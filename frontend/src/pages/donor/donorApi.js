import api from "../../api/client";
import { toIso } from "./donorData";
// The backend uses snake_case, the pages use camelCase. These two convert between them.
const fromApi = (d) => ({
  fullName: d.full_name,
  email: d.email,
  dob: d.dob ?? "",
  gender: d.gender ?? "",
  bloodGroup: d.blood_group,
  city: d.city,
  phone: d.phone ?? "",
  lastDonation: d.last_donation_date ?? "",
});

const toApi = (f) => ({
  full_name: f.fullName.trim(),
  email: f.email.trim(),
  dob: f.dob,
  gender: f.gender,
  blood_group: f.bloodGroup,
  city: f.city,
  phone: f.phone,
  last_donation_date: f.lastDonation || null,
});

export async function fetchDonor() {
  const { data } = await api.get("/donors/me");
  return { donor: fromApi(data), available: data.is_available };
}

export async function saveDonor(form) {
  const { data } = await api.put("/donors/me", toApi(form));
  return fromApi(data);
}

export async function updateAvailability(value) {
  await api.patch("/donors/me/availability", { is_available: value });
}

// Turn a failed request into a short message for the user
export function errorMessage(err) {
  if (!err.response) return "Cannot reach the server. Check that the backend is running.";
  const detail = err.response.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg.replace(/^Value error, /, "");
  return "Something went wrong. Please try again.";
}
const timeAgo = (iso) => {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} hours ago`;
  return `${Math.round(mins / 1440)} days ago`;
};

// Convert the backend shape into the shape the donor pages already use
const requestFromApi = (r) => ({
  id: r.id,
  code: `REQ-${r.id}`,
  hospital: r.hospital,
  group: r.blood_group,
  units: r.units_needed - r.units_fulfilled,
  city: r.city,
  area: r.address ? `${r.city} · ${r.address}` : r.city,
  distance: "",
  priority: r.urgency,
  received: timeAgo(r.notified_at),
  needed: r.required_by
    ? new Date(r.required_by).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    : "-",
  component: "Whole blood",
  place: r.address || r.city,
  note: r.note,
  status: r.status,
});

export async function fetchIncomingRequests() {
  const { data } = await api.get("/donors/me/requests");
  return data.map(requestFromApi);
}

export async function respondToRequest(requestId, answer) {
  const { data } = await api.post(`/donors/me/requests/${requestId}/respond`, {
    response: answer === "accepted" ? "Accepted" : "Declined",
  });
  return requestFromApi(data);
}

export async function fetchDonations() {
  const { data } = await api.get("/donors/me/donations");
  return data.map((d) => ({
    id: `DON-${d.id}`,
    date: d.donated_at ? toIso(new Date(d.donated_at)) : "",
    hospital: d.hospital,
    city: d.city,
    group: d.blood_group,
    volume: d.volume,
  }));
}