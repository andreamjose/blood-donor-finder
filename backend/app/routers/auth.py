from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Donor, Hospital, User
from ..schemas import LoginRequest, RegisterRequest, TokenResponse, UserOut
from ..security import create_access_token, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
users_router = APIRouter(prefix="/users", tags=["users"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    email = data.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")

    is_donor = data.role == "donor"
    user = User(
        name=data.full_name if is_donor else data.hospital_name,
        email=email,
        password_hash=hash_password(data.password),
        role=data.role,
        is_approved=is_donor,  # hospitals wait for an admin to approve them
        is_active=True,
    )

    try:
        db.add(user)
        db.flush()  # gives the new user an id

        if is_donor:
            db.add(Donor(
                user_id=user.id,
                blood_group=data.blood_group,
                city=data.city,
                phone=data.phone,
                dob=data.dob,
                gender=data.gender,
                last_donation_date=data.last_donation_date,
                is_available=True,
            ))
        else:
            db.add(Hospital(
                user_id=user.id,
                hospital_name=data.hospital_name,
                city=data.city,
                address=data.address,
                phone=data.phone,
                license_no=data.license_no,
            ))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Could not create the account. Check your details.")

    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower()).first()
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is disabled.")
    return {"access_token": create_access_token(user), "token_type": "bearer", "user": user}


@users_router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
