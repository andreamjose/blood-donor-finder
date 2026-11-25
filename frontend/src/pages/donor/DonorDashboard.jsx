import { Link, useOutletContext } from "react-router-dom";
import {
  BloodChip, HospitalAvatar, Icon, PriorityBadge, ResponseActions, StatCard, Toggle,
} from "./components";
import { eligibility, formatDate } from "./donorData";

export default function DonorDashboard() {
  const { donor, requests, respond, available, setAvailable, donations } = useOutletContext();

  const { next, eligible, daysLeft } = eligibility(donor.lastDonation);
  const firstName = donor.fullName.split(" ")[0];
  // Only requests you can still act on (full ones are not "awaiting your response")
  const newCount = requests.filter((r) => r.status === "new" && r.slotsLeft !== 0).length;
  const accepted = requests.filter((r) => r.status === "accepted").length;
  const total = String(donations.length).padStart(2, "0");
  const latest = donations[0];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Welcome back, {firstName}</h1>
          <p>A new day. Another chance to make a difference.</p>
        </div>
        <div className="page-head__side">
          <span className="pill">
            <Icon name="drop" size={12} /> {donor.bloodGroup} Blood group
          </span>
          <span className={`avail${available ? " avail--on" : ""}`}>{available ? "Available" : "Unavailable"}</span>
          <Toggle checked={available} onChange={setAvailable} label="Available to donate" />
        </div>
      </div>

      {!donor.area && (
        <p className="notice notice--warn" style={{ marginBottom: "1rem" }}>
          Add your area in <Link to="/donor/profile" className="link">My profile</Link> to receive requests within 5 km.
        </p>
      )}

      <section className={`banner${eligible ? "" : " banner--wait"}`}>
        <span className="banner__icon"><Icon name="check" size={18} /></span>
        <div>
          <strong>{eligible ? "You're ready to make a difference." : "Time to rest and recover."}</strong>
          <p>
            {eligible
              ? `Your 90-day donation gap is complete. We'll notify you about matching requests within 5 km of you in ${donor.city}.`
              : `You can donate again in ${daysLeft} days. We'll notify you once you're eligible.`}
          </p>
        </div>
        <span className="banner__tag">{eligible ? "Eligible today" : `Eligible ${formatDate(next)}`}</span>
      </section>

      <div className="stats">
        <StatCard label="Total donations" value={total} note="A commitment that counts" icon="drop" />
        <StatCard label="Requests received" value={requests.length} note={`${newCount} awaiting your response`} icon="inbox" />
        <StatCard label="Requests accepted" value={accepted} note="Thank you for stepping up" icon="heart" />
        <StatCard
          label="Next eligible date"
          value={formatDate(next)}
          note={eligible ? "90 days since your last donation" : `${daysLeft} days to go`}
          icon="calendar"
        />
      </div>

      <section className="card">
        <div className="card__head">
          <div>
            <h2>Recent blood requests</h2>
            <p>Matched to your blood group, location and availability.</p>
          </div>
          <Link to="/donor/requests" className="link">
            View all requests <Icon name="arrow" size={13} />
          </Link>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Hospital</th>
                <th>Blood</th>
                <th>Units</th>
                <th>Location</th>
                <th>Priority</th>
                <th>Received</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.slice(0, 3).map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="hosp">
                      <HospitalAvatar />
                      <span>
                        <strong>{r.hospital}</strong>
                        <small>{r.code}</small>
                      </span>
                    </div>
                  </td>
                  <td><BloodChip group={r.group} /></td>
                  <td>{r.units}</td>
                  <td>{r.area}{r.distance && ` · ${r.distance} away`}</td>
                  <td><PriorityBadge level={r.priority} /></td>
                  <td>{r.received}</td>
                  <td><ResponseActions request={r} onRespond={respond} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="duo">
        <section className="card note-card">
          <span className="note-card__icon"><Icon name="heart" size={18} /></span>
          <div>
            <h2>{donations.length} {donations.length === 1 ? "donation" : "donations"}. A lasting impact.</h2>
            <p>
              {latest
                ? `Thank you for making time for others. Your most recent donation was at ${latest.hospital} on ${formatDate(latest.date)}.`
                : "Your first donation will show up here once a hospital confirms it."}
            </p>
            <Link to="/donor/history" className="link">
              View donation history <Icon name="arrow" size={13} />
            </Link>
          </div>
        </section>

        <section className="card note-card">
          <span className="note-card__icon note-card__icon--plain"><Icon name="info" size={18} /></span>
          <div>
            <h2>Before you donate</h2>
            <p>Stay hydrated, have a healthy meal and bring a photo ID. The hospital will confirm eligibility.</p>
            <Link to="/guidelines" className="link">
              Read donation guidelines <Icon name="external" size={12} />
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}