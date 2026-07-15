"""Background daemon that polls CRM inbox, classifies emails, and takes actions."""

from __future__ import annotations

import html
import json
import logging
import os
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None  # fallback to UTC if unavailable

logger = logging.getLogger("mail_scanner")

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data" / "mail_scanner"
DATA_DIR.mkdir(parents=True, exist_ok=True)

PROCESSED_IDS_FILE = DATA_DIR / "processed_ids.json"
LOG_FILE = DATA_DIR / "log.jsonl"
CONTRACTORS_FILE = DATA_DIR / "contractors.json"
CACHED_TAGS_FILE = DATA_DIR / "cached_tags.json"
FEEDBACK_FILE = DATA_DIR / "feedback.jsonl"

DEFAULT_CONTRACTORS = {
    "contractors": [
        {
            "id": "baney",
            "name": "Baney Construction",
            "crm_contact_name": "Baney Construction",
            "email_domains": ["baneyconstruction.online", "baney.estimates@outlook.com"],
            "action": "create_deal_and_tasks",
            "responsible": "ken",
        },
        {
            "id": "aplus",
            "name": "A-Plus Restoration GC",
            "crm_contact_name": "A Plus Restoration GC",
            "email_domains": ["aplus.estimates@outlook.com", "aplusgcusa@gmail.com"],
            "action": "create_deal_and_tasks",
            "responsible": "ken",
        },
        {
            "id": "liberty",
            "name": "Liberty Restoration",
            "crm_contact_name": "Liberty Restoration",
            "email_domains": ["libertyrg.com"],
            "forwarded_from_domains": ["ken.chapman@libertyrg.com"],
            "action": "create_tasks_only",
            "responsible": "ken",
            "contact_id": "",  # set to Liberty Restoration Group contact UUID to link mention tasks
        },
        {
            "id": "highland",
            "name": "Highland Adjusters",
            "crm_contact_name": "Highland Adjusters",
            "email_domains": ["highlandadjusters.com", "jobnimbusmail.com"],
            "forwarded_from_domains": ["ken.chapman@libertyrg.com"],
            "action": "create_tasks_only",
            "responsible": "ken",
            "contact_id": "",  # set to Liberty Restoration Group contact UUID (same company)
        },
    ],
    "insurance_carriers": [
        "Allstate", "State Farm", "Westbend", "Country", "Farmers Insurance",
        "Liberty Mutual", "Chubb", "Rockford Mutual", "Westfield",
        "Auto Owners", "Travelers", "Shelter", "USAA", "Progressive",
    ],
    "review_assignees": ["rebeca", "claudiu"],
    "new_deal_assignees": ["rebeca", "claudiu"],
    "assignee_rules": {
        "jobnimbus_task": ["ken"],
        "jobnimbus_new_job": ["ken"],
        "jobnimbus_mention_est": ["ken"],
        "jobnimbus_mention": ["rebeca"],
        "supplement_new_project": ["rebeca", "claudiu"],
        "supplement_request": ["ken", "claudiu"],
        "new_potential": ["rebeca", "claudiu"],
        "reconciliation": ["ken", "claudiu"],
        "adjuster_action": ["ken", "claudiu"],
        "carrier_email": ["rebeca"],
        "carrier_email_notify": ["rebeca"],
        "supplement_discussion_request": ["ken", "claudiu"],
        "acculynx_other": ["rebeca", "claudiu"],
        "uncertain": ["rebeca"],
    },
}

# Canonical tag titles fetched from CRM on startup
TAG_MISSING_INFO = "Missing Info"
TAG_NEEDS_RECONCILIATION = "Needs reconciliation"
TAG_NEEDS_REBUTTAL = "NEEDS REBUTTAL"
TAG_PAUSE_CALLING = "PAUSE CALLING"
TAG_BOT_REVIEW = "Bot Review"

# Cached id of the "Bot Review" mail tag for the scanner account (resolved at runtime)
_BOT_REVIEW_MAIL_TAG_ID: int | None = None

# When True (set for Liberty/Highland origin JN emails), _dedup_opportunity returns no match.
# Policy: these emails are scanned only for task creation context; no deals exist for them in CRM.
_SKIP_DEAL_DEDUP_FOR_LH: bool = False

# Env-based config (set by server.py before starting scanner)
PORTAL_URL = ""
SCANNER_CRM_EMAIL = ""
SCANNER_CRM_PASSWORD = ""
SCANNER_POLL_INTERVAL = 120
SCANNER_ENABLED = True
SCANNER_CREATE_DEALS = False
SCANNER_CREATE_TASKS = False
SCANNER_POST_NOTES = False
SCANNER_NOTIFY_USERS = False
STAGE_NEW_SUPPLEMENT = 18
STAGE_FLAT_RATE = 17
USER_KEN = ""
USER_REBECA = ""
USER_CLAUDIU = ""
FIELD_CLAIM_NUMBER = 11
FIELD_CRM_JOB_ID = 26
FIELD_ADDRESS = 4
TASK_CAT_ESTIMATE = 34
TASK_CAT_FOLLOW_UP = 35
SSL_VERIFY = True

# ML configuration (Phase 5 — sentence-transformers start)
# ML_ENABLED configurable via env var: ML_ENABLED=true/1/yes to enable
ML_ENABLED = os.environ.get("ML_ENABLED", "false").lower() in ("true", "1", "yes")
ML_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
ML_MODEL_DIR = DATA_DIR / "ml_models"
ML_EMBED_DIM = 384  # all-MiniLM-L6-v2 output dimension

# Lazy-loaded ML objects (None until _init_ml() succeeds)
_ml_model = None
_ml_head = None  # fitted classifier head (logistic/kNN) or None


def _init_ml() -> bool:
    """Lazily load the sentence-transformers model and classifier head.
    Returns True if ML is ready; logs and returns False on any failure.
    """
    global _ml_model, _ml_head
    if not ML_ENABLED:
        return False
    if _ml_model is not None:
        return True
    try:
        from sentence_transformers import SentenceTransformer
        _ml_model = SentenceTransformer(ML_MODEL_NAME, cache_folder=str(ML_MODEL_DIR))
        # Try loading a fitted head (pickle)
        head_path = ML_MODEL_DIR / "classifier_head.pkl"
        if head_path.exists():
            try:
                import pickle
                with open(head_path, "rb") as f:
                    _ml_head = pickle.load(f)
                logger.info("ML classifier head loaded from %s", head_path)
            except Exception as e:
                logger.warning("Failed to load ML classifier head: %s", e)
                _ml_head = None
        else:
            logger.info("No classifier head found at %s; ML will return embeddings only", head_path)
        logger.info("ML initialized: model=%s, head=%s", ML_MODEL_NAME, type(_ml_head).__name__ if _ml_head else None)
        return True
    except ImportError:
        logger.info("ML dependencies not installed (sentence-transformers/torch). ML disabled.")
        return False
    except Exception as e:
        logger.warning("ML init failed: %s", e)
        return False


def _ml_embed(text: str) -> list[float] | None:
    """Embed a single text string using the loaded model. Returns None if ML not ready."""
    if _ml_model is None:
        return None
    try:
        vec = _ml_model.encode(text, normalize_embeddings=True)
        return vec.tolist()
    except Exception:
        return None


def _ml_classify(subject: str, body: str) -> dict[str, Any] | None:
    """Run ML classification on subject+body. Returns dict with ml_actionable_score,
    ml_category, ml_embedding (or None for each if ML not ready).
    Deterministic rules remain primary; ML is a tie-breaker/weak signal only.
    """
    if not ML_ENABLED or _ml_model is None:
        return None
    try:
        # Embed subject + body concatenated
        text = f"{subject}\n\n{body[:1500]}"
        embedding = _ml_embed(text)
        if embedding is None:
            return None

        result: dict[str, Any] = {
            "ml_embedding": embedding[:8],  # store first 8 dims for debugging (full 384-dim too large for log)
            "ml_actionable_score": None,
            "ml_category": None,
        }

        if _ml_head is not None:
            import numpy as np
            X = np.array([embedding])
            proba = None
            try:
                proba = _ml_head.predict_proba(X)[0]
            except Exception:
                pass
            if proba is not None and len(proba) >= 2:
                # Binary head: [not_actionable, actionable]
                result["ml_actionable_score"] = round(float(proba[1]), 4)
                result["ml_category"] = "actionable" if proba[1] >= 0.5 else "record"
            else:
                # Multi-class head: try to map to our categories
                pred = _ml_head.predict(X)[0]
                result["ml_category"] = str(pred)
        return result
    except Exception as e:
        logger.debug("ML classify error: %s", e)
        return None


# ML Override Confidence Thresholds (Phase 6: full override)
ML_OVERRIDE_STRONG_THRESHOLD = 0.8   # Force override (suppress/force action)
ML_OVERRIDE_SOFT_THRESHOLD = 0.6     # Soft override (add Bot Review flag)
ML_PROMOTE_THRESHOLD = 0.7           # Promote uncertain to actionable


def _apply_ml_override(log_entry: dict, classification: str, match_strength: str,
                       do_create_tasks: bool, do_post_notes: bool, is_record: bool) -> dict:
    """Apply ML-based overrides to the log entry after rule engine decisions.
    
    Full override mode: ML can suppress tasks, promote uncertain emails, and
    demote weak matches. Returns the modified log_entry.
    
    Override rules:
    1. ml_category == "ack" AND rule created task → suppress task creation
    2. ml_category == "record" AND dedup_reason == "owner_name_title" → demote to weak
    3. ml_category == "actionable" AND ml_actionable_score > ML_PROMOTE_THRESHOLD
       AND classification == "uncertain" → create task instead of Bot Review only
    4. ml_actionable_score < 0.2 AND rule would post note → suppress note
    """
    if not ML_ENABLED or _ml_model is None:
        return log_entry
    
    ml_category = log_entry.get("ml_category")
    ml_score = log_entry.get("ml_actionable_score")
    dedup_reason = log_entry.get("dedup_reason", "")
    
    if not ml_category:
        return log_entry
    
    override_applied = False
    override_reasons = []
    
    # Rule 1: Suppress tasks for ack emails (fixes 39978 false positives)
    if ml_category == "ack" and do_create_tasks:
        # Mark that ML would suppress this task
        log_entry["ml_override_suppress_task"] = True
        override_applied = True
        override_reasons.append("ack_suppress_task")
    
    # Rule 2: Demote owner_name_title matches in record context (fixes 961/872/1136)
    if ml_category == "record" and dedup_reason.startswith("owner_name_title"):
        if is_record:
            # Already demoted by _dedup_opportunity (is_record=True), but mark for logging
            log_entry["ml_override_demoted_owner"] = True
            override_applied = True
            override_reasons.append("record_demote_owner")
        else:
            # Even outside record context, ML says this is record-like — demote
            log_entry["ml_override_demoted_owner"] = True
            override_applied = True
            override_reasons.append("record_demote_owner_global")
    
    # Rule 3: Promote uncertain emails to actionable
    if (ml_category == "actionable" and ml_score is not None 
            and ml_score > ML_PROMOTE_THRESHOLD and classification == "uncertain"):
        log_entry["ml_override_promote"] = True
        override_applied = True
        override_reasons.append("promote_uncertain")
    
    # Rule 4: Suppress notes for very low-confidence emails
    if ml_score is not None and ml_score < 0.2 and do_post_notes:
        log_entry["ml_override_suppress_note"] = True
        override_applied = True
        override_reasons.append("suppress_low_confidence_note")
    
    # Log the override
    if override_applied:
        log_entry["ml_override_applied"] = True
        log_entry["ml_override_reasons"] = override_reasons
        logger.info("ML override applied: %s (score=%.3f, category=%s)", override_reasons, ml_score, ml_category)
    
    return log_entry


# List of custom field IDs (numeric) whose stored value match on a harvested code
# makes the dedup match "strong".
# Includes: claim #, CRM Job/ID, policy #, address, customer phone, "Claim codes" custom field, etc.
# Override/add in contractors.json:
#   "strong_custom_field_ids": [26, 11, 12, 4, 2]
#   "phone_custom_field_ids": [2]   # fields that hold phones (optional; if empty we scan all CFs for phones)
STRONG_CUSTOM_FIELD_IDS = [26, 11, 12, 4, 2]
PHONE_CUSTOM_FIELD_IDS = [2]

def _effective_strong_custom_field_ids() -> list[int]:
    cfg = get_contractors() or {}
    raw = cfg.get("strong_custom_field_ids") or STRONG_CUSTOM_FIELD_IDS
    out: list[int] = []
    for x in raw:
        try:
            out.append(int(x))
        except (ValueError, TypeError):
            pass
    return out or [11, 26, 4]

def _effective_phone_custom_field_ids() -> list[int]:
    cfg = get_contractors() or {}
    raw = cfg.get("phone_custom_field_ids") or PHONE_CUSTOM_FIELD_IDS
    out: list[int] = []
    for x in raw:
        try:
            out.append(int(x))
        except (ValueError, TypeError):
            pass
    return out


def _norm_claim(c: str) -> str:
    """Normalize claim code for matching (strip non-alphanum, upper)."""
    return re.sub(r"[^A-Za-z0-9]", "", (c or "")).upper()


def _get_mailboxes() -> dict[str, Any]:
    cfg = get_contractors() or {}
    mb = cfg.get("mailboxes") or {}
    return {
        "record": mb.get("record") or {"email": "crm@vanguardadj.online", "mailboxId": 21},
        "action": mb.get("action") or {"email": "requests@sherwoodestimates.com", "mailboxId": 20},
    }


def _get_email_history_category_id() -> int:
    cfg = get_contractors() or {}
    return int(cfg.get("email_history_category_id") or 39)


def _get_sending_domains() -> list[str]:
    cfg = get_contractors() or {}
    doms = list(cfg.get("sending_domains") or [])
    for c in cfg.get("contractors", []):
        for d in c.get("email_domains", []):
            dl = d.lower().strip()
            if dl and (dl not in doms):
                doms.append(dl)
    # keep unique lower
    seen = set()
    out = []
    for d in doms:
        dl = d.lower().strip()
        if dl and dl not in seen:
            seen.add(dl)
            out.append(dl)
    return out


def _extract_email_addresses(val: Any) -> str:
    """Extract email address strings from various CRM API 'to' field formats."""
    if not val:
        return ""
    parts: list[str] = []
    if isinstance(val, str):
        parts.append(val)
    elif isinstance(val, list):
        for item in val:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                for k in ("email", "Email", "address", "Address"):
                    v = item.get(k)
                    if v:
                        parts.append(str(v))
            else:
                parts.append(str(item))
    elif isinstance(val, dict):
        for k in ("email", "Email", "address", "Address"):
            v = val.get(k)
            if v:
                parts.append(str(v))
    return " ".join(parts)


def _detect_mailbox(conv: dict[str, Any] | None, msg: dict[str, Any] | None, from_email: str) -> str:
    """Return 'record' | 'action' | 'unknown'."""
    rec = _get_mailboxes()["record"]
    act = _get_mailboxes()["action"]
    rec_email = (rec.get("email") or "").lower()
    act_email = (act.get("email") or "").lower()
    rec_mid = str(rec.get("mailboxId") or "")
    act_mid = str(act.get("mailboxId") or "")

    for src in (conv or {}, msg or {}):
        for k in ("mailboxId", "accountId", "mailbox", "account"):
            v = str(src.get(k) or "").lower()
            if rec_mid and rec_mid in v:
                return "record"
            if act_mid and act_mid in v:
                return "action"
        for tk in ("to", "To", "toAddress", "ToAddress", "recipients", "Recipients"):
            to_raw = src.get(tk)
            if not to_raw:
                continue
            to_l = _extract_email_addresses(to_raw).lower()
            if rec_email and rec_email in to_l:
                return "record"
            if act_email and act_email in to_l:
                return "action"

    # Heuristic from live research: contractor sending domain + to looks carrier-ish or contractor's own estimate addr
    senders = _get_sending_domains()
    frm = (from_email or "").lower()
    is_sender = any(s in frm for s in senders)
    if is_sender:
        to_parts: list[str] = []
        for src in (conv or {}, msg or {}):
            for tk in ("to", "To", "toAddress", "ToAddress", "recipients", "Recipients"):
                tv = src.get(tk)
                if tv:
                    to_parts.append(_extract_email_addresses(tv))
        to_l = " ".join(to_parts).lower()
        if any(x in to_l for x in ["@allstate", "@statefarm", "@claims", "estimates@", "baney", "aplus"]):
            return "record"
        subj = ((conv or msg or {}).get("subject") or "").strip()
        if re.match(r"^[A-Za-z0-9\-]{5,30}$", subj):
            return "record"

    # Fallback: if from address matches a known mailbox, classify by that (sent items)
    frm_l = (from_email or "").lower()
    if rec_email and rec_email in frm_l:
        return "record"
    if act_email and act_email in frm_l:
        return "action"

    return "unknown"


