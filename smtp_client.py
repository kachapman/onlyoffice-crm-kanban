"""SMTP client for Sietch CRM v3.0 — password reset emails (MVP)."""

from __future__ import annotations

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Sietch CRM")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"


def send_email(to_addr: str, subject: str, html_body: str, text_body: str | None = None) -> bool:
    """Send email via external SMTP relay. Returns True on success, False on failure."""
    if not SMTP_HOST or not SMTP_USER:
        return False

    msg = MIMEMultipart("alternative")
    msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_USER}>"
    msg["To"] = to_addr
    msg["Subject"] = subject

    if text_body:
        msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            if SMTP_USE_TLS:
                server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception:
        return False


def send_password_reset_email(to_addr: str, reset_url: str) -> bool:
    """Send a password reset email with the given link."""
    subject = "Sietch CRM — Password Reset"
    html_body = f"""
    <html>
    <body style="font-family: sans-serif; color: #333;">
        <h2>Password Reset</h2>
        <p>You requested a password reset for your Sietch CRM account.</p>
        <p>Click the link below to set a new password. This link expires in 1 hour.</p>
        <p><a href="{reset_url}" style="display:inline-block;padding:10px 20px;background:#6d4aff;color:#fff;text-decoration:none;border-radius:4px;">Reset Password</a></p>
        <p style="color:#888;font-size:12px;">If you did not request this, you can safely ignore this email.</p>
    </body>
    </html>
    """
    text_body = f"Sietch CRM — Password Reset\n\nClick the link to reset your password (expires in 1 hour):\n{reset_url}\n\nIf you did not request this, ignore this email."
    return send_email(to_addr, subject, html_body, text_body)
