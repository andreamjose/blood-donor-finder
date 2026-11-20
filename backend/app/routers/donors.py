from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field, model_validator
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Donor, User
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
