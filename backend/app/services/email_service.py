"""
Email service — sends OTP emails.

Uses a console backend in development (prints to stdout).
Swap to real SMTP by setting SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars.
"""

import logging
import smtplib
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


class EmailBackend:
    """Base email backend interface."""

    def send(self, to: str, subject: str, body: str) -> None:
        raise NotImplementedError


class ConsoleEmailBackend(EmailBackend):
    """Prints emails to console/log — for development."""

    def send(self, to: str, subject: str, body: str) -> None:
        logger.info(
            "\n"
            "========== EMAIL (console backend) ==========\n"
            f"  To:      {to}\n"
            f"  Subject: {subject}\n"
            f"  Body:    {body}\n"
            "=============================================="
        )
        print(
            f"\n📧 EMAIL → {to}\n"
            f"   Subject: {subject}\n"
            f"   Body: {body}\n"
        )


class SMTPEmailBackend(EmailBackend):
    """Sends real emails via SMTP."""

    def send(self, to: str, subject: str, body: str) -> None:
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM
        msg["To"] = to

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASS)
            server.send_message(msg)

        logger.info(f"Email sent to {to} via SMTP")


def _get_backend() -> EmailBackend:
    """Select backend based on whether SMTP is configured."""
    if settings.SMTP_HOST and settings.SMTP_USER:
        return SMTPEmailBackend()
    return ConsoleEmailBackend()


# Singleton-ish instance
_backend = _get_backend()


def send_otp_email(to: str, otp: str) -> None:
    """Send a 6-digit OTP verification email."""
    subject = "Hall 12 — Your Verification Code"
    body = (
        f"Your verification code for Hall 12 (Marathas) Portal is:\n\n"
        f"    {otp}\n\n"
        f"This code expires in 10 minutes. Do not share it with anyone."
        f"If this was not done by you immediately contact hall office and Mess secretary and forward this mail to hall12@iitk.ac.in and utkarsh24@iitk.ac.in stating the same."
    )
    _backend.send(to, subject, body)
