import { useEffect, useState } from "react";
import { getUser } from "../api/auth";
import { formatDateTime, messageFrom } from "./hospital/hospitalApi";
import SupportThread from "./SupportThread";
import { createTicket, fetchMyTickets } from "./supportApi";
import "./support.css";

const CATEGORIES = ["Question", "Problem with the app", "Report a hospital or donor", "My account", "Other"];

export default function SupportPage() {
  const user = getUser();
  const [view, setView] = useState("list"); // list | new | thread
  const [openId, setOpenId] = useState(null);
  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState("");

  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  function loadList() {
    fetchMyTickets()
      .then(setTickets)
      .catch((err) => setError(messageFrom(err)));
  }

  useEffect(() => {
    loadList();
    const timer = setInterval(loadList, 30000);
    return () => clearInterval(timer);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (subject.trim().length < 3) return setError("Please add a short subject.");
    if (message.trim().length < 10) return setError("Please describe your concern in a little more detail.");
    setSending(true);
    try {
      const t = await createTicket({ category, subject: subject.trim(), message: message.trim() });
      setSubject("");
      setMessage("");
      setOpenId(t.id);
      setView("thread");
      loadList();
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Get support</h1>
          <p>Tell us what's wrong or what you need. Our team's replies show up here and by email.</p>
        </div>
      </div>

      <div className="sp-tabs">
        <button type="button" className={view === "new" ? "btn btn--primary" : "btn btn--ghost"} onClick={() => { setError(""); setView("new"); }}>
          New message
        </button>
        <button type="button" className={view !== "new" ? "btn btn--primary" : "btn btn--ghost"} onClick={() => { setError(""); setView("list"); }}>
          My messages{tickets && tickets.some((t) => t.unread) ? " •" : ""}
        </button>
      </div>

      <section className="card sp-card">
        {error && <p className="notice notice--warn" style={{ marginBottom: 16 }}>{error}</p>}

        {view === "new" && (
          <form onSubmit={handleSubmit} noValidate>
            <p className="sp-reply">
              Sending as <strong>{user?.name}</strong>. We'll also email replies to <strong>{user?.email}</strong>.
            </p>
            <label className="sp-field">
              <span>What is this about?</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="sp-field">
              <span>Subject</span>
              <input type="text" maxLength={120} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="A short summary" />
            </label>
            <label className="sp-field">
              <span>Your concern</span>
              <textarea
                rows={6}
                maxLength={2000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what happened, and the request number if it is about a request"
              />
              <small>{message.length}/2000</small>
            </label>
            <div className="sp-actions">
              <button type="submit" className="btn btn--primary" disabled={sending}>
                {sending ? "Sending..." : "Send message"}
              </button>
            </div>
          </form>
        )}

        {view === "list" && (
          <>
            {tickets === null && !error && <p className="sp-note">Loading...</p>}
            {tickets !== null && tickets.length === 0 && (
              <p className="sp-note">You haven't sent any messages yet. Choose "New message" to contact us.</p>
            )}
            <div className="sp-list">
              {(tickets || []).map((t) => (
                <button key={t.id} type="button" className="sp-row" onClick={() => { setOpenId(t.id); setView("thread"); }}>
                  <span className="sp-row__top">
                    <strong>{t.unread && <i className="sp-dot" />}{t.subject}</strong>
                    <span className={t.status === "Answered" ? "status status--ok" : t.status === "Closed" ? "status--closed" : "status--open"}>
                      {t.status === "Open" ? "Waiting for reply" : t.status === "Closed" ? "Resolved" : t.status}
                    </span>
                  </span>
                  <span className="sp-row__sub">{formatDateTime(t.updated_at)} · {t.last_message}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {view === "thread" && openId && (
          <>
            <button type="button" className="link" style={{ background: "none", border: 0, cursor: "pointer", marginBottom: 12 }} onClick={() => { setView("list"); loadList(); }}>
              &larr; All messages
            </button>
            <SupportThread ticketId={openId} onChanged={loadList} />
          </>
        )}
      </section>
    </>
  );
}