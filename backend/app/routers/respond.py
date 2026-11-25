"""Public one-click answer from the email. There is no login: the signed link in the
email names one donor's response, and only that.

Safety design: opening the link (GET) changes NOTHING, because email scanners open links.
Only the POST, sent when the donor presses the confirm button on the page, records an answer.
These endpoints never return a phone number.

Slot rules (same as the in-app accept in routers/donors.py): first come, first served.
A request has units_needed slots; Accepted + Donated answers use them up."""
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..expiry import expire_old_requests
from ..models import BloodRequest, Donor, Hospital, RequestResponse, User
from ..security import read_respond_token

router = APIRouter(prefix="/respond", tags=["respond"])

CLOSED_MESSAGES = {
    "Fulfilled": "This request has already been fulfilled. Thank you for being ready to help.",
    "Expired": "This request has expired.",
    "Cancelled": "The hospital cancelled this request.",
}
SLOTS_FULL = "Sorry, all slots for this request have been taken."


class RespondPreview(BaseModel):
    donor_name: str
    hospital: str
    city: str
    address: Optional[str] = None
    blood_group: str
    units_needed: int
    slots_left: int
    urgency: str
    required_by: Optional[datetime] = None
    note: Optional[str] = None
    status: str  # notified | accepted | declined | donated | noshow | unsuitable
    can_respond: bool
    message: Optional[str] = None  # why the donor cannot answer, or a thank-you after answering


class RespondBody(BaseModel):
    token: str
    action: Literal["accept", "decline"]


def slots_left(db: Session, req: BloodRequest, exclude_response_id: Optional[int] = None) -> int:
    """Slots still free: units_needed minus the donors who accepted or donated."""
    q = db.query(func.count(RequestResponse.id)).filter(
        RequestResponse.request_id == req.id,
        RequestResponse.status.in_(["Accepted", "Donated"]),
    )
    if exclude_response_id is not None:
        q = q.filter(RequestResponse.id != exclude_response_id)
    return max(0, req.units_needed - (q.scalar() or 0))


def respond_state(resp: RequestResponse, req: BloodRequest, left: int) -> tuple[bool, Optional[str]]:
    """Can this donor answer right now? Returns (yes/no, reason if no)."""
    if resp.status in ("Accepted", "Donated"):
        return False, "You have already accepted this request."
    if resp.status == "Declined":
        return False, "You have already declined this request."
    if resp.status in ("NoShow", "Unsuitable"):
        return False, "The hospital released your slot for this request."
    if resp.status != "Notified":
        return False, "This request can no longer be answered."
    if req.status != "Open":
        return False, CLOSED_MESSAGES.get(req.status, "This request is no longer open.")
    if left <= 0:
        return False, SLOTS_FULL
    return True, None


def load(token: str, db: Session):
    response_id, problem = read_respond_token(token)
    if problem == "expired":
        raise HTTPException(
            status.HTTP_410_GONE,
            "This link has expired. Log in to Blood Donor Finder to see if the request is still open.",
        )
    if response_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This link is not valid.")

    expire_old_requests(db)
    row = (
        db.query(RequestResponse, BloodRequest, Hospital, Donor, User)
        .join(BloodRequest, BloodRequest.id == RequestResponse.request_id)
        .join(Hospital, Hospital.id == BloodRequest.hospital_id)
        .join(Donor, Donor.id == RequestResponse.donor_id)
        .join(User, User.id == Donor.user_id)
        .filter(RequestResponse.id == response_id)
        .first()
    )
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This request could not be found.")
    if not row[4].is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is not active.")
    return row


def build_preview(db, resp, req, hosp, user, message: Optional[str] = None) -> RespondPreview:
    left = slots_left(db, req)
    can_respond, reason = respond_state(resp, req, left)
    return RespondPreview(
        donor_name=user.name,
        hospital=hosp.hospital_name,
        city=req.city,
        address=hosp.address,
        blood_group=req.blood_group,
        units_needed=req.units_needed,
        slots_left=left,
        urgency=req.urgency or "Normal",
        required_by=req.required_by,
        note=req.note,
        status=(resp.status or "Notified").lower(),
        can_respond=can_respond,
        message=message or reason,
    )


@router.get("/preview", response_model=RespondPreview)
def preview(token: str, db: Session = Depends(get_db)):
    """Show the request. Changes nothing."""
    resp, req, hosp, _donor, user = load(token, db)
    return build_preview(db, resp, req, hosp, user)


@router.post("", response_model=RespondPreview)
def answer(data: RespondBody, db: Session = Depends(get_db)):
    """Record the donor's answer. Only works while the response is still waiting."""
    resp, req, hosp, _donor, user = load(data.token, db)

    if data.action == "accept":
        # Lock the request so two donors cannot take the last slot at the same moment,
        # then check again with fresh data.
        db.query(BloodRequest).filter(BloodRequest.id == req.id).with_for_update().one()
        db.refresh(req)
        db.refresh(resp)

    left = slots_left(db, req, exclude_response_id=resp.id)
    can_respond, reason = respond_state(resp, req, left)
    if not can_respond:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, reason)

    resp.status = "Accepted" if data.action == "accept" else "Declined"
    resp.responded_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(resp)

    if data.action == "accept":
        thanks = "Thank you for accepting. The hospital can now see your answer and will contact you."
    else:
        thanks = "Thank you for letting us know. We will not ask you about this request again."
    return build_preview(db, resp, req, hosp, user, message=thanks)