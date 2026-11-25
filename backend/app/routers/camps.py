from datetime import date, datetime, time, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..geo import ensure_hospital_location, geocode, haversine_km
from ..mailer import send_camp_announcement, send_camp_cancelled, send_camp_slot_open
from ..matching import DONATION_GAP_DAYS, RADIUS_KM
from ..models import Camp, CampBooking, Donor, Hospital, User
from ..security import require_role
from .donors import get_donor
from .hospitals import get_hospital

router = APIRouter(prefix="/camps", tags=["camps"])               # hospital side
donor_router = APIRouter(prefix="/donors/me/camps", tags=["camps"])  # donor side

TAKEN = ("Booked", "Attended")  # statuses that use up a slot
MAX_ALERTS = 200


class CampCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=3, max_length=120)
    venue: str = Field(min_length=3, max_length=200)
    camp_date: date
    start_time: time
    end_time: time
    capacity: int = Field(ge=1, le=1000)
    notes: Optional[str] = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def check_values(self):
        if self.camp_date < date.today():
            raise ValueError("The camp date cannot be in the past.")
        if self.end_time <= self.start_time:
            raise ValueError("The end time must be after the start time.")
        return self


class CampOut(BaseModel):
    id: int
    title: str
    hospital: str
    venue: str
    city: str
    camp_date: date
    start_time: time
    end_time: time
    capacity: int
    booked: int
    slots_left: int
    notes: Optional[str] = None
    status: str
    distance_km: Optional[float] = None
    my_status: Optional[str] = None
    notified: int = 0


class BookingOut(BaseModel):
    id: int
    donor_name: str
    blood_group: str
    phone: Optional[str] = None
    status: str
    booked_at: Optional[datetime] = None


class BookingUpdate(BaseModel):
    status: Literal["Attended", "NoShow"]


def when_text(camp: Camp) -> str:
    return f"{camp.camp_date.strftime('%d %b %Y')}, {camp.start_time.strftime('%H:%M')} to {camp.end_time.strftime('%H:%M')}"


def booked_counts(db: Session, camp_ids: list[int]) -> dict:
    if not camp_ids:
        return {}
    return dict(
        db.query(CampBooking.camp_id, func.count(CampBooking.id))
        .filter(CampBooking.camp_id.in_(camp_ids), CampBooking.status.in_(TAKEN))
        .group_by(CampBooking.camp_id)
        .all()
    )


def camp_out(camp: Camp, hospital_name: str, booked: int, distance=None, my_status=None, notified=0) -> CampOut:
    return CampOut(
        id=camp.id, title=camp.title, hospital=hospital_name, venue=camp.venue, city=camp.city,
        camp_date=camp.camp_date, start_time=camp.start_time, end_time=camp.end_time,
        capacity=camp.capacity, booked=booked, slots_left=max(0, camp.capacity - booked),
        notes=camp.notes, status=camp.status or "Open",
        distance_km=distance, my_status=my_status, notified=notified,
    )


def donor_problem(donor: Donor, camp: Camp) -> Optional[str]:
    """Why this donor cannot book this camp (None means they can)."""
    if not donor.is_available:
        return "Switch to Available in your profile to book."
    if donor.latitude is None or donor.longitude is None:
        return "Add your area in My profile first."
    if camp.latitude is None or camp.longitude is None:
        return "This camp has no location yet."
    if haversine_km(donor.latitude, donor.longitude, camp.latitude, camp.longitude) > RADIUS_KM:
        return f"This camp is more than {RADIUS_KM} km from you."
    if donor.last_donation_date and donor.last_donation_date > camp.camp_date - timedelta(days=DONATION_GAP_DAYS):
        return "You will not be eligible to donate again by the camp date."
    return None


def eligible_donors(db: Session, camp: Camp, skip_booked: bool = False) -> list[tuple[Donor, User]]:
    if camp.latitude is None or camp.longitude is None:
        return []
    cutoff = camp.camp_date - timedelta(days=DONATION_GAP_DAYS)
    q = (
        db.query(Donor, User)
        .join(User, User.id == Donor.user_id)
        .filter(
            Donor.is_available.is_(True),
            User.is_active.is_(True),
            Donor.latitude.isnot(None),
            Donor.longitude.isnot(None),
            or_(Donor.last_donation_date.is_(None), Donor.last_donation_date <= cutoff),
        )
    )
    if skip_booked:
        booked = db.query(CampBooking.donor_id).filter(CampBooking.camp_id == camp.id, CampBooking.status.in_(TAKEN))
        q = q.filter(~Donor.id.in_(booked))
    near = [
        (d, u) for d, u in q.all()
        if haversine_km(camp.latitude, camp.longitude, d.latitude, d.longitude) <= RADIUS_KM
    ]
    return near[:MAX_ALERTS]


