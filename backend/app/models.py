"""Table definitions that match the tables already created in Supabase.
We do NOT call create_all(), the tables exist. These classes only describe them."""
from sqlalchemy import (
    Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text, func,
)

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # donor | hospital | admin
    is_approved = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=func.now())


class Donor(Base):
    __tablename__ = "donors"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    blood_group = Column(String, nullable=False)
    city = Column(String, nullable=False)
    phone = Column(String)
    dob = Column(Date)
    gender = Column(String)
    last_donation_date = Column(Date)
    is_available = Column(Boolean, default=True)


class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    hospital_name = Column(String, nullable=False)
    city = Column(String, nullable=False)
    address = Column(String)
    phone = Column(String)
    license_no = Column(String)


class BloodRequest(Base):
    __tablename__ = "blood_requests"

    id = Column(Integer, primary_key=True)
    hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=False)
    blood_group = Column(String, nullable=False)
    units_needed = Column(Integer, nullable=False)
    units_fulfilled = Column(Integer, default=0)
    city = Column(String, nullable=False)
    urgency = Column(String)
    required_by = Column(DateTime(timezone=True))
    exact_match_only = Column(Boolean, default=False)
    note = Column(Text)
    status = Column(String, default="Open")
    created_at = Column(DateTime(timezone=True), default=func.now())


class RequestResponse(Base):
    __tablename__ = "request_responses"

    id = Column(Integer, primary_key=True)
    request_id = Column(Integer, ForeignKey("blood_requests.id"), nullable=False)
    donor_id = Column(Integer, ForeignKey("donors.id"), nullable=False)
    status = Column(String, default="Notified")
    notified_at = Column(DateTime(timezone=True))
    responded_at = Column(DateTime(timezone=True))
