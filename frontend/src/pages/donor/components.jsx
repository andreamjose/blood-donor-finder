const PATHS = {
  drop: <path d="M12 2.5c3.6 4.3 6.5 7.9 6.5 11.4a6.5 6.5 0 0 1-13 0C5.5 10.4 8.4 6.8 12 2.5z" />,
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  inbox: (
    <>
      <path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z" />
      <path d="M3 13h5l1 3h6l1-3h5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z" />,
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
    </>
  ),
  chevron: <path d="M6 9l6 6 6-6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  hospital: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M12 8v6M9 11h6M10 21v-4h4v4" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  external: <path d="M7 17L17 7M8 7h9v9" />,
  download: (
    <>
      <path d="M12 3v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M4 21h16" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01M11 12h1v5h1" />
    </>
  ),
};

export function Icon({ name, size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={name === "drop" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle${checked ? " toggle--on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export function BloodChip({ group }) {
  return <span className="chip">{group}</span>;
}

export function PriorityBadge({ level }) {
  return <span className={`priority priority--${level.toLowerCase()}`}>{level}</span>;
}

export function HospitalAvatar() {
  return (
    <span className="avatar">
      <Icon name="hospital" size={16} />
    </span>
  );
}

export function ResponseActions({ request, onRespond, acceptLabel = "Accept" }) {
  if (request.status === "accepted") return <span className="status status--ok">Accepted</span>;
  if (request.status === "declined") return <span className="status status--muted">Declined</span>;
  // The hospital freed this donor's slot (no-show or not suitable)
  if (request.status === "released") return <span className="status status--muted">Slot released</span>;
  // First come, first served: once every slot is taken, late donors can no longer accept
  if (request.status === "new" && request.slotsLeft === 0) {
    return <span className="status status--muted">Slots full</span>;
  }
  return (
    <div className="actions">
      <button type="button" className="btn btn--primary" onClick={() => onRespond(request.id, "accepted")}>
        {acceptLabel}
      </button>
      <button type="button" className="btn btn--ghost" onClick={() => onRespond(request.id, "declined")}>
        Decline
      </button>
    </div>
  );
}

export function StatCard({ label, value, note, icon, tone }) {
  return (
    <div className="card stat">
      <div className="stat__top">
        <span>{label}</span>
        <Icon name={icon} size={16} />
      </div>
      <strong className={tone ? `stat__value stat__value--${tone}` : "stat__value"}>{value}</strong>
      <small>{note}</small>
    </div>
  );
}