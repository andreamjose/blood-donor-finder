import { useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { BLOOD_GROUPS, URGENCIES, createRequest, messageFrom } from "./hospitalApi";

// Format a Date as yyyy-MM-ddTHH:mm in LOCAL time (what datetime-local expects)
function toLocalInput(date) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

export default function CreateRequest() {
  const { hospital } = useOutletContext();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    blood_group: "",
    units_needed: 1,
    city: hospital?.city || "",
    urgency: "Normal",
    required_by: "",
    exact_match_only: false,
    note: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.blood_group) return setError("Please choose a blood group.");
    if (!form.required_by) return setError("Please choose when the blood is required by.");

    const when = new Date(form.required_by); // parsed as local time
    if (when <= new Date()) return setError("The required-by time must be in the future.");

    setSaving(true);
    try {
      await createRequest({
        blood_group: form.blood_group,
        units_needed: Number(form.units_needed),
        city: form.city.trim(),
        urgency: form.urgency,
        required_by: when.toISOString(), // converts local time to UTC
        exact_match_only: form.exact_match_only,
        note: form.note.trim() || null,
      });
      navigate("/hospital");
    } catch (err) {
      setError(messageFrom(err));
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Create request</h1>
          <p>Tell us what you need and matching donors will be alerted.</p>
        </div>
      </div>

      <section className="card rq-card">
        <form onSubmit={handleSubmit} noValidate>
          {error && <p className="notice notice--warn">{error}</p>}

          <div className="rq-grid">
            <label className="rq-field">
              <span>Blood group *</span>
              <select value={form.blood_group} onChange={set("blood_group")}>
                <option value="">Select</option>
                {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>

            <label className="rq-field">
              <span>Units needed * (1 to 10)</span>
              <input type="number" min={1} max={10} value={form.units_needed} onChange={set("units_needed")} />
            </label>

            <label className="rq-field">
              <span>City *</span>
              <input type="text" value={form.city} onChange={set("city")} placeholder="e.g. Kochi" />
            </label>

            <label className="rq-field">
              <span>Urgency *</span>
              <select value={form.urgency} onChange={set("urgency")}>
                {URGENCIES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>

            <label className="rq-field">
              <span>Required by *</span>
              <input
                type="datetime-local"
                min={toLocalInput(new Date())}
                value={form.required_by}
                onChange={set("required_by")}
              />
            </label>

            <label className="rq-check">
              <input type="checkbox" checked={form.exact_match_only} onChange={set("exact_match_only")} />
              <span>Exact blood group match only</span>
            </label>
          </div>

          <label className="rq-field">
            <span>Note (optional)</span>
            <textarea
              rows={3}
              maxLength={500}
              value={form.note}
              onChange={set("note")}
              placeholder="Ward, contact person, anything donors should know"
            />
            <small>{form.note.length}/500</small>
          </label>

          <div className="rq-actions">
            <Link to="/hospital" className="btn btn--ghost">Cancel</Link>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? "Posting..." : "Post request"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}