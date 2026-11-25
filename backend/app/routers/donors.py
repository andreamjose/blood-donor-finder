from datetime import date, datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field, model_validator
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..expiry import expire_old_requests
from ..geo import geocode, haversine_km
from ..models import BloodRequest, Camp, CampBooking, Donor, Hospital, RequestResponse, User
from ..schemas import BLOOD_GROUPS, PHONE_RE, age_on
from ..security import require_role

router = APIRouter(prefix="/donors", tags=["donors"])


class DonorOut(BaseModel):
    full_name: str
    email: str
    dob: Optional[date] = None
    gender: Optional[str] = None
    blood_group: str
    city: str
    area: Optional[str] = None
    phone: Optional[str] = None
    last_donation_date: Optional[date] = None
    is_available: bool
    email_notifications: bool = True


class DonorUpdate(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    dob: date
    gender: Literal["Male", "Female", "Other"]
    blood_group: str
    city: str = Field(min_length=2, max_length=100)
    area: Optional[str] = Field(default=None, max_length=200)
    phone: str
    last_donation_date: Optional[date] = None

    @model_validator(mode="after")
    def check_values(self):
        today = date.today()
        if self.blood_group not in BLOOD_GROUPS:
            raise ValueError("Enter a valid blood group.")
        if not PHONE_RE.match(self.phone):
            raise ValueError("Enter a valid phone number.")
        if not 18 <= age_on(self.dob, today) <= 65:
            raise ValueError("Donors must be between 18 and 65 years old.")
        if self.last_donation_date and self.last_donation_date > today:
            raise ValueError("The last donation date cannot be in the future.")
        return self


class AvailabilityUpdate(BaseModel):
    is_available: bool


class NotificationsUpdate(BaseModel):
    email_notifications: bool


class IncomingOut(BaseModel):
    id: int  # the blood request id
    hospital: str
    city: str
    address: Optional[str] = None
    blood_group: str
    units_needed: int
    units_fulfilled: int
    slots_left: int
    distance_km: Optional[float] = None
    urgency: str
    required_by: Optional[datetime] = None
    note: Optional[str] = None
    notified_at: Optional[datetime] = None
    status: str  # new | accepted | declined | released


class RespondIn(BaseModel):
    response: Literal["Accepted", "Declined"]


class DonationOut(BaseModel):
    id: str
    donated_at: Optional[datetime] = None
    hospital: str
    city: str
    blood_group: str
    volume: int = 450


STATUS_MAP = {
    "Notified": "new",
    "Accepted": "accepted",
    "Donated": "accepted",
    "Declined": "declined",
    "NoShow": "released",
    "Unsuitable": "released",
}


def get_donor(db: Session, user: User) -> Donor:
    donor = db.query(Donor).filter(Donor.user_id == user.id).first()
    if donor is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Donor profile not found.")
    return donor


def build(user: User, donor: Donor) -> DonorOut:
    return DonorOut(
        full_name=user.name,
        email=user.email,
        dob=donor.dob,
        gender=donor.gender,
        blood_group=donor.blood_group,
        city=donor.city,
        area=donor.area,
        phone=donor.phone,
        last_donation_date=donor.last_donation_date,
        is_available=bool(donor.is_available),
        email_notifications=donor.email_notifications is not False,
    )


def taken_counts(db: Session, request_ids: list[int]) -> dict:
    """How many slots are already taken (accepted or donated) for each request."""
    if not request_ids:
        return {}
    return dict(
        db.query(RequestResponse.request_id, func.count(RequestResponse.id))
        .filter(
            RequestResponse.request_id.in_(request_ids),
            RequestResponse.status.in_(["Accepted", "Donated"]),
        )
        .group_by(RequestResponse.request_id)
        .all()
    )


def incoming_out(
    resp: RequestResponse, req: BloodRequest, hosp: Hospital, donor: Donor, taken: int
) -> IncomingOut:
    distance = None
    if None not in (donor.latitude, donor.longitude, hosp.latitude, hosp.longitude):
        distance = round(haversine_km(donor.latitude, donor.longitude, hosp.latitude, hosp.longitude), 1)
    return IncomingOut(
        id=req.id,
        hospital=hosp.hospital_name,
        city=req.city,
        address=hosp.address,
        blood_group=req.blood_group,
        units_needed=req.units_needed,
        units_fulfilled=req.units_fulfilled or 0,
        slots_left=max(0, req.units_needed - taken),
        distance_km=distance,
        urgency=req.urgency or "Normal",
        required_by=req.required_by,
        note=req.note,
        notified_at=resp.notified_at,
        status=STATUS_MAP.get(resp.status, "new"),
    )


def incoming_query(db: Session, donor: Donor):
    expire_old_requests(db)
    return (
        db.query(RequestResponse, BloodRequest, Hospital)
        .join(BloodRequest, BloodRequest.id == RequestResponse.request_id)
        .join(Hospital, Hospital.id == BloodRequest.hospital_id)
        .filter(
            RequestResponse.donor_id == donor.id,
            BloodRequest.status != "Cancelled",
            # hide expired requests the donor never answered
            or_(BloodRequest.status != "Expired", RequestResponse.status != "Notified"),
        )
    )


@router.get("/me", response_model=DonorOut)
def read_me(user: User = Depends(require_role("donor")), db: Session = Depends(get_db)):
    return build(user, get_donor(db, user))


@router.put("/me", response_model=DonorOut)
def update_me(
    data: DonorUpdate,
    user: User = Depends(require_role("donor")),
    db: Session = Depends(get_db),
):
    donor = get_donor(db, user)
    email = data.email.lower()

    taken = db.query(User).filter(User.email == email, User.id != user.id).first()
    if taken:
        raise HTTPException(status.HTTP_409_CONFLICT, "Another account already uses this email.")

    # Work out the donor's coordinates from their area (only when it changed)
    area = (data.area or "").strip() or None
    lat, lon = donor.latitude, donor.longitude
    if not area:
        lat = lon = None
    elif area != donor.area or data.city != donor.city or lat is None:
        point = geocode(f"{area}, {data.city}, India")
        if point is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "We couldn't find that area. Try a nearby landmark or a larger area name.",
            )
        lat, lon = point

    user.name = data.full_name.strip()
    user.email = email
    donor.dob = data.dob
    donor.gender = data.gender
    donor.blood_group = data.blood_group
    donor.city = data.city
    donor.area = area
    donor.latitude, donor.longitude = lat, lon
    donor.phone = data.phone
    donor.last_donation_date = data.last_donation_date
    db.commit()
    return build(user, donor)


