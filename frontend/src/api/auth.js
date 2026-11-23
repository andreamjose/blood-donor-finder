// Each tab keeps its own login in sessionStorage, so two tabs can be two different users.
// localStorage remembers the last login, so a new tab or a reopened browser is still logged in.
// A session ends only when the user clicks Logout (or the server rejects the token).

let booted = false;

// Once per page load: a tab with no login of its own picks up the remembered one
function boot() {
  if (booted) return;
  booted = true;
  if (sessionStorage.getItem("token")) return;
  const token = localStorage.getItem("token");
  const user = localStorage.getItem("user");
  if (token && user) {
    sessionStorage.setItem("token", token);
    sessionStorage.setItem("user", user);
  }
}

export function saveSession({ access_token, user }) {
  booted = true;
  const raw = JSON.stringify(user);
  sessionStorage.setItem("token", access_token);
  sessionStorage.setItem("user", raw);
  localStorage.setItem("token", access_token);
  localStorage.setItem("user", raw);
}

export function getToken() {
  boot();
  return sessionStorage.getItem("token");
}

export function getUser() {
  boot();
  try {
    const raw = sessionStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  booted = true;
  const mine = sessionStorage.getItem("token");
  // Only forget the remembered login if it is this tab's login
  if (!mine || localStorage.getItem("token") === mine) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
}

// Where each role lands after login
export function homePathFor(role) {
  if (role === "donor") return "/donor";
  if (role === "hospital") return "/hospital";
  if (role === "admin") return "/admin";
  return "/";
}