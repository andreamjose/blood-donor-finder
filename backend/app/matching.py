import logging
import threading
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from .config import settings
from .mailer import send_request_alert
from .models import BloodRequest, Donor, Hospital, RequestResponse, User

log = logging.getLogger(__name__)

DONATION_GAP_DAYS = 90
MAX_EMAIL_ALERTS = 50  # safety cap: never email more than this many donors per request

# Indian Standard Time, as a fixed offset (no extra tz database needed on Windows)
IST = timezone(timedelta(hours=5, minutes=30))

# patient blood group -> donor groups that can give to them
CAN_RECEIVE_FROM = {
    "A+": ["A+", "A-", "O+", "O-"],
    "A-": ["A-", "O-"],
    "B+": ["B+", "B-", "O+", "O-"],
    "B-": ["B-", "O-"],
    "AB+": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    "AB-": ["A-", "B-", "AB-", "O-"],
    "O+": ["O+", "O-"],
    "O-": ["O-"],
}


def find_eligible_donors(db: Session, req: BloodRequest) -> list[Donor]:
    if req.exact_match_only:
        allowed = [req.blood_group]
    else:
        allowed = CAN_RECEIVE_FROM.get(req.blood_group, [req.blood_group])

    cutoff = date.today() - timedelta(days=DONATION_GAP_DAYS)
    return (
        db.query(Donor)
        .join(User, User.id == Donor.user_id)
        .filter(
            Donor.blood_group.in_(allowed),
            func.lower(func.trim(Donor.city)) == req.city.strip().lower(),
            Donor.is_available.is_(True),
            User.is_active.is_(True),
            or_(Donor.last_donation_date.is_(None), Donor.last_donation_date <= cutoff),
        )
        .all()
    )


def _format_needed_by(dt) -> str:
    """required_by is stored in UTC. Show it to donors in Indian Standard Time."""
    if dt is None:
        return "as soon as possible"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(IST).strftime("%d %b %Y, %I:%M %p IST")


def _send_alerts(alerts: list[dict]) -> None:
    """Runs in a background thread so posting a request is not slowed by email."""
    sent = 0
    for alert in alerts:
        try:
            if send_request_alert(**alert):
                sent += 1
        except Exception:
            log.exception("Alert email failed for a donor")
    log.info("Donor alert emails: %s sent out of %s", sent, len(alerts))


def notify_donors(db: Session, req: BloodRequest) -> int:
    """Create a 'Notified' response row for every eligible donor, then email them.
    Returns the number of donors notified."""
    donors = find_eligible_donors(db, req)
    now = datetime.now(timezone.utc)
    for donor in donors:
        db.add(RequestResponse(
            request_id=req.id,
            donor_id=donor.id,
            status="Notified",
            notified_at=now,
        ))
    db.commit()

    if donors:
        # Collect plain values now. The database session closes after the request,
        # so the background thread must not touch database objects.
        hospital = db.query(Hospital).filter(Hospital.id == req.hospital_id).first()
        hospital_name = hospital.hospital_name if hospital else "A hospital"
        base_url = (settings.frontend_url or "http://localhost:5173").rstrip("/")
        link = f"{base_url}/donor/requests"
        needed_by = _format_needed_by(req.required_by)

        user_ids = [d.user_id for d in donors[:MAX_EMAIL_ALERTS]]
        users = db.query(User).filter(User.id.in_(user_ids)).all()

        alerts = [
            {
                "to": u.email,
                "name": u.name,
                "hospital_name": hospital_name,
                "blood_group": req.blood_group,
                "units": req.units_needed,
                "city": req.city,
                "urgency": req.urgency,
                "needed_by": needed_by,
                "link": link,
            }
            for u in users
        ]
        threading.Thread(target=_send_alerts, args=(alerts,), daemon=True).start()

    return len(donors)
