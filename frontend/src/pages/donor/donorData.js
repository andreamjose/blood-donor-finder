// Sample data taken from the Figma design.
// TODO: replace with real data from the backend (GET /donors/me, GET /donors/me/requests, donation history).

export const MIN_GAP_DAYS = 90;
export const BLOOD_GROUPS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
export const GENDERS = ["Male", "Female", "Other"];
export const CITIES = [
  "Kochi", "Thiruvananthapuram", "Kozhikode", "Thrissur", "Bengaluru",
  "Chennai", "Hyderabad", "Mumbai", "Delhi", "Pune",
];

export const DONOR = {
  fullName: "Rohan Mehta",
  email: "rohan.mehta@gmail.com",
  dob: "1996-06-14",
  gender: "Male",
  bloodGroup: "O+",
  city: "Bengaluru",
  phone: "+91 98765 43210",
  lastDonation: "2026-08-19",
};

// Totals for the tab counters (the list below only holds the newest requests)
export const REQUEST_COUNTS = { all: 24, new: 3, accepted: 12, declined: 9 };

export const REQUESTS = [
  {
    id: "REQ-2026-1048", hospital: "City Care Hospital", area: "Indiranagar", city: "Bengaluru",
    distance: "2.4 km", priority: "Urgent", group: "O+", units: 2,
    component: "Packed red blood cells", needed: "Today, 6:00 PM", received: "10 minutes ago",
    place: "Hospital blood bank · Floor 1", status: "new",
  },
  {
    id: "REQ-2026-1046", hospital: "Manipal Hospital", area: "HAL Road", city: "Bengaluru",
    distance: "4.8 km", priority: "High", group: "O+", units: 1,
    component: "Packed red blood cells", needed: "Tomorrow, 10:00 AM", received: "35 minutes ago",
    place: "Hospital blood bank · Ground floor", status: "new",
  },
  {
    id: "REQ-2026-1042", hospital: "St. John's Medical College", area: "Koramangala", city: "Bengaluru",
    distance: "6.1 km", priority: "Normal", group: "O+", units: 3,
    component: "Packed red blood cells", needed: "19 Nov, 9:00 AM", received: "1 hour ago",
    place: "Donor room · Block B", status: "new",
  },
];

export const DONATIONS = [
  { id: "DON-2026-008", date: "2026-08-19", hospital: "Manipal Hospital", city: "Bengaluru", group: "O+", volume: 450 },
  { id: "DON-2026-007", date: "2026-05-18", hospital: "City Care Hospital", city: "Bengaluru", group: "O+", volume: 450 },
  { id: "DON-2026-006", date: "2026-02-14", hospital: "St. John's Medical College", city: "Bengaluru", group: "O+", volume: 450 },
  { id: "DON-2025-005", date: "2025-11-12", hospital: "Manipal Hospital", city: "Bengaluru", group: "O+", volume: 450 },
  { id: "DON-2025-004", date: "2025-08-10", hospital: "Fortis Hospital", city: "Bengaluru", group: "O+", volume: 450 },
  { id: "DON-2025-003", date: "2025-05-08", hospital: "City Care Hospital", city: "Bengaluru", group: "O+", volume: 450 },
  { id: "DON-2025-002", date: "2025-02-04", hospital: "St. John's Medical College", city: "Bengaluru", group: "O+", volume: 450 },
  { id: "DON-2024-001", date: "2024-11-01", hospital: "Manipal Hospital", city: "Bengaluru", group: "O+", volume: 450 },
];

/* ---------- date helpers (ISO strings like 2026-08-19) ---------- */

export function toIso(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export const todayIso = () => toIso(new Date());

export function formatDate(iso, pad = false) {
  if (!iso) return "-";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: pad ? "2-digit" : "numeric",
    month: "short",
    year: "numeric",
  });
}

export function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

export function ageFrom(iso) {
  const d = new Date(`${iso}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age -= 1;
  return age;
}

// Next eligible date = last donation + 90 days
export function eligibility(lastDonation) {
  if (!lastDonation) return { next: null, eligible: true, daysLeft: 0 };
  const next = addDays(lastDonation, MIN_GAP_DAYS);
  const today = todayIso();
  const eligible = next <= today;
  const daysLeft = eligible
    ? 0
    : Math.ceil((new Date(`${next}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000);
  return { next, eligible, daysLeft };
}
