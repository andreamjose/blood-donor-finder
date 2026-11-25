import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BloodChip, Icon, PriorityBadge } from "../donor/components";
import { StatusBadge } from "./components";
import {
  cancelRequest,
  fetchRequestDonors,
  fetchRequests,
  formatDateTime,
  markDonated,
  messageFrom,
  releaseSlot,
} from "./hospitalApi";

const FILTERS = ["All", "Open", "Fulfilled", "Expired", "Cancelled"];

export default function MyRequests() {
  const [requests, setRequests] = useState(null);
  const [filter, setFilter] = useState("All");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [donors, setDonors] = useState({});

  useEffect(() => {
    let cancelled = false;
    fetchRequests()
      .then((r) => { if (!cancelled) setRequests(r); })
      .catch((err) => { if (!cancelled) setError(messageFrom(err)); });
    return () => { cancelled = true; };
  }, []);

  async function handleCancel(id) {
    if (!window.confirm(`Cancel REQ-${id}? Donors will no longer see it.`)) return;
    setError("");
    setBusyId(id);
    try {
      const updated = await cancelRequest(id);
      setRequests((list) => list.map((r) => (r.id === id ? updated : r)));
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleDonors(id) {
    if (openId === id) return setOpenId(null);
    setOpenId(id);
    try {
      const list = await fetchRequestDonors(id);
      setDonors((d) => ({ ...d, [id]: list }));
    } catch (err) {
      setError(messageFrom(err));
    }
  }

  async function handleDonated(reqId, responseId) {
    if (!window.confirm("Confirm that this donor has donated?")) return;
    setError("");
    setBusyId(reqId);
    try {
      const updated = await markDonated(reqId, responseId);
      setRequests((list) => list.map((r) => (r.id === reqId ? updated : r)));
      const list = await fetchRequestDonors(reqId);
      setDonors((d) => ({ ...d, [reqId]: list }));
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRelease(reqId, responseId, reason) {
    const text = reason === "no_show"
      ? "Mark this donor as a no-show? The slot opens up and waiting donors are alerted."
      : "Mark this donor as not suitable? The slot opens up and waiting donors are alerted.";
    if (!window.confirm(text)) return;
    setError("");
    setBusyId(reqId);
    try {
      const updated = await releaseSlot(reqId, responseId, reason);
      setRequests((list) => list.map((r) => (r.id === reqId ? updated : r)));
      const list = await fetchRequestDonors(reqId);
      setDonors((d) => ({ ...d, [reqId]: list }));
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setBusyId(null);
    }
  }

  const visible = requests === null
    ? []
    : filter === "All" ? requests : requests.filter((r) => r.status === filter);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>My requests</h1>
          <p>Every blood request you have posted and how donors responded.</p>
        </div>
        <div className="page-head__side">
          <Link to="/hospital/requests/new" className="btn btn--primary">
            <Icon name="drop" size={14} /> Create request
          </Link>
        </div>
      </div>

      {error && <p className="notice notice--warn hl__pending">{error}</p>}

      <div className="rq-filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={f === filter ? "btn btn--primary" : "btn btn--ghost"}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Blood</th>
                <th>Units</th>
                <th>Urgency</th>
                <th>Required by</th>
                <th>Status</th>
                <th>Donors</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests === null && !error && (
                <tr><td colSpan={8} className="empty-cell">Loading...</td></tr>
              )}
              {requests !== null && visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-cell">
                    {filter === "All" ? "No requests yet." : `No ${filter.toLowerCase()} requests.`}
                  </td>
                </tr>
              )}
              {visible.map((r) => (
                <Fragment key={r.id}>
                  <tr>
                    <td>
                      <strong>REQ-{r.id}</strong>
                      <small>{r.city}</small>
                    </td>
                    <td><BloodChip group={r.blood_group} /></td>
                    <td>{r.units_fulfilled}/{r.units_needed}</td>
                    <td><PriorityBadge level={r.urgency} /></td>
                    <td>{formatDateTime(r.required_by)}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>{r.accepted_count} accepted · {r.notified_count} notified</td>
                    <td>
                      <div className="rq-row-actions">
                        <button type="button" className="btn btn--ghost" onClick={() => toggleDonors(r.id)}>
                          {openId === r.id ? "Hide donors" : "View donors"}
                        </button>
                        {r.status === "Open" && (
                          <button
                            type="button"
                            className="btn btn--ghost"
                            disabled={busyId === r.id}
                            onClick={() => handleCancel(r.id)}
                          >
                            {busyId === r.id ? "Working..." : "Cancel"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {openId === r.id && (
                    <tr>
                      <td colSpan={8}>
                        {!donors[r.id] && "Loading..."}
                        {donors[r.id] && donors[r.id].length === 0 && "No donors have accepted yet."}
                        {donors[r.id] && donors[r.id].map((d) => (
                          <div key={d.response_id} className="rq-donor">
                            <span>
                              <strong>{d.donor_name}</strong> · {d.blood_group} · {d.phone || "no phone"}
                            </span>
                            {d.status === "Donated" && <span className="status status--ok">Donated</span>}
                            {d.status === "NoShow" && <span className="status--closed">No-show</span>}
                            {d.status === "Unsuitable" && <span className="status--closed">Not suitable</span>}
                            {d.status === "Accepted" && r.status === "Open" && (
                              <div className="rq-row-actions">
                                <button
                                  type="button"
                                  className="btn btn--primary"
                                  disabled={busyId === r.id}
                                  onClick={() => handleDonated(r.id, d.response_id)}
                                >
                                  Mark donated
                                </button>
                                <button
                                  type="button"
                                  className="btn btn--ghost"
                                  disabled={busyId === r.id}
                                  onClick={() => handleRelease(r.id, d.response_id, "no_show")}
                                >
                                  No-show
                                </button>
                                <button
                                  type="button"
                                  className="btn btn--ghost"
                                  disabled={busyId === r.id}
                                  onClick={() => handleRelease(r.id, d.response_id, "unsuitable")}
                                >
                                  Not suitable
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}