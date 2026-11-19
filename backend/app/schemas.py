"""Shapes of the data the API accepts and returns."""
import re
from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

BLOOD_GROUPS = {"O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"}
PHONE_RE = re.compile(r"^\+?[0-9\s-]{10,15}$")


def age_on(dob: date, today: date) -> int:
    years = today.year - dob.year
    if (today.month, today.day) < (dob.month, dob.day):
        years -= 1
    return years


class RegisterRequest(BaseModel):
    role: Literal["donor", "hospital"]
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    city: str = Field(min_length=2, max_length=100)
    phone: str

    # donor only
    full_name: Optional[str] = None
    dob: Optional[date] = None
    gender: Optional[Literal["Male", "Female", "Other"]] = None
    blood_group: Optional[str] = None
    last_donation_date: Optional[date] = None

    # hospital only
    hospital_name: Optional[str] = None
    address: Optional[str] = None
    license_no: Optional[str] = None

    @model_validator(mode="after")
    def check_role_fields(self):
        if not PHONE_RE.match(self.phone):
            raise ValueError("Enter a valid phone number.")

        if self.role == "donor":
            missing = [f for f in ("full_name", "dob", "gender", "blood_group") if not getattr(self, f)]
            if missing:
                raise ValueError("Missing donor details: " + ", ".join(missing))
            if self.blood_group not in BLOOD_GROUPS:
                raise ValueError("Enter a valid blood group.")
            today = date.today()
            if not 18 <= age_on(self.dob, today) <= 65:
                raise ValueError("Donors must be between 18 and 65 years old.")
            if self.last_donation_date and self.last_donation_date > today:
                raise ValueError("The last donation date cannot be in the future.")
        else:
            missing = [f for f in ("hospital_name", "address", "license_no") if not getattr(self, f)]
            if missing:
                raise ValueError("Missing hospital details: " + ", ".join(missing))
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: str
    is_approved: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
