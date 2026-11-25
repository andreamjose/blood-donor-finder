import { useEffect, useState } from "react";
import { Icon } from "../donor/components";
import {
  campWhen, cancelCamp, createCamp, fetchCampBookings, fetchCamps,
  localToday, markCampBooking, messageFrom,
} from "./hospitalApi";
import "../camps.css";

const EMPTY = { title: "", venue: "", camp_date: "", start_time: "10:00", end_time: "14:00", capacity: 50, notes: "" };

export default function HospitalCamps() {
  const [camps, setCamps] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [people, setPeople] = useState({});
  const [busy, setBusy] = useState(null);

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));
  const load = () => fetchCamps().then(setCamps).catch((err) => setError(messageFrom(err)));

  useEffect(() => {
  load();
  const timer = setInterval(load, 30000);
  return () => clearInterval(timer);
}, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!form.camp_date) return setError("Choose the camp date.");
    setSaving(true);
    try {
      const camp = await createCamp({
        title: form.title, venue: form.venue, camp_date: form.camp_date,
        start_time: form.start_time, end_time: form.end_time,
        capacity: Number(form.capacity), notes: form.notes || null,
      });
      setInfo(`Camp created. ${camp.notified} eligible ${camp.notified === 1 ? "donor" : "donors"} within 5 km were alerted.`);
      setForm(EMPTY);
      setShowForm(false);
      load();
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(id) {
    if (openId === id) return setOpenId(null);
    setOpenId(id);
    try {
      const list = await fetchCampBookings(id);
      setPeople((p) => ({ ...p, [id]: list }));
    } catch (err) {
      setError(messageFrom(err));
    }
  }

  async function mark(campId, bookingId, status) {
    setBusy(bookingId);
    setError("");
    try {
      await markCampBooking(campId, bookingId, status);
      setPeople((p) => ({ ...p, [campId]: [] }));
      setPeople((p) => ({ ...p }));
      const list = await fetchCampBookings(campId);
      setPeople((p) => ({ ...p, [campId]: list }));
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setBusy(null);
    }
  }

  async function cancel(c) {
    if (!window.confirm(`Cancel "${c.title}"? Everyone who booked will be emailed.`)) return;
    setBusy(c.id);
    try {
      await cancelCamp(c.id);
      load();
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setBusy(null);
    }
  }

  const today = localToday();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Blood camps</h1>
          <p>Hold a donation drive. Donors within 5 km are alerted and book slots, first come, first served.</p>
        </div>
        <div className="page-head__side">
          <button type="button" className="btn btn--primary" onClick={() => setShowForm((s) => !s)}>
            <Icon name="calendar" size={14} /> {showForm ? "Close form" : "New camp"}
          </button>
        </div>
      </div>

      {error && <p className="notice notice--warn hl__pending">{error}</p>}
      {info && <p className="notice hl__pending">{info}</p>}

      {showForm && (
        <section className="card cp-form">
          <form onSubmit={submit} noValidate>
            <div className="rq-grid">
              <label className="rq-field"><span>Camp title *</span>
                <input value={form.title} onChange={set("title")} placeholder="e.g. World Blood Donor Day Camp" /></label>
              <label className="rq-field"><span>Venue *</span>
                <input value={form.venue} onChange={set("venue")} placeholder="e.g. Town Hall, Kakkanad" /></label>
              <label className="rq-field"><span>Date *</span>
                <input type="date" min={today} value={form.camp_date} onChange={set("camp_date")} /></label>
              <label className="rq-field"><span>Slots available *</span>
                <input type="number" min={1} max={1000} value={form.capacity} onChange={set("capacity")} /></label>
              <label className="rq-field"><span>Starts *</span>
                <input type="time" value={form.start_time} onChange={set("start_time")} /></label>
              <label className="rq-field"><span>Ends *</span>
                <input type="time" value={form.end_time} onChange={set("end_time")} /></label>
            </div>
            <label className="rq-field"><span>Notes (optional)</span>
              <textarea rows={3} maxLength={500} value={form.notes} onChange={set("notes")}
                placeholder="What donors should bring, parking, contact person" /></label>
            <div className="rq-actions">
              <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? "Creating..." : "Create camp and alert donors"}
              </button>
            </div>
          </form>
        </section>
      )}

      {camps === null && !error && <p className="cp-meta">Loading...</p>}
      {camps !== null && camps.length === 0 && <section className="card cp-card">No camps yet. Create your first one.</section>}

      {(camps || []).map((c) => (
        <section className="card cp-card" key={c.id}>
          <div className="cp-head">
            <div>
              <h2>{c.title}</h2>
              <p className="cp-meta">{campWhen(c)}</p>
              <p className="cp-meta">{c.venue}</p>
            </div>
            <span className={c.status === "Open" ? "status--open" : "status--closed"}>{c.status}</span>
          </div>

          <div className="cp-bar"><span style={{ width: `${Math.min(100, (c.booked / c.capacity) * 100)}%` }} /></div>
          <p className="cp-count">{c.booked} of {c.capacity} slots booked{c.slots_left === 0 ? " (full)" : ""}</p>

          <div className="cp-actions">
            <button type="button" className="btn btn--ghost" onClick={() => toggle(c.id)}>
              {openId === c.id ? "Hide bookings" : "View bookings"}
            </button>
            {c.status === "Open" && (
              <button type="button" className="btn btn--ghost" disabled={busy === c.id} onClick={() => cancel(c)}>
                Cancel camp
              </button>
            )}
          </div>

          {openId === c.id && (
            <div className="cp-people">
              {!people[c.id] && <p className="cp-meta">Loading...</p>}
              {people[c.id] && people[c.id].length === 0 && <p className="cp-meta">No bookings yet.</p>}
              {c.camp_date > today && people[c.id] && people[c.id].length > 0 && (
                <p className="cp-hint">You can mark attendance from the camp day.</p>
              )}
              {(people[c.id] || []).map((b) => (
                <div className="cp-person" key={b.id}>
                  <span><strong>{b.donor_name}</strong> · {b.blood_group} · {b.phone || "no phone"}</span>
                  {b.status === "Booked" && c.camp_date <= today ? (
                    <span className="cp-actions">
                      <button type="button" className="btn btn--primary" disabled={busy === b.id} onClick={() => mark(c.id, b.id, "Attended")}>Attended</button>
                      <button type="button" className="btn btn--ghost" disabled={busy === b.id} onClick={() => mark(c.id, b.id, "NoShow")}>No-show</button>
                    </span>
                  ) : (
                    <span className={b.status === "Attended" ? "status status--ok" : b.status === "Booked" ? "status--open" : "status--closed"}>
                      {b.status === "NoShow" ? "No-show" : b.status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </>
  );
}