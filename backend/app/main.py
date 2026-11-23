from .routers import admin, auth, blood_requests, donors, hospitals
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from .database import get_db

app = FastAPI(title="Blood Donor Finder")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(auth.users_router)
app.include_router(donors.router)
app.include_router(hospitals.router)
app.include_router(blood_requests.router)
app.include_router(admin.router)
@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}