import api from "../../api/client";

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const URGENCIES = ["Normal", "Urgent", "Critical"];

export const fetchHospital = () => api.get("/hospitals/me").then((r) => r.data);
export const fetchSummary = () => api.get("/hospitals/me/summary").then((r) => r.data);
export const fetchRequests = () => api.get("/requests").then((r) => r.data);
export const createRequest = (data) => api.post("/requests", data).then((r) => r.data);
export const cancelRequest = (id) =>
  api.patch(`/requests/${id}/status`, { status: "Cancelled" }).then((r) => r.data);

// Turn a failed request into a short message for the user
export function messageFrom(err) {
  if (!err.response) return "Cannot reach the server. Check that the backend is running.";
  const detail = err.response.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg.replace(/^Value error, /, "");
  return "Something went wrong. Please try again.";
}

export function formatDateTime(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const fetchRequestDonors = (id) =>
  api.get(`/requests/${id}/donors`).then((r) => r.data);

export const markDonated = (id, responseId) =>
  api.post(`/requests/${id}/donors/${responseId}/donated`).then((r) => r.data);

export const releaseSlot = (id, responseId, reason) =>
  api.post(`/requests/${id}/donors/${responseId}/release`, { reason }).then((r) => r.data);

export const fetchCamps = () => api.get("/camps").then((r) => r.data);
export const createCamp = (data) => api.post("/camps", data).then((r) => r.data);
export const cancelCamp = (id) => api.post(`/camps/${id}/cancel`).then((r) => r.data);
export const fetchCampBookings = (id) => api.get(`/camps/${id}/bookings`).then((r) => r.data);
export const markCampBooking = (id, bookingId, status) =>
  api.patch(`/camps/${id}/bookings/${bookingId}`, { status }).then((r) => r.data);

export function campWhen(c) {
  const day = new Date(`${c.camp_date}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
  return `${day}, ${c.start_time.slice(0, 5)} to ${c.end_time.slice(0, 5)}`;
}

export function localToday() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}