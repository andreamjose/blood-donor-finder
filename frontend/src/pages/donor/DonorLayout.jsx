import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "./components";
import { DONOR, REQUESTS } from "./donorData";
import "./donor.css";

const NAV = [
  { to: "/donor", label: "Dashboard", icon: "grid", end: true },
  { to: "/donor/requests", label: "Incoming Requests", icon: "inbox", badge: true },
  { to: "/donor/profile", label: "My Profile", icon: "user" },
  { to: "/donor/history", label: "Donation History", icon: "history" },
];

const CRUMBS = {
  "/donor": "Overview",
  "/donor/requests": "Incoming requests",
  "/donor/profile": "My profile",
  "/donor/history": "Donation history",
};

export default function DonorLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // State shared by all donor pages (sent down through the Outlet context)
  const [donor, setDonor] = useState(DONOR);
  const [requests, setRequests] = useState(REQUESTS);
  const [available, setAvailable] = useState(true);
  const [query, setQuery] = useState("");

  const newCount = requests.filter((r) => r.status === "new").length;

  function respond(id, status) {
    // TODO: send the response to the backend (PATCH) and then update the list
    setRequests((list) => list.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  function logout() {
    // TODO: also clear the stored login token
    navigate("/login");
  }

  function search(e) {
    e.preventDefault();
    navigate("/donor/requests");
  }

  const crumb = CRUMBS[pathname.replace(/\/$/, "")] ?? "Overview";

  return (
    <div className="dl">
      <aside className="dl__side">
        <Link to="/" className="dl__brand">
          <span className="dl__logo"><Icon name="drop" size={16} /></span>
          <span>
            <strong>Blood Donor</strong>
            <small>FINDER</small>
          </span>
        </Link>

        <p className="dl__label">Donor workspace</p>
        <nav className="dl__nav" aria-label="Donor">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="dl__link">
              <Icon name={item.icon} size={17} />
              <span>{item.label}</span>
              {item.badge && newCount > 0 && <em className="dl__badge">{newCount}</em>}
            </NavLink>
          ))}
        </nav>

        <div className="dl__promo">
          <Icon name="heart" size={16} />
          <strong>A little help goes a long way.</strong>
          <p>Questions about donating? We're here for you.</p>
          <a href="mailto:hello@blooddonorfinder.org">
            Get support <Icon name="external" size={11} />
          </a>
        </div>

        <button type="button" className="dl__logout" onClick={logout}>
          <Icon name="logout" size={17} /> Logout
        </button>
        <p className="dl__copy">&copy; 2026 Blood Donor Finder</p>
      </aside>

      <div className="dl__main">
        <header className="dl__top">
          <p className="dl__crumbs">
            Donor workspace <span>/</span> <strong>{crumb}</strong>
          </p>
          <form className="dl__search" onSubmit={search} role="search">
            <Icon name="search" size={16} />
            <input
              type="search"
              placeholder="Search requests..."
              aria-label="Search requests"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </form>
          <button type="button" className="dl__bell" aria-label="Notifications">
            <Icon name="bell" size={18} />
            {newCount > 0 && <i className="dl__dot" />}
          </button>
          <div className="dl__user">
            <span>
              <strong>{donor.fullName}</strong>
              <small>{donor.city} · Donor</small>
            </span>
            <Icon name="chevron" size={16} />
          </div>
        </header>

        <main className="dl__content">
          <Outlet context={{ donor, setDonor, requests, respond, available, setAvailable, query }} />
        </main>
      </div>
    </div>
  );
}
