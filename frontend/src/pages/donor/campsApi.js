import { useEffect, useState } from "react";
import api from "../../api/client";

export const fetchCamps = () => api.get("/donors/me/camps").then((r) => r.data);
export const bookCamp = (id) => api.post(`/donors/me/camps/${id}/book`).then((r) => r.data);
export const cancelBooking = (id) => api.post(`/donors/me/camps/${id}/cancel`).then((r) => r.data);

// Number of camps near you with a free slot that you have not booked (refreshes every 30 seconds)
export function useNewCamps() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchCamps()
        .then((list) => {
          if (cancelled) return;
          setCount(list.filter((c) => c.slots_left > 0 && c.my_status !== "Booked" && c.my_status !== "Attended").length);
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, 30000);
    window.addEventListener("camps-changed", load);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("camps-changed", load);
    };
  }, []);
  return count;
}