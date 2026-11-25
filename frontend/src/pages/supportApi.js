import { useEffect, useState } from "react";
import api from "../api/client";

export const createTicket = (data) => api.post("/support", data).then((r) => r.data);
export const fetchMyTickets = () => api.get("/support/mine").then((r) => r.data);
export const fetchInbox = (status) =>
  api.get("/support/inbox", { params: { ticket_status: status } }).then((r) => r.data);
export const fetchTicket = (id) => api.get(`/support/${id}`).then((r) => r.data);
export const sendReply = (id, message) =>
  api.post(`/support/${id}/messages`, { message }).then((r) => r.data);
export const setTicketStatus = (id, status) =>
  api.patch(`/support/${id}/status`, { status }).then((r) => r.data);

// Number of conversations with something new for the logged-in user (refreshes every 30 seconds)
export function useSupportUnread() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api.get("/support/unread")
        .then((r) => { if (!cancelled) setCount(r.data.count); })
        .catch(() => {});
    load();
    const timer = setInterval(load, 30000);
    window.addEventListener("support-changed", load);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("support-changed", load);
    };
  }, []);
  return count;
}