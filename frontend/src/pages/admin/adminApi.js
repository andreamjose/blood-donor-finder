import api from "../../api/client";

export { messageFrom } from "../hospital/hospitalApi";

export const fetchAdminSummary = () => api.get("/admin/summary").then((r) => r.data);
export const fetchAdminHospitals = (state) =>
  api.get("/admin/hospitals", { params: { state } }).then((r) => r.data);
export const setHospitalAccess = (id, action) =>
  api.patch(`/admin/hospitals/${id}`, { action }).then((r) => r.data);