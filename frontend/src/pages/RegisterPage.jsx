import { useState } from "react";
import { Link } from "react-router-dom";
import "./register.css";

const BLOOD_GROUPS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
const GENDERS = ["Male", "Female", "Other"];
// Keep these city names identical to what the backend matching uses
const CITIES = [
  "Kochi", "Thiruvananthapuram", "Kozhikode", "Thrissur", "Bengaluru",
  "Chennai", "Hyderabad", "Mumbai", "Delhi", "Pune",
];

const EMPTY = {
  fullName: "", hospitalName: "", email: "", dob: "", gender: "",
  bloodGroup: "", city: "", phone: "", lastDonation: "", address: "",
  licenseNo: "", password: "", confirm: "", terms: false,
};

function DropIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5c3.6 4.3 6.5 7.9 6.5 11.4a6.5 6.5 0 0 1-13 0C5.5 10.4 8.4 6.8 12 2.5z" />
    </svg>
  );
}

function HospitalIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M12 8v6M9 11h6M10 21v-4h4v4" />
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

function Field({ label, htmlFor, required, error, full, children }) {
  return (
    <div className={`field${full ? " field--full" : ""}${error ? " field--error" : ""}`}>
      <label htmlFor={htmlFor}>
        {label}
        {required && " *"}
      </label>
      {children}
      {error && <p className="field__error" role="alert">{error}</p>}
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="field__password">
      <input
        id={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        className="field__toggle"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
      >
        <EyeIcon off={show} />
      </button>
    </div>
  );
}

function ageFrom(dob) {
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const beforeBirthday =
    now.getMonth() < d.getMonth() ||
    (now.getMonth() === d.getMonth() && now.getDate() < d.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export default function RegisterPage() {
  const [role, setRole] = useState("donor");
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const isDonor = role === "donor";
  const set = (name) => (e) =>
    setValues((v) => ({
      ...v,
      [name]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  function validate() {
    const e = {};
    const today = new Date().toISOString().slice(0, 10);

    if (isDonor) {
      if (!values.fullName.trim()) e.fullName = "Enter your full name.";
      if (!values.dob) e.dob = "Enter your date of birth.";
      else {
        const age = ageFrom(values.dob);
        if (age < 18 || age > 65) e.dob = "Donors must be between 18 and 65 years old.";
      }
      if (!values.gender) e.gender = "Select your gender.";
      if (!values.bloodGroup) e.bloodGroup = "Select your blood group.";
      if (values.lastDonation && values.lastDonation > today)
        e.lastDonation = "The date cannot be in the future.";
    } else {
      if (!values.hospitalName.trim()) e.hospitalName = "Enter the hospital name.";
      if (!values.address.trim()) e.address = "Enter the hospital address.";
      if (!values.licenseNo.trim()) e.licenseNo = "Enter the licence number.";
    }

    if (!/^\S+@\S+\.\S+$/.test(values.email)) e.email = "Enter a valid email address.";
    if (!values.city) e.city = "Select your city.";
    if (!/^\+?[0-9\s-]{10,15}$/.test(values.phone)) e.phone = "Enter a valid phone number.";
    if (values.password.length < 8) e.password = "Use at least 8 characters.";
    if (isDonor && values.confirm !== values.password)
      e.confirm = "Passwords don't match. Please try again.";
    if (!values.terms) e.terms = "Please accept the terms to continue.";
    return e;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    setFormError("");
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setLoading(true);
    try {
      // TODO: send to the backend once the field names are agreed, for example:
      // await api.post("/auth/register", { role, ...fields });
      // Donor: full name, email, password, dob, gender, blood group, city, phone, last donation date
      // Hospital: hospital name, email, password, city, address, phone, license number
      // Hospitals stay "pending" until an admin approves them.
      console.log("Register submitted", { role, email: values.email });
    } catch {
      setFormError("Could not create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="register">
      {/* Left brand panel */}
      <aside className="register__panel">
        <Link to="/" className="register__brand">
          <span className="register__logo"><DropIcon size={16} /></span>
          Blood Donor Finder
        </Link>

        <div className="register__pitch">
          <h2>A match today. A second chance tomorrow.</h2>
          <p>Every donation begins with someone choosing to make a difference.</p>
        </div>

        <div className="register__stat">
          <strong>8,650+</strong>
          <span>donations. Countless new tomorrows.</span>
          <small>Be part of a community that cares.</small>
        </div>

        <p className="register__privacy">
          <LockIcon /> Your information stays private and secure.
        </p>
      </aside>

      {/* Right form */}
      <main className="register__main">
        <div className="register__wrap">
          <p className="register__eyebrow">Join the community</p>
          <h1>Start with a little kindness.</h1>
          <p className="register__sub">Create an account. Be there when it matters.</p>

          <div className="roles" role="group" aria-label="Account type">
            <button
              type="button"
              className={`role${isDonor ? " role--active" : ""}`}
              aria-pressed={isDonor}
              onClick={() => setRole("donor")}
            >
              <span className="role__icon"><DropIcon size={16} /></span>
              <span>
                <strong>Donor</strong>
                <small>I want to give blood</small>
              </span>
            </button>
            <button
              type="button"
              className={`role${!isDonor ? " role--active" : ""}`}
              aria-pressed={!isDonor}
              onClick={() => setRole("hospital")}
            >
              <span className="role__icon"><HospitalIcon /></span>
              <span>
                <strong>Hospital</strong>
                <small>I need blood donors</small>
              </span>
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="register__grid">
              {isDonor ? (
                <Field label="Full name" htmlFor="fullName" required error={errors.fullName}>
                  <input id="fullName" autoComplete="name" placeholder="Your full name"
                    value={values.fullName} onChange={set("fullName")} />
                </Field>
              ) : (
                <Field label="Hospital name" htmlFor="hospitalName" required error={errors.hospitalName}>
                  <input id="hospitalName" placeholder="Hospital name"
                    value={values.hospitalName} onChange={set("hospitalName")} />
                </Field>
              )}

              <Field label={isDonor ? "Email address" : "Work email"} htmlFor="email" required error={errors.email}>
                <input id="email" type="email" autoComplete="email" placeholder="you@example.com"
                  value={values.email} onChange={set("email")} />
              </Field>

              {isDonor && (
                <>
                  <Field label="Date of birth" htmlFor="dob" required error={errors.dob}>
                    <input id="dob" type="date" value={values.dob} onChange={set("dob")} />
                  </Field>
                  <Field label="Gender" htmlFor="gender" required error={errors.gender}>
                    <select id="gender" value={values.gender} onChange={set("gender")}>
                      <option value="">Select</option>
                      {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </Field>
                  <Field label="Blood group" htmlFor="bloodGroup" required error={errors.bloodGroup}>
                    <select id="bloodGroup" value={values.bloodGroup} onChange={set("bloodGroup")}>
                      <option value="">Select</option>
                      {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </Field>
                </>
              )}

              <Field label="City" htmlFor="city" required error={errors.city}>
                <select id="city" value={values.city} onChange={set("city")}>
                  <option value="">Select</option>
                  {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>

              <Field label="Phone number" htmlFor="phone" required error={errors.phone}>
                <input id="phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210"
                  value={values.phone} onChange={set("phone")} />
              </Field>

              {isDonor ? (
                <Field label="Last donation date" htmlFor="lastDonation" error={errors.lastDonation}>
                  <input id="lastDonation" type="date"
                    value={values.lastDonation} onChange={set("lastDonation")} />
                </Field>
              ) : (
                <>
                  <Field label="Licence number" htmlFor="licenseNo" required error={errors.licenseNo}>
                    <input id="licenseNo" placeholder="Licence number"
                      value={values.licenseNo} onChange={set("licenseNo")} />
                  </Field>
                </>
              )}

              <Field label="Password" htmlFor="password" required error={errors.password}>
                <PasswordInput id="password" autoComplete="new-password" placeholder="At least 8 characters"
                  value={values.password} onChange={set("password")} />
              </Field>

              {isDonor ? (
                <Field label="Confirm password" htmlFor="confirm" required error={errors.confirm}>
                  <PasswordInput id="confirm" autoComplete="new-password" placeholder="Repeat your password"
                    value={values.confirm} onChange={set("confirm")} />
                </Field>
              ) : (
                <Field label="Hospital address" htmlFor="address" required full error={errors.address}>
                  <input id="address" autoComplete="street-address" placeholder="Street, area, city and PIN code"
                    value={values.address} onChange={set("address")} />
                </Field>
              )}
            </div>

            {isDonor ? (
              <p className="register__hint">
                A minimum 90-day gap is used for matching. Final eligibility is confirmed
                by the hospital before donation.
              </p>
            ) : (
              <div className="register__notice">
                <span className="register__notice-icon"><HospitalIcon /></span>
                <p>
                  Hospitals are verified before posting blood requests.
                  <br />
                  We'll review your licence within 1-2 business days.
                </p>
              </div>
            )}

            <label className="check">
              <input type="checkbox" checked={values.terms} onChange={set("terms")} />
              <span>
                I agree to the <Link to="/terms">Terms of use</Link> and{" "}
                <Link to="/privacy">Privacy policy</Link>.
              </span>
            </label>
            {errors.terms && <p className="field__error" role="alert">{errors.terms}</p>}

            {formError && <p className="register__error" role="alert">{formError}</p>}

            <button type="submit" className="register__submit" disabled={loading}>
              {loading ? "Creating account..." : `Create ${isDonor ? "donor" : "hospital"} account`}
              {!loading && <span aria-hidden="true">&rarr;</span>}
            </button>
          </form>

          <p className="register__alt">
            Already have an account? <Link to="/login" className="link">Log in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
