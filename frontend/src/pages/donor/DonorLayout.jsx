import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearSession } from "../../api/auth";
import { NotificationBell, UserMenu } from "../../components/Menus";
import { useSupportUnread } from "../supportApi";
import { Icon } from "./components";
import { useNewCamps } from "./campsApi";
import {
  errorMessage,
  fetchDonations,
  fetchDonor,
  fetchIncomingRequests,
  respondToRequest,
  updateAvailability,
  updateEmailNotifications,
} from "./donorApi";
import "./donor.css";

const NAV = [
  { to: "/donor", label: "Dashboard", icon: "grid", end: true },
  { to: "/donor/requests", label: "Incoming Requests", icon: "inbox", badge: true },
  { to: "/donor/profile", label: "My Profile", icon: "user" },
  { to: "/donor/history", label: "Donation History", icon: "history" },
  { to: "/donor/camps", label: "Blood camps", icon: "calendar", campBadge: true },
];

const CRUMBS = {
  "/donor": "Overview",
  "/donor/requests": "Incoming requests",
  "/donor/profile": "My profile",
  "/donor/history": "Donation history",
  "/donor/support": "Support",
  "/donor/camps": "Blood camps",
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

export default function DonorLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const supportUnread = useSupportUnread();
  const newCamps = useNewCamps();

  const [donor, setDonor] = useState(null);
  const [available, setAvailableState] = useState(true);
  const [emailNotifications, setEmailNotificationsState] = useState(true);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [attempt, setAttempt] = useState(0);

  const [requests, setRequests] = useState([]);
  const [donations, setDonations] = useState([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchDonor()
      .then(({ donor, available, emailNotifications }) => {
        if (cancelled) return;
        setDonor(donor);
        setAvailableState(available);
        setEmailNotificationsState(emailNotifications);
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

  // Load requests and donations, then refresh every 30 seconds
  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;
    const load = () => {
      fetchIncomingRequests()
        .then((r) => { if (!cancelled) setRequests(r); })
        .catch(() => {});
      fetchDonations()
        .then((d) => { if (!cancelled) setDonations(d); })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [status]);

  async function setAvailable(value) {
    const previous = available;
    setAvailableState(value);
    try {
      await updateAvailability(value);
    } catch {
      setAvailableState(previous);
    }
  }

  async function setEmailNotifications(value) {
    const previous = emailNotifications;
    setEmailNotificationsState(value);
    try {
      await updateEmailNotifications(value);
    } catch {
      setEmailNotificationsState(previous);
    }
  }

  async function respond(id, answer) {
    try {
      const updated = await respondToRequest(id, answer);
      setRequests((list) => list.map((r) => (r.id === id ? updated : r)));
    } catch (err) {
      window.alert(errorMessage(err));
    }
  }

  function logout() {
    clearSession();
    navigate("/login");
  }

  function search(e) {
    e.preventDefault();
    navigate("/donor/requests");
  }

  if (status === "loading") {
    return <div style={stateStyle}>Loading your dashboard...</div>;
  }
  if (status === "error") {
    return (
      <div style={stateStyle}>
        <p>We could not load your details. Check that the backend is running.</p>
        <button type="button" onClick={() => { setStatus("loading"); setAttempt((n) => n + 1); }}>
          Try again
        </button>
      </div>
    );
  }

  // Requests you can still act on (full requests do not light the badge or the bell)
  const newRequests = requests.filter((r) => r.status === "new" && r.slotsLeft !== 0);
  const newCount = newRequests.length;
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
              {item.campBadge && newCamps > 0 && <em className="dl__badge">{newCamps}</em>}
            </NavLink>
          ))}
        </nav>

        <div className="dl__promo">
          <Icon name="heart" size={16} />
          <strong>A little help goes a long way.</strong>
          <p>Questions about donating? We're here for you.</p>
          <Link to="/guidelines">
            Donation guidelines <Icon name="external" size={11} />
          </Link>
          <Link to="/donor/support">
            Get support <Icon name="external" size={11} />
            {supportUnread > 0 && <em className="dl__badge">{supportUnread}</em>}
          </Link>
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

          <NotificationBell
            to="/donor/requests"
            items={newRequests.map((r) => ({
              id: r.id,
              title: r.hospital,
              note: `${r.group} · ${r.units} ${r.units === 1 ? "unit" : "units"} · ${r.priority}`,
            }))}
          />

          <UserMenu
            name={donor.fullName}
            sub={`${donor.city} · Donor`}
            links={[
              { to: "/donor/profile", label: "My profile" },
              { to: "/donor/history", label: "Donation history" },
            ]}
            onLogout={logout}
          />
        </header>

        <main className="dl__content">
          <Outlet
            context={{
              donor, setDonor, requests, respond, available, setAvailable,
              emailNotifications, setEmailNotifications, query, donations,
            }}
          />
        </main>
      </div>
    </div>
  );
}