def _task_title_with_claim(claim_code: str, base: str, customer: str = "", requester: str = "") -> str:
    """Build consistent task title: claim — base — customer (requester?)."""
    parts = []
    c = (claim_code or "").strip()
    if c:
        parts.append(c)
    parts.append(base.strip())
    cust = (customer or "").strip()
    if cust:
        parts.append(cust)
    req = (requester or "").strip()
    if req and req.lower() not in (cust or "").lower():
        parts.append(req)
    return " — ".join(parts)


def _extract_requester_hint(from_email: str, body_text: str) -> str:
    """Best-effort short requester label for task titles."""
    if from_email:
        # take local part or domain hint
        if "@" in from_email:
            local = from_email.split("@")[0]
            if local and len(local) > 3:
                return local
    # first non-empty line that looks like a name/sender
    for ln in (body_text or "").splitlines():
        s = ln.strip()
        if s and not s.lower().startswith(("from:", "to:", "subject:", "sent:", "date:")):
            # truncate
            return s[:40]
    return ""


# Phrases that indicate a carrier has revised their estimate (reconciliation trigger)
ESTIMATE_REVISION_PHRASES = [
    "attached estimate",
    "approved estimate",
    "updated estimate",
    "estimate for review",
    "estimate as requested",
    "approved supplement",
    "revised the estimate",
    "revised estimate",
]

# Regex patterns (case-insensitive) for JobNimbus mentions from Liberty/Highland
# indicating customer wants estimate revised or new one created.
JOBNIMBUS_MENTION_ESTIMATE_PATTERNS = [
    r"revise.*estimate",
    r"revised.*estimate",
    r"update.*estimate",
    r"new estimate",
    r"estimate.*(revised|update|again|please|needed|required)",
    r"please.*(revise|new|update).*estimate",
    r"estimate attached",
    r"attached.*estimate",
]

# Ack / OOO / delay / receipt language (Phase 2 policy)
ACK_DELAY_PATTERNS = [
    r"\back(nowledg(e|ement)?)?\b",
    r"\breceipt\b",
    r"out of office",
    r"\booo\b",
    r"\bdelay(ed|ing)?\b",
    r"review.*(time|period|in|within)",
    r"will (review|respond|get back)",
    r"received your (email|message|request)",
    r"thank you for (your|the) (email|message)",
    r"we have received",
]

_cached_tags: list[dict[str, Any]] = []
_contractors_config: dict[str, Any] = {}
_crm_token: str = ""
_crm_token_expires: float = 0


def configure(**kwargs: Any) -> None:
    for k, v in kwargs.items():
        if k.upper() == k:
            globals()[k] = v
        else:
            globals()[k.upper()] = v

def configure_scanner_behavior(**kwargs: Any) -> dict[str, Any]:
    """Live update the action flags (dry-run toggles). No restart needed.
    Accepts keys like create_deals, create_tasks, post_notes, notify_users (bool).
    Also accepts SCANNER_CREATE_* form.
    Persists to contractors.json via caller if desired.
    """
    changed: dict[str, Any] = {}
    mapping = {
        "create_deals": "SCANNER_CREATE_DEALS",
        "create_tasks": "SCANNER_CREATE_TASKS",
        "post_notes": "SCANNER_POST_NOTES",
        "notify_users": "SCANNER_NOTIFY_USERS",
        "SCANNER_CREATE_DEALS": "SCANNER_CREATE_DEALS",
        "SCANNER_CREATE_TASKS": "SCANNER_CREATE_TASKS",
        "SCANNER_POST_NOTES": "SCANNER_POST_NOTES",
        "SCANNER_NOTIFY_USERS": "SCANNER_NOTIFY_USERS",
    }
    for k, v in kwargs.items():
        target = mapping.get(k) or mapping.get(k.upper())
        if target:
            val = bool(v)
            globals()[target] = val
            changed[target] = val
    # also update action_toggles if provided
    at = kwargs.get("action_toggles") or {}
    if isinstance(at, dict):
        cfg = get_contractors() or {}
        cfg["action_toggles"] = at
        update_contractors(cfg)
        changed["action_toggles"] = at
    return changed


def _is_action_enabled(name: str) -> bool:
    """Per-action toggle check with legacy fallback."""
    cfg = get_contractors() or {}
    at = cfg.get("action_toggles") or {}
    if isinstance(at, dict) and name in at:
        return bool(at.get(name))
    sb = cfg.get("scanner_behavior") or {}
    legacy_map = {
        "link_email": "create_tasks",
        "apply_bot_review_mail_tag": "create_tasks",
        "mark_read": "create_tasks",
    }
    key = legacy_map.get(name, name)
    return bool(sb.get(key, False))


def _is_dry_run() -> bool:
    """When true, the scanner must not perform any mutations.
    Respects legacy globals and any per-action toggles.
    """
    if SCANNER_CREATE_DEALS or SCANNER_CREATE_TASKS or SCANNER_POST_NOTES or SCANNER_NOTIFY_USERS:
        return False
    cfg = get_contractors() or {}
    at = cfg.get("action_toggles") or {}
    if isinstance(at, dict) and any(bool(v) for v in at.values()):
        return False
    return True