@router.patch("/me/availability", response_model=DonorOut)
def set_availability(
    data: AvailabilityUpdate,
    user: User = Depends(require_role("donor")),
    db: Session = Depends(get_db),
):
    donor = get_donor(db, user)
    donor.is_available = data.is_available
    db.commit()
    return build(user, donor)


@router.patch("/me/notifications", response_model=DonorOut)
def set_notifications(
    data: NotificationsUpdate,
    user: User = Depends(require_role("donor")),
    db: Session = Depends(get_db),
):
    """Turn alert emails (new requests, slot openings, camps) on or off.
    Requests and camps still appear in the app either way."""
    donor = get_donor(db, user)
    donor.email_notifications = data.email_notifications
    db.commit()
    return build(user, donor)


@router.get("/me/requests", response_model=list[IncomingOut])
def my_requests(user: User = Depends(require_role("donor")), db: Session = Depends(get_db)):
    donor = get_donor(db, user)
    rows = incoming_query(db, donor).order_by(RequestResponse.notified_at.desc()).all()
    counts = taken_counts(db, [req.id for _, req, _ in rows])
    return [incoming_out(resp, req, hosp, donor, counts.get(req.id, 0)) for resp, req, hosp in rows]


@router.post("/me/requests/{request_id}/respond", response_model=IncomingOut)
def respond_to_request(
    request_id: int,
    data: RespondIn,
    user: User = Depends(require_role("donor")),
    db: Session = Depends(get_db),
):
    donor = get_donor(db, user)
    row = incoming_query(db, donor).filter(RequestResponse.request_id == request_id).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found.")
    resp, req, hosp = row
    if req.status != "Open":
        raise HTTPException(status.HTTP_409_CONFLICT, "This request is no longer open.")
    if resp.status == "Donated":
        raise HTTPException(status.HTTP_409_CONFLICT, "You have already donated for this request.")
    if resp.status in ("NoShow", "Unsuitable"):
        raise HTTPException(status.HTTP_409_CONFLICT, "The hospital released your slot for this request.")

    if data.response == "Accepted":
        # Lock the request so two donors cannot take the last slot at the same moment
        db.query(BloodRequest).filter(BloodRequest.id == req.id).with_for_update().one()
        taken = (
            db.query(func.count(RequestResponse.id))
            .filter(
                RequestResponse.request_id == req.id,
                RequestResponse.status.in_(["Accepted", "Donated"]),
                RequestResponse.id != resp.id,
            )
            .scalar()
            or 0
        )
        if taken >= req.units_needed:
            raise HTTPException(status.HTTP_409_CONFLICT, "Sorry, all slots for this request have been taken.")

    resp.status = data.response
    resp.responded_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(resp)
    counts = taken_counts(db, [req.id])
    return incoming_out(resp, req, hosp, donor, counts.get(req.id, 0))


@router.get("/me/donations", response_model=list[DonationOut])
def my_donations(user: User = Depends(require_role("donor")), db: Session = Depends(get_db)):
    donor = get_donor(db, user)
    items = []

    rows = (
        db.query(RequestResponse, BloodRequest, Hospital)
        .join(BloodRequest, BloodRequest.id == RequestResponse.request_id)
        .join(Hospital, Hospital.id == BloodRequest.hospital_id)
        .filter(RequestResponse.donor_id == donor.id, RequestResponse.status == "Donated")
        .all()
    )
    for resp, req, hosp in rows:
        items.append(DonationOut(
            id=str(resp.id), donated_at=resp.responded_at, hospital=hosp.hospital_name,
            city=hosp.city, blood_group=req.blood_group,
        ))

    camp_rows = (
        db.query(CampBooking, Camp, Hospital)
        .join(Camp, Camp.id == CampBooking.camp_id)
        .join(Hospital, Hospital.id == Camp.hospital_id)
        .filter(CampBooking.donor_id == donor.id, CampBooking.status == "Attended")
        .all()
    )
    for booking, camp, hosp in camp_rows:
        items.append(DonationOut(
            id=f"C{booking.id}",
            donated_at=datetime.combine(camp.camp_date, camp.start_time).replace(tzinfo=timezone.utc),
            hospital=f"{hosp.hospital_name} (camp)", city=hosp.city, blood_group=donor.blood_group,
        ))

    items.sort(key=lambda d: d.donated_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return items