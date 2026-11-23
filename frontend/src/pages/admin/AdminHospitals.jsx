import { useEffect, useState } from "react";
import { Icon, StatCard } from "../donor/components";
import {
  fetchAdminHospitals,
  fetchAdminSummary,
  messageFrom,
  setHospitalAccess,
} from "./adminApi";

const FILTERS = [
  ["pending", "Pending"],
  ["approved", "Approved"],
  ["suspended", "Rejected / suspended"],
  ["all", "All"],
];

const LABEL = { pending: "Pending", approved: "Approved", suspended: "Suspended" };

export default function AdminHospitals() {
  const [filter, setFilter] = useState("pending");
  const [summary, setSummary] = useState(null);
  const [hospitals, setHospitals] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  function load(state) {
    setError("");
    Promise.all([fetchAdminSummary(), fetchAdminHospitals(state)])
      .then(([s, h]) => {
        setSummary(s);
        setHospitals(h);
      })
      .catch((err) => setError(messageFrom(err)));
  }

  useEffect(() => {
    setHospitals(null);
    load(filter);
  }, [filter]);

  async function act(h, action) {
    const verb = action === "approve" ? "Approve" : h.state === "pending" ? "Reject" : "Suspend";
    if (!window.confirm(`${verb} ${h.hospital_name}?`)) return;
    setBusyId(h.id);
    try {
      await setHospitalAccess(h.id, action);
      load(filter);
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hospitals</h1>
          <p>Check each licence, then approve the hospital so it can post requests.</p>
        </div>
      </div>

      {error && <p className="notice notice--warn hl__pending">{error}</p>}

      <div className="stats">
        <StatCard label="Pending approval" value={summary ? summary.pending_hospitals : "-"} note="Waiting for you" icon="hospital" />
        <StatCard label="Approved hospitals" value={summary ? summary.approved_hospitals : "-"} note="Can post requests" icon="check" />
        <StatCard label="Donors" value={summary ? summary.donors : "-"} note="Registered" icon="user" />
        <StatCard label="Open requests" value={summary ? summary.open_requests : "-"} note="Across all hospitals" icon="inbox" />
      </div>

      <div className="rq-filters">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={key === filter ? "btn btn--primary" : "btn btn--ghost"}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Hospital</th>
                <th>Licence no.</th>
                <th>Contact</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {hospitals === null && !error && (
                <tr><td colSpan={5} className="empty-cell">Loading...</td></tr>
              )}
              {hospitals !== null && hospitals.length === 0 && (
                <tr><td colSpan={5} className="empty-cell">Nothing here.</td></tr>
              )}
              {(hospitals || []).map((h) => (
                <tr key={h.id}>
                  <td>
                    <strong>{h.hospital_name}</strong>
                    <small>{h.city}{h.address ? ` · ${h.address}` : ""}</small>
                  </td>
                  <td>{h.license_no || "-"}</td>
                  <td>
                    {h.email}
                    <small>{h.phone || "no phone"}</small>
                  </td>
                  <td>
                    <span className={h.state === "approved" ? "status status--ok" : h.state === "pending" ? "status--open" : "status--closed"}>
                      {LABEL[h.state]}
                    </span>
                  </td>
                  <td>
                    <div className="rq-row-actions">
                      {h.state !== "approved" && (
                        <button type="button" className="btn btn--primary" disabled={busyId === h.id} onClick={() => act(h, "approve")}>
                          {h.state === "suspended" ? "Reinstate" : "Approve"}
                        </button>
                      )}
                      {h.state !== "suspended" && (
                        <button type="button" className="btn btn--ghost" disabled={busyId === h.id} onClick={() => act(h, "suspend")}>
                          {h.state === "pending" ? "Reject" : "Suspend"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}