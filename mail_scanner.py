"""Background daemon that polls CRM inbox, classifies emails, and takes actions."""

from __future__ import annotations

import html
import json
import logging
import os
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger("mail_scanner")

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data" / "mail_scanner"
DATA_DIR.mkdir(parents=True, exist_ok=True)

PROCESSED_IDS_FILE = DATA_DIR / "processed_ids.json"
LOG_FILE = DATA_DIR / "log.jsonl"
CONTRACTORS_FILE = DATA_DIR / "contractors.json"
CACHED_TAGS_FILE = DATA_DIR / "cached_tags.json"

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
        },
        {
            "id": "highland",
            "name": "Highland Adjusters",
            "crm_contact_name": "Highland Adjusters",
            "email_domains": ["highlandadjusters.com", "jobnimbusmail.com"],
            "forwarded_from_domains": ["ken.chapman@libertyrg.com"],
            "action": "create_tasks_only",
            "responsible": "ken",
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
        "supplement_new_project": ["rebeca", "claudiu"],
        "supplement_request": ["ken", "claudiu"],
        "new_potential": ["rebeca", "claudiu"],
        "reconciliation": ["ken", "claudiu"],
        "adjuster_action": ["ken", "claudiu"],
        "carrier_email": ["ken", "claudiu"],
        "carrier_email_notify": ["ken", "claudiu"],
        "supplement_discussion_request": ["ken", "claudiu"],
        "acculynx_other": ["rebeca", "claudiu"],
        "uncertain": ["rebeca", "claudiu"],
    },
}

# Canonical tag titles fetched from CRM on startup
TAG_MISSING_INFO = "Missing Info"
TAG_NEEDS_RECONCILIATION = "Needs reconciliation"
TAG_NEEDS_REBUTTAL = "NEEDS REBUTTAL"
TAG_PAUSE_CALLING = "PAUSE CALLING"

# Env-based config (set by server.py before starting scanner)
PORTAL_URL = ""
SCANNER_CRM_EMAIL = ""
SCANNER_CRM_PASSWORD = ""
SCANNER_POLL_INTERVAL = 120
SCANNER_ENABLED = True
SCANNER_CREATE_DEALS = True
SCANNER_CREATE_TASKS = True
SCANNER_POST_NOTES = True
SCANNER_NOTIFY_USERS = True
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


def _ssl_context() -> Any:
    if SSL_VERIFY:
        return None
    import ssl
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def _crm_api(method: str, path: str, body: bytes | None = None, query: str = "", timeout: int = 30) -> tuple[int, Any]:
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


def _load_processed_ids() -> set[int]:
    if PROCESSED_IDS_FILE.exists():
        try:
            data = json.loads(PROCESSED_IDS_FILE.read_text("utf-8"))
            return set(data.get("ids", []))
        except (json.JSONDecodeError, OSError):
            return set()
    return set()


def _save_processed_ids(ids: set[int]) -> None:
    try:
        PROCESSED_IDS_FILE.write_text(json.dumps({"ids": sorted(ids)}), "utf-8")
    except OSError as e:
        logger.error("Failed to save processed IDs: %s", e)


def _append_log_entry(entry: dict[str, Any]) -> None:
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except OSError as e:
        logger.error("Failed to write log entry: %s", e)


def _load_contractors() -> dict[str, Any]:
    global _contractors_config
    if CONTRACTORS_FILE.exists():
        try:
            _contractors_config = json.loads(CONTRACTORS_FILE.read_text("utf-8"))
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


def _fetch_message(conversation_id: int, message_id_field: str | None = None) -> dict[str, Any] | None:
    status, data = _crm_api("GET", f"/api/2.0/mail/messages/{conversation_id}.json")
    if status < 400:
        msg = data.get("response") or data.get("result") or data
        if isinstance(msg, dict):
            return msg
    return None


