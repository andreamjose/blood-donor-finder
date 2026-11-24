from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from .models import BloodRequest, Donor, RequestResponse, User

DONATION_GAP_DAYS = 90

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


def notify_donors(db: Session, req: BloodRequest) -> int:
    """Create a 'Notified' response row for every eligible donor. Returns the count."""
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
    return len(donors)