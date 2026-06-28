"""Telegram bot for customer project status queries.

Usage:
  TELEGRAM_BOT_TOKEN=xxx DASHBOARD_URL=http://127.0.0.1:8765 python3 telegram_bot.py

The bot polls Telegram for messages, verifies invite codes, and returns
curated project info from the CRM (via the dashboard proxy).

Customer flow (once linked):
  - Send a project name (or part of it) to search open projects.
  - 1 match  → full detail is shown immediately.
  - N matches → numbered list; reply with a number for full detail.
  - 0 matches → "No projects found matching '...'".
  - Send /help for instructions.
"""

from __future__ import annotations

import asyncio
import email.utils
import html
import json
import logging
from html.parser import HTMLParser
import os
import re
import sys

import httpx

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("crm_bot")

# Load .env file like server.py does
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.isfile(_env_path):
    for line in open(_env_path, encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value

DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "http://127.0.0.1:8765")
TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
PORTAL = os.environ.get("ONLYOFFICE_PORTAL_URL", "")

# Last search results per chat, used to interpret "1", "2", ... replies.
_last_search: dict[int, str] = {}
_last_deals: dict[int, list[dict]] = {}
_last_employee: dict[int, bool] = {}

# ── Helpers ──

BOT_AUTH_HEADERS: dict[str, str] = {}


def _auth_headers() -> dict[str, str]:
    if not BOT_AUTH_HEADERS and TOKEN:
        BOT_AUTH_HEADERS["Authorization"] = f"Bearer {TOKEN}"
    return BOT_AUTH_HEADERS


def _fmt_money(amount: float, currency: str) -> str:
    if amount <= 0:
        return ""
    symbols = {"USD": "$", "EUR": "€", "GBP": "£", "": "$"}
    sym = symbols.get(currency.upper(), f"{currency} ")
    if amount == int(amount):
        return f"{sym}{int(amount):,}"
    return f"{sym}{amount:,.2f}"


def _fmt_date(iso_str: str) -> str:
    if not iso_str:
        return ""
    try:
        dt = iso_str.replace("T", " ").replace("Z", "").split(".")[0]
        parts = dt.split(" ")
        date_part = parts[0]
        if len(date_part) >= 10:
            y, m, d = date_part[:4], date_part[5:7], date_part[8:10]
            months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            m_name = months[int(m)] if 1 <= int(m) <= 12 else m
            return f"{m_name} {int(d)}, {y}"
    except Exception:
        pass
    return iso_str[:10]


# ── API Calls ──

async def _get(path: str, params: dict | None = None) -> dict | None:
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{DASHBOARD_URL}{path}",
                params=params,
                headers=_auth_headers(),
                timeout=30,
            )
            if resp.status_code == 200:
                return resp.json()
            logger.warning("GET %s -> %d %s", path, resp.status_code, resp.text[:200])
            return None
    except httpx.RequestError as e:
        logger.error("GET %s failed: %s", path, e)
        return None


async def _post(path: str, data: dict) -> dict | None:
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{DASHBOARD_URL}{path}",
                json=data,
                headers=_auth_headers(),
                timeout=30,
            )
            if resp.status_code == 200:
                return resp.json()
            logger.warning("POST %s -> %d %s", path, resp.status_code, resp.text[:200])
            return None
    except httpx.RequestError as e:
        logger.error("POST %s failed: %s", path, e)
        return None


async def get_mapping(chat_id: int) -> dict | None:
    return await _get("/api/bot/me", {"chatId": chat_id})


async def get_deals(contact_id: int | None, chat_id: int | None = None, search: str | None = None, employee: bool = False) -> list[dict] | None:
    params: dict = {}
    if contact_id is not None:
        params["contactId"] = contact_id
    if chat_id:
        params["chatId"] = chat_id
    if search:
        params["search"] = search
    if employee:
        params["employee"] = "true"
    result = await _get("/api/bot/deals", params)
    if result is None:
        return None  # API error (unreachable / timeout)
    if "deals" in result:
        return result["deals"]
    return []


async def verify_code(code: str, chat_id: int) -> dict | None:
    return await _post("/api/bot-customers/verify-code", {
        "code": code,
        "chatId": chat_id,
        "portal": PORTAL,
    })


