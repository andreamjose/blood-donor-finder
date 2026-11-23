from datetime import datetime, timezone

from sqlalchemy.orm import Session

from .models import BloodRequest


def expire_old_requests(db: Session) -> int:
    """Mark every Open request whose required-by time has passed as Expired."""
    count = (
        db.query(BloodRequest)
        .filter(
            BloodRequest.status == "Open",
            BloodRequest.required_by.isnot(None),
            BloodRequest.required_by < datetime.now(timezone.utc),
        )
        .update({BloodRequest.status: "Expired"}, synchronize_session=False)
    )
    if count:
        db.commit()
    return count