import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import { saveSession } from "../api/auth";
import "./login.css";

function DropIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5c3.6 4.3 6.5 7.9 6.5 11.4a6.5 6.5 0 0 1-13 0C5.5 10.4 8.4 6.8 12 2.5z" />
    </svg>
  );
}

function LockIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function EyeIcon({ off }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

// Turn a failed request into a short message for the user
function messageFrom(err) {
  if (!err.response) return "Cannot reach the server. Check that the backend is running.";
  const detail = err.response.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg.replace(/^Value error, /, "");
  return "Login failed. Please try again.";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Enter your password (at least 6 characters).");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email: email.trim(), password });
      saveSession(res.data, remember);

      const { role } = res.data.user;
      if (role === "donor") {
        navigate("/donor");
      } else {
        // TODO: send hospitals to /hospital and admins to /admin once those dashboards exist
        setError("Login worked, but the hospital and admin dashboards are not built yet.");
      }
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login">
      {/* Left brand panel */}
      <aside className="login__panel">
        <Link to="/" className="login__brand">
          <span className="login__logo"><DropIcon size={16} /></span>
          Blood Donor Finder
        </Link>

        <div className="login__pitch">
          <h2>A match today. A second chance tomorrow.</h2>
          <p>Every donation begins with someone choosing to make a difference.</p>
        </div>

        <div className="login__stat">
          <strong>8,650+</strong>
          <span>donations. Countless new tomorrows.</span>
          <small>Be part of a community that cares.</small>
        </div>

        <p className="login__privacy">
          <LockIcon /> Your information stays private and secure.
        </p>
      </aside>

      {/* Right form */}
      <main className="login__main">
        <div className="login__form-wrap">
          <p className="login__eyebrow">Welcome back</p>
          <h1>Good to see you again.</h1>
          <p className="login__sub">Log in to your account and make a difference.</p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="field__password">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="field__toggle"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon off={showPassword} />
                </button>
              </div>
            </div>

            <div className="login__row">
              <label className="check">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Remember me
              </label>
              <Link to="/forgot-password" className="link">Forgot password?</Link>
            </div>

            {error && <p className="login__error" role="alert">{error}</p>}

            <button type="submit" className="login__submit" disabled={loading}>
              {loading ? "Logging in..." : "Log in"}
              {!loading && <span aria-hidden="true">&rarr;</span>}
            </button>
          </form>

          <p className="login__alt">
            Don't have an account? <Link to="/register" className="link">Register now</Link>
          </p>

          <p className="login__note">
            <LockIcon size={16} /> One secure login for donors and hospitals.
          </p>

          <p className="login__legal">
            By continuing, you agree to our <Link to="/terms">Terms of use</Link> and{" "}
            <Link to="/privacy">Privacy policy</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}
