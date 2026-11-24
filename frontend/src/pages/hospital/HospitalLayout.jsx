import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearSession } from "../../api/auth";
import { UserMenu } from "../../components/Menus";
import { Icon } from "../donor/components";
import { fetchHospital } from "./hospitalApi";
import "../donor/donor.css";
import "./hospital.css";

// Change this to your real support mailbox
const SUPPORT_EMAIL = "blooddonorfinder@gmail.com";

const NAV = [
  { to: "/hospital", label: "Dashboard", icon: "grid", end: true },
  { to: "/hospital/requests/new", label: "Create request", icon: "drop" },
  { to: "/hospital/requests", label: "My requests", icon: "inbox", end: true },
];

const CRUMBS = {
  "/hospital": "Overview",
  "/hospital/requests": "My requests",
  "/hospital/requests/new": "Create request",
};

const stateStyle = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  alignContent: "center",
  gap: "0.75rem",
  fontFamily: "Inter, system-ui, sans-serif",
  color: "#6b6560",
  textAlign: "center",
};

export default function HospitalLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [hospital, setHospital] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchHospital()
      .then((data) => {
        if (cancelled) return;
        setHospital(data);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        const code = err.response?.status;
        if (code === 401 || code === 403) {
          clearSession();
          navigate("/login", { replace: true });
        } else {
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, attempt]);

  function logout() {
    clearSession();
    navigate("/login");
  }

  if (status === "loading") {
    return <div style={stateStyle}>Loading your dashboard...</div>;
  }
  if (status === "error") {
    return (
      <div style={stateStyle}>
        <p>We could not load your hospital details. Check that the backend is running.</p>
        <button type="button" onClick={() => { setStatus("loading"); setAttempt((n) => n + 1); }}>
          Try again
        </button>
      </div>
    );
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

        <p className="dl__label">Hospital workspace</p>
        <nav className="dl__nav" aria-label="Hospital">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="dl__link">
              <Icon name={item.icon} size={17} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="dl__promo">
          <Icon name="heart" size={16} />
          <strong>Every minute counts.</strong>
          <p>Mark urgent cases as Urgent or Critical so donors see them first.</p>
          <a href={`mailto:${SUPPORT_EMAIL}`}>
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
            Hospital workspace <span>/</span> <strong>{crumb}</strong>
          </p>

          <UserMenu
            name={hospital.hospital_name}
            sub={`${hospital.city} · Hospital`}
            links={[
              { to: "/hospital", label: "Dashboard" },
              { to: "/hospital/requests", label: "My requests" },
            ]}
            onLogout={logout}
          />
        </header>

        <main className="dl__content">
          {!hospital.is_approved && (
            <div className="notice notice--warn hl__pending" role="status">
              <Icon name="info" size={16} />
              Your hospital account is waiting for admin approval. You can post requests once it is approved.
            </div>
          )}
          <Outlet context={{ hospital }} />
        </main>
      </div>
    </div>
  );
}