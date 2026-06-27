"""Telegram bot for customer deal status queries.

Usage:
  TELEGRAM_BOT_TOKEN=xxx DASHBOARD_URL=http://127.0.0.1:8765 python3 telegram_bot.py

The bot polls Telegram for messages, verifies invite codes, and returns
curated deal info from the CRM (via the dashboard proxy).
"""

from __future__ import annotations

import asyncio
import html
import json
import logging
import os
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


async def get_deals(contact_id: int, chat_id: int | None = None) -> list[dict]:
    params: dict = {"contactId": contact_id}
    if chat_id:
        params["chatId"] = chat_id
    result = await _get("/api/bot/deals", params)
    if result and "deals" in result:
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


def format_deal_summary(deals: list[dict]) -> str:
    if not deals:
        return "No open projects found for your contact."
    lines = ["Your open projects:", ""]
    for i, d in enumerate(deals, 1):
        parts = [f"{i}. {_esc(d['title'])}"]
        stage = d.get("stage", "")
        if stage:
            parts.append(f"   Status: {_esc(stage)}")
        lines.append("\n".join(parts))
    lines.append("")
    lines.append("Reply with a number (1, 2, ...) to see full details.")
    return "\n".join(lines)


def format_deal_detail(deals: list[dict], index: int) -> str:
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
    update = d.get("latestUpdate")
    if update:
        content = update.get("content", "")
        created = _fmt_date(update.get("created", ""))
        if content:
            lines.append("")
            lines.append("Latest customer update:")
            lines.append(content)
            if created:
                lines.append(f"— {_esc(created)}")
    lines.append("")
    lines.append("Send any message to see your projects again.")
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
            "Welcome! Send me your invite code or any message to see your project updates.",
            parse_mode="HTML",
        )

    async def handle_message(update: Update, _ctx) -> None:
        if not update.message or not update.message.text:
            return
        chat_id = update.effective_chat.id
        text = update.message.text.strip()

        logger.info("Message from chat %d: %s", chat_id, text[:50])

        # Check if already mapped
        mapping = await get_mapping(chat_id)

        if mapping:
            contact_id = mapping.get("contactId")
            if not contact_id:
                await update.message.reply_text("Your account is not fully set up. Please contact support.", parse_mode="HTML")
                return

            deals = await get_deals(contact_id, chat_id)

            if text.isdigit():
                idx = int(text) - 1
                if 0 <= idx < len(deals):
                    msg = format_deal_detail(deals, idx)
                    await update.message.reply_text(msg, parse_mode="HTML")
                    return
                else:
                    msg = format_deal_summary(deals)
                    await update.message.reply_text(msg, parse_mode="HTML")
                    return
            else:
                msg = format_deal_summary(deals)
                await update.message.reply_text(msg, parse_mode="HTML")
                return
        else:
            result = await verify_code(text, chat_id)
            if result:
                contact_id = result.get("contactId")
                if contact_id:
                    deals = await get_deals(contact_id, chat_id)
                    msg = "✅ You've been linked! Here are your open projects:\n\n"
                    msg += format_deal_summary(deals)
                else:
                    msg = "✅ You've been linked! But we couldn't find any projects yet."
                await update.message.reply_text(msg, parse_mode="HTML")
                logger.info("Chat %d linked to contact %s", chat_id, contact_id)
            else:
                await update.message.reply_text(
                    "That code wasn't recognized or has expired. "
                    "Please check with your agent for a new invite code.",
                    parse_mode="HTML",
                )

    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    logger.info("Bot polling...")
    app.run_polling(allowed_updates=["messages"])


if __name__ == "__main__":
    main()