def _extract_claim_code(subject: str) -> str:
    m = re.match(r"^[A-Za-z0-9\-]{5,30}$", subject.strip())
    if m:
        return m.group(0).strip()
    m = re.search(r"(\b[A-Za-z0-9]{5,20}\b)", subject)
    if m:
        return m.group(1)
    return ""


def _extract_job_id(subject: str, body_text: str) -> str:
    m = re.search(r"(?:Job|job):?\s*([A-Z]{2}\s*-?\s*\d+)", subject + "\n" + body_text)
    if m:
        return m.group(1).strip()
    return ""


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


def _dedup_opportunity(claimant: str, job_id: str, claim_code: str, body_text: str) -> dict[str, Any] | None:
    if job_id:
        opps = _search_opportunities(job_id)
        for opp in opps:
            stored_job_id = _get_custom_field(opp, FIELD_CRM_JOB_ID)
            if stored_job_id and job_id in stored_job_id:
                return opp

    if claim_code:
        opps = _search_opportunities(claim_code)
        for opp in opps:
            stored_claim = _get_custom_field(opp, FIELD_CLAIM_NUMBER)
            if stored_claim and claim_code in stored_claim:
                return opp

    if claimant:
        opps = _search_opportunities(claimant)
        if not opps:
            return None
        address = _extract_address_from_body(body_text)
        for opp in opps:
            if address:
                stored_addr = _get_custom_field(opp, FIELD_ADDRESS)
                if stored_addr and address.lower() in stored_addr.lower():
                    return opp
        return None
    return None


def _link_email_to_opportunity(conversation_id: int, opp_id: int) -> bool:
    body = json.dumps({"messageId": conversation_id, "entityType": "opportunity", "entityId": opp_id}).encode("utf-8")
    status, data = _crm_api("PUT", "/api/2.0/mail/conversations/crm/link.json", body=body)
    return status < 400


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


def _add_tag(opp_id: int, tag_title: str) -> bool:
    canonical = _get_canonical_tag(tag_title)
    body = json.dumps({"tagName": canonical}).encode("utf-8")
    status, _ = _crm_api("POST", f"/api/2.0/crm/opportunity/{opp_id}/tag", body=body)
    if status >= 400:
        logger.warning("Failed to add tag '%s' to opp %s (status %s)", canonical, opp_id, status)
    return status < 400


def _post_note(opp_id: int, content: str, notify_users: list[str] | None = None) -> bool:
    safe_content = _sanitize_body(content) if "<" in content else content
    payload: dict[str, Any] = {"entityType": "opportunity", "entityId": opp_id, "content": safe_content, "categoryId": 1}
    if notify_users and SCANNER_NOTIFY_USERS:
        payload["notifyUserList"] = notify_users
    status, _ = _crm_api("POST", "/api/2.0/crm/history", body=json.dumps(payload).encode("utf-8"))
    return status < 400


def _create_task(title: str, description: str, responsible_id: str, category_id: int, opp_id: int | None = None, notify: bool = True) -> bool:
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
    status, data = _crm_api("POST", "/api/2.0/crm/task", body=json.dumps(payload).encode("utf-8"))
    if status < 400:
        task = data.get("response") or data.get("result") or data
        task_id = task.get("id") or task.get("ID")
        if task_id and notify:
            _crm_api("POST", f"/api/2.0/crm/task/{task_id}/notify", body=b"{}")
        return True
    return False


def _create_task_for_assignees(title: str, description: str, assignees: list[str], category_id: int, opp_id: int | None = None) -> None:
    for uid in assignees:
        _create_task(title, description, uid, category_id, opp_id)


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


def _notify_users_for(rule_name: str) -> list[str] | None:
    if not SCANNER_NOTIFY_USERS:
        return None
    uuids = _resolve_assignees(rule_name)
    return uuids if uuids else None


