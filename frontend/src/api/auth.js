
// Keeps the login token and the logged-in user in the browser.
// "Remember me" ticked -> localStorage (stays after closing the browser)
// "Remember me" not ticked -> sessionStorage (cleared when the tab is closed)
 
export function saveSession({ access_token, user }, remember = true) {
  clearSession();
  const store = remember ? localStorage : sessionStorage;
  store.setItem("token", access_token);
  store.setItem("user", JSON.stringify(user));
}
 
export function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token");
}
 
export function getUser() {
  try {
    const raw = localStorage.getItem("user") || sessionStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
 
export function clearSession() {
  for (const key of ["token", "user"]) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}
 