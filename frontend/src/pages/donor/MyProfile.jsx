import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { BloodChip, Icon, Toggle } from "./components";
import {
  BLOOD_GROUPS, CITIES, GENDERS, ageFrom, eligibility, formatDate, todayIso,
} from "./donorData";

function Field({ label, htmlFor, error, children }) {
  return (
    <div className={`pf__field${error ? " pf__field--error" : ""}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error && <p className="pf__error" role="alert">{error}</p>}
    </div>
  );
}

function validate(f) {
  const e = {};
  if (!f.fullName.trim()) e.fullName = "Enter your full name.";
  if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = "Enter a valid email address.";
  if (!f.dob) e.dob = "Enter your date of birth.";
  else if (ageFrom(f.dob) < 18 || ageFrom(f.dob) > 65) e.dob = "Donors must be between 18 and 65.";
  if (!f.gender) e.gender = "Select your gender.";
  if (!f.bloodGroup) e.bloodGroup = "Select your blood group.";
  if (!f.city) e.city = "Select your city.";
  if (!/^\+?[0-9\s-]{10,15}$/.test(f.phone)) e.phone = "Enter a valid phone number.";
  if (f.lastDonation && f.lastDonation > todayIso()) e.lastDonation = "The date cannot be in the future.";
  return e;
}

export default function MyProfile() {
  const { donor, setDonor, available, setAvailable } = useOutletContext();
  const [form, setForm] = useState(donor);
  const [errors, setErrors] = useState({});
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);

  const dirty = JSON.stringify(form) !== JSON.stringify(donor);
  const { next, eligible } = eligibility(donor.lastDonation);
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  function save(ev) {
    ev.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    // TODO: send to the backend with PUT /donors/me
    setDonor(form);
  }

  function cancel() {
    setForm(donor);
    setErrors({});
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>My profile</h1>
          <p>Keep your details current so the right requests reach you.</p>
        </div>
        <span className={`notice${dirty ? " notice--warn" : ""}`}>
          <Icon name={dirty ? "info" : "check"} size={14} />
          {dirty ? "You have unsaved changes." : "Your profile is up to date."}
        </span>
      </div>

      <div className="profile">
        <form className="card pf" onSubmit={save} noValidate>
          <h2>Personal information</h2>
          <p className="pf__sub">Your details are shared only with hospitals you accept.</p>

          <div className="pf__grid">
            <Field label="Full name" htmlFor="fullName" error={errors.fullName}>
              <input id="fullName" value={form.fullName} onChange={set("fullName")} />
            </Field>
            <Field label="Email address" htmlFor="email" error={errors.email}>
              <input id="email" type="email" value={form.email} onChange={set("email")} />
            </Field>
            <Field label="Date of birth" htmlFor="dob" error={errors.dob}>
              <input id="dob" type="date" value={form.dob} onChange={set("dob")} />
            </Field>
            <Field label="Gender" htmlFor="gender" error={errors.gender}>
              <select id="gender" value={form.gender} onChange={set("gender")}>
                {GENDERS.map((g) => <option key={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Blood group" htmlFor="bloodGroup" error={errors.bloodGroup}>
              <select id="bloodGroup" value={form.bloodGroup} onChange={set("bloodGroup")}>
                {BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="City" htmlFor="city" error={errors.city}>
              <select id="city" value={form.city} onChange={set("city")}>
                {CITIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Phone number" htmlFor="phone" error={errors.phone}>
              <input id="phone" type="tel" value={form.phone} onChange={set("phone")} />
            </Field>
            <Field label="Last donation date" htmlFor="lastDonation" error={errors.lastDonation}>
              <input id="lastDonation" type="date" value={form.lastDonation} onChange={set("lastDonation")} />
            </Field>
          </div>

          <div className="pf__foot">
            <p>
              Changing your last donation date recalculates your next eligible date using a
              minimum 90-day gap.
            </p>
            <div className="actions">
              <button type="button" className="btn btn--ghost" onClick={cancel}>Cancel</button>
              <button type="submit" className="btn btn--primary" disabled={!dirty}>Save changes</button>
            </div>
          </div>
        </form>

        <div className="profile__side">
          <section className="card ready">
            <BloodChip group={donor.bloodGroup} />
            <h2>{eligible ? "Ready to donate" : "Recovering"}</h2>
            <p>{eligible ? "Your 90-day gap is complete." : "Your 90-day gap is still in progress."}</p>
            <dl>
              <div><dt>Last donation</dt><dd>{formatDate(donor.lastDonation)}</dd></div>
              <div><dt>Next eligible</dt><dd className="ok">{formatDate(next)}</dd></div>
            </dl>
          </section>

          <section className="card prefs">
            <h2>Matching preferences</h2>
            <div className="prefs__row">
              <span><strong>Available to donate</strong><small>You'll receive new matching requests</small></span>
              <Toggle checked={available} onChange={setAvailable} label="Available to donate" />
            </div>
            <div className="prefs__row">
              <span><strong>Email notifications</strong><small>Request updates in your inbox</small></span>
              <Toggle checked={emailAlerts} onChange={setEmailAlerts} label="Email notifications" />
            </div>
            <div className="prefs__row">
              <span><strong>SMS notifications</strong><small>Time-sensitive requests on your phone</small></span>
              <Toggle checked={smsAlerts} onChange={setSmsAlerts} label="SMS notifications" />
            </div>
          </section>
        </div>
      </div>

      <section className="card privacy">
        <h2>Your privacy matters.</h2>
        <p>
          We never display your contact information publicly. Only a hospital whose request you
          accept can see the details needed to coordinate your donation.
        </p>
        <Link to="/privacy" className="link">
          Manage account security <Icon name="arrow" size={13} />
        </Link>
      </section>
    </>
  );
}
