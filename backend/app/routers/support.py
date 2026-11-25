import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..mailer import send_support_message, send_support_reply, send_support_resolved
from ..models import SupportMessage, SupportTicket, User
from ..security import get_current_user, require_role

router = APIRouter(prefix="/support", tags=["support"])

MAX_NEW_PER_HOUR = 5
_recent: dict[int, deque] = defaultdict(deque)  # user id -> times of new conversations


class NewTicket(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    category: Literal[
        "Question", "Problem with the app", "Report a hospital or donor", "My account", "Other"
    ] = "Question"
    subject: str = Field(min_length=3, max_length=120)
    message: str = Field(min_length=10, max_length=2000)


class ReplyIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    message: str = Field(min_length=1, max_length=2000)


class StatusIn(BaseModel):
    status: Literal["Open", "Closed"]


class MessageOut(BaseModel):
    id: int
    sender: str
    body: str
    created_at: Optional[datetime] = None


class TicketOut(BaseModel):
    id: int
    category: str
    subject: str
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    unread: bool
    last_message: str
    user_name: str
    user_email: str
    user_role: str


class TicketDetail(TicketOut):
    messages: list[MessageOut]


def check_rate_limit(user_id: int) -> None:
    now = time.time()
    sent = _recent[user_id]
    while sent and now - sent[0] > 3600:
        sent.popleft()
    if len(sent) >= MAX_NEW_PER_HOUR:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "You have sent several messages recently. Please try again in an hour.",
        )
    sent.append(now)


def last_body(db: Session, ticket_id: int) -> str:
    m = (
        db.query(SupportMessage)
        .filter(SupportMessage.ticket_id == ticket_id)
        .order_by(SupportMessage.created_at.desc(), SupportMessage.id.desc())
        .first()
    )
    return m.body if m else ""


def ticket_out(t: SupportTicket, owner: User, viewer: User, last: str) -> TicketOut:
    is_admin = viewer.role == "admin"
    return TicketOut(
        id=t.id,
        category=t.category,
        subject=t.subject,
        status=t.status or "Open",
        created_at=t.created_at,
        updated_at=t.updated_at,
        unread=bool(t.admin_unread if is_admin else t.user_unread),
        last_message=last,
        user_name=owner.name,
        user_email=owner.email,
        user_role=owner.role,
    )


def detail(db: Session, t: SupportTicket, owner: User, viewer: User) -> TicketDetail:
    msgs = (
        db.query(SupportMessage)
        .filter(SupportMessage.ticket_id == t.id)
        .order_by(SupportMessage.created_at.asc(), SupportMessage.id.asc())
        .all()
    )
    base = ticket_out(t, owner, viewer, msgs[-1].body if msgs else "")
    return TicketDetail(
        **base.model_dump(),
        messages=[MessageOut(id=m.id, sender=m.sender, body=m.body, created_at=m.created_at) for m in msgs],
    )


def load_ticket(db: Session, ticket_id: int, viewer: User) -> SupportTicket:
    t = db.get(SupportTicket, ticket_id)
    if t is None or (viewer.role != "admin" and t.user_id != viewer.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found.")
    return t


# NOTE: fixed paths (/mine, /unread, /inbox) must stay above /{ticket_id}

@router.post("", response_model=TicketDetail, status_code=status.HTTP_201_CREATED)
def create_ticket(
    data: NewTicket,
    background: BackgroundTasks,
    user: User = Depends(require_role("donor", "hospital")),
    db: Session = Depends(get_db),
):
    check_rate_limit(user.id)
    subject = " ".join(data.subject.split())  # one line only
    now = datetime.now(timezone.utc)
    t = SupportTicket(
        user_id=user.id, category=data.category, subject=subject, status="Open",
        user_unread=False, admin_unread=True, created_at=now, updated_at=now,
    )
    db.add(t)
    db.flush()
    db.add(SupportMessage(ticket_id=t.id, sender="user", body=data.message, created_at=now))
    db.commit()
    db.refresh(t)
    background.add_task(
        send_support_message, t.id, user.name, user.email, user.role, data.category, subject, data.message
    )
    return detail(db, t, user, user)


@router.get("/mine", response_model=list[TicketOut])
def my_tickets(user: User = Depends(require_role("donor", "hospital")), db: Session = Depends(get_db)):
    rows = (
        db.query(SupportTicket)
        .filter(SupportTicket.user_id == user.id)
        .order_by(SupportTicket.updated_at.desc(), SupportTicket.id.desc())
        .all()
    )
    return [ticket_out(t, user, user, last_body(db, t.id)) for t in rows]


@router.get("/unread")
def unread_count(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role == "admin":
        q = db.query(func.count(SupportTicket.id)).filter(SupportTicket.admin_unread.is_(True))
    else:
        q = db.query(func.count(SupportTicket.id)).filter(
            SupportTicket.user_id == user.id, SupportTicket.user_unread.is_(True)
        )
    return {"count": q.scalar() or 0}


@router.get("/inbox", response_model=list[TicketOut])
def inbox(
    ticket_status: Literal["Open", "Answered", "Closed", "all"] = "Open",
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    q = db.query(SupportTicket, User).join(User, User.id == SupportTicket.user_id)
    if ticket_status != "all":
        q = q.filter(SupportTicket.status == ticket_status)
    rows = q.order_by(SupportTicket.updated_at.desc(), SupportTicket.id.desc()).all()
    return [ticket_out(t, owner, user, last_body(db, t.id)) for t, owner in rows]


@router.get("/{ticket_id}", response_model=TicketDetail)
def read_ticket(ticket_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = load_ticket(db, ticket_id, user)
    owner = db.get(User, t.user_id)
    if user.role == "admin":
        t.admin_unread = False
    else:
        t.user_unread = False
    db.commit()
    return detail(db, t, owner, user)


@router.post("/{ticket_id}/messages", response_model=TicketDetail)
def add_message(
    ticket_id: int,
    data: ReplyIn,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = load_ticket(db, ticket_id, user)
    owner = db.get(User, t.user_id)
    now = datetime.now(timezone.utc)
    is_admin = user.role == "admin"

    db.add(SupportMessage(
        ticket_id=t.id, sender="admin" if is_admin else "user", body=data.message, created_at=now,
    ))
    t.updated_at = now
    if is_admin:
        t.status = "Answered"
        t.user_unread = True
        t.admin_unread = False
        link = f"{settings.frontend_url.rstrip('/')}/{owner.role}/support"
        background.add_task(send_support_reply, owner.email, owner.name, t.subject, data.message, link)
    else:
        t.status = "Open"  # a user reply reopens a closed conversation
        t.admin_unread = True
        t.user_unread = False
        background.add_task(
            send_support_message, t.id, owner.name, owner.email, owner.role,
            t.category, t.subject, data.message, True,
        )
    db.commit()
    db.refresh(t)
    return detail(db, t, owner, user)


@router.patch("/{ticket_id}/status", response_model=TicketDetail)
def set_status(
    ticket_id: int,
    data: StatusIn,
    background: BackgroundTasks,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    t = load_ticket(db, ticket_id, user)
    owner = db.get(User, t.user_id)
    was_closed = t.status == "Closed"
    t.status = data.status
    if data.status == "Closed" and not was_closed:
        t.user_unread = True  # shows the badge on their Get support link
        link = f"{settings.frontend_url.rstrip('/')}/{owner.role}/support"
        background.add_task(send_support_resolved, owner.email, owner.name, t.subject, link)
    db.commit()
    db.refresh(t)
    return detail(db, t, owner, user)