def own_camp(db: Session, hospital_id: int, camp_id: int) -> Camp:
    camp = db.query(Camp).filter(Camp.id == camp_id, Camp.hospital_id == hospital_id).first()
    if camp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Camp not found.")
    return camp


# ---------------------------------------------------------------- hospital side

@router.post("", response_model=CampOut, status_code=status.HTTP_201_CREATED)
def create_camp(
    data: CampCreate,
    background: BackgroundTasks,
    user: User = Depends(require_role("hospital")),
    db: Session = Depends(get_db),
):
    hospital = get_hospital(db, user)
    if not user.is_approved:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your hospital account is waiting for admin approval.")

    point = geocode(f"{data.venue}, {hospital.city}, India")
    if point is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "We couldn't locate that venue. Add the area or a landmark, for example 'Town Hall, Kakkanad'.",
        )

    camp = Camp(
        hospital_id=hospital.id, title=data.title, venue=data.venue, city=hospital.city,
        camp_date=data.camp_date, start_time=data.start_time, end_time=data.end_time,
        capacity=data.capacity, notes=data.notes or None, status="Open",
        latitude=point[0], longitude=point[1],
    )
    db.add(camp)
    db.commit()
    db.refresh(camp)

    # Every eligible donor sees the camp in the app; only those with email alerts on get an email
    recipients = eligible_donors(db, camp)
    link = f"{settings.frontend_url.rstrip('/')}/donor/camps"
    for d, u in recipients:
        if d.email_notifications is False:
            continue
        background.add_task(
            send_camp_announcement, u.email, u.name, hospital.hospital_name,
            camp.title, camp.venue, when_text(camp), link,
        )
    return camp_out(camp, hospital.hospital_name, 0, notified=len(recipients))


@router.get("", response_model=list[CampOut])
def list_camps(user: User = Depends(require_role("hospital")), db: Session = Depends(get_db)):
    hospital = get_hospital(db, user)
    camps = (
        db.query(Camp).filter(Camp.hospital_id == hospital.id)
        .order_by(Camp.camp_date.desc(), Camp.id.desc()).all()
    )
    counts = booked_counts(db, [c.id for c in camps])
    return [camp_out(c, hospital.hospital_name, counts.get(c.id, 0)) for c in camps]


@router.get("/{camp_id}/bookings", response_model=list[BookingOut])
def camp_bookings(camp_id: int, user: User = Depends(require_role("hospital")), db: Session = Depends(get_db)):
    hospital = get_hospital(db, user)
    camp = own_camp(db, hospital.id, camp_id)
    rows = (
        db.query(CampBooking, Donor, User)
        .join(Donor, Donor.id == CampBooking.donor_id)
        .join(User, User.id == Donor.user_id)
        .filter(CampBooking.camp_id == camp.id)
        .order_by(CampBooking.booked_at.asc())
        .all()
    )
    return [
        BookingOut(id=b.id, donor_name=u.name, blood_group=d.blood_group, phone=d.phone,
                   status=b.status, booked_at=b.booked_at)
        for b, d, u in rows
    ]


@router.patch("/{camp_id}/bookings/{booking_id}", response_model=BookingOut)
def mark_booking(
    camp_id: int,
    booking_id: int,
    data: BookingUpdate,
    user: User = Depends(require_role("hospital")),
    db: Session = Depends(get_db),
):
    hospital = get_hospital(db, user)
    camp = own_camp(db, hospital.id, camp_id)
    if camp.camp_date > date.today():
        raise HTTPException(status.HTTP_409_CONFLICT, "You can mark attendance from the camp day.")
    booking = db.query(CampBooking).filter(CampBooking.id == booking_id, CampBooking.camp_id == camp.id).first()
    if booking is None or booking.status != "Booked":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only a booked donor can be marked.")

    booking.status = data.status
    donor = db.get(Donor, booking.donor_id)
    if data.status == "Attended" and donor:
        donor.last_donation_date = camp.camp_date
    db.commit()
    owner = db.get(User, donor.user_id)
    return BookingOut(id=booking.id, donor_name=owner.name, blood_group=donor.blood_group,
                      phone=donor.phone, status=booking.status, booked_at=booking.booked_at)


