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
import html
import json
import logging
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


def _sanitize_html(text: str) -> str:
    """Sanitize CRM HTML for Telegram's HTML parse mode.

    1. Decode ALL HTML entities to actual characters (handles &nbsp;,
       &mdash;, &amp;, etc. — Telegram doesn't support named entities).
    2. Strip non-Telegram tags; track and balance Telegram-safe tags
       so orphaned openings are auto-closed and dangling closings removed.
    3. Re-escape bare & outside tag brackets to &amp;.
    """
    text = re.sub(r'<br\s*/?>', '\n', text)
    text = html.unescape(text)

    open_tags: list[str] = []

    def _replace_tag(m: re.Match) -> str:
        raw = m.group(0)
        tagname = m.group(1).lower()

        if raw.endswith('/>'):
            if tagname in _TELEGRAM_HTML_TAGS:
                return raw
            return ''

        if raw.startswith('</'):
            if tagname in _TELEGRAM_HTML_TAGS:
                if open_tags and open_tags[-1] == tagname:
                    open_tags.pop()
                    return raw
                return ''
        elif tagname in _TELEGRAM_HTML_TAGS:
            open_tags.append(tagname)
            return raw

        return ''

    text = re.sub(r'</?(\w+)(\s[^>]*)?>', _replace_tag, text)

    for tag in reversed(open_tags):
        text += f'</{tag}>'

    result: list[str] = []
    i = 0
    for m in re.finditer(r'<[^>]*>', text):
        before = text[i:m.start()]
        result.append(before.replace('&', '&amp;'))
        result.append(m.group(0).replace('&', '&amp;'))
        i = m.end()
    result.append(text[i:].replace('&', '&amp;'))
    return ''.join(result)


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
            for ev in events:
                cat = ev.get("categoryName") or ""
                content = ev.get("content", "")
                created = _fmt_date(ev.get("created", ""))
                if cat:
                    lines.append(f"[{_esc(cat)}]")
                if content:
                    lines.append(_sanitize_html(content))
                if created:
                    lines.append(f"— {_esc(created)}")
                lines.append("")
    else:
        update = d.get("latestUpdate")
        if update:
            content = update.get("content", "")
            created = _fmt_date(update.get("created", ""))
            if content:
                lines.append("")
                lines.append("Latest customer update:")
                lines.append(_sanitize_html(content))
                if created:
                    lines.append(f"— {_esc(created)}")
    if lines and lines[-1] != "":
        lines.append("")
    lines.append("Send another project name to search again.")
    return "\n".join(lines)


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

    async def start(update: Update, _ctx) -> None:
        await update.message.reply_text(
            "Welcome! Send me your invite code to get started. "
            "Once linked, send a project name to find it.",
            parse_mode="HTML",
        )

    async def help_command(update: Update, _ctx) -> None:
        await update.message.reply_text(HELP_TEXT, parse_mode="HTML")

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
                    await update.message.reply_text("Your account is not fully set up. Please contact support.", parse_mode="HTML")
                    return

                _last_employee[chat_id] = is_employee

                # Help request
                if lower in ("/help", "help", "?"):
                    await update.message.reply_text(HELP_TEXT, parse_mode="HTML")
                    return

                # Number reply: read from cached results (no re-fetch)
                if text.isdigit():
                    deals = _last_deals.get(chat_id, [])
                    emp = _last_employee.get(chat_id, False)
                    if not deals:
                        await update.message.reply_text("No projects to select from. Send a project name to search.", parse_mode="HTML")
                        return
                    idx = int(text) - 1
                    if 0 <= idx < len(deals):
                        msg = format_deal_detail(deals, idx, is_employee=emp)
                        await update.message.reply_text(msg, parse_mode="HTML")
                    else:
                        search = _last_search.get(chat_id, "")
                        msg = format_search_result(deals, search, is_employee=emp)
                        await update.message.reply_text(msg, parse_mode="HTML")
                    return

                # Treat any other text as a title search
                search = text
                deals = await get_deals(contact_id, chat_id, search=search, employee=is_employee)
                if deals is None:
                    await update.message.reply_text("I'm having trouble reaching the server. Please try again in a couple of minutes.", parse_mode="HTML")
                    return
                _last_deals[chat_id] = deals
                _last_search[chat_id] = search
                msg = format_search_result(deals, search, is_employee=is_employee)
                await update.message.reply_text(msg, parse_mode="HTML")
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
                    await update.message.reply_text(msg, parse_mode="HTML")
                    logger.info("Chat %d linked to contact %s (employee=%s)", chat_id, contact_id, is_employee)
                else:
                    await update.message.reply_text(
                        "That code wasn't recognized or has expired. "
                        "Please check with your agent for a new invite code.",
                        parse_mode="HTML",
                    )
        except Exception:
            logger.exception("Unhandled error in handle_message for chat %d", chat_id)
            try:
                await update.message.reply_text("Something went wrong. Please try again in a couple of minutes.", parse_mode="HTML")
            except Exception:
                pass

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    logger.info("Bot polling...")
    app.run_polling(allowed_updates=["messages"])


if __name__ == "__main__":
    main()
