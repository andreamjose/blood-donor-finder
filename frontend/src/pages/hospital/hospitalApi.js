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