"""Password hashing, login tokens and the 'who is logged in' dependency."""
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import User

bearer = HTTPBearer()

RESPOND_LINK_MAX_DAYS = 3  # an email link never works for longer than this


def hash_password(password: str) -> str:
    # bcrypt only uses the first 72 bytes of a password
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user: User) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": str(user.id), "role": user.role, "exp": expires}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def _fingerprint(user: User) -> str:
    # Changes whenever the password changes, so a reset link works only once
    return hashlib.sha256(user.password_hash.encode("utf-8")).hexdigest()[:16]


def create_reset_token(user: User) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.reset_token_expire_minutes)
    payload = {"sub": str(user.id), "purpose": "reset", "pwd": _fingerprint(user), "exp": expires}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def user_from_reset_token(token: str, db: Session) -> Optional[User]:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("purpose") != "reset":
            return None
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None
    user = db.get(User, user_id)
    if user is None or not user.is_active or payload.get("pwd") != _fingerprint(user):
        return None
    return user


def create_respond_token(response_id: int, required_by: Optional[datetime]) -> str:
    """Token for the Accept / Decline links in a request email.

    It names ONE donor's response row, so it cannot be used for anything else.
    It expires when the request is needed by, and never later than RESPOND_LINK_MAX_DAYS."""
    expires = datetime.now(timezone.utc) + timedelta(days=RESPOND_LINK_MAX_DAYS)
    if required_by is not None:
        if required_by.tzinfo is None:
            required_by = required_by.replace(tzinfo=timezone.utc)
        expires = min(expires, required_by)
    payload = {"sub": str(response_id), "purpose": "respond", "exp": expires}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def read_respond_token(token: str) -> tuple[Optional[int], Optional[str]]:
    """Returns (response_id, None) for a good token, or (None, "expired" / "invalid")."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except ExpiredSignatureError:
        return None, "expired"
    except JWTError:
        return None, "invalid"
    if payload.get("purpose") != "respond":
        return None, "invalid"
    try:
        return int(payload["sub"]), None
    except (KeyError, ValueError):
        return None, "invalid"


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired login. Please log in again.")
    try:
        payload = jwt.decode(creds.credentials, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("purpose"):  # reset and respond tokens are not login tokens
            raise unauthorized
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise unauthorized

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise unauthorized
    return user


def require_role(*roles: str):
    """Use as: user = Depends(require_role("hospital"))"""

    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this.")
        return user

    return checker
