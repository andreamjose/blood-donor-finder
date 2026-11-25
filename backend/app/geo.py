"""Distance and address lookup (OpenStreetMap Nominatim, free; keep to about 1 request a second)."""
import json
import math
import time
import urllib.parse
import urllib.request
from typing import Optional

from sqlalchemy.orm import Session

from .models import Hospital


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def geocode(query: str) -> Optional[tuple[float, float]]:
    """Turn an address into (latitude, longitude), or None if it cannot be found."""
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"q": query, "format": "json", "limit": 1, "countrycodes": "in"}
    )
    request = urllib.request.Request(url, headers={"User-Agent": "BloodDonorFinder/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            data = json.load(response)
    except Exception:
        return None
    if not data:
        return None
    return float(data[0]["lat"]), float(data[0]["lon"])


def ensure_hospital_location(db: Session, hospital: Hospital) -> bool:
    """Look up the hospital's coordinates once and save them. Returns False if not found."""
    if hospital.latitude is not None and hospital.longitude is not None:
        return True

    attempts = []
    if hospital.address:
        attempts.append(f"{hospital.address}, {hospital.city}, India")
    attempts.append(f"{hospital.hospital_name}, {hospital.city}, India")
    attempts.append(f"{hospital.city}, India")  # last resort: the middle of the city

    point = None
    for text in attempts:
        point = geocode(text)
        if point:
            break
        time.sleep(1.1)  # stay within the free service's rate limit
    if point is None:
        return False

    hospital.latitude, hospital.longitude = point
    db.commit()
    return True