import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { BloodChip, Icon, PriorityBadge, StatCard } from "../donor/components";
import { StatusBadge } from "./components";
import { fetchRequests, fetchSummary, formatDateTime, messageFrom } from "./hospitalApi";

export default function HospitalDashboard() {
  const { hospital } = useOutletContext();
  const [summary, setSummary] = useState(null);
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchSummary(), fetchRequests()])
      .then(([s, r]) => {
        if (cancelled) return;
        setSummary(s);
        setRequests(r);
      })
      .catch((err) => {
        if (!cancelled) setError(messageFrom(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Welcome, {hospital.hospital_name}</h1>
          <p>Post a request and the right donors are alerted straight away.</p>
        </div>
        <div className="page-head__side">
          <Link to="/hospital/requests/new" className="btn btn--primary">
            <Icon name="drop" size={14} /> Create request
          </Link>
        </div>
      </div>

      {error && <p className="notice notice--warn hl__pending">{error}</p>}

      <div className="stats stats--three">
        <StatCard label="Active requests" value={summary ? summary.active_requests : "-"} note="Open right now" icon="inbox" />
        <StatCard label="Donors accepted" value={summary ? summary.donors_accepted : "-"} note="Ready to donate" icon="heart" />
        <StatCard label="Requests fulfilled" value={summary ? summary.requests_fulfilled : "-"} note="All units collected" icon="check" />
      </div>

      <section className="card">
        <div className="card__head">
          <div>
            <h2>Recent requests</h2>
            <p>Your latest blood requests and how many donors have responded.</p>
          </div>
          <Link to="/hospital/requests" className="link">
            View all requests <Icon name="arrow" size={13} />
          </Link>
        </div>

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
              </tr>
            </thead>
            <tbody>
              {requests === null && (
                <tr><td colSpan={7} className="empty-cell">Loading...</td></tr>
              )}
              {requests !== null && requests.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    No requests yet. Create your first request to alert matching donors.
                  </td>
                </tr>
              )}
              {requests !== null && requests.slice(0, 5).map((r) => (
                <tr key={r.id}>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}