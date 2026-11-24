import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { BloodChip, Icon, StatCard } from "./components";
import { formatDate, toIso } from "./donorData";

function cutoff(months) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return toIso(d);
}

function exportCsv(rows) {
  const header = ["Date", "Donation ID", "Hospital", "City", "Blood group", "Volume (mL)", "Status"];
  const lines = rows.map((r) =>
    [r.date, r.id, `"${r.hospital.replace(/"/g, '""')}"`, r.city, r.group, r.volume, "Completed"].join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "donation-history.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function DonationHistory() {
  const { donations } = useOutletContext();
  const [range, setRange] = useState("all");

  const rows = donations.filter((r) => range === "all" || r.date >= cutoff(Number(range)));
  const latest = donations[0];
  const litres = ((donations.length * 450) / 1000).toFixed(1);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Donation history</h1>
          <p>Every visit is a reminder of the difference you make.</p>
        </div>
        <button type="button" className="btn btn--ghost btn--icon" onClick={() => exportCsv(rows)} disabled={rows.length === 0}>
          <Icon name="download" size={14} /> Export history
        </button>
      </div>

      <div className="stats stats--three">
        <StatCard
          label="Lifetime donations"
          value={String(donations.length).padStart(2, "0")}
          note="Thank you for showing up."
          icon="drop"
        />
        <StatCard
          label="Blood donated"
          value={`${litres} L`}
          tone="red"
          note={`${donations.length} donations × 450 mL`}
          icon="heart"
        />
        <StatCard
          label="Most recent donation"
          value={latest ? formatDate(latest.date) : "-"}
          note={latest ? `${latest.hospital}, ${latest.city}` : "No donations yet"}
          icon="calendar"
        />
      </div>

      <section className="card">
        <div className="card__head">
          <h2>Your donation record</h2>
          <select className="select" aria-label="Date range" value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="all">All dates</option>
            <option value="12">Last 12 months</option>
            <option value="6">Last 6 months</option>
          </select>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Donation date</th>
                <th>Hospital</th>
                <th>Blood group</th>
                <th>Volume</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.date, true)}</td>
                  <td>
                    <strong>{r.hospital}</strong>
                    <small className="block">{r.id} · {r.city}</small>
                  </td>
                  <td><BloodChip group={r.group} /></td>
                  <td>{r.volume} mL</td>
                  <td><span className="status status--ok">Completed</span></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-cell">No donations in this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="card__foot">
          Showing {rows.length === donations.length ? "all " : ""}{rows.length} completed donations
        </p>
      </section>
    </>
  );
}