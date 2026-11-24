from datetime import date, datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..expiry import expire_old_requests
from ..matching import notify_donors
from ..models import BloodRequest, Donor, RequestResponse, User
from ..schemas import BLOOD_GROUPS
from ..security import require_role
from .hospitals import get_hospital

router = APIRouter(prefix="/requests", tags=["requests"])

STATUSES = ("Open", "Fulfilled", "Expired", "Cancelled")


class RequestCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    blood_group: str
    units_needed: int = Field(ge=1, le=10)
    city: str = Field(min_length=2, max_length=100)
    urgency: Literal["Normal", "Urgent", "Critical"] = "Normal"
    required_by: datetime
    exact_match_only: bool = False
    note: Optional[str] = Field(default=None, max_length=500)

    @field_validator("blood_group")
    @classmethod
    def valid_group(cls, value: str) -> str:
        if value not in BLOOD_GROUPS:
            raise ValueError("Enter a valid blood group.")
        return value

    @field_validator("required_by")
    @classmethod
    def in_the_future(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        if value <= datetime.now(timezone.utc):
            raise ValueError("The required-by time must be in the future.")
        return value


class StatusUpdate(BaseModel):
    status: Literal["Cancelled"]


class RequestOut(BaseModel):
    id: int
    blood_group: str
    units_needed: int
    units_fulfilled: int
    city: str
    urgency: str
    required_by: Optional[datetime] = None
    exact_match_only: bool
    note: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    notified_count: int = 0
    accepted_count: int = 0


class RequestCreated(RequestOut):
    donors_notified: int = 0


class DonorResponseOut(BaseModel):
    response_id: int
    donor_name: str
    blood_group: str
    phone: Optional[str] = None
    status: str
    responded_at: Optional[datetime] = None


def response_counts(db: Session, request_ids: list[int]):
    """How many donors were notified / said yes, for each request id."""
    if not request_ids:
        return {}, {}
    notified = dict(
        db.query(RequestResponse.request_id, func.count(RequestResponse.id))
        .filter(RequestResponse.request_id.in_(request_ids))
        .group_by(RequestResponse.request_id)
        .all()
    )
    accepted = dict(
        db.query(RequestResponse.request_id, func.count(RequestResponse.id))
        .filter(
            RequestResponse.request_id.in_(request_ids),
            RequestResponse.status.in_(["Accepted", "Donated"]),
        )
        .group_by(RequestResponse.request_id)
        .all()
    )
    return notified, accepted


def build(req: BloodRequest, notified: dict, accepted: dict) -> RequestOut:
    return RequestOut(
        id=req.id,
        blood_group=req.blood_group,
        units_needed=req.units_needed,
        units_fulfilled=req.units_fulfilled or 0,
        city=req.city,
        urgency=req.urgency or "Normal",
        required_by=req.required_by,
        exact_match_only=bool(req.exact_match_only),
        note=req.note,
        status=req.status or "Open",
        created_at=req.created_at,
        notified_count=notified.get(req.id, 0),
        accepted_count=accepted.get(req.id, 0),
    )


def get_own_request(db: Session, hospital_id: int, request_id: int) -> BloodRequest:
    req = (
        db.query(BloodRequest)
        .filter(BloodRequest.id == request_id, BloodRequest.hospital_id == hospital_id)
        .first()
    )
    if req is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found.")
    return req


@router.post("", response_model=RequestCreated, status_code=status.HTTP_201_CREATED)
def create_request(
    data: RequestCreate,
    user: User = Depends(require_role("hospital")),
    db: Session = Depends(get_db),
):
    hospital = get_hospital(db, user)
    if not user.is_approved:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Your hospital account is waiting for admin approval.",
        )

    req = BloodRequest(
        hospital_id=hospital.id,
        blood_group=data.blood_group,
        units_needed=data.units_needed,
        units_fulfilled=0,
        city=data.city,
        urgency=data.urgency,
        required_by=data.required_by,
        exact_match_only=data.exact_match_only,
        note=data.note or None,
        status="Open",
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    donors_notified = notify_donors(db, req)

    return RequestCreated(
        **build(req, {req.id: donors_notified}, {}).model_dump(),
        donors_notified=donors_notified,
    )


@router.get("", response_model=list[RequestOut])
def list_requests(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    user: User = Depends(require_role("hospital")),
    db: Session = Depends(get_db),
):
    expire_old_requests(db)
    hospital = get_hospital(db, user)
    query = db.query(BloodRequest).filter(BloodRequest.hospital_id == hospital.id)
    if status_filter:
        if status_filter not in STATUSES:
            raise HTTPException(422, "Unknown status.")
        query = query.filter(BloodRequest.status == status_filter)
    rows = query.order_by(BloodRequest.created_at.desc(), BloodRequest.id.desc()).all()
    notified, accepted = response_counts(db, [r.id for r in rows])
    return [build(r, notified, accepted) for r in rows]


@router.get("/{request_id}", response_model=RequestOut)
def read_request(
    request_id: int,
    user: User = Depends(require_role("hospital")),
    db: Session = Depends(get_db),
):
    expire_old_requests(db)
    hospital = get_hospital(db, user)
    req = get_own_request(db, hospital.id, request_id)
    notified, accepted = response_counts(db, [req.id])
    return build(req, notified, accepted)


@router.patch("/{request_id}/status", response_model=RequestOut)
def update_status(
    request_id: int,
    data: StatusUpdate,
    user: User = Depends(require_role("hospital")),
    db: Session = Depends(get_db),
):
    expire_old_requests(db)
    hospital = get_hospital(db, user)
    req = get_own_request(db, hospital.id, request_id)
    if req.status != "Open":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only open requests can be cancelled.")
    req.status = data.status
    db.commit()
    db.refresh(req)
    notified, accepted = response_counts(db, [req.id])
    return build(req, notified, accepted)


@router.get("/{request_id}/donors", response_model=list[DonorResponseOut])
def request_donors(
    request_id: int,
    user: User = Depends(require_role("hospital")),
    db: Session = Depends(get_db),
):
    hospital = get_hospital(db, user)
    req = get_own_request(db, hospital.id, request_id)
    rows = (
        db.query(RequestResponse, Donor, User)
        .join(Donor, Donor.id == RequestResponse.donor_id)
        .join(User, User.id == Donor.user_id)
        .filter(
            RequestResponse.request_id == req.id,
            RequestResponse.status.in_(["Accepted", "Donated"]),
        )
        .order_by(RequestResponse.responded_at.desc())
        .all()
    )
    return [
        DonorResponseOut(
            response_id=resp.id,
            donor_name=u.name,
            blood_group=d.blood_group,
            phone=d.phone,
            status=resp.status,
            responded_at=resp.responded_at,
        )
        for resp, d, u in rows
    ]


@router.post("/{request_id}/donors/{response_id}/donated", response_model=RequestOut)
def mark_donated(
    request_id: int,
    response_id: int,
    user: User = Depends(require_role("hospital")),
    db: Session = Depends(get_db),
):
    expire_old_requests(db)
    hospital = get_hospital(db, user)
    req = get_own_request(db, hospital.id, request_id)
    if req.status != "Open":
        raise HTTPException(status.HTTP_409_CONFLICT, "This request is no longer open.")

    resp = (
        db.query(RequestResponse)
        .filter(RequestResponse.id == response_id, RequestResponse.request_id == req.id)
        .first()
    )
    if resp is None or resp.status != "Accepted":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only an accepted donor can be marked as donated.")

    resp.status = "Donated"
    resp.responded_at = datetime.now(timezone.utc)
    req.units_fulfilled = (req.units_fulfilled or 0) + 1
    if req.units_fulfilled >= req.units_needed:
        req.status = "Fulfilled"

    donor = db.query(Donor).filter(Donor.id == resp.donor_id).first()
    if donor:
        donor.last_donation_date = date.today()

    db.commit()
    db.refresh(req)
    notified, accepted = response_counts(db, [req.id])
    return build(req, notified, accepted)