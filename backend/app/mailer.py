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
    ticket_id: int,
    name: str,
    email: str,
    role: str,
    category: str,
    subject: str,
    message: str,
    is_reply: bool = False,
) -> bool:
    """Tell the admin inbox about a new message. Reply in the admin page so the user sees it in the app."""
    to = settings.support_email or settings.smtp_user or "support@localhost"
    kind = "New reply" if is_reply else "New support message"
    link = f"{settings.frontend_url.rstrip('/')}/admin/support"
    text = (
        f"{kind} (ticket #{ticket_id})\n\n"
        f"From: {name} ({role})\n"
        f"Email: {email}\n"
        f"Category: {category}\n"
        f"Subject: {subject}\n\n"
        f"{message}\n\n"
        f"Reply in the admin page so it shows in the user's Support page:\n{link}\n"
    )
    return send_email(to, f"[Support] {category}: {subject}", text, reply_to=email)


def send_support_reply(to: str, name: str, subject: str, reply: str, link: str) -> bool:
    """Tell a user that the team replied."""
    text = (
        f"Hi {name},\n\n"
        f"Our team replied to your message \"{subject}\":\n\n"
        f"{reply}\n\n"
        f"You can read the conversation and answer here:\n{link}\n"
    )
    return send_email(to, f"Re: {subject}", text)


def send_support_resolved(to: str, name: str, subject: str, link: str) -> bool:
    """Tell a user that their issue was marked as resolved."""
    text = (
        f"Hi {name},\n\n"
        f"We've marked your message \"{subject}\" as resolved.\n"
        f"If you still need help, just reply and we'll reopen it:\n{link}\n"
    )
    return send_email(to, f"Resolved: {subject}", text)

def send_slot_open(to: str, name: str, hospital: str, blood_group: str, link: str) -> bool:
    """Tell a waiting donor that a slot opened up."""
    text = (
        f"Hi {name},\n\n"
        f"A slot just opened for a {blood_group} blood request from {hospital}.\n"
        f"Slots are first come, first served, so accept soon if you can help:\n{link}\n"
    )
    return send_email(to, f"A slot opened: {blood_group} blood needed at {hospital}", text)
def send_camp_announcement(to: str, name: str, hospital: str, title: str, venue: str, when: str, link: str) -> bool:
    text = (
        f"Hi {name},\n\n{hospital} is holding a blood donation camp near you:\n\n"
        f"{title}\nWhen: {when}\nWhere: {venue}\n\n"
        f"Slots are limited and first come, first served. Book yours here:\n{link}\n"
    )
    return send_email(to, f"Blood camp near you: {title}", text)


def send_camp_slot_open(to: str, name: str, hospital: str, title: str, when: str, link: str) -> bool:
    text = (
        f"Hi {name},\n\nA slot just opened at the blood camp \"{title}\" ({hospital}, {when}).\n"
        f"It is first come, first served, so book soon if you can come:\n{link}\n"
    )
    return send_email(to, f"A slot opened: {title}", text)


def send_camp_cancelled(to: str, name: str, hospital: str, title: str, when: str) -> bool:
    text = (
        f"Hi {name},\n\nWe're sorry: {hospital} has cancelled the blood camp \"{title}\" ({when}).\n"
        f"Your booking has been released. Thank you for offering to help.\n"
    )
    return send_email(to, f"Camp cancelled: {title}", text)
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
