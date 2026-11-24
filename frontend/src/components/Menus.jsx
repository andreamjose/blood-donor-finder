import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../pages/donor/components";
import "./menu.css";

// Open/close state that also closes on outside click and the Escape key
function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return { open, setOpen, ref };
}

export function UserMenu({ name, sub, links, onLogout }) {
  const { open, setOpen, ref } = useDropdown();
  return (
    <div className="um" ref={ref}>
      <button
        type="button"
        className="dl__user um__btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>
          <strong>{name}</strong>
          <small>{sub}</small>
        </span>
        <Icon name="chevron" size={16} />
      </button>
      {open && (
        <div className="um__panel" role="menu">
          {links.map((l) => (
            <Link key={l.to} to={l.to} role="menuitem" onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          <button type="button" role="menuitem" onClick={onLogout}>Logout</button>
        </div>
      )}
    </div>
  );
}

export function NotificationBell({ items, to }) {
  const { open, setOpen, ref } = useDropdown();
  return (
    <div className="um" ref={ref}>
      <button
        type="button"
        className="dl__bell"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="bell" size={18} />
        {items.length > 0 && <i className="dl__dot" />}
      </button>
      {open && (
        <div className="um__panel um__panel--wide">
          <p className="um__title">New requests</p>
          {items.length === 0 && <p className="um__empty">You're all caught up.</p>}
          {items.slice(0, 5).map((i) => (
            <Link key={i.id} to={to} onClick={() => setOpen(false)}>
              <strong>{i.title}</strong>
              <small>{i.note}</small>
            </Link>
          ))}
          {items.length > 0 && <Link to={to} onClick={() => setOpen(false)}>View all requests</Link>}
        </div>
      )}
    </div>
  );
}