from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..expiry import expire_old_requests
from ..models import BloodRequest, Hospital, RequestResponse, User
from ..security import require_role

router = APIRouter(prefix="/hospitals", tags=["hospitals"])


class HospitalOut(BaseModel):
    id: int
    hospital_name: str
    city: str
    address: Optional[str] = None
    phone: Optional[str] = None
    license_no: Optional[str] = None
    email: str
    is_approved: bool


class SummaryOut(BaseModel):
    active_requests: int
    donors_accepted: int
    requests_fulfilled: int


def get_hospital(db: Session, user: User) -> Hospital:
    hospital = db.query(Hospital).filter(Hospital.user_id == user.id).first()
    if hospital is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hospital profile not found.")
    return hospital


@router.get("/me", response_model=HospitalOut)
def read_me(user: User = Depends(require_role("hospital")), db: Session = Depends(get_db)):
    h = get_hospital(db, user)
    return HospitalOut(
        id=h.id,
        hospital_name=h.hospital_name,
        city=h.city,
        address=h.address,
        phone=h.phone,
        license_no=h.license_no,
        email=user.email,
        is_approved=bool(user.is_approved),
    )


@router.get("/me/summary", response_model=SummaryOut)
def read_summary(user: User = Depends(require_role("hospital")), db: Session = Depends(get_db)):
    expire_old_requests(db)
    h = get_hospital(db, user)

    def count_requests(request_status: str) -> int:
        return (
            db.query(func.count(BloodRequest.id))
            .filter(BloodRequest.hospital_id == h.id, BloodRequest.status == request_status)
            .scalar()
            or 0
        )

    my_request_ids = select(BloodRequest.id).where(BloodRequest.hospital_id == h.id)
    accepted = (
        db.query(func.count(RequestResponse.id))
        .filter(
            RequestResponse.request_id.in_(my_request_ids),
            RequestResponse.status.in_(["Accepted", "Donated"]),
        )
        .scalar()
        or 0
    )
    return SummaryOut(
        active_requests=count_requests("Open"),
        donors_accepted=accepted,
        requests_fulfilled=count_requests("Fulfilled"),
    )