def _process_email(msg: dict[str, Any], conversation_id: int, _depth: int = 0) -> dict[str, Any] | None:
    subject = (msg.get("subject") or "").strip()
    from_email = (msg.get("from") or msg.get("sender") or "").strip().lower()
    intro = _email_intro_text(msg)
    body_text = intro
    html_body = msg.get("htmlBody") or ""

    log_entry: dict[str, Any] = {
        "conversation_id": conversation_id,
        "subject": subject,
        "from": from_email,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "classification": None,
        "actions_taken": [],
    }

    subject_lower = subject.lower()
    body_lower = body_text.lower()
    contractors_cfg = get_contractors()
    carriers = contractors_cfg.get("insurance_carriers", DEFAULT_CONTRACTORS["insurance_carriers"])
    carrier_pattern = r"\b(" + "|".join(re.escape(c) for c in carriers) + r")\b"
    has_carrier = re.search(carrier_pattern, subject + "\n" + body_text, re.IGNORECASE)

    # --- Classifier rules (ordered, first-match-wins) ---

    # 01. JobNimbus: New Task Assigned
    m = re.search(r"new task assigned in jobnimbus:\s*(.+)", subject_lower)
    if m:
        task_name = m.group(1).strip()
        desc_match = re.search(r"assigned you a new task\s*:\s*(.+?)(?:\n|$)", body_text)
        description = desc_match.group(1).strip() if desc_match else body_text[:500]
        log_entry["classification"] = "jobnimbus_task"
        if SCANNER_CREATE_TASKS:
            assignees = _resolve_assignees("jobnimbus_task")
            if assignees:
                _create_task(
                    f"JobNimbus Task: {task_name}",
                    description,
                    assignees[0], TASK_CAT_ESTIMATE,
                )
                log_entry["actions_taken"].append("created_task")
        _append_log_entry(log_entry)
        return log_entry

    # 02. JobNimbus: New Job Assigned
    m = re.search(r"(.+?) assigned you a new job:\s*(.+)", subject_lower)
    if m:
        job_name = m.group(2).strip()
        assigner = m.group(1).strip()
        addr_match = re.search(r"(\d{1,5}\s+[A-Za-z0-9\s,]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Circle|Cir|Blvd|Boulevard|Way)[\s,]*[A-Z]{2})", body_text, re.IGNORECASE)
        address = addr_match.group(1).strip() if addr_match else ""
        desc = f"Assigned by {assigner}. New job: {job_name}. Address: {address}".strip()
        log_entry["classification"] = "jobnimbus_new_job"
        if SCANNER_CREATE_TASKS:
            assignees = _resolve_assignees("jobnimbus_new_job")
            if assignees:
                _create_task(
                    f"Review new job: {job_name}" + (f" — {address}" if address else ""),
                    desc,
                    assignees[0], TASK_CAT_ESTIMATE,
                )
                log_entry["actions_taken"].append("created_task")
        _append_log_entry(log_entry)
        return log_entry

    # 03. JobNimbus: Mention
    m = re.search(r"(.+?) has mentioned you on the contact \"(.+?)\"", subject_lower)
    if m:
        log_entry["classification"] = "jobnimbus_mention"
        log_entry["actions_taken"].append("skipped")
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

        existing = _dedup_opportunity(claimant, job_id, "", body_text)
        if existing:
            opp_id = int(existing.get("id") or existing.get("ID", 0))
            if is_completed:
                if SCANNER_POST_NOTES:
                    _post_note(opp_id, f"Supplement completed: {body_text[:1000]}")
                    log_entry["actions_taken"].append("posted_note")
            else:
                if SCANNER_POST_NOTES:
                    _post_note(opp_id, f"Supplement update: {body_text[:1000]}")
                    log_entry["actions_taken"].append("posted_note")
                if SCANNER_CREATE_TASKS and SCANNER_NOTIFY_USERS:
                    _create_task_for_assignees(
                        f"Supplement request — {claimant}",
                        body_text[:500],
                        _resolve_assignees("supplement_request"), TASK_CAT_ESTIMATE, opp_id,
                    )
                    log_entry["actions_taken"].append("created_task")
        else:
            if SCANNER_CREATE_DEALS:
                opp_id = _create_opportunity(claimant, STAGE_NEW_SUPPLEMENT)
                if opp_id:
                    cf_fields = {}
                    if job_id:
                        cf_fields[FIELD_CRM_JOB_ID] = job_id
                    _set_custom_fields(opp_id, cf_fields)
                    _add_tag(opp_id, TAG_MISSING_INFO)
                    _link_email_to_opportunity(conversation_id, opp_id)
                    if SCANNER_POST_NOTES:
                        _post_note(opp_id, f"New supplement project: {body_text[:1000]}")
                    if SCANNER_CREATE_TASKS:
                        _create_task_for_assignees(
                            f"Review new project: {claimant}",
                            f"New supplement project from email. Job: {job_id}" if job_id else "New supplement project from email.",
                            _resolve_assignees("supplement_new_project"), TASK_CAT_FOLLOW_UP, opp_id,
                        )
                    log_entry["actions_taken"].extend(["created_deal", "added_tag", "linked_email"])
            else:
                if SCANNER_CREATE_TASKS:
                    _create_task_for_assignees(
                        f"Review new project: {claimant}",
                        f"New supplement project from email. Job: {job_id}" if job_id else "New supplement project from email.",
                        _resolve_assignees("supplement_new_project"), TASK_CAT_FOLLOW_UP,
                    )
                    log_entry["actions_taken"].append("created_task")
        _append_log_entry(log_entry)
        return log_entry

    # 05. Acculynx: Job Notification
    m = re.search(r"job notification:\s*(?:\d+|[A-Z]{2}\s*-\s*\d+):\s*(.+)", subject_lower)
    if m:
        claimant = m.group(1).strip()
        job_id = _extract_job_id(subject, body_text)
        log_entry["classification"] = "check_claimant"
        log_entry["claimant"] = claimant

        existing = _dedup_opportunity(claimant, job_id, "", body_text)
        if existing:
            opp_id = int(existing.get("id") or existing.get("ID", 0))
            if SCANNER_POST_NOTES:
                _post_note(opp_id, f"Email update via Acculynx: {body_text[:1000]}")
                log_entry["actions_taken"].append("posted_note")
            _link_email_to_opportunity(conversation_id, opp_id)
            log_entry["actions_taken"].append("linked_email")
        else:
            if SCANNER_CREATE_TASKS:
                _create_task_for_assignees(
                    f"New potential: {claimant}",
                    f"New job notification from Acculynx. Review and create deal if needed.\n\n{body_text[:500]}",
                    _resolve_assignees("new_potential"), TASK_CAT_FOLLOW_UP,
                )
                log_entry["actions_taken"].append("created_task")
        _append_log_entry(log_entry)
        return log_entry

    # 06. Reconciliation / Carrier Estimate Revision
    has_reconcile = re.search(r"\breconcil", subject_lower + "\n" + body_lower)
    is_carrier_estimate = (
        has_carrier
        and any(phrase in body_lower for phrase in ESTIMATE_REVISION_PHRASES)
    )
    if has_reconcile or is_carrier_estimate:
        claim_code = _extract_claim_code(subject)
        claimant = _extract_claimant_from_body(body_text)
        log_entry["classification"] = "reconciliation_task"
        log_entry["claim_code"] = claim_code
        log_entry["claimant"] = claimant

        existing = _dedup_opportunity(claimant, "", claim_code, body_text)
        if existing:
            opp_id = int(existing.get("id") or existing.get("ID", 0))
            if SCANNER_POST_NOTES:
                _post_note(opp_id, f"Needs reconciliation: {body_text[:1000]}", notify_users=_notify_users_for("reconciliation"))
                log_entry["actions_taken"].append("posted_note")
            _add_tag(opp_id, TAG_NEEDS_RECONCILIATION)
            log_entry["actions_taken"].append("added_tag")
            if SCANNER_CREATE_TASKS:
                _create_task_for_assignees(
                    f"Reconcile estimate — {claim_code}",
                    f"Reconciliation needed for claim {claim_code}. {body_text[:500]}",
                    _resolve_assignees("reconciliation"), TASK_CAT_ESTIMATE, opp_id,
                )
                log_entry["actions_taken"].append("created_task")
        _append_log_entry(log_entry)
        return log_entry

    # 07. Adjuster Action Request
    adjuster_keywords = r"adjuster\s+(wants|requested|said|made|need|will|review|assign|sent|confirm|asked|required)"
    if re.search(adjuster_keywords, subject_lower) or re.search(adjuster_keywords, body_lower):
        claim_code = _extract_claim_code(subject)
        log_entry["classification"] = "adjuster_action"
        log_entry["claim_code"] = claim_code

        existing = _dedup_opportunity("", "", claim_code, body_text)
        if existing:
            opp_id = int(existing.get("id") or existing.get("ID", 0))
            action_text = subject
            m = re.search(r"adjuster\s+(wants|requested|said|made|need|will|review|assign|sent|confirm|asked|required)\s*(.*)", subject_lower, re.IGNORECASE)
            if m:
                action_text = f"Adjuster {m.group(1)}: {m.group(2).strip()}"
            if SCANNER_POST_NOTES:
                _post_note(opp_id, f"Adjuster action: {action_text}\n\n{body_text[:2000]}", notify_users=_notify_users_for("adjuster_action"))
                log_entry["actions_taken"].append("posted_note")
            _add_tag(opp_id, TAG_NEEDS_REBUTTAL)
            _add_tag(opp_id, TAG_PAUSE_CALLING)
            log_entry["actions_taken"].append("added_tags")
            if SCANNER_CREATE_TASKS:
                _create_task_for_assignees(
                    f"Adjuster response needed — {claim_code}",
                    action_text,
                    _resolve_assignees("adjuster_action"), TASK_CAT_ESTIMATE, opp_id,
                )
                log_entry["actions_taken"].append("created_task")
        _append_log_entry(log_entry)
        return log_entry

    # 08. Carrier/Insurance Company Email
    if has_carrier:
        claim_code = _extract_claim_code(subject)
        log_entry["classification"] = "carrier_adjuster_email"
        log_entry["claim_code"] = claim_code
        log_entry["carrier"] = has_carrier.group(1)

        existing = _dedup_opportunity("", "", claim_code, body_text)
        if existing:
            opp_id = int(existing.get("id") or existing.get("ID", 0))
            if SCANNER_POST_NOTES:
                note_text = f"Email from {has_carrier.group(1)}.\n\nSubject: {subject}\n\n{body_text[:3000]}"
                _post_note(opp_id, note_text, notify_users=_notify_users_for("carrier_email_notify"))
                log_entry["actions_taken"].append("posted_note")
            _add_tag(opp_id, TAG_NEEDS_REBUTTAL)
            _add_tag(opp_id, TAG_PAUSE_CALLING)
            log_entry["actions_taken"].append("added_tags")
            m = re.search(r"(request|need|require|please|send|provide|upload|submit)", body_lower)
            if m and SCANNER_CREATE_TASKS:
                _create_task_for_assignees(
                    f"Review carrier request — {claim_code}",
                    f"Carrier ({has_carrier.group(1)}) request in email.\n\nSubject: {subject}\n\n{body_text[:1000]}",
                    _resolve_assignees("carrier_email"), TASK_CAT_ESTIMATE, opp_id,
                )
                log_entry["actions_taken"].append("created_task")
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

            existing = _dedup_opportunity(claimant, "", claim_code, body_text)
            if existing:
                opp_id = int(existing.get("id") or existing.get("ID", 0))
                if SCANNER_POST_NOTES:
                    _post_note(opp_id, f"Supplement discussion: {body_text[:2000]}")
                    log_entry["actions_taken"].append("posted_note")
                m = re.search(r"(request|need|require|please|send|provide|upload|submit|quote|estimate)", body_lower)
                if m and SCANNER_CREATE_TASKS:
                    _create_task_for_assignees(
                        f"Supplement request — {claim_code}",
                        body_text[:500],
                        _resolve_assignees("supplement_discussion_request"), TASK_CAT_ESTIMATE, opp_id,
                    )
                    log_entry["actions_taken"].append("created_task")
            _append_log_entry(log_entry)
            return log_entry

    # 10. Claim Code Only (BCC Record)
    if re.match(r"^[A-Za-z0-9\-]{5,30}$", subject.strip()):
        claim_code = subject.strip()
        log_entry["classification"] = "claim_code_only"
        log_entry["claim_code"] = claim_code

        existing = _dedup_opportunity("", "", claim_code, body_text)
        if existing:
            opp_id = int(existing.get("id") or existing.get("ID", 0))
            if SCANNER_POST_NOTES:
                _post_note(opp_id, f"Email record: {subject}\n\n{body_text[:1000]}")
                log_entry["actions_taken"].append("posted_note")
            _link_email_to_opportunity(conversation_id, opp_id)
            log_entry["actions_taken"].append("linked_email")
        elif _depth < 1:
            msg_full = _fetch_message(conversation_id)
            if msg_full:
                return _process_email(msg_full, conversation_id, _depth + 1)
        _append_log_entry(log_entry)
        return log_entry

    # 11. Acculynx Other
    if "acculynx" in from_email or "acculynx" in from_email.lower():
        log_entry["classification"] = "acculynx_other"
        if SCANNER_CREATE_TASKS:
            _create_task_for_assignees(
                f"Review email: {subject[:100]}",
                f"Unclassified Acculynx email.\n\nFrom: {from_email}\nSubject: {subject}\n\n{body_text[:500]}",
                _resolve_assignees("acculynx_other"), TASK_CAT_FOLLOW_UP,
            )
            log_entry["actions_taken"].append("created_task")
        _append_log_entry(log_entry)
        return log_entry

    # 12. Uncertain
    log_entry["classification"] = "uncertain"
    if SCANNER_CREATE_TASKS:
        _create_task_for_assignees(
            f"Review email: {subject[:100]}",
            f"Unclassified email.\n\nFrom: {from_email}\nSubject: {subject}\n\n{body_text[:500]}",
            _resolve_assignees("uncertain"), TASK_CAT_FOLLOW_UP,
        )
        log_entry["actions_taken"].append("created_task")
    _append_log_entry(log_entry)
    return log_entry


