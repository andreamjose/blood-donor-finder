import time
from collections import defaultdict, deque
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from ..mailer import send_support_message
from ..models import User
from ..security import get_current_user

router = APIRouter(prefix="/support", tags=["support"])

MAX_PER_HOUR = 5
_recent: dict[int, deque] = defaultdict(deque)  # user id -> send times (resets on restart)


class SupportRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    category: Literal[
        "Question",
        "Problem with the app",
        "Report a hospital or donor",
        "My account",
        "Other",
    ] = "Question"
    subject: str = Field(min_length=3, max_length=120)
    message: str = Field(min_length=10, max_length=2000)


def check_rate_limit(user_id: int) -> None:
    now = time.time()
    sent = _recent[user_id]
    while sent and now - sent[0] > 3600:
        sent.popleft()
    if len(sent) >= MAX_PER_HOUR:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "You have sent several messages recently. Please try again in an hour.",
        )
    sent.append(now)


@router.post("")
def send_support(
    data: SupportRequest,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
):
    check_rate_limit(user.id)
    subject = " ".join(data.subject.split())  # one line only, safe for an email header
    background.add_task(
        send_support_message, user.name, user.email, user.role, data.category, subject, data.message
    )
    return {"message": "Thanks, your message has been sent to our team. We'll reply by email."}