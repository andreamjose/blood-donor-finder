import { useState } from "react";
import api from "../api/client";
import { getUser } from "../api/auth";
import { messageFrom } from "./hospital/hospitalApi";
import "./support.css";

const CATEGORIES = [
  "Question",
  "Problem with the app",
  "Report a hospital or donor",
  "My account",
  "Other",
];

export default function SupportPage() {
  const user = getUser();
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (subject.trim().length < 3) return setError("Please add a short subject.");
    if (message.trim().length < 10) return setError("Please describe your concern in a little more detail.");

    setSending(true);
    try {
      await api.post("/support", { category, subject: subject.trim(), message: message.trim() });
      setSent(true);
      setSubject("");
      setMessage("");
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
          <p>Tell us what's wrong or what you need. Our team will reply by email.</p>
        </div>
      </div>

      <section className="card sp-card">
        {sent && (
          <p className="sp-ok" role="status">
            Thanks, your message has been sent. We'll reply to {user?.email}.{" "}
            <button type="button" className="link" style={{ background: "none", border: 0, cursor: "pointer" }} onClick={() => setSent(false)}>
              Send another
            </button>
          </p>
        )}

        {!sent && (
          <form onSubmit={handleSubmit} noValidate>
            {error && <p className="notice notice--warn" style={{ marginBottom: 16 }}>{error}</p>}
            <p className="sp-reply">
              Sending as <strong>{user?.name}</strong>. Replies go to <strong>{user?.email}</strong>.
            </p>

            <label className="sp-field">
              <span>What is this about?</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>

            <label className="sp-field">
              <span>Subject</span>
              <input
                type="text"
                maxLength={120}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="A short summary"
              />
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
      </section>
    </>
  );
}