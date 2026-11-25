import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/client";
import "./respond.css";

// false = the donor presses a confirm button on this page (safest, recommended).
// true  = the answer is saved as soon as the page opens, when the link carries
//         ?action=accept or ?action=decline. Some strict email scanners run page
//         scripts, so they could answer for the donor.
const AUTO_SAVE = false;

function DropIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5c3.6 4.3 6.5 7.9 6.5 11.4a6.5 6.5 0 0 1-13 0C5.5 10.4 8.4 6.8 12 2.5z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M7.5 12.5l3 3 6-6.5" />
    </svg>
  );
}

function formatWhen(value) {
  if (!value) return "As soon as possible";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return (
    d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " IST"
  );
}

function errorText(err) {
  if (!err?.response) {
    return "Could not reach the server. Please check your connection and try again.";
  }
  const detail = err.response.data?.detail;
  if (typeof detail === "string") return detail;
  return "Something went wrong. Please try again.";
}

export default function RespondPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const hint = params.get("action"); // optional: which button of the email was clicked

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const autoSent = useRef(false);

  async function send(action) {
    setSaving(true);
    setSaveError("");
    try {
      const res = await api.post("/respond", { token, action });
      setData(res.data);
    } catch (err) {
      setSaveError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  // Opening the page only LOOKS at the request. Nothing is saved until an answer is sent.
  useEffect(() => {
    if (!token) {
      setLoadError("This link is not valid.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    api
      .get("/respond/preview", { params: { token } })
      .then((res) => {
        if (cancelled) return;
        setData(res.data);
        const wanted = hint === "accept" || hint === "decline";
        if (AUTO_SAVE && wanted && res.data.can_respond && !autoSent.current) {
          autoSent.current = true;
          send(hint);
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorText(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const urgency = data?.urgency || "Normal";
  const urgencyClass = ["critical", "urgent", "normal"].includes(urgency.toLowerCase())
    ? urgency.toLowerCase()
    : "normal";

  let noticeClass = "respond__notice--warn";
  let showCheck = false;
  if (data?.status === "accepted" || data?.status === "donated") {
    noticeClass = "respond__notice--ok";
    showCheck = true;
  } else if (data?.status === "declined") {
    noticeClass = "respond__notice--declined";
  }

  return (
    <div className="respond">
      <header className="respond__bar">
        <Link to="/" className="respond__brand">
          <span className="respond__logo"><DropIcon /></span>
          Blood Donor Finder
        </Link>
      </header>

      <main className="respond__main">
        <div className="respond__card">
          {loading && <p className="respond__loading">Loading the request...</p>}

          {!loading && loadError && (
            <>
              <p className="respond__eyebrow">Blood request</p>
              <h1>We could not open this request</h1>
              <p className="respond__error">{loadError}</p>
              <p className="respond__footer">
                <Link to="/login" className="respond__link">Log in to Blood Donor Finder</Link>
              </p>
            </>
          )}

          {!loading && data && (
            <>
              <p className="respond__eyebrow">Blood request</p>
              <h1>Hi {data.donor_name}</h1>
              <p className="respond__sub">A hospital near you needs blood that matches yours.</p>

              <div className="respond__hero">
                <span className="respond__group">{data.blood_group}</span>
                <div>
                  <div className="respond__units">
                    {data.units_needed} unit{data.units_needed === 1 ? "" : "s"} needed
                  </div>
                  <div className="respond__when">By {formatWhen(data.required_by)}</div>
                </div>
                <span className={`respond__pill respond__pill--${urgencyClass}`}>{urgency}</span>
              </div>

              <div className="respond__rows">
                <div className="respond__row">
                  <span className="respond__label">Hospital</span>
                  <span className="respond__value">{data.hospital}</span>
                </div>
                <div className="respond__row">
                  <span className="respond__label">City</span>
                  <span className="respond__value">{data.city}</span>
                </div>
                {data.address && (
                  <div className="respond__row">
                    <span className="respond__label">Address</span>
                    <span className="respond__value">{data.address}</span>
                  </div>
                )}
                {data.note && (
                  <div className="respond__row">
                    <span className="respond__label">Note</span>
                    <span className="respond__value">{data.note}</span>
                  </div>
                )}
              </div>

              {data.can_respond ? (
                <>
                  <p className="respond__help">
                    Please accept only if you are able to donate. The hospital's medical team
                    confirms your eligibility before any donation.
                  </p>
                  <div className="respond__buttons">
                    <button
                      className={`respond__btn ${hint === "decline" ? "respond__btn--ghost" : "respond__btn--primary"}`}
                      disabled={saving}
                      onClick={() => send("accept")}
                    >
                      {saving ? "Saving..." : "Accept"}
                    </button>
                    <button
                      className={`respond__btn ${hint === "decline" ? "respond__btn--primary" : "respond__btn--ghost"}`}
                      disabled={saving}
                      onClick={() => send("decline")}
                    >
                      {saving ? "Saving..." : "Decline"}
                    </button>
                  </div>
                </>
              ) : (
                <div className={`respond__notice ${noticeClass}`}>
                  {showCheck && <CheckIcon />}
                  <span>{data.message}</span>
                </div>
              )}

              {saveError && <p className="respond__error">{saveError}</p>}

              <p className="respond__footer">
                <Link to="/login" className="respond__link">Open Blood Donor Finder</Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}