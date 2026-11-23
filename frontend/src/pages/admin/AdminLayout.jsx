import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearSession } from "../../api/auth";
import { UserMenu } from "../../components/Menus";
import { Icon } from "../donor/components";
import "../donor/donor.css";
import "../hospital/hospital.css";

export default function AdminLayout() {
  const navigate = useNavigate();

  function logout() {
    clearSession();
    navigate("/login");
  }

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

        <p className="dl__label">Admin workspace</p>
        <nav className="dl__nav" aria-label="Admin">
          <NavLink to="/admin" end className="dl__link">
            <Icon name="hospital" size={17} />
            <span>Hospitals</span>
          </NavLink>
        </nav>

        <button type="button" className="dl__logout" onClick={logout}>
          <Icon name="logout" size={17} /> Logout
        </button>
        <p className="dl__copy">&copy; 2026 Blood Donor Finder</p>
      </aside>

      <div className="dl__main">
        <header className="dl__top">
          <p className="dl__crumbs">
            Admin workspace <span>/</span> <strong>Hospitals</strong>
          </p>
          <UserMenu name="Administrator" sub="Admin" links={[]} onLogout={logout} />
        </header>
        <main className="dl__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}