def _poll_inbox() -> None:
    status, data = _crm_api("GET", "/api/2.0/mail/conversations.json", query="folder=1&page_size=50")
    if status >= 400:
        logger.error("Failed to fetch inbox (status %s)", status)
        return

    conversations = data.get("response") or data.get("result") or data
    if not isinstance(conversations, list):
        logger.warning("Unexpected inbox response format")
        return

    processed = _load_processed_ids()
    new_ids: set[int] = set()

    for conv in conversations:
        conv_id = conv.get("id") or conv.get("ID")
        if conv_id is None:
            continue
        conv_id = int(conv_id)
        if conv_id in processed:
            continue
        new_ids.add(conv_id)
        subject = (conv.get("subject") or "").strip()
        from_email = (conv.get("from") or conv.get("sender") or "").strip()
        logger.info("Processing conversation %s: %s from %s", conv_id, subject[:80], from_email)

        msg_full = _fetch_message(conv_id)
        if msg_full:
            try:
                _process_email(msg_full, conv_id)
            except Exception as e:
                logger.error("Error processing conversation %s: %s", conv_id, e)

    processed.update(new_ids)
    _save_processed_ids(processed)

    if new_ids:
        logger.info("Processed %s new conversations", len(new_ids))


def _scanner_loop() -> None:
    logger.info("Mail scanner started (interval: %ss, portal: %s)", SCANNER_POLL_INTERVAL, PORTAL_URL)
    _load_contractors()
    _fetch_tag_cache()

    if SCANNER_ENABLED:
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


def get_scanner_status() -> dict[str, Any]:
    processed = _load_processed_ids()
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
        "total_processed": len(processed),
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
        return entries[-limit:]
    except OSError:
        return []
