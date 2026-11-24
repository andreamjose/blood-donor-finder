from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import BloodRequest, Donor, Hospital, User
from ..security import require_role

router = APIRouter(prefix="/admin", tags=["admin"])


class HospitalRow(BaseModel):
    id: int
    hospital_name: str
    city: str
    address: Optional[str] = None
    phone: Optional[str] = None
    license_no: Optional[str] = None
    email: str
    state: str  # pending | approved | suspended
    created_at: Optional[datetime] = None


class AdminSummary(BaseModel):
    pending_hospitals: int
    approved_hospitals: int
    donors: int
    open_requests: int


class AccessUpdate(BaseModel):
    action: Literal["approve", "suspend"]


def state_of(user: User) -> str:
    if not user.is_active:
        return "suspended"
    return "approved" if user.is_approved else "pending"


def row(h: Hospital, u: User) -> HospitalRow:
    return HospitalRow(
        id=h.id,
        hospital_name=h.hospital_name,
        city=h.city,
        address=h.address,
        phone=h.phone,
        license_no=h.license_no,
        email=u.email,
        state=state_of(u),
        created_at=u.created_at,
    )


@router.get("/summary", response_model=AdminSummary)
def summary(user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    def hospitals(*conditions) -> int:
        return (
            db.query(func.count(Hospital.id))
            .join(User, User.id == Hospital.user_id)
            .filter(*conditions)
            .scalar()
            or 0
        )

    return AdminSummary(
        pending_hospitals=hospitals(User.is_active.is_(True), User.is_approved.is_(False)),
        approved_hospitals=hospitals(User.is_active.is_(True), User.is_approved.is_(True)),
        donors=db.query(func.count(Donor.id)).scalar() or 0,
        open_requests=db.query(func.count(BloodRequest.id)).filter(BloodRequest.status == "Open").scalar() or 0,
    )


@router.get("/hospitals", response_model=list[HospitalRow])
def list_hospitals(
    state: Literal["pending", "approved", "suspended", "all"] = Query(default="pending"),
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Hospital, User)
        .join(User, User.id == Hospital.user_id)
        .order_by(User.created_at.desc(), Hospital.id.desc())
        .all()
    )
    result = [row(h, u) for h, u in rows]
    return result if state == "all" else [r for r in result if r.state == state]


@router.patch("/hospitals/{hospital_id}", response_model=HospitalRow)
def update_hospital(
    hospital_id: int,
    data: AccessUpdate,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    h = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if h is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hospital not found.")
    u = db.query(User).filter(User.id == h.user_id).first()

    if data.action == "approve":
        u.is_approved = True
        u.is_active = True
    else:
        u.is_approved = False
        u.is_active = False
    db.commit()
    return row(h, u)