def _ssl_context() -> Any:
    if SSL_VERIFY:
        return None
    import ssl
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def _crm_api(method: str, path: str, body: bytes | None = None, query: str = "", timeout: int = 30, content_type: str | None = None) -> tuple[int, Any]:
    global _crm_token, _crm_token_expires

    if not _crm_token or time.time() >= _crm_token_expires:
        auth_body = json.dumps({"userName": SCANNER_CRM_EMAIL, "password": SCANNER_CRM_PASSWORD}).encode("utf-8")
        req = urllib.request.Request(
            f"{PORTAL_URL}/api/2.0/authentication.json",
            data=auth_body,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, context=_ssl_context(), timeout=20) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                _crm_token = (data.get("response") or data).get("token", "")
                _crm_token_expires = time.time() + 3000
        except Exception as e:
            logger.error("CRM auth failed: %s", e)
            return 502, {"error": "CRM auth failed"}

    url = f"{PORTAL_URL}{path}"
    if query:
        url = f"{url}?{query}"
    headers = {"Accept": "application/json", "Authorization": _crm_token}
    if body is not None:
        if content_type:
            headers["Content-Type"] = content_type
        elif "Content-Type" not in headers:
            headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, context=_ssl_context(), timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        data = exc.read()
        try:
            return exc.code, json.loads(data.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return exc.code, {"error": str(exc)}
    except urllib.error.URLError as exc:
        return 502, {"error": str(exc.reason)}


def _load_processed_state() -> dict[str, Any]:
    if PROCESSED_IDS_FILE.exists():
        try:
            data = json.loads(PROCESSED_IDS_FILE.read_text("utf-8"))
            ids = set(int(x) for x in (data.get("ids") or []))
            raw_sigs = data.get("sigs") or []
            if isinstance(raw_sigs, dict):
                # migrate old mixed dict format
                migrated = set()
                for k, v in raw_sigs.items():
                    if isinstance(v, str) and "|" in v:
                        migrated.add(v)
                    if isinstance(k, str) and "|" in k:
                        migrated.add(k)
                raw_sigs = list(migrated)
            seen_sigs = set(s for s in (raw_sigs or []) if isinstance(s, str) and "|" in s)
            return {"ids": ids, "sigs": seen_sigs}
        except (json.JSONDecodeError, OSError, TypeError, ValueError):
            return {"ids": set(), "sigs": set()}
    return {"ids": set(), "sigs": set()}


def _save_processed_state(state: dict[str, Any]) -> None:
    try:
        ids = sorted(int(x) for x in (state.get("ids") or []))
        raw_sigs = state.get("sigs") or []
        if isinstance(raw_sigs, (set, list)):
            sigs_list = sorted(set(s for s in raw_sigs if isinstance(s, str) and "|" in s))
        elif isinstance(raw_sigs, dict):
            # legacy migration
            sigs_list = sorted(set(
                v for v in raw_sigs.values() if isinstance(v, str) and "|" in v
            ) | set(k for k in raw_sigs.keys() if isinstance(k, str) and "|" in k))
        else:
            sigs_list = []
        PROCESSED_IDS_FILE.write_text(json.dumps({"ids": ids, "sigs": sigs_list}, indent=2), "utf-8")
    except OSError as e:
        logger.error("Failed to save processed state: %s", e)


def _load_processed_ids() -> set[int]:
    return _load_processed_state()["ids"]


def _save_processed_ids(ids: set[int]) -> None:
    st = _load_processed_state()
    st["ids"] = set(ids)
    _save_processed_state(st)


# === DEPLOYMENT SAFEGUARD ===
# Purpose: On the very first run after deployment (when processed_ids.json does not exist),
# record all currently visible conversations as already processed WITHOUT taking any actions
# (no tasks, notes, deals, tags). This guarantees the scanner only acts on emails that
# arrive AFTER this deployment, preventing duplication of work humans have already done.
#
# HOW TO USE:
# - During local/dev testing: LEAVE THE CALL COMMENTED OUT below. This lets you see
#   the classifier act on the current inbox (useful for verifying new rules like
#   jobnimbus_mention_est).
# - Before the GitHub commit that enables real scanner actions in production:
#   1. Uncomment the seed block in _scanner_loop() below.
#   2. (Recommended) On the production droplet, remove any existing processed_ids.json
#      from testing so the seed runs against the exact inbox state at go-live time.
#
# The seed logic itself is always present; only the call site is what gets toggled.
def _seed_existing_conversations_as_processed() -> None:
    logger.info("DEPLOYMENT SEED: No processed_ids.json found. Seeding current inbox IDs with NO actions taken.")
    status, data = _crm_api("GET", "/api/2.0/mail/conversations.json", query="folder=1&page_size=100&sort=date&sortorder=descending")
    if status >= 400:
        logger.error("DEPLOYMENT SEED FAILED (status %s). Manual review of processed_ids.json recommended.", status)
        return
    conversations = data.get("response") or data.get("result") or data
    if not isinstance(conversations, list):
        logger.warning("DEPLOYMENT SEED: unexpected response format")
        return
    ids: set[int] = set()
    for conv in conversations:
        cid = conv.get("id") or conv.get("ID")
        if cid is not None:
            try:
                ids.add(int(cid))
            except (TypeError, ValueError):
                pass
    _save_processed_ids(ids)
    logger.info("DEPLOYMENT SEED complete: marked %s existing conversations as processed. Only future emails will trigger actions.", len(ids))


def _append_log_entry(entry: dict[str, Any]) -> None:
    try:
        if isinstance(entry, dict):
            cc = entry.get("claim_code")
            if cc and not entry.get("normalized_claim"):
                entry["normalized_claim"] = _norm_claim(cc)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except OSError as e:
        logger.error("Failed to write log entry: %s", e)
    # Track emails that may need human review/feedback for retraining.
    _maybe_record_feedback_candidate(entry)


def _maybe_record_feedback_candidate(entry: dict[str, Any]) -> None:
    if not isinstance(entry, dict):
        return
    flagged = bool(entry.get("apply_bot_review_mail")) or bool(entry.get("ml_override_applied"))
    if not flagged:
        return
    try:
        record_feedback_candidate(entry)
    except Exception as e:
        logger.warning("Failed to record feedback candidate: %s", e)


def _append_feedback_entry(entry: dict[str, Any]) -> None:
    """Append a feedback record to feedback.jsonl."""
    try:
        entry.setdefault("timestamp", _now_et_iso())
        with open(FEEDBACK_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except OSError as e:
        logger.error("Failed to write feedback entry: %s", e)


def record_feedback_candidate(log_entry: dict[str, Any]) -> None:
    """Record an email that the bot had trouble with so a user can later confirm/correct it.

    Called whenever the bot applies a Bot Review mail tag or an ML override changes the
    planned action.  The candidate stores the bot's decision + email text so it can be
    used as a labeled training example once a user reviews it.
    """
    if not isinstance(log_entry, dict):
        return
    cid = log_entry.get("conversation_id") or log_entry.get("crm_message_id")
    if not cid:
        return
    # Avoid duplicate candidates for the same conversation within the same run.
    # We do this by checking if a candidate for this conversation already exists.
    existing = get_feedback_entries(limit=1000)
    for e in existing:
        if str(e.get("conversation_id")) == str(cid) and e.get("user_verdict") is None:
            return
    candidate = {
        "conversation_id": cid,
        "message_id": log_entry.get("crm_message_id"),
        "subject": log_entry.get("subject"),
        "from": log_entry.get("from"),
        "classification": log_entry.get("classification"),
        "match_strength": log_entry.get("match_strength"),
        "bot_action": log_entry.get("actions_taken") or log_entry.get("action_taken"),
        "linked_opp_id": log_entry.get("linked_opp_id"),
        "linked_opp_title": log_entry.get("linked_opp_title"),
        "ml_override_applied": bool(log_entry.get("ml_override_applied")),
        "ml_override_reasons": log_entry.get("ml_override_reasons") or [],
        "ml_actionable_score": log_entry.get("ml_actionable_score"),
        "ml_ack_score": log_entry.get("ml_ack_score"),
        "source_inbox": log_entry.get("source_inbox"),
        "email_text": (log_entry.get("sanitized_text") or log_entry.get("email_text") or "")[:2000],
        "user_verdict": None,
        "user_correction": None,
        "correct_classification": None,
        "correct_opp_id": None,
        "correct_opp_title": None,
        "reviewed_at": None,
    }
    _append_feedback_entry(candidate)


def store_user_feedback(payload: dict[str, Any]) -> dict[str, Any]:
    """Store a user correction for a bot decision.

    payload keys:
      - conversation_id (required)
      - user_verdict: "correct" or "wrong"
      - user_correction: optional class label chosen by the user
      - correct_classification: optional — the rule the user says should have matched
      - correct_opp_id: optional — the deal ID the user says it should link to
      - correct_opp_title: optional — title of the correct deal (for display)
      - notes: optional free-form reviewer notes
    """
    if not isinstance(payload, dict):
        raise ValueError("payload must be a dict")
    cid = payload.get("conversation_id")
    if not cid:
        raise ValueError("conversation_id required")
    verdict = (payload.get("user_verdict") or "").lower()
    if verdict not in ("correct", "wrong"):
        raise ValueError("user_verdict must be 'correct' or 'wrong'")
    # Update existing candidate if present; otherwise append a new record.
    updated = False
    entries: list[dict[str, Any]] = []
    if FEEDBACK_FILE.exists():
        try:
            with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if str(entry.get("conversation_id")) == str(cid) and entry.get("user_verdict") is None:
                        entry["user_verdict"] = verdict
                        entry["user_correction"] = payload.get("user_correction")
                        entry["correct_classification"] = payload.get("correct_classification")
                        entry["correct_opp_id"] = payload.get("correct_opp_id")
                        entry["correct_opp_title"] = payload.get("correct_opp_title")
                        entry["reviewer_notes"] = payload.get("notes")
                        entry["reviewed_at"] = _now_et_iso()
                        updated = True
                    entries.append(entry)
        except OSError as e:
            logger.error("Failed to read feedback file: %s", e)
    if not updated:
        entries.append({
            "conversation_id": cid,
            "message_id": payload.get("message_id"),
            "subject": payload.get("subject"),
            "from": payload.get("from"),
            "classification": payload.get("classification"),
            "user_verdict": verdict,
            "user_correction": payload.get("user_correction"),
            "correct_classification": payload.get("correct_classification"),
            "correct_opp_id": payload.get("correct_opp_id"),
            "correct_opp_title": payload.get("correct_opp_title"),
            "reviewer_notes": payload.get("notes"),
            "reviewed_at": _now_et_iso(),
        })
    try:
        with open(FEEDBACK_FILE, "w", encoding="utf-8") as f:
            for entry in entries:
                f.write(json.dumps(entry) + "\n")
    except OSError as e:
        logger.error("Failed to write feedback file: %s", e)
        raise
    return {"ok": True, "updated": updated}


def get_feedback_entries(limit: int = 200) -> list[dict[str, Any]]:
    """Return recent feedback entries, newest first."""
    entries: list[dict[str, Any]] = []
    if FEEDBACK_FILE.exists():
        try:
            with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entries.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
        except OSError as e:
            logger.error("Failed to read feedback file: %s", e)
    entries.reverse()
    return entries[:limit]


def _now_et_iso() -> str:
    """Return current time as ISO string in US Eastern (America/New_York). Fallback to UTC."""
    if ZoneInfo:
        try:
            tz = ZoneInfo("America/New_York")
            return datetime.now(tz).isoformat()
        except Exception:
            pass
    return datetime.now(timezone.utc).isoformat()


def _load_contractors() -> dict[str, Any]:
    global _contractors_config
    if CONTRACTORS_FILE.exists():
        try:
            loaded = json.loads(CONTRACTORS_FILE.read_text("utf-8"))
            # Merge with defaults to ensure new keys (e.g. scanner_identity) exist
            base = dict(DEFAULT_CONTRACTORS)
            base.update(loaded or {})
            # scanner_identity may be empty object or absent — keep as-is if present
            _contractors_config = base
            return _contractors_config
        except (json.JSONDecodeError, OSError):
            pass
    _contractors_config = dict(DEFAULT_CONTRACTORS)
    _save_contractors()
    return _contractors_config


def _save_contractors() -> None:
    try:
        CONTRACTORS_FILE.write_text(json.dumps(_contractors_config, indent=2), "utf-8")
    except OSError as e:
        logger.error("Failed to save contractors: %s", e)


def get_contractors() -> dict[str, Any]:
    return _contractors_config or _load_contractors()


def update_contractors(data: dict[str, Any]) -> dict[str, Any]:
    global _contractors_config
    _contractors_config = data
    _save_contractors()
    return _contractors_config


def _fetch_tag_cache() -> list[dict[str, Any]]:
    global _cached_tags
    status, data = _crm_api("GET", "/api/2.0/crm/opportunity/tag")
    if status < 400:
        tags = (data.get("response") or data.get("result") or data)
        if isinstance(tags, list):
            _cached_tags = tags
            try:
                CACHED_TAGS_FILE.write_text(json.dumps(tags, indent=2), "utf-8")
            except OSError:
                pass
            return tags
    if CACHED_TAGS_FILE.exists():
        try:
            _cached_tags = json.loads(CACHED_TAGS_FILE.read_text("utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return _cached_tags


def _get_canonical_tag(title: str) -> str:
    for t in _cached_tags:
        if t.get("title", "").lower() == title.lower():
            return t["title"]
    return title


def _sanitize_body(html_body: str) -> str:
    text = re.sub(r"<script[^>]*>.*?</script>", "", html_body, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<iframe[^>]*>.*?</iframe>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<object[^>]*>.*?</object>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</p>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</div>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</tr>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = text.strip()
    text = text[:10000]
    text = html.escape(text)
    return text


def _most_recent_body(msg: dict[str, Any]) -> str:
    """Return the most recent (top) sanitized body for Email notes.
    Strips quoted/replied/forwarded older content heuristically.
    """
    html = msg.get("htmlBody") or ""
    intro = msg.get("introduction") or ""
    base = intro or ( _sanitize_body(html) if html else "" )
    if not base:
        return ""
    # Cut at common reply/forward markers
    for marker in (r"[-_= \t]*forwarded message[-_= \t]*", r"[-_= \t]*original message[-_= \t]*", r"^On .*wrote:$", r"^From:.*$"):
        m = re.search(marker, base, re.IGNORECASE | re.MULTILINE)
        if m:
            base = base[:m.start()].strip()
            break
    # Also cut at the first ">" quoted line block if it appears early
    lines = base.splitlines()
    clean_lines = []
    for ln in lines:
        if ln.strip().startswith(">"):
            break
        clean_lines.append(ln)
    base = "\n".join(clean_lines).strip()
    return base[:4000]  # keep Email notes reasonable size


def _extract_claimant_from_body(body_text: str) -> str:
    lines = [l.strip() for l in body_text.split("\n") if l.strip()]
    if lines:
        first_line = lines[0].strip()
        if first_line and not first_line.startswith("From:") and not first_line.startswith("Subject:"):
            return first_line
    return ""


def _email_intro_text(msg: dict[str, Any]) -> str:
    intro = msg.get("introduction") or ""
    if intro:
        return intro
    html_body = msg.get("htmlBody") or ""
    if html_body:
        return _sanitize_body(html_body)
    return ""


def _clean_jn_body(body_text: str, conv_id: int | None = None) -> str:
    """Strip forwarded/reply/JobNimbus automation headers and append a mail deep link.
    Returns a concise description suitable for task bodies.
    """
    s = body_text or ""
    # Hard cut at the first Forwarded/Original Message marker (handles jammed single-line forms with no newlines)
    for marker in (r"[-_= \t]*forwarded message[-_= \t]*", r"[-_= \t]*original message[-_= \t]*"):
        m = re.search(marker, s, re.IGNORECASE)
        if m:
            s = s[:m.start()].strip()
            break
    # Remove any surviving header lines (Subject/Date/From etc)
    s = re.sub(r"(?im)^[\s\t]*(from|to|cc|date|sent|subject):\s*.*$", "", s)
    # Remove JobNimbus automation lines and lone jobnimbus urls
    s = re.sub(r"(?im)^[\s\t]*automation \(contact\) via jobnimbus.*$", "", s)
    s = re.sub(r"(?im)^[\s\t]*via jobnimbus.*$", "", s)
    s = re.sub(r"(?im)^[\s\t]*https?://[^\s]*jobnimbus[^\s]*\s*$", "", s)
    # Collapse whitespace
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s).strip()
    # Trim overly long
    if len(s) > 900:
        s = s[:900].rstrip() + "…"
    # Append clickable mail link if we have a conv id
    if conv_id is not None:
        link = f"{PORTAL_URL}/addons/mail/Default.aspx#conversation/{conv_id}" if PORTAL_URL else f"#conversation/{conv_id}"
        s = (s + "\n\n" if s else "") + f"Mail: {link}"
    return s.strip()


def _fetch_message(conversation_id: int, message_id_field: str | None = None) -> dict[str, Any] | None:
    status, data = _crm_api("GET", f"/api/2.0/mail/messages/{conversation_id}.json")
    if status < 400:
        msg = data.get("response") or data.get("result") or data
        if isinstance(msg, dict):
            return msg
    return None


def _parse_conv_timestamp(conv: dict[str, Any]) -> str:
    """Return a best-effort ISO-ish timestamp string for a conversation (ET preferred)."""
    for k in ("receivedDate", "chainDate", "date"):
        v = conv.get(k)
        if not v:
            continue
        if isinstance(v, str):
            return v
        if isinstance(v, dict) and v.get("value"):
            return str(v["value"])
    return ""


def _conv_signature(conv: dict[str, Any], body_text: str | None = None) -> str:
    """Stable signature for content-based dedup: claim-ish + from + coarse date + short body hash."""
    claim = (_extract_claim_code(conv.get("subject") or "") or "").lower()
    frm = ((conv.get("from") or conv.get("sender") or "") or "").strip().lower()
    ts = _parse_conv_timestamp(conv)
    dpart = ""
    try:
        dpart = (ts or "")[:10]
    except Exception:
        dpart = ""
    body = (body_text or "")[:400].lower()
    import hashlib
    h = hashlib.sha1((claim + "|" + frm + "|" + dpart + "|" + body).encode("utf-8", errors="ignore")).hexdigest()[:12]
    return f"{claim}|{frm}|{dpart}|{h}"


def _extract_claim_code(subject: str) -> str:
    # Strip common forward/reply prefixes so "Fwd: 0825006406" yields the code
    s = re.sub(r'^(Fwd:|FW:|Re:|RE:)\s*:?\s*', '', subject, flags=re.IGNORECASE).strip()
    m = re.match(r"^[A-Za-z0-9\-]{5,30}$", s)
    if m:
        return _norm_claim(m.group(0))
    m = re.search(r"(\b[A-Za-z0-9]{5,20}\b)", s)
    if m:
        return _norm_claim(m.group(1))
    return ""


def _find_claim_codes(text: str) -> list[str]:
    """Find plausible claim codes anywhere in subject or body (strip fwd etc)."""
    codes: list[str] = []
    # First try after stripping fwd/re etc on each line-ish token
    for raw in re.split(r"[\s\n:]+", text or ""):
        s = re.sub(r'^(Fwd:|FW:|Re:|RE:)\s*:?\s*', '', raw, flags=re.IGNORECASE).strip()
        if re.match(r"^[A-Za-z0-9\-]{5,30}$", s):
            codes.append(s)
        else:
            m = re.search(r"\b([A-Za-z0-9]{5,20})\b", s)
            if m:
                codes.append(m.group(1))
    # Dedup preserve order
    seen = set()
    out = []
    for c in codes:
        if c and c not in seen:
            seen.add(c)
            out.append(c)
    return out


def _extract_job_id(subject: str, body_text: str) -> str:
    m = re.search(r"(?:Job|job):?\s*([A-Z]{2}\s*-?\s*\d+)", subject + "\n" + body_text)
    if m:
        return m.group(1).strip()
    return ""


def _normalize_phone(p: str) -> str:
    """Return 10-digit normalized phone or empty."""
    if not p:
        return ""
    digits = re.sub(r"\D", "", p)
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    return digits if len(digits) == 10 else ""


def _norm_claim(c: str) -> str:
    """Normalize claim code for matching (strip dashes, upper)."""
    return re.sub(r"[^A-Za-z0-9]", "", (c or "")).upper()


def _find_phones(text: str) -> list[str]:
    """Extract normalized 10-digit phones from text."""
    raw = re.findall(r"(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})", text or "")
    out: list[str] = []
    seen = set()
    for r in raw:
        n = _normalize_phone(r)
        if n and n not in seen:
            seen.add(n)
            out.append(n)
    return out


def _find_owner_name_candidates(text: str) -> list[str]:
    """Extract plausible owner last names / full names from subject/body.
    Deal titles are typically the property owner name.
    """
    cands: list[str] = []
    s = text or ""
    # "Last, First" or "Last, First M"
    for m in re.finditer(r"\b([A-Z][a-zA-Z\-']+),\s*([A-Z][a-zA-Z\-']+)", s):
        last = m.group(1)
        cands.append(last)
        cands.append(f"{last}, {m.group(2)}")
    # Bare last name-ish tokens that are capitalized and not common words
    for m in re.finditer(r"\b([A-Z][a-zA-Z\-']{2,})\b", s):
        tok = m.group(1)
        if tok.lower() not in ("fwd", "fw", "re", "the", "and", "for", "claim", "policy", "job", "estimate", "supplement"):
            cands.append(tok)
    # Full "First Last" early in strings (e.g. first line of body)
    for m in re.finditer(r"^\s*([A-Z][a-z]+)\s+([A-Z][a-zA-Z\-']+)", s, re.M):
        cands.append(m.group(2))
        cands.append(f"{m.group(1)} {m.group(2)}")
    # dedup preserve order
    seen = set()
    out = []
    for c in cands:
        cl = c.lower()
        if cl not in seen:
            seen.add(cl)
            out.append(c)
    return out[:8]  # limit noise


def _search_opportunities(query: str) -> list[dict[str, Any]]:
    status, data = _crm_api("GET", "/api/2.0/crm/opportunity/filter", query=f"filterValue={urllib.parse.quote(query)}")
    if status < 400:
        opps = data.get("response") or data.get("result") or data
        if isinstance(opps, list):
            return opps
    return []


def _get_custom_field(opp: dict[str, Any], field_id: int) -> str:
    for cf in opp.get("customFieldList", opp.get("CustomFieldList", [])):
        if cf.get("id") == field_id or cf.get("ID") == field_id:
            val = cf.get("value") or cf.get("Value") or ""
            if isinstance(val, str):
                return val.strip()
            if isinstance(val, (int, float)):
                return str(val)
    return ""


def _extract_address_from_body(body: str) -> str:
    lines = [l.strip() for l in body.split("\n") if l.strip()]
    for line in lines:
        if re.search(r"\d{1,5}\s+[A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Circle|Cir|Blvd|Boulevard|Way|Terrace|Trl|Trail)[\s,]*[A-Z]{2}", line, re.IGNORECASE):
            return line.strip()
        if re.search(r"\d{1,5}\s+[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}", line):
            return line.strip()
    return ""


def _dedup_opportunity(claimant: str, job_id: str, claim_code: str, body_text: str, is_record: bool = False) -> tuple[dict[str, Any] | None, str, str]:
    """Return (opp or None, dedup_reason, match_strength).
    match_strength: "strong" (custom field hit) | "weak" | "none"

    First pass: use provided codes + body tokens.
    If no strong match, second pass: aggressively harvest more claim/job codes from body and re-search.
    Only "claim_custom:*" or "job_id_custom" count as strong.

    Special policy: when _SKIP_DEAL_DEDUP_FOR_LH is True (set for Liberty/Highland origin JN emails),
    we short-circuit and return (None, "lh_skip", "none") — these are never matched to CRM deals.

    Phase 6: owner_name_title demotion — when is_record=True, owner_name_title matches
    are demoted to weak (not strong). This prevents false matches on record inbox BCCs.
    """
    if _SKIP_DEAL_DEDUP_FOR_LH:
        return None, "lh_skip", "none"
    # Normalize claim/job for dash-insensitive matching (per plan)
    claim_code = _norm_claim(claim_code)
    job_id = _norm_claim(job_id)
    def _search_once(codes: list[str], jid: str, claimnt: str, btext: str) -> list[tuple[dict[str, Any], str]]:
        cands: list[tuple[dict[str, Any], str]] = []
        strong_ids = _effective_strong_custom_field_ids()

        # Job ID (if provided) against strong fields
        if jid:
            opps = _search_opportunities(jid)
            for opp in opps:
                hit = False
                for fid in strong_ids:
                    stored = _get_custom_field(opp, fid)
                    if stored and jid in stored:
                        cands.append((opp, f"strong_custom:{fid}"))
                        hit = True
                        break
                if not hit:
                    if jid.lower() in (opp.get("title") or "").lower():
                        cands.append((opp, "job_id_title"))
                    else:
                        cands.append((opp, "job_id_filter"))

        # Codes (claim, policy, job codes, claim-codes custom field, etc.) against strong fields
        for code in codes:
            opps = _search_opportunities(code)
            for opp in opps:
                hit = False
                for fid in strong_ids:
                    stored = _get_custom_field(opp, fid)
                    if stored and code in stored:
                        cands.append((opp, f"strong_custom:{fid}"))
                        hit = True
                        break
                if not hit:
                    if code.lower() in (opp.get("title") or "").lower():
                        cands.append((opp, f"claim_title:{code}"))
                    else:
                        cands.append((opp, f"claim_filter:{code}"))

        # Claimant / owner name search + address + title kw
        if claimnt:
            opps = _search_opportunities(claimnt)
            addr = _extract_address_from_body(btext)
            for opp in opps:
                title = (opp.get("title") or "").lower()
                if addr and addr.lower() in (_get_custom_field(opp, FIELD_ADDRESS).lower() or title):
                    cands.append((opp, "claimant_addr"))
                elif any(tok in title for tok in _find_claim_codes(claimnt + " " + btext) if len(tok) > 5):
                    cands.append((opp, "claimant_title_kw"))
                else:
                    cands.append((opp, "claimant_filter"))

        # Phones: search and verify in phone/strong custom fields
        phones = _find_phones(btext)
        phone_fids = _effective_phone_custom_field_ids() or strong_ids
        for ph in phones:
            opps = _search_opportunities(ph)
            for opp in opps:
                hit = False
                for fid in phone_fids:
                    val = _get_custom_field(opp, fid)
                    if ph in re.sub(r"\D", "", val or ""):
                        cands.append((opp, f"phone_custom:{fid}"))
                        hit = True
                        break
                if not hit and ph in re.sub(r"\D", "", (opp.get("title") or "")):
                    cands.append((opp, "phone_title"))

        # Owner name (deal title is owner name): if name appears in opp title, strong signal
        owner_names = _find_owner_name_candidates(claimnt + " " + btext)
        for nm in owner_names:
            if not nm or len(nm) < 3:
                continue
            opps = _search_opportunities(nm)
            nml = nm.lower()
            for opp in opps:
                t = (opp.get("title") or "").lower()
                if nml in t or any(part in t for part in nml.split() if len(part) >= 3):
                    cands.append((opp, "owner_name_title"))

        return cands

    codes_to_try: list[str] = []
    if claim_code:
        codes_to_try.append(claim_code)
    for c in _find_claim_codes(body_text):
        if c not in codes_to_try:
            codes_to_try.append(c)

    candidates = _search_once(codes_to_try, job_id or "", claimant or "", body_text or "")

    # Pick best from first pass
    def _pick_best(cands: list[tuple[dict[str, Any], str]]) -> tuple[dict[str, Any] | None, str]:
        if not cands:
            return None, "no_match"
        priority = {
            "strong_custom": 110,
            "phone_custom": 105,
            "owner_name_title": 102,
            "claim_custom": 100,
            "job_id_custom": 90,
            "claim_title": 70,
            "job_id_title": 65,
            "claimant_addr": 60,
            "claimant_title_kw": 55,
            "phone_title": 52,
            "claim_filter": 40,
            "claimant_filter": 30,
        }
        def score(item):
            _, reason = item
            for k, p in priority.items():
                if reason.startswith(k):
                    return p
            return 10
        cands = sorted(cands, key=score, reverse=True)
        return cands[0]

    best_opp, best_reason = _pick_best(candidates)

    # If no strong on first pass, second pass: harvest more aggressively from body
    is_strong = best_reason.startswith("claim_custom") or best_reason.startswith("job_id_custom")
    if not is_strong:
        # Second pass: pull every plausible code from full body text (more greedy)
        extra_codes: list[str] = []
        for tok in re.findall(r"\b([A-Za-z0-9][A-Za-z0-9\-]{4,25})\b", body_text or ""):
            t = tok.strip("-")
            if re.match(r"^[A-Za-z0-9\-]{5,30}$", t) and t not in codes_to_try and t not in extra_codes:
                extra_codes.append(t)
        # Also look for "Claim Number: 123", "Claim#: 123", "claim 123456" etc.
        for m in re.finditer(r"(?:claim|claim#|claim number|claim no\.?)\s*[:#]?\s*([A-Za-z0-9\-]{5,25})", (body_text or ""), re.IGNORECASE):
            val = m.group(1).strip()
            if val and val not in codes_to_try and val not in extra_codes:
                extra_codes.append(val)
        if extra_codes:
            candidates2 = _search_once(extra_codes, job_id or "", claimant or "", body_text or "")
            best2, reason2 = _pick_best(candidates2)
            if best2 and (
                reason2.startswith("strong_custom")
                or reason2.startswith("phone_custom")
                or reason2.startswith("owner_name_title")
                or reason2.startswith("claim_custom")
                or reason2.startswith("job_id_custom")
            ):
                best_opp, best_reason = best2, reason2
            elif not best_opp and best2:
                # fallback to whatever second pass found (will be weak)
                best_opp, best_reason = best2, reason2

    is_strong = best_reason.startswith("strong_custom") or best_reason.startswith("phone_custom") or (best_reason.startswith("owner_name_title") and not is_record)
    # Phase 6: owner_name_title demotion for record inbox contexts (per plan)
    # owner_name_title is NOT strong in record context — prevents false matches on BCC'd claim codes.
    strength = "strong" if is_strong else ("weak" if best_opp else "none")
    return best_opp, best_reason, strength


def _link_email_to_opportunity(conversation_id: int, opp_id: int) -> tuple[bool, int, str | None]:
    if not _is_action_enabled("link_email"):
        return False, 0, "dry_run"
    # Use the exact form-urlencoded payload that the working mail UI uses
    params = urllib.parse.urlencode({
        "id_message": str(conversation_id),
        "crm_contact_ids[0][Id]": str(opp_id),
        "crm_contact_ids[0][Type]": "3",
    })
    body = params.encode("utf-8")
    status, data = _crm_api("PUT", "/api/2.0/mail/conversations/crm/link.json", body=body, content_type="application/x-www-form-urlencoded")
    if status < 400:
        return True, status, None
    err = ""
    try:
        err = (data.get("error") or data.get("message") or str(data))[:300] if isinstance(data, dict) else str(data)[:300]
    except Exception:
        err = str(data)[:300]
    return False, status, err or f"status={status}"


def _mark_conversation_read(conversation_id: int) -> tuple[bool, int, str | None]:
    if not _is_action_enabled("mark_read"):
        return False, 0, "dry_run"
    # Use form-urlencoded exactly as the working mail UI does: ids[] + status=read
    body = urllib.parse.urlencode({"ids[]": str(conversation_id), "status": "read"}).encode("utf-8")
    status, data = _crm_api("PUT", "/api/2.0/mail/conversations/mark.json", body=body, content_type="application/x-www-form-urlencoded")
    if status < 400:
        return True, status, None
    err = ""
    try:
        err = (data.get("error") or data.get("message") or str(data))[:300] if isinstance(data, dict) else str(data)[:300]
    except Exception:
        err = str(data)[:300]
    return False, status, err or f"status={status}"


def _get_bot_review_mail_tag_id() -> int | None:
    """Fetch the numeric id of the 'Bot Review' mail tag for the current (shared reviewer) account.
    Caches the result.
    """
    global _BOT_REVIEW_MAIL_TAG_ID
    if _BOT_REVIEW_MAIL_TAG_ID is not None:
        return _BOT_REVIEW_MAIL_TAG_ID
    try:
        status, data = _crm_api("GET", "/api/2.0/mail/tags.json")
        if status < 400:
            tags = (data.get("response") or []) if isinstance(data, dict) else []
            tag_list = []
            for t in tags:
                tid = t.get("id") or t.get("Id") or t.get("ID")
                nm = (t.get("name") or t.get("Name") or t.get("label") or "").strip()
                if tid is not None:
                    tag_list.append((int(tid), nm))
                if nm.lower() == TAG_BOT_REVIEW.lower():
                    _BOT_REVIEW_MAIL_TAG_ID = int(tid) if tid is not None else None
                    logger.info("Found Bot Review mail tag id=%s for scanner account", _BOT_REVIEW_MAIL_TAG_ID)
                    return _BOT_REVIEW_MAIL_TAG_ID
            logger.info("Mail tags visible to scanner account (id, name): %s", tag_list[:20])
            if not any((nm or "").lower() == TAG_BOT_REVIEW.lower() for _, nm in tag_list):
                logger.warning("'Bot Review' tag not found in /mail/tags.json for this account. Create the tag in the Mail module (while logged in as the scanner identity) and re-run.")
    except Exception as e:
        logger.warning("Failed to fetch mail tags for Bot Review lookup: %s", e)
    return None

_BOT_REVIEW_MAIL_TAG_ID: int | None = None

def _apply_bot_review_mail_tag(conversation_id: int) -> tuple[bool, int, str | None]:
    """Apply the 'Bot Review' mail tag to a conversation (for ambiguous/unmatched emails from the shared reviewer account).
    Leaves the item unread. Only for cases where we could not create a task or link to a deal.
    Tries multiple known mail tag paths + message-level tagging, using numeric id when available.
    Payloads are chosen to match the native OnlyOffice mail UI (form-urlencoded ids[] + tagid, or tagIds[]).

    TO DIAGNOSE / FIX TAGGING:
    - Log in to the CRM as the scanner identity (the account in scanner_identity or BOT_CRM_EMAIL).
    - Open the native Mail module, pick any conversation, apply a tag (create "Bot Review" tag first if missing).
    - Open DevTools → Network tab, filter by "tag".
    - Look for a request to a URL containing "/mail/" and "tag".
    - Capture: Method (PUT/POST), full URL, Content-Type, and the exact request body (form or JSON).
    - Also note the response status + body.
    - Paste that here (or run with the scanner and capture the "mail tag attempt/result" log lines).
    The current code logs every attempt it makes. The correct payload from the browser capture will be replicated exactly.
    """
    if not _is_action_enabled("apply_bot_review_mail_tag"):
        return False, 0, "dry_run"
    tag_id = _get_bot_review_mail_tag_id()
    last_status = 0
    last_data = None

    # Try to resolve the actual message id (sometimes different from conv id)
    msg_id = conversation_id
    try:
        st, mdata = _crm_api("GET", f"/api/2.0/mail/messages/{conversation_id}.json")
        if st < 400:
            m = (mdata.get("response") or mdata.get("result") or mdata) if isinstance(mdata, dict) else {}
            if isinstance(m, dict):
                mid = m.get("id") or m.get("ID")
                if mid:
                    msg_id = int(mid)
    except Exception:
        pass

    def _try(body: bytes, ct: str, paths: list[str], meths: list[str]) -> bool:
        nonlocal last_status, last_data
        for path in paths:
            for meth in meths:
                try:
                    # Log the exact attempt so we can match against browser capture
                    try:
                        preview = body.decode("utf-8", errors="replace")[:300] if body else ""
                    except Exception:
                        preview = repr(body)[:200]
                    logger.info("mail tag attempt: %s %s ct=%s body~=%s", meth, path, ct, preview)
                    status, data = _crm_api(meth, path, body=body, content_type=ct)
                    last_status, last_data = status, data
                    logger.info("mail tag result: %s %s -> %s %s", meth, path, status, (str(data)[:300] if data else ""))
                    if status < 400:
                        return True
                except Exception as e:
                    last_data = str(e)[:200]
                    logger.info("mail tag exception on %s %s: %s", meth, path, e)
        return False

    # === EXACT WORKING PAYLOAD (captured live from native Mail UI on this CRM) ===
    # PUT /api/2.0/mail/conversations/tag/{tagId}/set.json?__={ms}
    # Content-Type: application/x-www-form-urlencoded; charset=UTF-8
    # Body: messages[]=29610
    #   - tagId lives in the path: /tag/6/set.json
    #   - uses "messages[]" key (works for both conv and message ids)
    #   - __= is a millisecond cache-buster
    if tag_id is not None:
        import time as _time_mod
        ts = int(_time_mod.time() * 1000)
        ctype = "application/x-www-form-urlencoded; charset=UTF-8"
        for cid in (conversation_id, msg_id):
            # 1. Exact match to the provided curl (with cache-buster + .json)
            path = f"/api/2.0/mail/conversations/tag/{tag_id}/set.json?__={ts}"
            form = urllib.parse.urlencode({"messages[]": str(cid)}).encode("utf-8")
            if _try(form, ctype, [path], ["PUT"]):
                return True, last_status, None

            # 2. Without .json suffix (some proxies normalize)
            path = f"/api/2.0/mail/conversations/tag/{tag_id}/set?__={ts}"
            if _try(form, ctype, [path], ["PUT"]):
                return True, last_status, None

            # 3. messages/ variant
            pathm = f"/api/2.0/mail/messages/tag/{tag_id}/set.json?__={ts}"
            if _try(form, ctype, [pathm], ["PUT"]):
                return True, last_status, None
            pathm = f"/api/2.0/mail/messages/tag/{tag_id}/set?__={ts}"
            if _try(form, ctype, [pathm], ["PUT"]):
                return True, last_status, None

            # 4. No cache-buster fallbacks
            path = f"/api/2.0/mail/conversations/tag/{tag_id}/set.json"
            if _try(form, ctype, [path], ["PUT"]):
                return True, last_status, None
            path = f"/api/2.0/mail/conversations/tag/{tag_id}/set"
            if _try(form, ctype, [path], ["PUT"]):
                return True, last_status, None

    # Fallback to older guessed paths (kept for other CRM versions)
    paths_conv = [
        "/api/2.0/mail/conversations/tag.json",
        "/api/2.0/mail/conversations/tag",
        "/api/2.0/mail/conversation/tag.json",
        "/api/2.0/mail/conversation/tag",
    ]
    paths_msg = [
        "/api/2.0/mail/messages/tag.json",
        "/api/2.0/mail/messages/tag",
    ]

    # Numeric id attempts (older shapes)
    if tag_id is not None:
        for idkey in ("ids[]", "id", "ids"):
            for key in ("tagid", "tagId", "tag_id", "TagId"):
                val = str(conversation_id) if idkey == "id" else str(conversation_id)
                form = urllib.parse.urlencode({idkey: val, key: str(tag_id)}).encode("utf-8")
                if _try(form, "application/x-www-form-urlencoded", paths_conv, ["PUT", "POST"]):
                    return True, last_status, None
                formm = urllib.parse.urlencode({idkey: str(msg_id), key: str(tag_id)}).encode("utf-8")
                if _try(formm, "application/x-www-form-urlencoded", paths_msg, ["PUT", "POST"]):
                    return True, last_status, None
        form = urllib.parse.urlencode({"ids[]": str(conversation_id), "tagIds[]": str(tag_id)}).encode("utf-8")
        if _try(form, "application/x-www-form-urlencoded", paths_conv, ["PUT", "POST"]):
            return True, last_status, None
        formm = urllib.parse.urlencode({"ids[]": str(msg_id), "tagIds[]": str(tag_id)}).encode("utf-8")
        if _try(formm, "application/x-www-form-urlencoded", paths_msg, ["PUT", "POST"]):
            return True, last_status, None
        form = urllib.parse.urlencode({"ids[]": str(conversation_id), "tagIds": str(tag_id)}).encode("utf-8")
        if _try(form, "application/x-www-form-urlencoded", paths_conv, ["PUT", "POST"]):
            return True, last_status, None

        for key in ("tagId", "tagid", "tag_id", "TagId"):
            try:
                jbody = json.dumps({"ids": [conversation_id], key: tag_id}).encode("utf-8")
                if _try(jbody, "application/json", paths_conv, ["PUT", "POST"]):
                    return True, last_status, None
                jbm = json.dumps({"ids": [msg_id], key: tag_id}).encode("utf-8")
                if _try(jbm, "application/json", paths_msg, ["PUT", "POST"]):
                    return True, last_status, None
            except Exception:
                pass
        try:
            jbody = json.dumps({"ids": [conversation_id], "tagIds": [tag_id]}).encode("utf-8")
            if _try(jbody, "application/json", paths_conv, ["PUT", "POST"]):
                return True, last_status, None
            jbm = json.dumps({"ids": [msg_id], "tagIds": [tag_id]}).encode("utf-8")
            if _try(jbm, "application/json", paths_msg, ["PUT", "POST"]):
                return True, last_status, None
        except Exception:
            pass
        try:
            jbody = json.dumps({"messageIds": [conversation_id], "tagid": tag_id}).encode("utf-8")
            if _try(jbody, "application/json", paths_conv, ["PUT", "POST"]):
                return True, last_status, None
        except Exception:
            pass

    # Name fallback
    for nm in (TAG_BOT_REVIEW, "Bot Review"):
        form = urllib.parse.urlencode({"ids[]": str(conversation_id), "tag": nm}).encode("utf-8")
        if _try(form, "application/x-www-form-urlencoded", paths_conv, ["PUT", "POST"]):
            return True, last_status, None
        formm = urllib.parse.urlencode({"ids[]": str(msg_id), "tag": nm}).encode("utf-8")
        if _try(formm, "application/x-www-form-urlencoded", paths_msg, ["PUT", "POST"]):
            return True, last_status, None
        form = urllib.parse.urlencode({"id": str(conversation_id), "tag": nm}).encode("utf-8")
        if _try(form, "application/x-www-form-urlencoded", paths_conv, ["PUT", "POST"]):
            return True, last_status, None

    err = ""
    try:
        if isinstance(last_data, dict):
            err = (last_data.get("error") or last_data.get("message") or str(last_data))[:300]
        else:
            err = str(last_data)[:300] if last_data else ""
    except Exception:
        err = str(last_data)[:300] if last_data else ""
    return False, last_status, err or f"status={last_status}"


def _create_opportunity(title: str, stage_id: int, contact_id: int | None = None) -> int | None:
    payload: dict[str, Any] = {"title": title, "stageId": stage_id, "responsibleId": USER_KEN}
    if contact_id:
        payload["contactId"] = contact_id
    if STAGE_NEW_SUPPLEMENT in (stage_id, str(stage_id)):
        payload["stageId"] = STAGE_NEW_SUPPLEMENT
    status, data = _crm_api("POST", "/api/2.0/crm/opportunity", body=json.dumps(payload).encode("utf-8"))
    if status < 400:
        opp = data.get("response") or data.get("result") or data
        opp_id = opp.get("id") or opp.get("ID")
        if opp_id:
            return int(opp_id)
    return None


def _set_custom_fields(opp_id: int, fields: dict[int, str]) -> bool:
    for field_id, value in fields.items():
        if not value:
            continue
        body = json.dumps({"value": value}).encode("utf-8")
        status, _ = _crm_api("POST", f"/api/2.0/crm/opportunity/{opp_id}/customfield/{field_id}", body=body)
        if status >= 400:
            logger.warning("Failed to set CF %s on opp %s (status %s)", field_id, opp_id, status)
    return True


def _add_tag(opp_id: int, tag_title: str) -> tuple[bool, int, str | None]:
    # Dry-run safety: do not mutate opp tags unless actions are enabled
    if not (SCANNER_CREATE_TASKS or SCANNER_POST_NOTES or _is_action_enabled("apply_bot_review_mail_tag") or _is_action_enabled("create_tasks")):
        return False, 0, "dry_run"
    canonical = _get_canonical_tag(tag_title)
    body = json.dumps({"tagName": canonical}).encode("utf-8")
    status, data = _crm_api("POST", f"/api/2.0/crm/opportunity/{opp_id}/tag", body=body)
    if status < 400:
        return True, status, None
    err = ""
    try:
        err = (data.get("error") or data.get("message") or str(data))[:300] if isinstance(data, dict) else str(data)[:300]
    except Exception:
        err = str(data)[:300]
    logger.warning("Failed to add tag '%s' to opp %s (status %s): %s", canonical, opp_id, status, err)
    return False, status, err or f"status={status}"


def _post_note(opp_id: int, content: str, notify_users: list[str] | None = None, category_id: int | None = None) -> tuple[bool, int, str | None]:
    if not (SCANNER_POST_NOTES or _is_action_enabled("post_notes")):
        return False, 0, "dry_run"
    safe_content = _sanitize_body(content) if "<" in content else content
    footer = "\n\n<em>—Note created by CRM Bot—</em>"
    if "—Note created by CRM Bot—" not in safe_content:
        safe_content = safe_content + footer
    if len(safe_content) > 3800:
        safe_content = safe_content[:3750].rstrip() + "…\n\n<em>—Note created by CRM Bot—</em>"
    cat = category_id if category_id is not None else 1
    payload: dict[str, Any] = {"entityType": "opportunity", "entityId": opp_id, "content": safe_content, "categoryId": cat}
    if notify_users and _is_action_enabled("notify_users"):
        payload["notifyUserList"] = notify_users
    status, data = _crm_api("POST", "/api/2.0/crm/history", body=json.dumps(payload).encode("utf-8"))
    if status < 400:
        return True, status, None
    err = ""
    try:
        err = (data.get("error") or data.get("message") or str(data))[:300] if isinstance(data, dict) else str(data)[:300]
    except Exception:
        err = str(data)[:300]
    return False, status, err or f"status={status}"


def _record_action(log_entry: dict[str, Any], action: str, ok: bool, status: int, err: str | None) -> None:
    if ok:
        log_entry.setdefault("actions_taken", []).append(action)
    else:
        log_entry.setdefault("errors", []).append(f"{action}:{status}:{(err or '')[:200]}")


def _create_task(title: str, description: str, responsible_id: str, category_id: int, opp_id: int | None = None, notify: bool = True, contact_id: str | None = None) -> tuple[bool, int, str | None, int | None]:
    if not (SCANNER_CREATE_TASKS or _is_action_enabled("create_tasks")):
        return False, 0, "dry_run", None
    payload: dict[str, Any] = {
        "title": title,
        "description": description,
        "responsibleId": responsible_id,
        "categoryId": category_id,
    }
    if opp_id:
        payload["entityType"] = "opportunity"
        payload["entityId"] = opp_id
        payload["isNotify"] = notify
    if contact_id and opp_id:
        # Only attach contact when we also have an opportunity entity; standalone contactId has caused 400 in this CRM
        try:
            payload["contactId"] = int(contact_id)
        except (ValueError, TypeError):
            payload["contactId"] = contact_id

    # Provide a deadline; some CRM versions treat it as required or range-checked
    # Use +1 day in ET (America/New_York) per policy
    try:
        from datetime import datetime, timedelta
        if "deadline" not in payload:
            base = datetime.now()
            if ZoneInfo:
                try:
                    tz = ZoneInfo("America/New_York")
                    base = datetime.now(tz)
                except Exception:
                    pass
            payload["deadline"] = (base + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S")
    except Exception:
        pass

    status, data = _crm_api("POST", "/api/2.0/crm/task", body=json.dumps(payload).encode("utf-8"))
    task_id = None
    if status < 400:
        try:
            task = data.get("response") or data.get("result") or data
            tid = task.get("id") or task.get("ID")
            if tid is not None:
                task_id = int(tid)
            if task_id and notify:
                _crm_api("POST", f"/api/2.0/crm/task/{task_id}/notify", body=b"{}")
            return True, status, None, task_id
        except Exception:
            return True, status, None, task_id
    err = ""
    try:
        err = (data.get("error") or data.get("message") or str(data))[:300] if isinstance(data, dict) else str(data)[:300]
    except Exception:
        err = str(data)[:300]
    # Log full payload on failure for diagnosis
    try:
        logger.error("Task create failed %s %s payload=%s resp=%s", status, err, payload, str(data)[:500])
    except Exception:
        pass
    return False, status, err or f"status={status}", None


def _create_task_for_assignees(title: str, description: str, assignees: list[str], category_id: int, opp_id: int | None = None, contact_id: str | None = None) -> list[tuple[str, bool, int, str | None, int | None]]:
    results: list[tuple[str, bool, int, str | None, int | None]] = []
    for uid in assignees:
        ok, st, err, tid = _create_task(title, description, uid, category_id, opp_id, contact_id=contact_id)
        results.append((uid, ok, st, err, tid))
    return results


_USER_NAME_MAP: dict[str, str] = {}

def _ensure_user_name_map() -> dict[str, str]:
    if not _USER_NAME_MAP:
        m = {}
        if USER_KEN:
            m["ken"] = USER_KEN
        if USER_REBECA:
            m["rebeca"] = USER_REBECA
        if USER_CLAUDIU:
            m["claudiu"] = USER_CLAUDIU
        _USER_NAME_MAP.update(m)
    return _USER_NAME_MAP


def _resolve_assignees(rule_name: str) -> list[str]:
    cfg = get_contractors()
    rules = cfg.get("assignee_rules", {})
    names = rules.get(rule_name, [])
    mapping = _ensure_user_name_map()
    uuids = []
    for name in names:
        name_lower = name.strip().lower()
        uid = mapping.get(name_lower)
        if uid:
            uuids.append(uid)
    return uuids


# Friendly label helpers (for logs/UI)
def _friendly_assignee(uid: str) -> str:
    u = (uid or "").strip().lower()
    if u == (USER_KEN or "").strip().lower():
        return "ken"
    if u == (USER_REBECA or "").strip().lower():
        return "rebeca"
    if u == (USER_CLAUDIU or "").strip().lower():
        return "claudiu"
    # also try by key if someone passed a key instead of uuid
    for k, v in _ensure_user_name_map().items():
        if (v or "").strip().lower() == u:
            return k
    return uid  # fallback to raw


def _resolve_contact_label(contact_id: str | None) -> str | None:
    if not contact_id:
        return None
    cfg = get_contractors()
    for c in cfg.get("contractors", []):
        if str(c.get("contact_id", "")).strip() == str(contact_id).strip():
            return c.get("crm_contact_name") or c.get("name") or str(contact_id)
    return str(contact_id)  # raw if unknown


def _notify_users_for(rule_name: str) -> list[str] | None:
    if not _is_action_enabled("notify_users"):
        return None
    uuids = _resolve_assignees(rule_name)
    return uuids if uuids else None


def _process_email_core(msg: dict[str, Any], conversation_id: int, _depth: int = 0, conv: dict[str, Any] | None = None) -> dict[str, Any] | None:
    subject = (msg.get("subject") or "").strip()
    from_email = (msg.get("from") or msg.get("sender") or "").strip().lower()
    intro = _email_intro_text(msg)
    body_text = intro
    html_body = msg.get("htmlBody") or ""

    log_entry: dict[str, Any] = {
        "conversation_id": conversation_id,
        "subject": subject,
        "from": from_email,
        "timestamp": _now_et_iso(),
        "classification": None,
        "actions_taken": [],
        "errors": [],
        "source_inbox": None,
    }

    # Phase 5: ML scoring (weak signal; deterministic rules remain primary)
    ml_result = _ml_classify(subject, body_text)
    if ml_result:
        log_entry["ml_actionable_score"] = ml_result.get("ml_actionable_score")
        log_entry["ml_category"] = ml_result.get("ml_category")
        log_entry["ml_embedding"] = ml_result.get("ml_embedding")

    # Early mailbox detection (Phase 1) — prefer conv object if provided (from poll)
    mailbox_type = _detect_mailbox(conv, msg, from_email)
    log_entry["source_inbox"] = mailbox_type
    is_record = mailbox_type == "record"

    # Per-action toggles (granular, live from contractors.json action_toggles)
    do_link          = _is_action_enabled("link_email")
    do_post_notes    = _is_action_enabled("post_notes")
    do_create_tasks  = _is_action_enabled("create_tasks")
    do_create_deals  = _is_action_enabled("create_deals")
    do_notify        = _is_action_enabled("notify_users")
    do_bot_mail_tag  = _is_action_enabled("apply_bot_review_mail_tag")
    do_mark_read     = _is_action_enabled("mark_read")

    log_entry["toggles"] = {
        "link_email": do_link,
        "post_notes": do_post_notes,
        "create_tasks": do_create_tasks,
        "create_deals": do_create_deals,
        "notify_users": do_notify,
        "apply_bot_review_mail_tag": do_bot_mail_tag,
        "mark_read": do_mark_read,
    }

    # Record inbox policy (crm@vanguardadj.online + contractor sending BCCs):
    # Hard link-only + optional most-recent sanitized body as Email note (cat 39).
    # No tasks, no deals, no Bot Review tasks, no notify from record path.
    if is_record:
        do_create_tasks = False
        do_create_deals = False
        do_notify = False
        do_bot_mail_tag = False
        # do_link and do_post_notes remain as configured (link-only default; post only for Email note on strong)
        log_entry["policy"] = "record_link_only"
        log_entry["skipped_actions"] = ["task:record_policy", "notify:record_policy", "deal:record_policy", "bot_review:record_policy"]

    # Reset per-email policy flag
    global _SKIP_DEAL_DEDUP_FOR_LH
    _SKIP_DEAL_DEDUP_FOR_LH = False

    # Early policy gate for Liberty/Highland forwarded JN emails:
    # Never match these against CRM deals (no deals from that company exist in native CRM).
    # They are scanned only to produce estimate/review tasks (or Bot Review tag if ambiguous).
    try:
        contractors = get_contractors().get("contractors", [])
        is_lh_origin = False
        for c in contractors:
            if c.get("id") in ("liberty", "highland"):
                doms = c.get("email_domains", []) + c.get("forwarded_from_domains", [])
                if any(d.lower() in from_email.lower() for d in doms):
                    is_lh_origin = True
                    break
        if is_lh_origin:
            _SKIP_DEAL_DEDUP_FOR_LH = True
    except Exception:
        pass

    subject_lower = subject.lower()
    body_lower = body_text.lower()
    contractors_cfg = get_contractors()
    carriers = contractors_cfg.get("insurance_carriers", DEFAULT_CONTRACTORS["insurance_carriers"])
    carrier_pattern = r"\b(" + "|".join(re.escape(c) for c in carriers) + r")\b"
    has_carrier = re.search(carrier_pattern, subject + "\n" + body_text, re.IGNORECASE)

    is_ack_or_delay = False
    for pat in ACK_DELAY_PATTERNS:
        if re.search(pat, subject + "\n" + body_text, re.IGNORECASE):
            is_ack_or_delay = True
            break

    # Phase 2: Ack / delay / OOO / receipt policy (per plan)
    # - Carrier paths: suppress pure action tasks (no recon task, no "review carrier" task). Still link/note if toggled + strong.
    # - Contractor forwards (sending domains): create actionable "Notify customer of delay" review task.
    if is_ack_or_delay:
        log_entry["classification"] = "ack_delay"
        log_entry["ack_delay"] = True
        from_domain = from_email.split("@")[-1] if "@" in from_email else ""
        contractors_cfg_local = get_contractors()
        contractor_domains = set()
        for c in contractors_cfg_local.get("contractors", []):
            for d in c.get("email_domains", []):
                contractor_domains.add(d.lower())
        is_contractor_forward = any(s in from_email.lower() for s in _get_sending_domains()) or from_domain in contractor_domains

        if has_carrier or is_record:
            # Suppress task; link + note only on strong match (if toggles allow)
            existing, dedup_reason, match_strength = _dedup_opportunity("", "", _extract_claim_code(subject), body_text, is_record=is_record)
            log_entry["dedup_reason"] = dedup_reason
            log_entry["match_strength"] = match_strength
            if existing:
                opp_id = int(existing.get("id") or existing.get("ID", 0))
                log_entry["linked_opp_id"] = opp_id
                log_entry["linked_opp_title"] = existing.get("title") or existing.get("Title") or ""
                if do_link:
                    ok, st, err = _link_email_to_opportunity(conversation_id, opp_id)
                    _record_action(log_entry, "linked_email", ok, st, err)
                if match_strength == "strong" and do_post_notes:
                    ok, st, err = _post_note(opp_id, f"Carrier ack/delay: {subject}\n\n{body_text[:600]}")
                    _record_action(log_entry, "posted_note", ok, st, err)
            log_entry = _apply_ml_override(log_entry, "ack_delay", "strong", False, do_post_notes, is_record)
            _append_log_entry(log_entry)
            return log_entry

        if is_contractor_forward:
            claim_code = _extract_claim_code(subject)
            claimant = _extract_claimant_from_body(body_text)
            requester = _extract_requester_hint(from_email, body_text)
            title = _task_title_with_claim(claim_code, "Notify customer of delay", claimant, requester)
            desc = f"Ack/delay/OOO from carrier. Most-recent request:\n\n{body_text[:900]}\n\nMail: {(PORTAL_URL or '')}/addons/mail/Default.aspx#conversation/{conversation_id}"
            log_entry["classification"] = "ack_delay_review_task"
            if do_create_tasks:
                res = _create_task_for_assignees(title, desc, _resolve_assignees("reconciliation") or _resolve_assignees("adjuster_action"), TASK_CAT_ESTIMATE)
                for uid, ok, st, err, tid in res:
                    _record_action(log_entry, "created_task", ok, st, err)
                log_entry["task_results"] = res
            log_entry = _apply_ml_override(log_entry, "ack_delay_review_task", "none", do_create_tasks, False, is_record)
            _append_log_entry(log_entry)
            return log_entry
        # else: fall through to normal rules (rare)

    # --- Classifier rules (ordered, first-match-wins) ---

    # 01. JobNimbus: New Task Assigned
    m = re.search(r"new task assigned in jobnimbus:\s*(.+)", subject_lower)
    if m:
        task_name = m.group(1).strip()
        desc_match = re.search(r"assigned you a new task\s*:\s*(.+?)(?:\n|$)", body_text)
        raw_desc = desc_match.group(1).strip() if desc_match else body_text[:500]
        description = _clean_jn_body(raw_desc, conversation_id)
        log_entry["classification"] = "jobnimbus_task"
        if do_create_tasks:
            assignees = _resolve_assignees("jobnimbus_task")
            if assignees:
                log_entry["tasked"] = assignees
                ok, st, err, tid = _create_task(
                    f"JobNimbus Task: {task_name}",
                    description,
                    assignees[0], TASK_CAT_ESTIMATE,
                )
                _record_action(log_entry, "created_task", ok, st, err)
                if ok and tid is not None:
                    log_entry["task_id"] = tid
        log_entry = _apply_ml_override(log_entry, "jobnimbus_task", "none", do_create_tasks, do_post_notes, is_record)
        _append_log_entry(log_entry)
        return log_entry

    # 02. JobNimbus: New Job Assigned
    m = re.search(r"(.+?) assigned you a new job:\s*(.+)", subject_lower)
    if m:
        job_name = m.group(2).strip()
        assigner = m.group(1).strip()
        addr_match = re.search(r"(\d{1,5}\s+[A-Za-z0-9\s,]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Circle|Cir|Blvd|Boulevard|Way)[\s,]*[A-Z]{2})", body_text, re.IGNORECASE)
        address = addr_match.group(1).strip() if addr_match else ""
        raw_desc = f"Assigned by {assigner}. New job: {job_name}. Address: {address}".strip()
        desc = _clean_jn_body(raw_desc, conversation_id)
        log_entry["classification"] = "jobnimbus_new_job"
        if do_create_tasks:
            assignees = _resolve_assignees("jobnimbus_new_job")
            if assignees:
                log_entry["tasked"] = assignees
                ok, st, err, tid = _create_task(
                    _task_title_with_claim("", f"Review new job: {job_name}" + (f" — {address}" if address else "")),
                    desc,
                    assignees[0], TASK_CAT_ESTIMATE,
                )
                _record_action(log_entry, "created_task", ok, st, err)
                if ok and tid is not None:
                    log_entry["task_id"] = tid
        log_entry = _apply_ml_override(log_entry, "jobnimbus_new_job", "none", do_create_tasks, do_post_notes, is_record)
        _append_log_entry(log_entry)
        return log_entry

    # 03. JobNimbus: Mention (Liberty/Highland only for estimate signals; always task someone, no skip)
    m = re.search(r"(.+?) has mentioned you on the (contact|job) \"(.+?)\"", subject, re.IGNORECASE)
    if m:
        mentioner = m.group(1).strip()
        contact_name = m.group(3).strip()
        log_entry["mentioner"] = mentioner
        log_entry["contact"] = contact_name

        # Determine if from current Liberty/Highland origins
        contractors = contractors_cfg.get("contractors", [])
        is_current_origin = False
        contact_id = None
        contact_label = None
        for c in contractors:
            if c.get("id") in ("liberty", "highland"):
                all_doms = c.get("email_domains", []) + c.get("forwarded_from_domains", [])
                if any(d.lower() in from_email.lower() for d in all_doms):
                    is_current_origin = True
                    contact_id = c.get("contact_id") or None
                    contact_label = _resolve_contact_label(contact_id)
                    break

        # Liberty/Highland JN emails are NEVER checked against CRM deals (no deals from that company exist).
        # They are scanned purely for context to create estimate/review tasks.
        # Body scan for estimate revise/new signal
        has_est_signal = False
        if is_current_origin:
            for pat in JOBNIMBUS_MENTION_ESTIMATE_PATTERNS:
                if re.search(pat, body_lower):
                    has_est_signal = True
                    break

        # For LH origin the top of _process_email already set _SKIP_DEAL_DEDUP_FOR_LH=True
        if is_current_origin and not has_est_signal:
            # Ambiguous for liberty/highland — flag for Bot Review mail tag (visible in shared mail module).
            # No task, no deal lookup, leave unread.
            log_entry["classification"] = "jobnimbus_mention_ambiguous"
            log_entry["contact_label"] = contact_label
            log_entry["apply_bot_review_mail"] = True
            log_entry = _apply_ml_override(log_entry, "jobnimbus_mention_ambiguous", "none", do_create_tasks, do_post_notes, is_record)
            _append_log_entry(log_entry)
            return log_entry

        if has_est_signal:
            cls = "jobnimbus_mention_est"
            assignees = _resolve_assignees("jobnimbus_mention_est") or []
            title = _task_title_with_claim("", f'JobNimbus mention — revise estimate for "{contact_name}"')
            raw = f'Mentioned by {mentioner} on contact "{contact_name}".\n\n{body_text[:1200]}'
            desc = _clean_jn_body(raw, conversation_id)
            cat = TASK_CAT_ESTIMATE
        else:
            cls = "jobnimbus_mention"
            assignees = _resolve_assignees("jobnimbus_mention") or []
            title = _task_title_with_claim("", f'JobNimbus mention for "{contact_name}"')
            raw = f'Mentioned by {mentioner} on contact "{contact_name}".\n\n{body_text[:1200]}'
            desc = _clean_jn_body(raw, conversation_id)
            cat = TASK_CAT_FOLLOW_UP

        log_entry["classification"] = cls
        log_entry["contact_label"] = contact_label

        if do_create_tasks and assignees:
            log_entry["tasked"] = assignees
            log_entry["contact_id"] = contact_id
            res = _create_task_for_assignees(title, desc, assignees, cat, contact_id=contact_id)
            for uid, ok, st, err, tid in res:
                _record_action(log_entry, "created_task", ok, st, err)
            log_entry["task_results"] = res

        log_entry = _apply_ml_override(log_entry, cls, "none", do_create_tasks, do_post_notes, is_record)
        _append_log_entry(log_entry)
        return log_entry

    # 04. Acculynx: Supplement Notification
    m = re.search(r"job supplement notification:\s*(.+?)\s+(?:[A-Z]{2}\s*-?\s*\d+)", subject_lower)
    if m:
        claimant = m.group(1).strip()
        job_id = _extract_job_id(subject, body_text)
        is_completed = "completed" in body_lower
        log_entry["classification"] = "supplement_update"
        log_entry["claimant"] = claimant
        log_entry["job_id"] = job_id
        log_entry["completed"] = is_completed

        existing, dedup_reason, match_strength = _dedup_opportunity(claimant, job_id, "", body_text, is_record=is_record)
        log_entry["dedup_reason"] = dedup_reason
        log_entry["match_strength"] = match_strength
        if existing and match_strength == "strong":
            opp_id = int(existing.get("id") or existing.get("ID", 0))
            log_entry["linked_opp_id"] = opp_id
            log_entry["linked_opp_title"] = existing.get("title") or existing.get("Title") or ""
            if is_completed:
                if do_post_notes:
                    ok, st, err = _post_note(opp_id, f"Supplement completed: {body_text[:1000]}")
                    _record_action(log_entry, "posted_note", ok, st, err)
                if do_link:
                    ok, st, err = _link_email_to_opportunity(conversation_id, opp_id)
                    _record_action(log_entry, "linked_email", ok, st, err)
            else:
                if do_post_notes:
                    ok, st, err = _post_note(opp_id, f"Supplement update: {body_text[:1000]}")
                    _record_action(log_entry, "posted_note", ok, st, err)
                if do_link:
                    ok, st, err = _link_email_to_opportunity(conversation_id, opp_id)
                    _record_action(log_entry, "linked_email", ok, st, err)
                if do_create_tasks and do_notify:
                    res = _create_task_for_assignees(
                    _task_title_with_claim("", f"Supplement request — {claimant}"),
                    body_text[:500],
                    _resolve_assignees("supplement_request"), TASK_CAT_ESTIMATE, opp_id,
                    )
                    for uid, ok, st, err, tid in res:
                        _record_action(log_entry, "created_task", ok, st, err)
                    log_entry["task_results"] = res
        elif existing:
            # weak match: still actionable - link/note/tag/task on the opp
            opp_id = int(existing.get("id") or existing.get("ID", 0))
            log_entry["linked_opp_id"] = opp_id
            log_entry["linked_opp_title"] = existing.get("title") or existing.get("Title") or ""
            if do_post_notes:
                ok, st, err = _post_note(opp_id, f"Supplement update: {body_text[:1000]}")
                _record_action(log_entry, "posted_note", ok, st, err)
            if do_link:
                ok, st, err = _link_email_to_opportunity(conversation_id, opp_id)
                _record_action(log_entry, "linked_email", ok, st, err)
            if do_create_tasks:
                res = _create_task_for_assignees(
                    _task_title_with_claim(claim_code, "Adjuster response needed"),
                    action_text,
                    _resolve_assignees("adjuster_action"), TASK_CAT_ESTIMATE, opp_id,
                )
                for uid, ok, st, err, tid in res:
                    _record_action(log_entry, "created_task", ok, st, err)
                log_entry["task_results"] = res
        else:
            log_entry["no_deal"] = True
            log_entry["no_deal_reason"] = "no strong match"
            if do_create_deals:
                opp_id = _create_opportunity(claimant, STAGE_NEW_SUPPLEMENT)
                if opp_id:
                    log_entry["linked_opp_id"] = opp_id
                    # best-effort title
                    try:
                        o = _crm_api("GET", f"/api/2.0/crm/opportunity/{opp_id}.json")[1]
                        log_entry["linked_opp_title"] = (o.get("response") or o).get("title") or (o.get("response") or o).get("Title") or ""
                    except Exception:
                        pass
                    cf_fields = {}
                    if job_id:
                        cf_fields[FIELD_CRM_JOB_ID] = job_id
                    _set_custom_fields(opp_id, cf_fields)
                    if do_create_tasks:
                        ok, st, err = _add_tag(opp_id, TAG_MISSING_INFO)
                        _record_action(log_entry, "added_tag", ok, st, err)
                    if do_link:
                        ok, st, err = _link_email_to_opportunity(conversation_id, opp_id)
                        _record_action(log_entry, "linked_email", ok, st, err)
                    if do_post_notes:
                        ok, st, err = _post_note(opp_id, f"New supplement project: {body_text[:1000]}")
                        _record_action(log_entry, "posted_note", ok, st, err)
                    if do_create_tasks:
                        res = _create_task_for_assignees(
                    _task_title_with_claim(job_id or "", f"Review new project: {claimant}"),
                    f"New supplement project from email. Job: {job_id}" if job_id else "New supplement project from email.",
                    _resolve_assignees("supplement_new_project"), TASK_CAT_FOLLOW_UP, opp_id,
                        )
                        for uid, ok, st, err, tid in res:
                            _record_action(log_entry, "created_task", ok, st, err)
                        log_entry["task_results"] = res
                    log_entry["actions_taken"].extend(["created_deal"])
            else:
                if do_create_tasks:
                    res = _create_task_for_assignees(
                    _task_title_with_claim(job_id or "", f"Review new project: {claimant}"),
                    f"New supplement project from email. Job: {job_id}" if job_id else "New supplement project from email.",
                    _resolve_assignees("supplement_new_project"), TASK_CAT_FOLLOW_UP,
                    )
                    for uid, ok, st, err, tid in res:
                        _record_action(log_entry, "created_task", ok, st, err)
                    log_entry["task_results"] = res
        log_entry = _apply_ml_override(log_entry, "supplement_update", match_strength, do_create_tasks, do_post_notes, is_record)
        _append_log_entry(log_entry)
        return log_entry

    # 05. Acculynx: Job Notification
    m = re.search(r"job notification:\s*(?:\d+|[A-Z]{2}\s*-\s*\d+):\s*(.+)", subject_lower)
    if m:
        claimant = m.group(1).strip()
        job_id = _extract_job_id(subject, body_text)
        log_entry["classification"] = "check_claimant"
        log_entry["claimant"] = claimant

        existing, dedup_reason, match_strength = _dedup_opportunity(claimant, job_id, "", body_text, is_record=is_record)
        log_entry["dedup_reason"] = dedup_reason
        log_entry["match_strength"] = match_strength
        if existing and match_strength == "strong":
            opp_id = int(existing.get("id") or existing.get("ID", 0))
            log_entry["linked_opp_id"] = opp_id
            log_entry["linked_opp_title"] = existing.get("title") or existing.get("Title") or ""
            if do_post_notes:
                ok, st, err = _post_note(opp_id, f"Email update via Acculynx: {body_text[:1000]}")
                _record_action(log_entry, "posted_note", ok, st, err)
            if do_link:
                ok, st, err = _link_email_to_opportunity(conversation_id, opp_id)
                _record_action(log_entry, "linked_email", ok, st, err)
        else:
            if do_create_tasks:
                res = _create_task_for_assignees(
                    _task_title_with_claim("", f"New potential: {claimant}"),
                    f"New job notification from Acculynx. Review and create deal if needed.\n\n{body_text[:500]}",
                    _resolve_assignees("new_potential"), TASK_CAT_FOLLOW_UP,
                )
                for uid, ok, st, err, tid in res:
                    _record_action(log_entry, "created_task", ok, st, err)
                log_entry["task_results"] = res
        log_entry = _apply_ml_override(log_entry, "check_claimant", match_strength, do_create_tasks, do_post_notes, is_record)
        _append_log_entry(log_entry)
        return log_entry

    # 06. Reconciliation / Carrier Estimate Revision
    # Literal "reconciliation" / "reconcile" anywhere forces this path (even non-carrier mail).
    # This rule runs before generic carrier (08) so recon signals always take precedence.
    has_reconcile = re.search(r"\breconcil", subject_lower + "\n" + body_lower)
    is_carrier_estimate = (
        has_carrier
        and any(phrase in body_lower for phrase in ESTIMATE_REVISION_PHRASES)
    )
    # Also treat common "review complete + position/estimate provided" language as reconciliation signal for carriers
    if not (has_reconcile or is_carrier_estimate) and has_carrier:
        if re.search(r"completed our review|outlined our position|for your review|revised estimate|updated estimate|new RCV", body_lower):
            is_carrier_estimate = True
    if has_reconcile or is_carrier_estimate:
        claim_code = _extract_claim_code(subject)
        claimant = _extract_claimant_from_body(body_text)
        log_entry["classification"] = "reconciliation_task"
        log_entry["claim_code"] = claim_code
        log_entry["claimant"] = claimant

        existing, dedup_reason, match_strength = _dedup_opportunity(claimant, "", claim_code, body_text, is_record=is_record)
        log_entry["dedup_reason"] = dedup_reason
        log_entry["match_strength"] = match_strength
        if existing and match_strength == "strong":
            opp_id = int(existing.get("id") or existing.get("ID", 0))
            log_entry["linked_opp_id"] = opp_id
            log_entry["linked_opp_title"] = existing.get("title") or existing.get("Title") or ""
            if do_post_notes:
                ok, st, err = _post_note(opp_id, f"Needs reconciliation: {body_text[:1000]}", notify_users=_notify_users_for("reconciliation"))
                _record_action(log_entry, "posted_note", ok, st, err)
            if do_link:
                ok, st, err = _link_email_to_opportunity(conversation_id, opp_id)
                _record_action(log_entry, "linked_email", ok, st, err)
            if do_create_tasks:
                ok, st, err = _add_tag(opp_id, TAG_NEEDS_RECONCILIATION)
                _record_action(log_entry, "added_tag", ok, st, err)
            if do_create_tasks:
                res = _create_task_for_assignees(
                    _task_title_with_claim(claim_code, "Reconcile estimate"),
                    f"Reconciliation needed for claim {claim_code}. {body_text[:500]}",
                    _resolve_assignees("reconciliation"), TASK_CAT_ESTIMATE, opp_id,
                )
                for uid, ok, st, err, tid in res:
                    _record_action(log_entry, "created_task", ok, st, err)
                log_entry["task_results"] = res
        elif existing:
            # weak match: still actionable - link/note/tag/task on the opp
            opp_id = int(existing.get("id") or existing.get("ID", 0))
            log_entry["linked_opp_id"] = opp_id
            log_entry["linked_opp_title"] = existing.get("title") or existing.get("Title") or ""
            if do_post_notes:
                ok, st, err = _post_note(opp_id, f"Needs reconciliation: {body_text[:1000]}", notify_users=_notify_users_for("reconciliation"))
                _record_action(log_entry, "posted_note", ok, st, err)
            if do_link:
                ok, st, err = _link_email_to_opportunity(conversation_id, opp_id)
                _record_action(log_entry, "linked_email", ok, st, err)
            if do_create_tasks:
                ok, st, err = _add_tag(opp_id, TAG_NEEDS_RECONCILIATION)
                _record_action(log_entry, "added_tag", ok, st, err)
            if do_create_tasks:
                res = _create_task_for_assignees(
                    _task_title_with_claim(claim_code, "Reconcile estimate"),
                    f"Reconciliation candidate for claim {claim_code}. {body_text[:500]}",
                    _resolve_assignees("reconciliation"), TASK_CAT_ESTIMATE, opp_id,
                )
                for uid, ok, st, err, tid in res:
                    _record_action(log_entry, "created_task", ok, st, err)
                log_entry["task_results"] = res
        log_entry = _apply_ml_override(log_entry, "reconciliation_task", match_strength, do_create_tasks, do_post_notes, is_record)
        _append_log_entry(log_entry)
        return log_entry

    # 07. Adjuster Action Request
    adjuster_keywords = r"adjuster\s+(wants|requested|said|made|need|will|review|assign|sent|confirm|asked|required)"
    if re.search(adjuster_keywords, subject_lower) or re.search(adjuster_keywords, body_lower):
        claim_code = _extract_claim_code(subject)
        log_entry["classification"] = "adjuster_action"
        log_entry["claim_code"] = claim_code

        existing, dedup_reason, match_strength = _dedup_opportunity("", "", claim_code, body_text, is_record=is_record)
        log_entry["dedup_reason"] = dedup_reason
        log_entry["match_strength"] = match_strength
        if existing and match_strength == "strong":
            opp_id = int(existing.get("id") or existing.get("ID", 0))
            log_entry["linked_opp_id"] = opp_id
            log_entry["linked_opp_title"] = existing.get("title") or existing.get("Title") or ""
            action_text = subject
            m = re.search(r"adjuster\s+(wants|requested|said|made|need|will|review|assign|sent|confirm|asked|required)\s*(.*)", subject_lower, re.IGNORECASE)
            if m:
                action_text = f"Adjuster {m.group(1)}: {m.group(2).strip()}"
            if do_post_notes:
                ok, st, err = _post_note(opp_id, f"Adjuster action: {action_text}\n\n{body_text[:2000]}", notify_users=_notify_users_for("adjuster_action"))
                _record_action(log_entry, "posted_note", ok, st, err)
            if do_link:
                ok, st, err = _link_email_to_opportunity(conversation_id, opp_id)
                _record_action(log_entry, "linked_email", ok, st, err)
            if do_create_tasks:
                ok, st, err = _add_tag(opp_id, TAG_NEEDS_REBUTTAL)
                _record_action(log_entry, "added_tag", ok, st, err)
                ok, st, err = _add_tag(opp_id, TAG_PAUSE_CALLING)
                _record_action(log_entry, "added_tag", ok, st, err)
            if do_create_tasks:
                res = _create_task_for_assignees(
                    _task_title_with_claim(claim_code, "Adjuster response needed"),
                    action_text,
                    _resolve_assignees("adjuster_action"), TASK_CAT_ESTIMATE, opp_id,
                )
                for uid, ok, st, err, tid in res:
                    _record_action(log_entry, "created_task", ok, st, err)
                log_entry["task_results"] = res
        elif existing:
            # weak match: still actionable - link/note/tag/task on the opp
            opp_id = int(existing.get("id") or existing.get("ID", 0))
            log_entry["linked_opp_id"] = opp_id
            log_entry["linked_opp_title"] = existing.get("title") or existing.get("Title") or ""
            if do_post_notes:
                ok, st, err = _post_note(opp_id, f"Adjuster action: {action_text}\n\n{body_text[:2000]}", notify_users=_notify_users_for("adjuster_action"))
                _record_action(log_entry, "posted_note", ok, st, err)
            if do_link:
                ok, st, err = _link_email_to_opportunity(conversation_id, opp_id)
                _record_action(log_entry, "linked_email", ok, st, err)
            if do_create_tasks:
                ok, st, err = _add_tag(opp_id, TAG_NEEDS_REBUTTAL)
                _record_action(log_entry, "added_tag", ok, st, err)
                ok, st, err = _add_tag(opp_id, TAG_PAUSE_CALLING)
                _record_action(log_entry, "added_tag", ok, st, err)
            if do_create_tasks:
                res = _create_task_for_assignees(
                    _task_title_with_claim(claim_code, "Adjuster response needed"),
                    action_text,
                    _resolve_assignees("adjuster_action"), TASK_CAT_ESTIMATE, opp_id,
                )
                for uid, ok, st, err, tid in res:
                    _record_action(log_entry, "created_task", ok, st, err)
                log_entry["task_results"] = res
        log_entry = _apply_ml_override(log_entry, "adjuster_action", match_strength, do_create_tasks, do_post_notes, is_record)
        _append_log_entry(log_entry)
        return log_entry

    # 08. Carrier/Insurance Company Email (generic / non-reconciliation)
    # Revised estimates and recon signals are caught by rule 06 (runs first) and produce reconciliation tasks.
    # This rule must never create "Review carrier email" tasks. For matched deals we associate the mail;
    # for ambiguous we apply Bot Review mail tag (leave unread) in the shared reviewer inbox.
    if has_carrier:
        claim_code = _extract_claim_code(subject)
        log_entry["classification"] = "carrier_adjuster_email"
        log_entry["claim_code"] = claim_code
        log_entry["carrier"] = has_carrier.group(1)

        existing, dedup_reason, match_strength = _dedup_opportunity("", "", claim_code, body_text, is_record=is_record)
        log_entry["dedup_reason"] = dedup_reason
        log_entry["match_strength"] = match_strength
        if existing:
            opp_id = int(existing.get("id") or existing.get("ID", 0))
            log_entry["linked_opp_id"] = opp_id
            log_entry["linked_opp_title"] = existing.get("title") or existing.get("Title") or ""
            # Link email to opp for traceability on any match
            if do_link:
                ok, st, err = _link_email_to_opportunity(conversation_id, opp_id)
                _record_action(log_entry, "linked_email", ok, st, err)
            # Opp-level Bot Review tag (surfaces in deal)
            if do_create_tasks:
                ok, st, err = _add_tag(opp_id, TAG_BOT_REVIEW)
                _record_action(log_entry, "added_tag", ok, st, err)
            # Note only on strong matches (skip on weak to avoid large-body 400s)
            if match_strength == "strong" and do_post_notes:
                note_text = f"Email from {has_carrier.group(1)}.\n\nSubject: {subject}\n\n{body_text[:2000]}"
                ok, st, err = _post_note(opp_id, note_text, notify_users=_notify_users_for("carrier_email_notify"))
                _record_action(log_entry, "posted_note", ok, st, err)
            # Weak: link + opp tag only (no note, no task)
            # No task creation for carrier_adjuster_email in any path.
        else:
            # No plausible opp: Bot Review mail tag in shared inbox, leave unread
            log_entry["no_deal"] = True
            log_entry["no_deal_reason"] = dedup_reason or "no strong match"
            log_entry["apply_bot_review_mail"] = True
        log_entry = _apply_ml_override(log_entry, "carrier_adjuster_email", match_strength, do_create_tasks, do_post_notes, is_record)
        _append_log_entry(log_entry)
        return log_entry

    # 09. Supplement Keyword Discussion
    if "supplement" in body_lower or "supplement" in subject_lower:
        from_domain = from_email.split("@")[-1] if "@" in from_email else ""
        contractor_domains = set()
        for c in contractors_cfg.get("contractors", DEFAULT_CONTRACTORS["contractors"]):
            contractor_domains.update(c.get("email_domains", []))
        if from_domain in contractor_domains or any(d in from_email for d in contractor_domains):
            claim_code = _extract_claim_code(subject)
            claimant = _extract_claimant_from_body(body_text)
            log_entry["classification"] = "supplement_discussion"
            log_entry["claim_code"] = claim_code

            existing, dedup_reason, match_strength = _dedup_opportunity(claimant, "", claim_code, body_text, is_record=is_record)
            log_entry["dedup_reason"] = dedup_reason
            log_entry["match_strength"] = match_strength
            if existing and match_strength == "strong":
                opp_id = int(existing.get("id") or existing.get("ID", 0))
                log_entry["linked_opp_id"] = opp_id
                log_entry["linked_opp_title"] = existing.get("title") or existing.get("Title") or ""
                if do_link:
                    ok, st, err = _link_email_to_opportunity(conversation_id, opp_id)
                    _record_action(log_entry, "linked_email", ok, st, err)
                if do_post_notes:
                    ok, st, err = _post_note(opp_id, f"Supplement discussion: {body_text[:2000]}")
                    _record_action(log_entry, "posted_note", ok, st, err)
                m = re.search(r"(request|need|require|please|send|provide|upload|submit|quote|estimate)", body_lower)
                if m and do_create_tasks:
                    res = _create_task_for_assignees(
                        _task_title_with_claim(claim_code, "Supplement request"),
                        body_text[:500],
                        _resolve_assignees("supplement_discussion_request"), TASK_CAT_ESTIMATE, opp_id,
                    )
                    for uid, ok, st, err, tid in res:
                        _record_action(log_entry, "created_task", ok, st, err)
                    log_entry["task_results"] = res
            elif existing:
                # weak match: still actionable
                opp_id = int(existing.get("id") or existing.get("ID", 0))
                log_entry["linked_opp_id"] = opp_id
                log_entry["linked_opp_title"] = existing.get("title") or existing.get("Title") or ""
                if do_link:
                    ok, st, err = _link_email_to_opportunity(conversation_id, opp_id)
                    _record_action(log_entry, "linked_email", ok, st, err)
                if do_post_notes:
                    ok, st, err = _post_note(opp_id, f"Supplement discussion: {body_text[:2000]}")
                    _record_action(log_entry, "posted_note", ok, st, err)
                m = re.search(r"(request|need|require|please|send|provide|upload|submit|quote|estimate)", body_lower)
                if m and do_create_tasks:
                    res = _create_task_for_assignees(
                        _task_title_with_claim(claim_code, "Supplement request"),
                        body_text[:500],
                        _resolve_assignees("supplement_discussion_request"), TASK_CAT_ESTIMATE, opp_id,
                    )
                    for uid, ok, st, err, tid in res:
                        _record_action(log_entry, "created_task", ok, st, err)
                    log_entry["task_results"] = res
            else:
                log_entry["no_deal"] = True
                log_entry["no_deal_reason"] = "no strong match"
                log_entry["apply_bot_review_mail"] = True
            log_entry = _apply_ml_override(log_entry, "supplement_discussion", match_strength, do_create_tasks, do_post_notes, is_record)
            _append_log_entry(log_entry)
            return log_entry

    # 09b. Supplement discussion no-deal fallback (ensure Bot Review mail tag for unlinked)
    # (The main block above already sets it in the else; this is belt-and-suspenders for any early return path.)
    # 10. Claim Code Only (BCC Record)
    if re.match(r"^[A-Za-z0-9\-]{5,30}$", subject.strip()):
        claim_code = subject.strip()
        log_entry["classification"] = "claim_code_only"
        log_entry["claim_code"] = claim_code

        existing, dedup_reason, match_strength = _dedup_opportunity("", "", claim_code, body_text, is_record=is_record)
        log_entry["dedup_reason"] = dedup_reason
        log_entry["match_strength"] = match_strength
        if existing and match_strength == "strong":
            opp_id = int(existing.get("id") or existing.get("ID", 0))
            log_entry["linked_opp_id"] = opp_id
            log_entry["linked_opp_title"] = existing.get("title") or existing.get("Title") or ""
            if is_record:
                # Record inbox: link always (toggle controlled), optional most-recent body as Email note (cat 39)
                if do_link:
                    ok, st, err = _link_email_to_opportunity(conversation_id, opp_id)
                    _record_action(log_entry, "linked_email", ok, st, err)
                if do_post_notes:
                    recent = _most_recent_body(msg) or body_text[:4000]
                    cat39 = _get_email_history_category_id()
                    ok, st, err = _post_note(opp_id, f"Email: {subject}\n\n{recent}", category_id=cat39)
                    _record_action(log_entry, "posted_email_note", ok, st, err)
            else:
                if do_post_notes:
                    ok, st, err = _post_note(opp_id, f"Email record: {subject}\n\n{body_text[:1000]}")
                    _record_action(log_entry, "posted_note", ok, st, err)
                if do_link:
                    ok, st, err = _link_email_to_opportunity(conversation_id, opp_id)
                    _record_action(log_entry, "linked_email", ok, st, err)
        elif _depth < 1:
            msg_full = _fetch_message(conversation_id)
            if msg_full:
                return _process_email_core(msg_full, conversation_id, _depth + 1)
        else:
            # No strong match and no further depth: Bot Review mail tag + leave unread
            log_entry["no_deal"] = True
            log_entry["no_deal_reason"] = dedup_reason or "no strong match"
            log_entry["apply_bot_review_mail"] = True
        log_entry = _apply_ml_override(log_entry, "claim_code_only", match_strength, do_create_tasks, do_post_notes, is_record)
        _append_log_entry(log_entry)
        return log_entry

    # 11. Acculynx Other
    if "acculynx" in from_email or "acculynx" in from_email.lower():
        log_entry["classification"] = "acculynx_other"
        existing, dedup_reason, match_strength = _dedup_opportunity("", "", _extract_claim_code(subject), body_text, is_record=is_record)
        log_entry["dedup_reason"] = dedup_reason
        log_entry["match_strength"] = match_strength
        if existing and match_strength == "strong":
            opp_id = int(existing.get("id") or existing.get("ID", 0))
            log_entry["linked_opp_id"] = opp_id
            log_entry["linked_opp_title"] = existing.get("title") or existing.get("Title") or ""
            if do_post_notes:
                ok, st, err = _post_note(opp_id, f"Unclassified Acculynx email.\n\nSubject: {subject}\n\n{body_text[:2000]}")
                _record_action(log_entry, "posted_note", ok, st, err)
            if do_link:
                ok, st, err = _link_email_to_opportunity(conversation_id, opp_id)
                _record_action(log_entry, "linked_email", ok, st, err)
            if do_create_tasks:
                ok, st, err = _add_tag(opp_id, TAG_BOT_REVIEW)
                _record_action(log_entry, "added_tag", ok, st, err)
        else:
            log_entry["no_deal"] = True
            log_entry["no_deal_reason"] = dedup_reason or "no strong match"
            log_entry["apply_bot_review_mail"] = True  # ambiguous: Bot Review tag in shared mail inbox, leave unread, no task
        log_entry = _apply_ml_override(log_entry, "acculynx_other", match_strength, do_create_tasks, do_post_notes, is_record)
        _append_log_entry(log_entry)
        return log_entry

    # 11b. Acculynx other weak/no-match already set flag above.

    # 12. Uncertain / ambiguous (no task for uncategorized; use Bot Review mail tag + leave unread)
    log_entry["classification"] = "uncertain"
    existing, dedup_reason, match_strength = _dedup_opportunity("", "", _extract_claim_code(subject), body_text, is_record=is_record)
    log_entry["dedup_reason"] = dedup_reason
    log_entry["match_strength"] = match_strength
    if existing and match_strength == "strong":
        opp_id = int(existing.get("id") or existing.get("ID", 0))
        log_entry["linked_opp_id"] = opp_id
        log_entry["linked_opp_title"] = existing.get("title") or existing.get("Title") or ""
        if do_post_notes:
            ok, st, err = _post_note(opp_id, f"Unclassified email.\n\nSubject: {subject}\n\n{body_text[:2000]}")
            _record_action(log_entry, "posted_note", ok, st, err)
        if do_link:
            ok, st, err = _link_email_to_opportunity(conversation_id, opp_id)
            _record_action(log_entry, "linked_email", ok, st, err)
        if do_create_tasks:
            ok, st, err = _add_tag(opp_id, TAG_BOT_REVIEW)
            _record_action(log_entry, "added_tag", ok, st, err)
    else:
        log_entry["no_deal"] = True
        log_entry["no_deal_reason"] = dedup_reason or "no strong match"
        # poll_inbox will apply mail "Bot Review" tag and leave unread
        log_entry["apply_bot_review_mail"] = True
    log_entry = _apply_ml_override(log_entry, "uncertain", match_strength, do_create_tasks, do_post_notes, is_record)
    _append_log_entry(log_entry)
    return log_entry


def _ensure_linked_or_flagged(log_entry: dict[str, Any] | None, conversation_id: int) -> dict[str, Any] | None:
    """Guarantee every processed email is either linked to an opportunity or flagged for human review.

    Primary purpose of the scanner is to attach emails to deals. If the core classifier did not
    already link the email, fall back to the best dedup candidate (even weak) and link. Only if
    absolutely no candidate exists do we apply the Bot Review mail tag so a user can manually
    route it. This also generates training signal for improving matching.
    """
    if not log_entry:
        return log_entry
    # Skip if already linked, or if Liberty/Highland skip was requested.
    if log_entry.get("linked_opp_id"):
        return log_entry
    if log_entry.get("dedup_reason") == "lh_skip":
        return log_entry

    subject = log_entry.get("subject") or ""
    from_email = log_entry.get("from") or ""
    body_text = log_entry.get("body_text") or ""
    claim_code = log_entry.get("claim_code") or ""
    is_record = (log_entry.get("source_inbox") or "") == "record"

    existing, dedup_reason, match_strength = _dedup_opportunity("", "", claim_code or _extract_claim_code(subject), body_text, is_record=is_record)
    if existing:
        opp_id = int(existing.get("id") or existing.get("ID", 0))
        log_entry["linked_opp_id"] = opp_id
        log_entry["linked_opp_title"] = existing.get("title") or existing.get("Title") or ""
        log_entry["dedup_reason"] = dedup_reason
        log_entry["match_strength"] = match_strength
        if _is_action_enabled("link_email"):
            ok, st, err = _link_email_to_opportunity(conversation_id, opp_id)
            _record_action(log_entry, "linked_email", ok, st, err)
    else:
        log_entry["no_deal"] = True
        log_entry["no_deal_reason"] = dedup_reason or "no candidate opportunity"
        log_entry["apply_bot_review_mail"] = True
    return log_entry


def _process_email(msg: dict[str, Any], conversation_id: int, _depth: int = 0, conv: dict[str, Any] | None = None) -> dict[str, Any] | None:
    """Public entry point: classify an email, then ensure it is linked or flagged."""
    log_entry = _process_email_core(msg, conversation_id, _depth, conv)
    return _ensure_linked_or_flagged(log_entry, conversation_id)


def _poll_inbox() -> None:
    # Granular toggles: do not blanket-skip. Record inbox may only do link+Email notes.
    # _process_email and helpers gate the actual mutations.
    # Always newest first and consistent order to avoid seeing "older" items unpredictably
    status, data = _crm_api("GET", "/api/2.0/mail/conversations.json", query="folder=1&page_size=100&sort=date&sortorder=descending")
    if status >= 400:
        logger.error("Failed to fetch inbox (status %s)", status)
        return

    conversations = data.get("response") or data.get("result") or data
    if not isinstance(conversations, list):
        logger.warning("Unexpected inbox response format")
        return

    st = _load_processed_state()
    processed_ids: set[int] = set(st.get("ids") or set())
    seen_sigs: set[str] = set(st.get("sigs") or set())
    new_ids: set[int] = set()
    new_sigs: set[str] = set()

    for conv in conversations:
        conv_id = conv.get("id") or conv.get("ID")
        if conv_id is None:
            continue
        conv_id = int(conv_id)
        if conv_id in processed_ids:
            continue
        # Timestamp + content signature gate
        ts = _parse_conv_timestamp(conv)
        sig = _conv_signature(conv)
        if sig in seen_sigs:
            processed_ids.add(conv_id)
            new_sigs.add(sig)  # ensure persisted
            continue
        # Record early so restarts/crashes don't cause re-processing
        processed_ids.add(conv_id)
        seen_sigs.add(sig)
        new_ids.add(conv_id)
        new_sigs.add(sig)
        _save_processed_state({"ids": processed_ids, "sigs": seen_sigs})

        subject = (conv.get("subject") or "").strip()
        from_email = (conv.get("from") or conv.get("sender") or "").strip()
        # Early mailbox detection (Phase 1) — before fetch, log source_inbox
        mailbox_type = _detect_mailbox(conv, None, from_email)
        logger.info("Processing conversation %s: %s from %s (ts=%s) source_inbox=%s", conv_id, subject[:80], from_email, ts or "?", mailbox_type)

        msg_full = _fetch_message(conv_id)
        body_for_sig = None
        if msg_full:
            body_for_sig = _email_intro_text(msg_full)
            sig = _conv_signature(conv, body_for_sig)
            if sig in seen_sigs:
                new_sigs.add(sig)
                _save_processed_state({"ids": processed_ids, "sigs": seen_sigs})
                continue
            seen_sigs.add(sig)
            new_sigs.add(sig)
            _save_processed_state({"ids": processed_ids, "sigs": seen_sigs})

        try:
            log_entry = _process_email(msg_full, conv_id, conv=conv) if msg_full else None
            le = log_entry or {}
            # Decide whether to mark read:
            # - Any linked opp
            # - Successful task creation (for actionable like JN)
            # - Explicit classifications that are handled via task/link
            should_mark = bool(le.get("linked_opp_id"))
            tr = le.get("task_results") or []
            if any((isinstance(r, (list, tuple)) and r[1]) for r in tr):
                should_mark = True
            cls = le.get("classification") or ""
            if cls in ("jobnimbus_task", "jobnimbus_new_job", "jobnimbus_mention_est"):
                should_mark = True

            if should_mark:
                ok, stt, err = _mark_conversation_read(conv_id)
                if ok:
                    le.setdefault("actions_taken", []).append("marked_read")
                    logger.info("Marked conversation %s as read", conv_id)
                else:
                    logger.warning("Mark read failed for %s: %s", conv_id, err)
                    le.setdefault("errors", []).append(f"marked_read:{stt}:{(err or '')[:200]}")
            else:
                # Ambiguous / no plausible opp: apply Bot Review mail tag (in shared reviewer inbox), leave unread.
                # Also explicit flag from rules (e.g. ambiguous liberty/highland JN mentions).
                apply_tag = bool(le.get("apply_bot_review_mail")) or cls in ("uncertain", "carrier_adjuster_email", "claim_code_only", "acculynx_other", "supplement_discussion", "jobnimbus_mention_ambiguous")
                if apply_tag:
                    ok, stt, err = _apply_bot_review_mail_tag(conv_id)
                    if ok:
                        le.setdefault("actions_taken", []).append("tagged_bot_review")
                    else:
                        le.setdefault("errors", []).append(f"tagged_bot_review:{stt}:{(err or '')[:200]}")
            # Persist the final actions (tag / mark) into the log so UI and verification see them.
            # We append the updated entry; the original classification entry is already there.
            if any(a in ("tagged_bot_review", "marked_read") for a in (le.get("actions_taken") or [])):
                _append_log_entry(le)
        except Exception as e:
            logger.error("Error processing conversation %s: %s", conv_id, e)

    # Final persist (ids/sigs already added early)
    _save_processed_state({"ids": processed_ids, "sigs": seen_sigs})

    if new_ids:
        logger.info("Processed %s new conversations (timestamp+sig gate active)", len(new_ids))

    if _is_dry_run():
        logger.info("DRY RUN: all create_deals/create_tasks/post_notes/notify_users are false. No further mutations performed this cycle.")


def _scanner_loop() -> None:
    logger.info("Mail scanner started (interval: %ss, portal: %s, ml_enabled: %s)", SCANNER_POLL_INTERVAL, PORTAL_URL, ML_ENABLED)
    _load_contractors()
    _fetch_tag_cache()
    if ML_ENABLED:
        _init_ml()

    if SCANNER_ENABLED:
        # === POST-DEPLOYMENT SAFEGUARD (RETROACTIVE SCAN PREVENTION) ===
        # On the absolute first run after a production deployment (when processed_ids.json
        # does not exist), we seed all currently visible conversation IDs as "already processed"
        # WITHOUT taking any actions (no tasks, notes, deals, tags). This ensures the scanner
        # only acts on NEW emails that arrive AFTER this deployment, preventing duplication
        # of work that humans have already performed on the existing inbox.
        #
        # IMPORTANT:
        # - During active testing and development: LEAVE THE LINE BELOW COMMENTED.
        #   This allows the scanner to act on current inbox contents for validation
        #   of new rules (e.g. jobnimbus_mention_est body scanning).
        # - When preparing the GitHub commit that turns the scanner "live" in production
        #   (with real actions enabled), UNCOMMENT the line below.
        # - On the production droplet at go-live time, it is recommended to ensure
        #   processed_ids.json is absent (or empty) so the seed captures the exact
        #   inbox state at the moment the scanner is activated.
        #
        # The seed function itself is always defined and safe to call; only the
        # invocation here is what gets toggled.

        # _seed_existing_conversations_as_processed()   # <-- UNCOMMENT ON PRODUCTION GO-LIVE COMMIT

        _poll_inbox()

    while True:
        time.sleep(SCANNER_POLL_INTERVAL)
        if SCANNER_ENABLED:
            try:
                _poll_inbox()
            except Exception as e:
                logger.error("Scanner poll iteration failed: %s", e)


def start_scanner(config: dict[str, Any] | None = None) -> threading.Thread:
    if config:
        configure(**config)

    thread = threading.Thread(target=_scanner_loop, daemon=True, name="mail-scanner")
    thread.start()
    logger.info("Mail scanner daemon thread started")
    return thread


def _feedback_count() -> int:
    """Return the number of feedback entries on disk."""
    if not FEEDBACK_FILE.exists():
        return 0
    count = 0
    try:
        with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    count += 1
    except OSError:
        pass
    return count


def get_scanner_status() -> dict[str, Any]:
    processed = _load_processed_ids()
    cfg = get_contractors() or {}
    at = cfg.get("action_toggles") or {}
    model_path = ML_MODEL_DIR / "classifier_head.pkl"
    summary_path = ML_MODEL_DIR / "training_summary.json"
    summary: dict[str, Any] = {}
    if summary_path.exists():
        try:
            summary = json.loads(summary_path.read_text("utf-8"))
        except Exception:
            pass
    return {
        "enabled": SCANNER_ENABLED,
        "poll_interval_s": SCANNER_POLL_INTERVAL,
        "portal_url": PORTAL_URL,
        "email": SCANNER_CRM_EMAIL,
        "processed_ids_file": str(PROCESSED_IDS_FILE),
        "log_file": str(LOG_FILE),
        "create_deals": SCANNER_CREATE_DEALS,
        "create_tasks": SCANNER_CREATE_TASKS,
        "post_notes": SCANNER_POST_NOTES,
        "notify_users": SCANNER_NOTIFY_USERS,
        "action_toggles": at,
        "total_processed": len(processed),
        "strong_custom_field_ids": _effective_strong_custom_field_ids(),
        "feedback_count": _feedback_count(),
        "ml_model_exists": model_path.exists(),
        "ml_model_path": str(model_path),
        "ml_summary": summary,
    }


def get_scanner_log(limit: int = 200) -> list[dict[str, Any]]:
    if not LOG_FILE.exists():
        return []
    try:
        entries: list[dict[str, Any]] = []
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        entries.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass
        # Return newest first (reverse chronological)
        return list(reversed(entries[-limit:]))
    except OSError:
        return []


def retrain_classifier_head(mock_samples: int = 300, use_feedback: bool = True) -> dict[str, Any]:
    """Retrain the ML classifier head using mock data + user feedback.

    Runs train_ml_head.py in a subprocess so the heavy ML libraries don't block
    the scanner thread. Returns summary or error info.
    """
    script = ROOT / "train_ml_head.py"
    if not script.exists():
        return {"ok": False, "error": "train_ml_head.py not found"}
    # Prefer .venv-ml python if it has sentence-transformers installed
    venv_ml_python = ROOT / ".venv-ml" / "bin" / "python3"
    if venv_ml_python.exists():
        py = str(venv_ml_python)
    else:
        py = sys.executable
    cmd = [py, str(script)]
    if use_feedback:
        cmd.append("--mock-and-feedback")
    else:
        cmd.append("--generate-mock")
    cmd.extend(["--samples", str(mock_samples)])
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600,
            cwd=str(ROOT),
        )
        if result.returncode != 0:
            return {"ok": False, "error": result.stderr or result.stdout or "training failed"}
        # Try to load training summary for accuracy
        summary_path = ML_MODEL_DIR / "training_summary.json"
        summary: dict[str, Any] = {}
        if summary_path.exists():
            try:
                summary = json.loads(summary_path.read_text("utf-8"))
            except Exception:
                pass
        return {
            "ok": True,
            "summary": summary,
            "output": result.stdout[-2000:],
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "Training timed out (10 minutes)"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def reprocess_conversations(conversation_ids: list[int]) -> list[dict[str, Any]]:
    """Re-process specific conversation IDs (for admin verification).
    Fetches each conversation's message, runs _process_email, returns results.
    Does NOT update processed_ids — the original processed record is preserved.
    """
    results: list[dict[str, Any]] = []
    for cid in conversation_ids:
        try:
            msg_full = _fetch_message(cid)
            if not msg_full:
                results.append({"conversation_id": cid, "error": "message_not_found"})
                continue
            # Build a minimal conv dict for mailbox detection
            conv = {"id": cid, "subject": msg_full.get("subject", ""), "from": msg_full.get("from", "")}
            log_entry = _process_email(msg_full, cid, conv=conv)
            results.append(log_entry or {"conversation_id": cid, "error": "no_result"})
        except Exception as e:
            logger.error("Reprocess failed for conversation %s: %s", cid, e)
            results.append({"conversation_id": cid, "error": str(e)})
    return results
