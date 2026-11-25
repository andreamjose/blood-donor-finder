import { useEffect, useRef, useState } from "react";
import { formatDateTime, messageFrom } from "./hospital/hospitalApi";
import { fetchTicket, sendReply, setTicketStatus } from "./supportApi";

// One conversation. Used by users (their own) and by the admin inbox.
export default function SupportThread({ ticketId, isAdmin = false, onChanged }) {
  const [ticket, setTicket] = useState(null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  function announce() {
    window.dispatchEvent(new Event("support-changed"));
    if (onChanged) onChanged();
  }

  useEffect(() => {
    let cancelled = false;
    setTicket(null);
    setReply("");
    setError("");
    const load = (first) =>
      fetchTicket(ticketId)
        .then((t) => {
          if (cancelled) return;
          setTicket(t);
          if (first) announce();
        })
        .catch((err) => { if (!cancelled) setError(messageFrom(err)); });
    load(true);
    const timer = setInterval(() => load(false), 30000);
    return () => { cancelled = true; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ block: "nearest" });
  }, [ticket?.messages.length]);

  async function send(e) {
    e.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    setError("");
    try {
      setTicket(await sendReply(ticketId, reply.trim()));
      setReply("");
      announce();
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleClosed() {
    setBusy(true);
    try {
      setTicket(await setTicketStatus(ticketId, ticket.status === "Closed" ? "Open" : "Closed"));
      announce();
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setBusy(false);
    }
  }

  if (!ticket) {
    return <p className="sp-note">{error || "Loading..."}</p>;
  }

  const nameFor = (sender) => {
    if (sender === "admin") return isAdmin ? "You (Support team)" : "Support team";
    return isAdmin ? ticket.user_name : "You";
  };

  return (
    <div className="sp-thread">
      <div className="sp-thread__head">
        <div>
          <h2>{ticket.subject}</h2>
          <small>
            {ticket.category} · {ticket.status === "Closed" ? "Resolved" : ticket.status}
            {isAdmin && ` · ${ticket.user_name} (${ticket.user_role}) · ${ticket.user_email}`}
          </small>
        </div>
        {isAdmin && (
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={toggleClosed}>
            {ticket.status === "Closed" ? "Reopen" : "Mark as resolved"}
          </button>
        )}
      </div>

      <div className="sp-msgs">
        {ticket.messages.map((m) => (
          <div key={m.id} className={`sp-msg${m.sender === "admin" ? " sp-msg--admin" : ""}`}>
            <small>{nameFor(m.sender)} · {formatDateTime(m.created_at)}</small>
            {m.body}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {error && <p className="notice notice--warn" style={{ marginBottom: 12 }}>{error}</p>}
      {!isAdmin && ticket.status === "Closed" && (
        <p className="sp-note">This conversation is resolved. Sending a message will reopen it.</p>
      )}

      <form className="sp-replybox" onSubmit={send}>
        <textarea
          rows={3}
          maxLength={2000}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder={isAdmin ? "Write your reply" : "Write a message"}
        />
        <div className="sp-actions" style={{ marginTop: 10 }}>
          <button type="submit" className="btn btn--primary" disabled={busy || !reply.trim()}>
            {busy ? "Sending..." : isAdmin ? "Send reply" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}