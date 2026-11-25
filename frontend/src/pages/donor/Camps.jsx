import { useEffect, useState } from "react";
import { Icon } from "./components";
import { campWhen, messageFrom } from "../hospital/hospitalApi";
import { bookCamp, cancelBooking, fetchCamps } from "./campsApi";
import "../camps.css";

export default function DonorCamps() {
  const [camps, setCamps] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);

  const load = () =>
    fetchCamps()
      .then(setCamps)
      .catch((err) => setError(messageFrom(err)));

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  async function act(id, fn) {
    setError("");
    setBusy(id);
    try {
      await fn(id);
      await load();
      window.dispatchEvent(new Event("camps-changed"));
    } catch (err) {
      setError(messageFrom(err));
      load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Blood camps</h1>
          <p>Donation drives within 5 km of you. Slots are first come, first served.</p>
        </div>
      </div>

      {error && <p className="notice notice--warn" style={{ marginBottom: "1rem" }}>{error}</p>}
      {camps === null && !error && <p className="cp-meta">Loading...</p>}
      {camps !== null && camps.length === 0 && (
        <section className="card cp-card">
          No camps near you right now. We'll alert you when one is announced within 5 km. Make sure your area is set in My profile.
        </section>
      )}

      {(camps || []).map((c) => {
        const booked = c.my_status === "Booked";
        const attended = c.my_status === "Attended";
        return (
          <section className="card cp-card" key={c.id}>
            <div className="cp-head">
              <div>
                <h2>{c.title}</h2>
                <p className="cp-meta"><Icon name="hospital" size={13} /> {c.hospital}</p>
                <p className="cp-meta"><Icon name="calendar" size={13} /> {campWhen(c)}</p>
                <p className="cp-meta">{c.venue}{c.distance_km != null ? ` · ${c.distance_km} km away` : ""}</p>
                {c.notes && <p className="cp-meta">{c.notes}</p>}
              </div>
              {booked && <span className="status status--ok">You're booked</span>}
              {attended && <span className="status status--ok">Attended</span>}
            </div>

            <div className="cp-bar"><span style={{ width: `${Math.min(100, (c.booked / c.capacity) * 100)}%` }} /></div>
            <p className="cp-count">
              {c.slots_left === 0 ? "Camp full" : `${c.slots_left} of ${c.capacity} slots left`}
            </p>

            <div className="cp-actions">
              {booked && (
                <button type="button" className="btn btn--ghost" disabled={busy === c.id} onClick={() => act(c.id, cancelBooking)}>
                  Cancel my booking
                </button>
              )}
              {!booked && !attended && c.slots_left > 0 && (
                <button type="button" className="btn btn--primary" disabled={busy === c.id} onClick={() => act(c.id, bookCamp)}>
                  {busy === c.id ? "Booking..." : "Book my slot"}
                </button>
              )}
              {!booked && !attended && c.slots_left === 0 && <span className="status status--muted">Camp full</span>}
            </div>
          </section>
        );
      })}
    </>
  );
}