import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../api/client.js";
import StatCard from "../components/Cards/StatCard.jsx";
import PageIntro from "../components/Header/PageIntro.jsx";

const frequencies = [
  ["weekly", "Weekly"],
  ["biweekly", "Every two weeks"],
  ["semimonthly", "Twice a month"],
  ["monthly", "Monthly"],
  ["yearly", "Yearly"],
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function emptyForm() {
  return {
    profile_name: "",
    employer_name: "",
    job_title: "",
    pay_type: "hourly",
    pay_amount: "",
    pay_frequency: "weekly",
    hours_per_week: "40",
    pay_day_notes: "",
    overtime_enabled: false,
    overtime_rate_multiplier: "1.5",
    overtime_hours_per_week: "0",
    overtime_notes: "",
    federal_tax_percent: "0",
    state_tax_percent: "0",
    local_tax_percent: "0",
    other_deductions_percent: "0",
    other_deductions_amount: "0",
    active: true,
    notes: "",
  };
}

function profilePayload(profile) {
  return {
    profile_name: profile.profile_name,
    employer_name: profile.employer_name || null,
    job_title: profile.job_title || null,
    pay_type: profile.pay_type,
    pay_amount: Number(profile.pay_amount),
    pay_frequency: profile.pay_frequency,
    hours_per_week: profile.pay_type === "hourly" ? Number(profile.hours_per_week) : null,
    pay_day_notes: profile.pay_day_notes || null,
    overtime_enabled: profile.pay_type === "hourly" && Boolean(profile.overtime_enabled),
    overtime_rate_multiplier: Number(profile.overtime_rate_multiplier),
    overtime_hours_per_week: Number(profile.overtime_hours_per_week),
    overtime_notes: profile.overtime_notes || null,
    federal_tax_percent: Number(profile.federal_tax_percent),
    state_tax_percent: Number(profile.state_tax_percent),
    local_tax_percent: Number(profile.local_tax_percent),
    other_deductions_percent: Number(profile.other_deductions_percent),
    other_deductions_amount: Number(profile.other_deductions_amount),
    active: Boolean(profile.active),
    notes: profile.notes || null,
  };
}

async function responseMessage(response, fallback) {
  try {
    const data = await response.json();
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) return data.detail[0]?.msg || fallback;
  } catch {
    // Keep the friendly fallback for non-JSON errors.
  }
  return fallback;
}

function PayProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [summary, setSummary] = useState({
    total_active_profiles: 0,
    estimated_weekly_gross_income: 0,
    estimated_monthly_gross_income: 0,
    estimated_yearly_gross_income: 0,
    estimated_weekly_net_income: 0,
    estimated_monthly_net_income: 0,
    estimated_yearly_net_income: 0,
    estimated_monthly_taxes: 0,
    estimated_yearly_taxes: 0,
  });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const requestPayData = useCallback(async (signal) => {
    const [profilesResponse, summaryResponse] = await Promise.all([
      apiFetch("/pay-profiles", { signal }),
      apiFetch("/pay-profiles/summary", { signal }),
    ]);
    if (!profilesResponse.ok || !summaryResponse.ok) throw new Error("Pay candy could not be loaded.");
    const [profileData, summaryData] = await Promise.all([profilesResponse.json(), summaryResponse.json()]);
    if (!Array.isArray(profileData)) throw new Error("candyserver returned an invalid pay profile list.");
    return { profileData, summaryData };
  }, []);

  const applyPayData = useCallback(({ profileData, summaryData }) => {
    setProfiles(profileData);
    setSummary(summaryData);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadInitialPayData() {
      try {
        applyPayData(await requestPayData(controller.signal));
      } catch (requestError) {
        if (requestError.name !== "AbortError") setError(requestError.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadInitialPayData();
    return () => controller.abort();
  }, [applyPayData, requestPayData]);

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  function resetForm() {
    setForm(emptyForm());
    setEditingId(null);
  }

  function startEditing(profile) {
    setForm({
      profile_name: profile.profile_name,
      employer_name: profile.employer_name || "",
      job_title: profile.job_title || "",
      pay_type: profile.pay_type,
      pay_amount: String(profile.pay_amount),
      pay_frequency: profile.pay_frequency,
      hours_per_week: profile.hours_per_week === null ? "" : String(profile.hours_per_week),
      pay_day_notes: profile.pay_day_notes || "",
      overtime_enabled: profile.overtime_enabled,
      overtime_rate_multiplier: String(profile.overtime_rate_multiplier),
      overtime_hours_per_week: String(profile.overtime_hours_per_week),
      overtime_notes: profile.overtime_notes || "",
      federal_tax_percent: String(profile.federal_tax_percent),
      state_tax_percent: String(profile.state_tax_percent),
      local_tax_percent: String(profile.local_tax_percent),
      other_deductions_percent: String(profile.other_deductions_percent),
      other_deductions_amount: String(profile.other_deductions_amount),
      active: profile.active,
      notes: profile.notes || "",
    });
    setEditingId(profile.id);
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    const isEditing = editingId !== null;
    try {
      const response = await apiFetch(`/pay-profiles${isEditing ? `/${editingId}` : ""}`, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profilePayload(form)),
      });
      if (!response.ok) throw new Error(await responseMessage(response, "The pay profile could not be saved."));
      resetForm();
      applyPayData(await requestPayData());
      setSuccess(isEditing ? "Pay profile updated throughout CandyVault." : "New pay candy added to the jar.");
    } catch (requestError) {
      setError(requestError.message || "The pay profile could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(profile) {
    setTogglingId(profile.id);
    setError("");
    setSuccess("");
    try {
      const response = await apiFetch(`/pay-profiles/${profile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profilePayload({ ...profile, active: !profile.active })),
      });
      if (!response.ok) throw new Error(await responseMessage(response, "The profile status could not be changed."));
      applyPayData(await requestPayData());
      setSuccess(`${profile.profile_name} is now ${profile.active ? "inactive" : "active"}.`);
    } catch (requestError) {
      setError(requestError.message || "The profile status could not be changed.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(profile) {
    if (!window.confirm(`Delete pay profile "${profile.profile_name}"? This cannot be undone.`)) return;
    setDeletingId(profile.id);
    setError("");
    setSuccess("");
    try {
      const response = await apiFetch(`/pay-profiles/${profile.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseMessage(response, "The pay profile could not be deleted."));
      if (editingId === profile.id) resetForm();
      applyPayData(await requestPayData());
      setSuccess("Pay profile removed and income estimates refreshed.");
    } catch (requestError) {
      setError(requestError.message || "The pay profile could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <PageIntro eyebrow="Household earnings" title="Pay Profiles" description="Track expected household income and keep the money-in side of the candy jar current." />

      <section className="stats-grid pay-summary-grid" aria-label="Pay profile summary">
        <StatCard label="Active Profiles" value={String(summary.total_active_profiles)} detail="Pay streams filling the jar" icon="PAY" />
        <StatCard label="Monthly Gross" value={formatCurrency(summary.estimated_monthly_gross_income)} detail="Before estimated deductions" icon="GROSS" />
        <StatCard label="Monthly Taxes" value={formatCurrency(summary.estimated_monthly_taxes)} detail="Estimated taxes and deductions" icon="TAX" />
        <StatCard label="Monthly Net" value={formatCurrency(summary.estimated_monthly_net_income)} detail="Estimated take-home pay candy" icon="NET" />
        <StatCard label="Yearly Net" value={formatCurrency(summary.estimated_yearly_net_income)} detail="Estimated annual take-home" icon="YR" />
      </section>

      {error && <div className="expense-alert" role="alert">{error}</div>}
      {success && <div className="document-success" role="status">{success}</div>}

      <div className="pay-profile-layout">
        <section className="panel pay-profile-form-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">{editingId === null ? "Add pay candy" : "Edit pay profile"}</h2>
              <p className="panel-subtitle">Income estimates update automatically.</p>
            </div>
          </div>

          <form className="pay-profile-form" onSubmit={handleSubmit}>
            <label className="form-field"><span>Profile name</span><input name="profile_name" value={form.profile_name} onChange={updateField} maxLength="120" placeholder="e.g. Alex’s Pay" required /></label>
            <div className="pay-form-row">
              <label className="form-field"><span>Employer</span><input name="employer_name" value={form.employer_name} onChange={updateField} maxLength="180" placeholder="Candy Company" /></label>
              <label className="form-field"><span>Job title</span><input name="job_title" value={form.job_title} onChange={updateField} maxLength="180" placeholder="Role or position" /></label>
            </div>
            <div className="pay-form-row pay-form-row-three">
              <label className="form-field"><span>Pay type</span><select name="pay_type" value={form.pay_type} onChange={updateField}><option value="hourly">Hourly</option><option value="salary">Salary</option><option value="fixed">Fixed</option></select></label>
              <label className="form-field"><span>{form.pay_type === "hourly" ? "Hourly rate" : "Pay amount"}</span><div className="amount-input"><span aria-hidden="true">$</span><input name="pay_amount" type="number" min="0" step="0.01" value={form.pay_amount} onChange={updateField} placeholder="0.00" required /></div></label>
              <label className="form-field"><span>Frequency</span><select name="pay_frequency" value={form.pay_frequency} onChange={updateField}>{frequencies.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
            {form.pay_type === "hourly" && <label className="form-field"><span>Hours per week</span><input name="hours_per_week" type="number" min="0" step="0.25" value={form.hours_per_week} onChange={updateField} required /></label>}

            {form.pay_type === "hourly" && (
              <fieldset className="pay-detail-section overtime-section">
                <legend>Overtime Pay</legend>
                <label className="pay-active-check"><input name="overtime_enabled" type="checkbox" checked={form.overtime_enabled} onChange={updateField} /><span>Receives overtime pay</span></label>
                {form.overtime_enabled && (
                  <>
                    <div className="pay-form-row">
                      <label className="form-field"><span>Overtime multiplier</span><input name="overtime_rate_multiplier" type="number" min="1" step="0.01" list="overtime-multipliers" value={form.overtime_rate_multiplier} onChange={updateField} required /><datalist id="overtime-multipliers"><option value="1.5" /><option value="2" /></datalist></label>
                      <label className="form-field"><span>Average overtime hours/week</span><input name="overtime_hours_per_week" type="number" min="0" step="0.25" value={form.overtime_hours_per_week} onChange={updateField} required /></label>
                    </div>
                    <label className="form-field"><span>Overtime notes</span><textarea name="overtime_notes" value={form.overtime_notes} onChange={updateField} rows="2" placeholder="Time-and-a-half, seasonal hours, double time…" /></label>
                  </>
                )}
              </fieldset>
            )}

            <fieldset className="pay-detail-section tax-section">
              <legend>Estimated Taxes & Deductions</legend>
              <p className="tax-estimate-helper">These are planning estimates, not tax advice.</p>
              <div className="tax-field-grid">
                <label className="form-field"><span>Federal tax %</span><input name="federal_tax_percent" type="number" min="0" max="100" step="0.01" value={form.federal_tax_percent} onChange={updateField} required /></label>
                <label className="form-field"><span>State tax %</span><input name="state_tax_percent" type="number" min="0" max="100" step="0.01" value={form.state_tax_percent} onChange={updateField} required /></label>
                <label className="form-field"><span>Local tax %</span><input name="local_tax_percent" type="number" min="0" max="100" step="0.01" value={form.local_tax_percent} onChange={updateField} required /></label>
                <label className="form-field"><span>Other deductions %</span><input name="other_deductions_percent" type="number" min="0" max="100" step="0.01" value={form.other_deductions_percent} onChange={updateField} required /></label>
                <label className="form-field"><span>Annual fixed deductions</span><div className="amount-input"><span aria-hidden="true">$</span><input name="other_deductions_amount" type="number" min="0" step="0.01" value={form.other_deductions_amount} onChange={updateField} required /></div></label>
              </div>
            </fieldset>

            <label className="form-field"><span>Pay day notes</span><input name="pay_day_notes" value={form.pay_day_notes} onChange={updateField} maxLength="500" placeholder="e.g. Every other Friday" /></label>
            <label className="form-field"><span>Notes</span><textarea name="notes" value={form.notes} onChange={updateField} maxLength="10000" rows="3" placeholder="Optional household notes…" /></label>
            <label className="pay-active-check"><input name="active" type="checkbox" checked={form.active} onChange={updateField} /><span>Include this profile in household income estimates</span></label>
            <div className="pay-form-actions">
              <button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : editingId === null ? "Add Pay Profile" : "Save Changes"}</button>
              {editingId !== null && <button className="secondary-button" type="button" onClick={resetForm}>Cancel edit</button>}
            </div>
          </form>
        </section>

        <section className="pay-profile-list" aria-label="Household pay profiles">
          <div className="pay-profile-list-heading"><div><span>Household candy counter</span><h2>Pay Profiles</h2></div><b>{profiles.length} profiles</b></div>
          {loading ? (
            <div className="notes-loading" role="status">Counting the household pay candy…</div>
          ) : profiles.length === 0 ? (
            <div className="pay-profile-empty"><span aria-hidden="true">🍭</span><h3>No pay candy in the jar yet.</h3><p>Add the first household earning profile using the form.</p></div>
          ) : (
            <div className="pay-profile-card-grid">
              {profiles.map((profile, index) => (
                <article className={`pay-profile-card pay-card-${index % 4}${profile.active ? "" : " inactive"}`} key={profile.id}>
                  <div className="pay-profile-card-top">
                    <div className="pay-avatar" aria-hidden="true">{profile.profile_name.slice(0, 2).toUpperCase()}</div>
                    <div><span className={`pay-status ${profile.active ? "active" : "inactive"}`}>{profile.active ? "Active" : "Inactive"}</span><h3>{profile.profile_name}</h3><p>{profile.job_title || "Household earner"}{profile.employer_name ? ` · ${profile.employer_name}` : ""}</p></div>
                  </div>
                  <div className="pay-profile-tags"><span>{profile.pay_type}</span><span>{profile.pay_frequency}</span>{profile.pay_type === "hourly" && <span>{Number(profile.hours_per_week)} regular hrs</span>}{profile.overtime_enabled && <span>{Number(profile.overtime_hours_per_week)} OT hrs × {Number(profile.overtime_rate_multiplier)}</span>}<span>{Number(profile.total_tax_percent)}% deductions</span></div>
                  {profile.pay_type === "hourly" && (
                    <div className="pay-gross-split">
                      <div><span>Regular weekly gross</span><strong>{formatCurrency(profile.regular_weekly_gross)}</strong></div>
                      {profile.overtime_enabled && <div><span>Overtime weekly gross</span><strong>{formatCurrency(profile.overtime_weekly_gross)}</strong></div>}
                    </div>
                  )}
                  <div className="pay-income-breakdown">
                    <div className="pay-breakdown-heading"><span>Period</span><span>Gross</span><span>Taxes / deductions</span><span>Net</span></div>
                    <div><strong>Weekly</strong><span>{formatCurrency(profile.estimated_weekly_gross_income)}</span><span>{formatCurrency(profile.estimated_weekly_taxes)}</span><b>{formatCurrency(profile.estimated_weekly_net_income)}</b></div>
                    <div><strong>Monthly</strong><span>{formatCurrency(profile.estimated_monthly_gross_income)}</span><span>{formatCurrency(profile.estimated_monthly_taxes)}</span><b>{formatCurrency(profile.estimated_monthly_net_income)}</b></div>
                    <div><strong>Yearly</strong><span>{formatCurrency(profile.estimated_yearly_gross_income)}</span><span>{formatCurrency(profile.estimated_yearly_taxes)}</span><b>{formatCurrency(profile.estimated_yearly_net_income)}</b></div>
                  </div>
                  {profile.pay_day_notes && <p className="pay-day-note">📅 {profile.pay_day_notes}</p>}
                  <div className="pay-profile-actions">
                    <button type="button" onClick={() => startEditing(profile)}>Edit</button>
                    <button type="button" onClick={() => toggleActive(profile)} disabled={togglingId === profile.id}>{togglingId === profile.id ? "Updating…" : profile.active ? "Set Inactive" : "Set Active"}</button>
                    <button type="button" onClick={() => handleDelete(profile)} disabled={deletingId === profile.id}>{deletingId === profile.id ? "Deleting…" : "Delete"}</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export default PayProfiles;
