import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/client";
import "./login.css";

function messageFrom(err) {
  if (!err.response) return "Cannot reach the server. Check that the backend is running.";
  const detail = err.response.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg.replace(/^Value error, /, "");
  return "Something went wrong. Please try again.";
}

function Shell({ children }) {
  return (
    <div className="login">
      <aside className="login__panel">
        <Link to="/" className="login__brand">Blood Donor Finder</Link>
        <div className="login__pitch">
          <h2>A match today. A second chance tomorrow.</h2>
          <p>Every donation begins with someone choosing to make a difference.</p>
        </div>
        <p className="login__privacy">Your information stays private and secure.</p>
      </aside>
      <main className="login__main">
        <div className="login__form-wrap">{children}</div>
      </main>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address.");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <p className="login__eyebrow">Forgot password</p>
      <h1>Reset your password.</h1>
      <p className="login__sub">Enter your account email and we'll send you a link to choose a new password.</p>

      {sent ? (
        <>
          <p className="login__ok" role="status">
            If an account exists for <strong>{email}</strong>, a reset link is on its way. It expires in
            30 minutes. Check your spam folder if you don't see it.
          </p>
          <p className="login__alt"><Link to="/login" className="link">Back to log in</Link></p>
        </>
      ) : (
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
          {error && <p className="login__error" role="alert">{error}</p>}
          <button type="submit" className="login__submit" disabled={loading}>
            {loading ? "Sending..." : "Send reset link"}
          </button>
          <p className="login__alt"><Link to="/login" className="link">Back to log in</Link></p>
        </form>
      )}
    </Shell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Your password must be at least 8 characters.");
    if (password !== confirm) return setError("The two passwords do not match.");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Shell>
        <p className="login__eyebrow">Reset password</p>
        <h1>This link is not valid.</h1>
        <p className="login__sub">The reset link is missing or incomplete.</p>
        <p className="login__alt"><Link to="/forgot-password" className="link">Request a new link</Link></p>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="login__eyebrow">Reset password</p>
      <h1>Choose a new password.</h1>
      <p className="login__sub">Use at least 8 characters.</p>

      {done ? (
        <>
          <p className="login__ok" role="status">Your password has been updated.</p>
          <Link to="/login" className="login__submit" style={{ textAlign: "center", textDecoration: "none" }}>
            Log in
          </Link>
        </>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="password">New password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="confirm">Confirm new password</label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error && (
            <p className="login__error" role="alert">
              {error}{" "}
              {error.includes("expired") && <Link to="/forgot-password" className="link">Request a new link</Link>}
            </p>
          )}
          <button type="submit" className="login__submit" disabled={loading}>
            {loading ? "Saving..." : "Update password"}
          </button>
        </form>
      )}
    </Shell>
  );
}