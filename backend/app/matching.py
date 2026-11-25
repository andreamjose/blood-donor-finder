from datetime import date, datetime, timedelta, timezone

from sqlalchemy import or_
from sqlalchemy.orm import Session

from .geo import ensure_hospital_location, haversine_km
from .models import BloodRequest, Donor, Hospital, RequestResponse, User

DONATION_GAP_DAYS = 90
RADIUS_KM = 5

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
    hospital = db.get(Hospital, req.hospital_id)
    if hospital is None or not ensure_hospital_location(db, hospital):
        return []

    if req.exact_match_only:
        allowed = [req.blood_group]
    else:
        allowed = CAN_RECEIVE_FROM.get(req.blood_group, [req.blood_group])

    cutoff = date.today() - timedelta(days=DONATION_GAP_DAYS)
    candidates = (
        db.query(Donor)
        .join(User, User.id == Donor.user_id)
        .filter(
            Donor.blood_group.in_(allowed),
            Donor.is_available.is_(True),
            User.is_active.is_(True),
            or_(Donor.last_donation_date.is_(None), Donor.last_donation_date <= cutoff),
            Donor.latitude.isnot(None),
            Donor.longitude.isnot(None),
        )
        .all()
    )
    return [
        d for d in candidates
        if haversine_km(hospital.latitude, hospital.longitude, d.latitude, d.longitude) <= RADIUS_KM
    ]


def notify_donors(db: Session, req: BloodRequest) -> int:
    """Create a 'Notified' response row for every eligible donor within the radius."""
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