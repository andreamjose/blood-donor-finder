from datetime import date, datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field, model_validator
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..expiry import expire_old_requests
from ..models import BloodRequest, Donor, Hospital, RequestResponse, User
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
    phone: Optional[str] = None
    last_donation_date: Optional[date] = None
    is_available: bool


class DonorUpdate(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    dob: date
    gender: Literal["Male", "Female", "Other"]
    blood_group: str
    city: str = Field(min_length=2, max_length=100)
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


class IncomingOut(BaseModel):
    id: int  # the blood request id
    hospital: str
    city: str
    address: Optional[str] = None
    blood_group: str
    units_needed: int
    units_fulfilled: int
    urgency: str
    required_by: Optional[datetime] = None
    note: Optional[str] = None
    notified_at: Optional[datetime] = None
    status: str  # new | accepted | declined


class RespondIn(BaseModel):
    response: Literal["Accepted", "Declined"]


class DonationOut(BaseModel):
    id: int
    donated_at: Optional[datetime] = None
    hospital: str
    city: str
    blood_group: str
    volume: int = 450


STATUS_MAP = {"Notified": "new", "Accepted": "accepted", "Donated": "accepted", "Declined": "declined"}


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
        phone=donor.phone,
        last_donation_date=donor.last_donation_date,
        is_available=bool(donor.is_available),
    )


def incoming_out(resp: RequestResponse, req: BloodRequest, hosp: Hospital) -> IncomingOut:
    return IncomingOut(
        id=req.id,
        hospital=hosp.hospital_name,
        city=req.city,
        address=hosp.address,
        blood_group=req.blood_group,
        units_needed=req.units_needed,
        units_fulfilled=req.units_fulfilled or 0,
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

    user.name = data.full_name.strip()
    user.email = email
    donor.dob = data.dob
    donor.gender = data.gender
    donor.blood_group = data.blood_group
    donor.city = data.city
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


@router.get("/me/requests", response_model=list[IncomingOut])
def my_requests(user: User = Depends(require_role("donor")), db: Session = Depends(get_db)):
    donor = get_donor(db, user)
    rows = incoming_query(db, donor).order_by(RequestResponse.notified_at.desc()).all()
    return [incoming_out(*row) for row in rows]


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
    resp.status = data.response
    resp.responded_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(resp)
    return incoming_out(resp, req, hosp)


@router.get("/me/donations", response_model=list[DonationOut])
def my_donations(user: User = Depends(require_role("donor")), db: Session = Depends(get_db)):
    donor = get_donor(db, user)
    rows = (
        db.query(RequestResponse, BloodRequest, Hospital)
        .join(BloodRequest, BloodRequest.id == RequestResponse.request_id)
        .join(Hospital, Hospital.id == BloodRequest.hospital_id)
        .filter(RequestResponse.donor_id == donor.id, RequestResponse.status == "Donated")
        .order_by(RequestResponse.responded_at.desc())
        .all()
    )
    return [
        DonationOut(
            id=resp.id,
            donated_at=resp.responded_at,
            hospital=hosp.hospital_name,
            city=hosp.city,
            blood_group=req.blood_group,
        )
        for resp, req, hosp in rows
    ]