"""The one place that sends email. Works with any SMTP provider (Gmail, Resend, ...)."""
import logging
import smtplib
from email.message import EmailMessage
from typing import Optional

from .config import settings

log = logging.getLogger(__name__)


def email_configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_user and settings.smtp_password)


def send_email(
    to: str,
    subject: str,
    text: str,
    html: Optional[str] = None,
    reply_to: Optional[str] = None,
) -> bool:
    """Send one email. Returns True if it was sent. Never raises."""
    if not email_configured():
        # Development fallback: show the email in the backend terminal instead
        print(
            f"\n--- EMAIL (SMTP not configured) ---\nTo: {to}\nReply-To: {reply_to}\n"
            f"Subject: {subject}\n\n{text}\n-----------------------------------\n"
        )
        return False

    msg = EmailMessage()
    msg["From"] = settings.mail_from or settings.smtp_user
    msg["To"] = to
    msg["Subject"] = subject
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")

    try:
        if settings.smtp_port == 465:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15) as server:
                server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
                server.starttls()
                server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
        return True
    except Exception:
        log.exception("Could not send email to %s", to)
        return False


def send_password_reset(to: str, name: str, link: str) -> bool:
    minutes = settings.reset_token_expire_minutes
    text = (
        f"Hi {name},\n\n"
        f"We received a request to reset your Blood Donor Finder password.\n"
        f"Open this link to choose a new one (it expires in {minutes} minutes):\n\n{link}\n\n"
        f"If you did not ask for this, you can ignore this email. Your password will not change."
    )
    html = (
        f"<p>Hi {name},</p>"
        f"<p>We received a request to reset your Blood Donor Finder password.</p>"
        f"<p><a href=\"{link}\" style=\"display:inline-block;padding:10px 18px;background:#b91c1c;"
        f"color:#fff;border-radius:8px;text-decoration:none;font-weight:600\">Reset my password</a></p>"
        f"<p>This link expires in {minutes} minutes. If you did not ask for this, "
        f"you can ignore this email and your password will not change.</p>"
    )
    return send_email(to, "Reset your Blood Donor Finder password", text, html)


def send_support_message(
    name: str, email: str, role: str, category: str, subject: str, message: str
) -> bool:
    """Forward a support message to the admin inbox. Replying goes to the sender."""
    to = settings.support_email or settings.smtp_user or "support@localhost"
    text = (
        f"New support message\n\n"
        f"From: {name} ({role})\n"
        f"Email: {email}\n"
        f"Category: {category}\n"
        f"Subject: {subject}\n\n"
        f"{message}\n"
    )
    return send_email(to, f"[Support] {category}: {subject}", text, reply_to=email)