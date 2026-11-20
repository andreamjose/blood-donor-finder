import api from "../../api/client";

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