@router.post("/{camp_id}/cancel", response_model=CampOut)
def cancel_camp(
    camp_id: int,
    background: BackgroundTasks,
    user: User = Depends(require_role("hospital")),
    db: Session = Depends(get_db),
):
    hospital = get_hospital(db, user)
    camp = own_camp(db, hospital.id, camp_id)
    if camp.status != "Open":
        raise HTTPException(status.HTTP_409_CONFLICT, "This camp is already cancelled.")
    camp.status = "Cancelled"
    bookers = (
        db.query(User)
        .join(Donor, Donor.user_id == User.id)
        .join(CampBooking, CampBooking.donor_id == Donor.id)
        .filter(CampBooking.camp_id == camp.id, CampBooking.status == "Booked")
        .all()
    )
    db.commit()
    # Sent to everyone who booked, whatever their alert setting: it changes a booking they made
    for u in bookers:
        background.add_task(send_camp_cancelled, u.email, u.name, hospital.hospital_name, camp.title, when_text(camp))
    counts = booked_counts(db, [camp.id])
    return camp_out(camp, hospital.hospital_name, counts.get(camp.id, 0))


# ---------------------------------------------------------------- donor side

@donor_router.get("", response_model=list[CampOut])
def my_camps(user: User = Depends(require_role("donor")), db: Session = Depends(get_db)):
    donor = get_donor(db, user)
    rows = (
        db.query(Camp, Hospital)
        .join(Hospital, Hospital.id == Camp.hospital_id)
        .filter(Camp.status == "Open", Camp.camp_date >= date.today())
        .order_by(Camp.camp_date.asc(), Camp.start_time.asc())
        .all()
    )
    mine = dict(db.query(CampBooking.camp_id, CampBooking.status).filter(CampBooking.donor_id == donor.id).all())
    counts = booked_counts(db, [c.id for c, _ in rows])

    result = []
    for camp, hosp in rows:
        my = mine.get(camp.id)
        # show camps near the donor, plus any camp they already booked
        if my not in TAKEN and donor_problem(donor, camp) is not None:
            continue
        distance = None
        if None not in (donor.latitude, donor.longitude, camp.latitude, camp.longitude):
            distance = round(haversine_km(donor.latitude, donor.longitude, camp.latitude, camp.longitude), 1)
        result.append(camp_out(camp, hosp.hospital_name, counts.get(camp.id, 0), distance, my))
    return result


def locked_camp(db: Session, camp_id: int) -> tuple[Camp, Hospital]:
    camp = db.query(Camp).filter(Camp.id == camp_id).with_for_update().first()
    if camp is None or camp.status != "Open" or camp.camp_date < date.today():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This camp is not open for booking.")
    return camp, db.get(Hospital, camp.hospital_id)


@donor_router.post("/{camp_id}/book", response_model=CampOut)
def book_camp(camp_id: int, user: User = Depends(require_role("donor")), db: Session = Depends(get_db)):
    donor = get_donor(db, user)
    camp, hosp = locked_camp(db, camp_id)  # the lock stops two donors taking the last slot together

    problem = donor_problem(donor, camp)
    if problem:
        raise HTTPException(status.HTTP_409_CONFLICT, problem)

    booking = db.query(CampBooking).filter(CampBooking.camp_id == camp.id, CampBooking.donor_id == donor.id).first()
    if booking is not None and booking.status in TAKEN:
        raise HTTPException(status.HTTP_409_CONFLICT, "You have already booked a slot at this camp.")

    taken = booked_counts(db, [camp.id]).get(camp.id, 0)
    if taken >= camp.capacity:
        raise HTTPException(status.HTTP_409_CONFLICT, "Sorry, this camp is full.")

    if booking is None:
        booking = CampBooking(camp_id=camp.id, donor_id=donor.id)
        db.add(booking)
    booking.status = "Booked"
    booking.booked_at = datetime.now(timezone.utc)
    db.commit()
    return camp_out(camp, hosp.hospital_name, taken + 1, my_status="Booked")


@donor_router.post("/{camp_id}/cancel", response_model=CampOut)
def cancel_booking(
    camp_id: int,
    background: BackgroundTasks,
    user: User = Depends(require_role("donor")),
    db: Session = Depends(get_db),
):
    donor = get_donor(db, user)
    camp, hosp = locked_camp(db, camp_id)
    booking = db.query(CampBooking).filter(CampBooking.camp_id == camp.id, CampBooking.donor_id == donor.id).first()
    if booking is None or booking.status != "Booked":
        raise HTTPException(status.HTTP_409_CONFLICT, "You have no active booking for this camp.")

    taken = booked_counts(db, [camp.id]).get(camp.id, 0)
    was_full = taken >= camp.capacity
    booking.status = "Cancelled"
    db.commit()

    if was_full:  # a slot just opened: alert eligible donors who have not booked (and have email alerts on)
        link = f"{settings.frontend_url.rstrip('/')}/donor/camps"
        for d, u in eligible_donors(db, camp, skip_booked=True):
            if u.id != user.id and d.email_notifications is not False:
                background.add_task(send_camp_slot_open, u.email, u.name, hosp.hospital_name, camp.title, when_text(camp), link)
    return camp_out(camp, hosp.hospital_name, taken - 1, my_status="Cancelled")