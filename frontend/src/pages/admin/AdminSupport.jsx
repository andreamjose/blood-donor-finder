import { useEffect, useState } from "react";
import { formatDateTime, messageFrom } from "../hospital/hospitalApi";
import SupportThread from "../SupportThread";
import { fetchInbox } from "../supportApi";
import "../support.css";

const FILTERS = [
  ["Open", "Needs reply"],
  ["Answered", "Answered"],
  ["Closed", "Resolved"],
  ["all", "All"],
];

export default function AdminSupport() {
  const [filter, setFilter] = useState("Open");
  const [tickets, setTickets] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  function load() {
    fetchInbox(filter)
      .then(setTickets)
      .catch((err) => setError(messageFrom(err)));
  }

  useEffect(() => {
    setTickets(null);
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Support inbox</h1>
          <p>Messages from donors and hospitals. Replies appear in their Support page and are emailed to them.</p>
        </div>
      </div>

      {error && <p className="notice notice--warn hl__pending">{error}</p>}

      <div className="sp-tabs">
        {FILTERS.map(([key, label]) => (
          <button key={key} type="button" className={key === filter ? "btn btn--primary" : "btn btn--ghost"} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>

      <div className="sp-split">
        <section className="card" style={{ padding: 8 }}>
          {tickets === null && !error && <p className="sp-note" style={{ padding: 12 }}>Loading...</p>}
          {tickets !== null && tickets.length === 0 && <p className="sp-note" style={{ padding: 12 }}>Nothing here.</p>}
          <div className="sp-list">
            {(tickets || []).map((t) => (
              <button key={t.id} type="button" className={`sp-row${selected === t.id ? " sp-row--active" : ""}`} onClick={() => setSelected(t.id)}>
                <span className="sp-row__top">
                  <strong>{t.unread && <i className="sp-dot" />}{t.subject}</strong>
                </span>
                <span className="sp-row__sub">{t.user_name} ({t.user_role}) · {formatDateTime(t.updated_at)}</span>
                <span className="sp-row__sub">{t.last_message}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="card sp-card" style={{ maxWidth: "none" }}>
          {selected ? (
            <SupportThread ticketId={selected} isAdmin onChanged={load} />
          ) : (
            <p className="sp-note">Select a conversation to read and reply.</p>
          )}
        </section>
      </div>
    </>
  );
}