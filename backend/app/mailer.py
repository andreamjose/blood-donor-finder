"""The one place that sends email. Works with any SMTP provider (Gmail, Resend, ...)."""
import logging
import smtplib
from email.message import EmailMessage
from html import escape
from typing import Optional

from .config import settings
log = logging.getLogger(__name__)


def email_configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_user and settings.smtp_password)


def send_email(to: str, subject: str, text: str, html: Optional[str] = None) -> bool:
    """Send one email. Returns True if it was sent. Never raises."""
    if not email_configured():
        # Development fallback: show the email in the backend terminal instead
        print(f"\n--- EMAIL (SMTP not configured) ---\nTo: {to}\nSubject: {subject}\n\n{text}\n-----------------------------------\n")
        return False

    msg = EmailMessage()
    msg["From"] = settings.mail_from or settings.smtp_user
    msg["To"] = to
    msg["Subject"] = subject
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


def send_request_alert(
    to: str,
    name: str,
    hospital_name: str,
    blood_group: str,
    units: int,
    city: str,
    urgency: str,
    needed_by: str,
    link: str,
    accept_link: Optional[str] = None,
    decline_link: Optional[str] = None,
) -> bool:
    """Tell a matching donor that a hospital needs blood.

    accept_link / decline_link are personal, signed links that open the public
    /respond page (no login). Opening a link changes nothing: the donor confirms
    on that page.

    Privacy: the hospital's phone number is NOT included. The app only shares
    it after the donor accepts.
    """
    units_text = f"{units} unit" + ("" if units == 1 else "s")
    place = " ".join(str(city).split())
    one_click = bool(accept_link and decline_link)
    if urgency in ("Urgent", "Critical"):
        subject = f"{urgency}: {blood_group} blood needed in {place}"
    else:
        subject = f"{blood_group} blood needed in {place}"

    text = (
        f"Hi {name},\n\n"
        f"{hospital_name} in {place} needs {units_text} of {blood_group} blood "
        f"(urgency: {urgency}).\n"
        f"Needed by: {needed_by}\n\n"
        f"You are receiving this because your blood group and city match this request.\n\n"
    )
    if one_click:
        text += (
            f"Can you help? You will see the request and confirm on the next page.\n"
            f"Accept:  {accept_link}\n"
            f"Decline: {decline_link}\n\n"
            f"These links are personal to you, so please do not forward this email.\n"
            f"Or log in to see all your requests: {link}\n\n"
        )
    else:
        text += f"Log in to accept or decline:\n{link}\n\n"
    text += (
        f"Please accept only if you are able to donate. The hospital's medical team "
        f"confirms your eligibility before any donation."
    )

    if one_click:
        buttons = (
            f"<p>Can you help? You will see the request and confirm on the next page.</p>"
            f"<p><a href=\"{escape(accept_link)}\" style=\"display:inline-block;padding:10px 18px;"
            f"background:#b91c1c;color:#fff;border-radius:8px;text-decoration:none;"
            f"font-weight:600\">Accept</a>"
            f"<a href=\"{escape(decline_link)}\" style=\"display:inline-block;padding:10px 18px;"
            f"margin-left:8px;border:1px solid #b91c1c;color:#b91c1c;border-radius:8px;"
            f"text-decoration:none;font-weight:600\">Decline</a></p>"
            f"<p style=\"color:#555;font-size:13px\">These buttons are personal to you, so please do "
            f"not forward this email. Or <a href=\"{escape(link)}\">log in to see all your "
            f"requests</a>.</p>"
        )
    else:
        buttons = (
            f"<p><a href=\"{escape(link)}\" style=\"display:inline-block;padding:10px 18px;"
            f"background:#b91c1c;color:#fff;border-radius:8px;text-decoration:none;"
            f"font-weight:600\">View request</a></p>"
        )

    html = (
        f"<p>Hi {escape(name)},</p>"
        f"<p><strong>{escape(hospital_name)}</strong> in {escape(place)} needs "
        f"<strong>{escape(units_text)} of {escape(blood_group)}</strong> blood "
        f"(urgency: {escape(urgency)}).</p>"
        f"<p>Needed by: {escape(needed_by)}</p>"
        f"<p>You are receiving this because your blood group and city match this request.</p>"
        f"{buttons}"
        f"<p style=\"color:#555;font-size:13px\">Please accept only if you are able to donate. "
        f"The hospital's medical team confirms your eligibility before any donation.</p>"
    )
    return send_email(to, subject, text, html)
