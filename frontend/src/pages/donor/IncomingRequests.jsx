import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { BloodChip, HospitalAvatar, Icon, PriorityBadge, ResponseActions } from "./components";
import { eligibility } from "./donorData";

const TABS = [
  ["all", "All requests"],
  ["new", "New"],
  ["accepted", "Accepted"],
  ["declined", "Declined"],
];

export default function IncomingRequests() {
  const { donor, requests, respond, available, query } = useOutletContext();
  const [tab, setTab] = useState("all");
  // Matching now uses distance, so a request from just across a city border is still yours
  const [city, setCity] = useState("all");
  const [selectedId, setSelectedId] = useState(null);

  const count = (s) => requests.filter((r) => r.status === s).length;
  const counts = {
    all: requests.length,
    new: count("new"),
    accepted: count("accepted"),
    declined: count("declined"),
  };

  const q = query.trim().toLowerCase();
  const list = requests.filter(
    (r) =>
      (tab === "all" || r.status === tab) &&
      (city === "all" || r.city === city) &&
      (!q || r.hospital.toLowerCase().includes(q) || r.area.toLowerCase().includes(q)),
  );

  const selected = list.find((r) => r.id === selectedId) ?? list[0];
  const { eligible } = eligibility(donor.lastDonation);

  const where = (r) => `${r.area}${r.distance ? ` · ${r.distance} away` : ""}`;
  const slotsText = (r) =>
    r.slotsLeft === 0 ? "Slots full" : `${r.slotsLeft} ${r.slotsLeft === 1 ? "slot" : "slots"} left`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Incoming requests</h1>
          <p>A match for you could mean everything to someone else.</p>
        </div>
        <span className="pill pill--soft">{counts.new} new matches</span>
      </div>

      <div className="card filters">
        <div className="tabs" role="tablist">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`tab${tab === key ? " tab--active" : ""}`}
              onClick={() => setTab(key)}
            >
              {label} <b>{counts[key]}</b>
            </button>
          ))}
        </div>
        <select className="select" aria-label="City" value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="all">All cities</option>
          <option value={donor.city}>{donor.city}</option>
        </select>
      </div>

      <div className="split">
        <div className="reqlist">
          {list.length === 0 && (
            <div className="card empty">
              No requests here yet. We'll let you know when one within 5 km matches.
            </div>
          )}

          {list.map((r) => (
            <article
              key={r.id}
              className={`card req${selected && selected.id === r.id ? " req--active" : ""}`}
              tabIndex={0}
              onClick={() => setSelectedId(r.id)}
              onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && setSelectedId(r.id)}
            >
              <div className="req__top">
                <div className="hosp">
                  <HospitalAvatar />
                  <span>
                    <strong>{r.hospital}</strong>
                    <small>{where(r)}</small>
                  </span>
                </div>
                <PriorityBadge level={r.priority} />
              </div>

              <p className="req__what">
                <BloodChip group={r.group} /> {r.units} {r.units === 1 ? "unit" : "units"} · {r.component}
              </p>

              <div className="req__bottom">
                <span>
                  Needed {r.needed}
                  <small>{r.received}{r.status === "new" ? ` · ${slotsText(r)}` : ""}</small>
                </span>
                <ResponseActions request={r} onRespond={respond} acceptLabel="Accept request" />
              </div>
            </article>
          ))}

          <p className="reqlist__foot">
            Showing {list.length} {tab === "all" ? "" : `${tab} `}requests matched to your profile
          </p>
        </div>

        {selected && (
          <aside className="card detail">
            <p className="eyebrow">Request details</p>
            <h2>{selected.hospital}</h2>
            <span className="verified"><Icon name="check" size={12} /> Verified hospital</span>
            <small className="detail__id">{selected.code}</small>

            <dl className="detail__rows">
              <div><dt>Blood group</dt><dd>{selected.group}</dd></div>
              <div><dt>Units required</dt><dd>{selected.units} {selected.units === 1 ? "unit" : "units"}</dd></div>
              <div><dt>Slots</dt><dd>{slotsText(selected)}</dd></div>
              <div><dt>Component</dt><dd>{selected.component}</dd></div>
              <div><dt>Required by</dt><dd>{selected.needed}</dd></div>
              <div><dt>Donation location</dt><dd>{selected.place}</dd></div>
              {selected.distance && <div><dt>Distance from you</dt><dd>{selected.distance}</dd></div>}
            </dl>

            <div className="match">
              <strong><Icon name="check" size={13} /> You're a match</strong>
              <p>
                {donor.bloodGroup} blood group · {selected.distance ? `${selected.distance} from you` : donor.city}
              </p>
              <p>
                {available ? "Available" : "Unavailable"} · 90-day gap {eligible ? "complete" : "in progress"}
              </p>
            </div>

            <p className="detail__note">
              Places are first come, first served. Your phone number is shared with this hospital
              only after you accept, and the hospital will confirm final donation eligibility.
            </p>
          </aside>
        )}
      </div>
    </>
  );
}