# ── Message Formatting ──

def _esc(text: str) -> str:
    return html.escape(str(text), quote=False)


_TELEGRAM_HTML_TAGS = frozenset({
    'b', 'strong', 'i', 'em', 'u', 'ins',
    's', 'strike', 'del',
    'a', 'code', 'pre',
})


class _TelegramHTMLSanitizer(HTMLParser):
    """Strip unsupported tags (keep their text) and preserve allowed Telegram tags."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.result: list[str] = []
        self.open_tags: list[str] = []

    def _escape_text(self, text: str) -> str:
        return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

    def _build_attrs(self, attrs: list[tuple[str, str | None]]) -> str:
        parts: list[str] = []
        for key, value in attrs:
            if value is None:
                continue
            # href for <a> is handled separately; skip it here.
            if key.lower() == 'href':
                continue
            escaped = (value
                       .replace('&', '&amp;')
                       .replace('"', '&quot;')
                       .replace("'", '&#39;')
                       .replace('<', '&lt;')
                       .replace('>', '&gt;'))
            parts.append(f' {key.lower()}="{escaped}"')
        return ''.join(parts)

    def _rebuild_a_tag(self, attrs: list[tuple[str, str | None]]) -> str | None:
        href = None
        for key, value in attrs:
            if key.lower() == 'href' and value:
                href = value
                break
        if not href:
            return None
        href = (href
                .replace('&', '&amp;')
                .replace('"', '&quot;')
                .replace("'", '&#39;')
                .replace('<', '&lt;')
                .replace('>', '&gt;'))
        return f'<a href="{href}">'

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag_lower = tag.lower()
        if tag_lower == 'br':
            self.result.append('\n')
            return
        if tag_lower not in _TELEGRAM_HTML_TAGS:
            return
        if tag_lower == 'a':
            rebuilt = self._rebuild_a_tag(attrs)
            if rebuilt:
                self.result.append(rebuilt)
                self.open_tags.append('a')
            return
        attrs_str = self._build_attrs(attrs)
        self.result.append(f'<{tag_lower}{attrs_str}>')
        self.open_tags.append(tag_lower)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag_lower = tag.lower()
        if tag_lower == 'br':
            self.result.append('\n')
            return
        if tag_lower not in _TELEGRAM_HTML_TAGS:
            return
        if tag_lower == 'a':
            # Self-closing <a /> is invalid in Telegram; strip it.
            return
        attrs_str = self._build_attrs(attrs)
        self.result.append(f'<{tag_lower}{attrs_str}/>')

    def handle_endtag(self, tag: str) -> None:
        tag_lower = tag.lower()
        if tag_lower not in _TELEGRAM_HTML_TAGS:
            return
        if self.open_tags and self.open_tags[-1] == tag_lower:
            self.open_tags.pop()
            self.result.append(f'</{tag_lower}>')
        # Dangling closers are dropped.

    def handle_data(self, data: str) -> None:
        self.result.append(self._escape_text(data))

    def handle_entityref(self, name: str) -> None:
        ch = html.unescape(f'&{name};')
        self.result.append(self._escape_text(ch))

    def handle_charref(self, name: str) -> None:
        ch = html.unescape(f'&#{name};')
        self.result.append(self._escape_text(ch))

    def close(self) -> str:  # type: ignore[override]
        super().close()
        for tag in reversed(self.open_tags):
            self.result.append(f'</{tag}>')
        return ''.join(self.result)


def _sanitize_html(text: str) -> str:
    """Sanitize CRM HTML for Telegram's HTML parse mode.

    - Strip unsupported tags but keep their text content.
    - Preserve allowed tags: b, strong, i, em, u, ins, s, strike, del, a, code, pre.
    - Escape stray <, >, & in text.
    - Convert <br> to newlines.
    """
    if not text:
        return ""
    parser = _TelegramHTMLSanitizer()
    parser.feed(text)
    return parser.close()


def _extract_mail_fields(content: str) -> dict[str, str] | None:
    """Best-effort extraction from possibly truncated CRM mail JSON."""
    fields: dict[str, str] = {}
    patterns = {
        "from": r'"from"\s*:\s*"((?:\\.|[^"\\])*)"',
        "to": r'"to"\s*:\s*"((?:\\.|[^"\\])*)"',
        "subject": r'"subject"\s*:\s*"((?:\\.|[^"\\])*)"',
        "introduction": r'"introduction"\s*:\s*"((?:\\.|[^"\\])*)"',
    }
    for key, pattern in patterns.items():
        m = re.search(pattern, content, re.IGNORECASE)
        if m:
            value = m.group(1)
            value = value.replace('\\\\', '\\').replace('\\"', '"').replace('\\n', '\n').replace('\\r', '').replace('\\t', '\t')
            fields[key] = value
    return fields if fields else None


def _extract_forward_info(body: str) -> tuple[str, str | None]:
    """Find a Forwarded/Original Message header block, extract From/Date, and return (cleaned_body, info_line)."""
    marker_re = re.compile(r'--------\s*(Forwarded|Original)\s*Message\s*--------\s*', re.IGNORECASE)
    m = marker_re.search(body)
    if not m:
        return body, None

    marker_type = m.group(1).lower()
    header_field_re = re.compile(
        r'(Subject|Date|From|Reply-To|To|Cc|Bcc):\s*',
        re.IGNORECASE,
    )
    pos = m.end()
    fields: dict[str, str] = {}

    while True:
        fm = header_field_re.match(body, pos)
        if not fm:
            break
        key = fm.group(1).lower()
        value_start = fm.end()
        next_fm = header_field_re.search(body, value_start)
        body_indicator = re.search(r'(?<=\s)[\[>]', body[value_start:])
        body_indicator_pos = value_start + body_indicator.start() if body_indicator else len(body)

        if next_fm and next_fm.start() < body_indicator_pos:
            end = next_fm.start()
            pos = next_fm.start()
        else:
            end = body_indicator_pos
            pos = end

        value = body[value_start:end].strip()
        if key in ("from", "date", "subject", "to"):
            fields[key] = value

    info_parts: list[str] = []
    if "from" in fields:
        info_parts.append(f"from {fields['from']}")
    if "date" in fields:
        info_parts.append(f"on {fields['date']}")

    if info_parts:
        info = "Forwarded " + " ".join(info_parts)
    else:
        info = "Forwarded message" if marker_type == "forwarded" else "Original message"

    before = body[:m.start()].rstrip()
    after = body[pos:].lstrip()
    cleaned = (before + ("\n\n" if before else "") + after).strip()
    return cleaned, f"[{info}]"


def _clean_reply_attribution(body: str) -> tuple[str, str | None]:
    """Convert 'On ... wrote:' attribution into a clean [On ... wrote] line."""
    reply_re = re.compile(r'\s+On\s+(.+?)\s+wrote:\s*', re.IGNORECASE)
    m = reply_re.search(body)
    if not m:
        return body, None
    attribution = m.group(1).strip()
    info = f"On {attribution} wrote"
    before = body[:m.start()].rstrip()
    after = body[m.end():].lstrip()
    cleaned = (before + f"\n\n[{info}]" + ('\n\n' + after if after else '')).strip()
    return cleaned, info


def _format_mail_event(content: str, max_len: int = 1000) -> str:
    """Parse CRM mail JSON and return a concise readable block."""
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        data = _extract_mail_fields(content)
        if data is None:
            return _sanitize_html(content)

    def _parse_address(raw: str) -> str:
        if not raw:
            return ""
        name, addr = email.utils.parseaddr(raw)
        if name and addr:
            return _esc(f"{name} <{addr}>")
        if addr:
            return _esc(addr)
        return _esc(raw)

    from_addr = _parse_address(str(data.get("from") or ""))
    to_addr = _parse_address(str(data.get("to") or ""))
    subject = _esc(str(data.get("subject") or ""))
    body = str(data.get("introduction") or data.get("body") or "")
    body, forward_info = _extract_forward_info(body)
    body, _ = _clean_reply_attribution(body)
    # Put each quoted email line on its own line for readability.
    body = re.sub(r'\s*>\s*', '\n> ', body).strip()
    if len(body) > max_len:
        body = body[:max_len - 1] + "…"
    body = _sanitize_html(body)

    lines: list[str] = []
    if from_addr:
        lines.append(f"From: {from_addr}")
    if to_addr:
        lines.append(f"To: {to_addr}")
    if subject:
        lines.append(f"Subject: {subject}")
    if forward_info:
        lines.append("")
        lines.append(forward_info)
    if body:
        lines.append("")
        lines.append(f"Body: {body}")
    return "\n".join(lines)


def _format_event_body(category: str, content: str, max_len: int = 500) -> str:
    cat_lower = category.lower()
    if 'mail' in cat_lower or 'email' in cat_lower:
        return _format_mail_event(content, max_len=max_len)
    if len(content) > max_len:
        content = content[:max_len - 1] + "…"
    return _sanitize_html(content)


HELP_TEXT = (
    "Send a project name (or part of it) to look it up.\n"
    "If several match, I'll send a numbered list — reply with a number to see full details.\n"
    "Need a new invite code? Contact your agent."
)


def format_search_result(deals: list[dict], search: str, is_employee: bool = False) -> str:
    if not deals:
        return f"No projects found matching '{_esc(search)}'."
    if len(deals) == 1:
        return format_deal_detail(deals, 0, is_employee=is_employee)
    lines = [f"Projects matching '{_esc(search)}':", ""]
    for i, d in enumerate(deals, 1):
        parts = [f"{i}. {_esc(d['title'])}"]
        stage = d.get("stage", "")
        if stage:
            parts.append(f"   Status: {_esc(stage)}")
        lines.append("\n".join(parts))
    lines.append("")
    lines.append("Reply with a number (1, 2, ...) to see full details.")
    msg = "\n".join(lines)
    if len(msg) > 4000:
        msg = msg[:3980] + "\n\n\u2026 (message truncated)"
    return msg


def format_deal_detail(deals: list[dict], index: int, is_employee: bool = False) -> str:
    if index < 0 or index >= len(deals):
        return "Invalid selection."
    d = deals[index]
    amt = _fmt_money(d.get("amount", 0), d.get("currency", ""))
    lines = [
        _esc(d["title"]),
        "─" * 30,
    ]
    stage = d.get("stage", "")
    if stage:
        lines.append(f"Status: {_esc(stage)}")
    if amt:
        lines.append(f"Amount: {_esc(amt)}")
    if is_employee:
        events = d.get("events", [])
        if events:
            lines.append("")
            for idx, ev in enumerate(events):
                if idx > 0:
                    lines.append("───────────────")
                cat = ev.get("categoryName") or ""
                content = ev.get("content", "")
                created = _fmt_date(ev.get("created", ""))
                if cat and created:
                    lines.append(f"<b>[{_esc(cat)}]</b> — <i>{_esc(created)}</i>")
                elif cat:
                    lines.append(f"<b>[{_esc(cat)}]</b>")
                elif created:
                    lines.append(f"<i>{_esc(created)}</i>")
                if content:
                    lines.append(_format_event_body(cat, content))
                lines.append("")
    else:
        update = d.get("latestUpdate")
        if update:
            content = update.get("content", "")
            created = _fmt_date(update.get("created", ""))
            if content:
                lines.append("")
                if created:
                    lines.append(f"Latest customer update — <i>{_esc(created)}</i>")
                else:
                    lines.append("Latest customer update:")
                lines.append(_sanitize_html(content))
    if lines and lines[-1] != "":
        lines.append("")
    lines.append("Send another project name to search again.")
    msg = "\n".join(lines)
    if len(msg) > 4000:
        msg = msg[:3980] + "\n\n… (message truncated)"
    return msg


# ── Main Setup ──

def main() -> None:
    if not TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not set")
        sys.exit(1)
    if not PORTAL:
        logger.error("ONLYOFFICE_PORTAL_URL not set")
        sys.exit(1)

    try:
        from telegram import Update
        from telegram.ext import Application, CommandHandler, MessageHandler, filters
    except ImportError:
        logger.error("python-telegram-bot not installed: pip install python-telegram-bot")
        sys.exit(1)

    app = Application.builder().token(TOKEN).build()

    async def _reply_html(update: Update, text: str) -> None:
        """Send a message in HTML mode, falling back to plain text if Telegram rejects it."""
        try:
            await update.message.reply_text(text, parse_mode="HTML")
        except Exception as exc:
            logger.warning("HTML reply failed for chat %s: %s", update.effective_chat.id, exc)
            sample = text[:500].replace("\n", "\\n")
            logger.warning("Offending message sample: %s", sample)
            try:
                await update.message.reply_text(text, parse_mode=None)
            except Exception as exc2:
                logger.exception("Plain-text fallback also failed for chat %s", update.effective_chat.id)

    async def start(update: Update, _ctx) -> None:
        await _reply_html(
            update,
            "Welcome! Send me your invite code to get started. "
            "Once linked, send a project name to find it.",
        )

    async def help_command(update: Update, _ctx) -> None:
        await _reply_html(update, HELP_TEXT)

    async def handle_message(update: Update, _ctx) -> None:
        try:
            if not update.message or not update.message.text:
                return
            chat_id = update.effective_chat.id
            text = update.message.text.strip()
            lower = text.lower()

            logger.info("Message from chat %d: %s", chat_id, text[:50])

            # Check if already mapped
            mapping = await get_mapping(chat_id)

            if mapping:
                contact_id = mapping.get("contactId")
                is_employee = mapping.get("employee", False)
                if not contact_id and not is_employee:
                    await _reply_html(update, "Your account is not fully set up. Please contact support.")
                    return

                _last_employee[chat_id] = is_employee

                # Help request
                if lower in ("/help", "help", "?"):
                    await _reply_html(update, HELP_TEXT)
                    return

                # Number reply: read from cached results (no re-fetch)
                if text.isdigit():
                    deals = _last_deals.get(chat_id, [])
                    emp = _last_employee.get(chat_id, False)
                    if not deals:
                        await _reply_html(update, "No projects to select from. Send a project name to search.")
                        return
                    idx = int(text) - 1
                    if 0 <= idx < len(deals):
                        msg = format_deal_detail(deals, idx, is_employee=emp)
                        await _reply_html(update, msg)
                    else:
                        search = _last_search.get(chat_id, "")
                        msg = format_search_result(deals, search, is_employee=emp)
                        await _reply_html(update, msg)
                    return

                # Treat any other text as a title search
                search = text
                deals = await get_deals(contact_id, chat_id, search=search, employee=is_employee)
                if deals is None:
                    await _reply_html(update, "I'm having trouble reaching the server. Please try again in a couple of minutes.")
                    return
                _last_deals[chat_id] = deals
                _last_search[chat_id] = search
                msg = format_search_result(deals, search, is_employee=is_employee)
                await _reply_html(update, msg)
                return
            else:
                # Not linked yet — treat message as invite code
                result = await verify_code(text, chat_id)
                if result:
                    contact_id = result.get("contactId")
                    is_employee = result.get("employee", False)
                    if contact_id:
                        msg = (
                            "✅ You've been linked! Send a project name to find it.\n\n"
                            "Example: <b>roof</b> or <b>Smith</b>"
                        )
                    elif is_employee:
                        msg = (
                            "✅ You've been linked as an employee! Send a project name to search across all projects.\n\n"
                            "Example: <b>roof</b> or <b>Smith</b>"
                        )
                    else:
                        msg = "✅ You've been linked! But we couldn't find any projects yet."
                    await _reply_html(update, msg)
                    logger.info("Chat %d linked to contact %s (employee=%s)", chat_id, contact_id, is_employee)
                else:
                    await _reply_html(
                        update,
                        "That code wasn't recognized or has expired. "
                        "Please check with your agent for a new invite code.",
                    )
        except Exception:
            logger.exception("Unhandled error in handle_message for chat %d", chat_id)
            try:
                await _reply_html(update, "Something went wrong. Please try again in a couple of minutes.")
            except Exception:
                pass

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    logger.info("Bot polling...")
    app.run_polling(allowed_updates=["messages"])


if __name__ == "__main__":
    main()
