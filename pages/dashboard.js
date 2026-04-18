import Head from "next/head";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import { ETA_DESTINATIONS, MONTH_NAMES } from "../lib/constants";
import { downloadExcelReport, downloadPdfReport } from "../lib/exporters";
import {
  buildPayrollSummary,
  enrichJobsWithPayroll,
  formatHours,
  parseDateParts
} from "../lib/payroll";

const ETA_HOUR_OPTIONS = Array.from({ length: 13 }, (_, index) => index);
const ETA_MINUTE_OPTIONS = Array.from({ length: 12 }, (_, index) => index * 5);

function todayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function createEmptyForm(technicianId = "") {
  return {
    technicianId,
    date: todayDateString(),
    customer: "",
    issue: "",
    location: "",
    dispatchTime: "08:00",
    etaToHours: 0,
    etaToMinutes: 0,
    arrivalTime: "08:00",
    finishedTime: "09:00",
    etaFromHours: 0,
    etaFromMinutes: 0,
    etaFromDestination: "home"
  };
}

function formatDisplayDate(dateString = "") {
  const parsed = parseDateParts(dateString);

  if (!parsed) {
    return dateString;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsed.date);
}

function payTypeLabel(value = "") {
  return value === "hourly" ? "Hourly" : "Salary";
}

function roleLabel(value = "") {
  if (value === "admin") {
    return "Admin";
  }

  if (value === "editor") {
    return "Editor";
  }

  return "Viewer";
}

function statusLabel(value = "") {
  if (value === "approved") {
    return "Approved";
  }

  if (value === "suspended") {
    return "Suspended";
  }

  return "Pending";
}

function deriveYearOptions(jobs = []) {
  const now = new Date().getFullYear();
  const years = new Set([now, now - 1]);

  jobs.forEach((job) => {
    const parsed = parseDateParts(job.date);
    if (parsed) {
      years.add(parsed.year);
    }
  });

  return Array.from(years).sort((left, right) => right - left);
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(createEmptyForm(""));
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedTech, setSelectedTech] = useState(null);
  const [historyMonth, setHistoryMonth] = useState(new Date().getMonth());
  const [historyYear, setHistoryYear] = useState(new Date().getFullYear());
  const [showUserManager, setShowUserManager] = useState(false);
  const [showTechManager, setShowTechManager] = useState(false);
  const [newTechnician, setNewTechnician] = useState({
    name: "",
    payType: "salary"
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  async function authFetch(url, options = {}) {
    const token =
      typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
    const headers = {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
    const response = await fetch(url, {
      ...options,
      headers
    });

    if (response.status === 401) {
      window.localStorage.removeItem("token");
      router.replace("/");
      throw new Error("Your session expired. Please sign in again.");
    }

    return response;
  }

  async function loadDashboard() {
    setLoading(true);

    try {
      const sessionResponse = await authFetch("/api/session");
      const sessionData = await sessionResponse.json();

      if (!sessionData.user) {
        router.replace("/");
        return;
      }

      setSession(sessionData.user);

      const [jobsResponse, techniciansResponse] = await Promise.all([
        authFetch("/api/jobs"),
        authFetch("/api/technicians")
      ]);

      const jobsData = await jobsResponse.json();
      const techniciansData = await techniciansResponse.json();
      const nextTechnicians = techniciansData.technicians || [];

      setJobs(jobsData.jobs || []);
      setTechnicians(nextTechnicians);
      setForm((current) =>
        current.technicianId
          ? current
          : createEmptyForm(
              nextTechnicians.find((technician) => technician.active)?._id ||
                nextTechnicians[0]?._id ||
                ""
            )
      );

      if (sessionData.user.role === "admin") {
        const usersResponse = await authFetch("/api/users");
        const usersData = await usersResponse.json();
        setUsers(usersData.users || []);
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Unable to load the portal."
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleEntrySubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await authFetch("/api/jobs", {
        method: "POST",
        body: JSON.stringify(form)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to save the entry.");
      }

      setJobs(data.jobs || []);
      setForm(createEmptyForm(form.technicianId));
      setMessage({
        type: "success",
        text: "Entry saved and payroll totals refreshed."
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteJob(jobId) {
    if (!window.confirm("Delete this payroll entry?")) {
      return;
    }

    setWorking(true);
    setMessage(null);

    try {
      const response = await authFetch(`/api/jobs?id=${jobId}`, {
        method: "DELETE"
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to delete the entry.");
      }

      setJobs(data.jobs || []);
      setMessage({
        type: "success",
        text: "Entry deleted."
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message
      });
    } finally {
      setWorking(false);
    }
  }

  async function refreshUsers() {
    const response = await authFetch("/api/users");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to load users.");
    }

    setUsers(data.users || []);
  }

  async function handleUserUpdate(userId, updates) {
    setWorking(true);
    setMessage(null);

    try {
      const response = await authFetch("/api/users", {
        method: "PATCH",
        body: JSON.stringify({ userId, ...updates })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to update that user.");
      }

      setUsers(data.users || []);
      setMessage({
        type: "success",
        text: "User access updated."
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message
      });
    } finally {
      setWorking(false);
    }
  }

  async function handleAddTechnician(event) {
    event.preventDefault();
    setWorking(true);
    setMessage(null);

    try {
      const response = await authFetch("/api/technicians", {
        method: "POST",
        body: JSON.stringify(newTechnician)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to add the technician.");
      }

      setTechnicians(data.technicians || []);
      setNewTechnician({ name: "", payType: "salary" });
      setMessage({
        type: "success",
        text: "Technician added."
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message
      });
    } finally {
      setWorking(false);
    }
  }

  async function handleTechnicianUpdate(technicianId, updates) {
    setWorking(true);
    setMessage(null);

    try {
      const response = await authFetch("/api/technicians", {
        method: "PATCH",
        body: JSON.stringify({ technicianId, ...updates })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to update the technician.");
      }

      setTechnicians(data.technicians || []);
      setMessage({
        type: "success",
        text: "Technician updated."
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message
      });
    } finally {
      setWorking(false);
    }
  }

  async function handleTechnicianDelete(technicianId) {
    if (!window.confirm("Remove this technician from the roster?")) {
      return;
    }

    setWorking(true);
    setMessage(null);

    try {
      const response = await authFetch(`/api/technicians?id=${technicianId}`, {
        method: "DELETE"
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to remove the technician.");
      }

      setTechnicians(data.technicians || []);
      setMessage({
        type: "success",
        text: "Technician removed."
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message
      });
    } finally {
      setWorking(false);
    }
  }

  function handleLogout() {
    window.localStorage.removeItem("token");
    router.replace("/");
  }

  const canEdit = session?.role === "admin" || session?.role === "editor";
  const isAdmin = session?.role === "admin";
  const enrichedJobs = enrichJobsWithPayroll(jobs);
  const filteredJobs = enrichedJobs.filter((job) => {
    const parsed = parseDateParts(job.date);

    return (
      parsed &&
      parsed.month === selectedMonth + 1 &&
      parsed.year === selectedYear
    );
  });
  const summaryCards = buildPayrollSummary(filteredJobs, technicians).filter(
    (item) => item.active || item.jobCount > 0
  );
  const periodRegularHours = summaryCards.reduce(
    (total, item) => total + item.regularHours,
    0
  );
  const periodAfterHours = summaryCards.reduce(
    (total, item) => total + item.afterHours,
    0
  );
  const periodTotalHours = summaryCards.reduce(
    (total, item) => total + item.totalHours,
    0
  );
  const yearOptions = deriveYearOptions(enrichedJobs);
  const pendingUsers = users.filter((user) => user.status === "pending");
  const managedUsers = users.filter((user) => user.status !== "pending");
  const historyJobs = selectedTech
    ? enrichedJobs.filter((job) => {
        const parsed = parseDateParts(job.date);
        return (
          job.technicianName === selectedTech.name &&
          parsed &&
          parsed.month === historyMonth + 1 &&
          parsed.year === historyYear
        );
      })
    : [];
  const historySummary = selectedTech
    ? buildPayrollSummary(historyJobs, [selectedTech])[0]
    : null;

  if (loading) {
    return (
        <div className="portal-shell">
        <div className="loading-state">Loading portal data...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>M&apos;s Fleet Service | Dashboard</title>
      </Head>

      <div className="portal-shell">
        <header className="portal-topbar">
          <div>
            <p className="eyebrow">Operational Payroll Portal</p>
            <h1>M&apos;s Fleet Service</h1>
            <p className="topbar-copy">
              Track jobs, monitor payroll exposure, and review technician history across the current and previous year.
            </p>
          </div>

          <div className="topbar-tools">
            <div className="profile-card">
              <span className="profile-eyebrow">Signed in as</span>
              <strong>{session?.fullName}</strong>
              <span>
                @{session?.username} - {roleLabel(session?.role)}
              </span>
            </div>

            <div className="topbar-actions">
              {isAdmin ? (
                <>
                  <button className="ghost-button" onClick={() => setShowUserManager(true)}>
                    User Access
                  </button>
                  <button className="ghost-button" onClick={() => setShowTechManager(true)}>
                    Technicians
                  </button>
                </>
              ) : null}
              <button className="secondary-button" onClick={handleLogout}>
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {message ? <div className={`notice ${message.type}`}>{message.text}</div> : null}

        <section className="metric-grid">
          <article className="metric-card">
            <span>Selected Period</span>
            <strong>
              {MONTH_NAMES[selectedMonth]} {selectedYear}
            </strong>
            <small>{filteredJobs.length} entries tracked</small>
          </article>
          <article className="metric-card">
            <span>Regular Hours</span>
            <strong>{formatHours(periodRegularHours)}</strong>
            <small>Monday to Saturday, 8 AM to 6 PM</small>
          </article>
          <article className="metric-card">
            <span>After Hours</span>
            <strong>{formatHours(periodAfterHours)}</strong>
            <small>Sunday, holiday, and outside regular hours</small>
          </article>
          <article className="metric-card">
            <span>Total Hours</span>
            <strong>{formatHours(periodTotalHours)}</strong>
            <small>{technicians.filter((technician) => technician.active).length} active technicians</small>
          </article>
        </section>

        <section className="toolbar panel">
          <div>
            <p className="eyebrow">Reporting Focus</p>
            <h3>Month and year filter</h3>
          </div>
          <div className="toolbar-controls">
            <select value={selectedMonth} onChange={(event) => setSelectedMonth(Number(event.target.value))}>
              {MONTH_NAMES.map((monthName, index) => (
                <option key={monthName} value={index}>
                  {monthName}
                </option>
              ))}
            </select>
            <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="workspace-grid">
          <article className="panel form-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Centre Left</p>
                <h3>Service Entry</h3>
              </div>
              <span className={`pill ${canEdit ? "success" : "muted"}`}>
                {canEdit ? "Edit enabled" : "View only"}
              </span>
            </div>

            {!canEdit ? (
              <div className="empty-card">
                <strong>Your account has view-only access.</strong>
                <p>
                  Admins can promote you to editor access from the User Access panel if you need to submit or delete entries.
                </p>
              </div>
            ) : null}

            <form className="entry-form" onSubmit={handleEntrySubmit}>
              <label>
                Technician
                <select
                  disabled={!canEdit}
                  value={form.technicianId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      technicianId: event.target.value
                    }))
                  }
                >
                  <option value="">Select technician</option>
                  {technicians
                    .filter((technician) => technician.active)
                    .map((technician) => (
                      <option key={technician._id} value={technician._id}>
                        {technician.name} - {payTypeLabel(technician.payType)}
                      </option>
                    ))}
                </select>
              </label>

              <div className="two-column-grid">
                <label>
                  Date
                  <input
                    disabled={!canEdit}
                    type="date"
                    value={form.date}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        date: event.target.value
                      }))
                    }
                  />
                </label>

                <label>
                  Customer
                  <input
                    disabled={!canEdit}
                    value={form.customer}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        customer: event.target.value
                      }))
                    }
                    placeholder="Customer name"
                  />
                </label>
              </div>

              <label>
                Issue
                <textarea
                  disabled={!canEdit}
                  value={form.issue}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      issue: event.target.value
                    }))
                  }
                  placeholder="Describe the service issue"
                />
              </label>

              <label>
                Location
                <input
                  disabled={!canEdit}
                  value={form.location}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      location: event.target.value
                    }))
                  }
                  placeholder="Service location"
                />
              </label>

              <div className="three-column-grid">
                <label>
                  Dispatch Time
                  <input
                    disabled={!canEdit}
                    type="time"
                    value={form.dispatchTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        dispatchTime: event.target.value
                      }))
                    }
                  />
                </label>

                <label>
                  Arrival Time
                  <input
                    disabled={!canEdit}
                    type="time"
                    value={form.arrivalTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        arrivalTime: event.target.value
                      }))
                    }
                  />
                </label>

                <label>
                  Finished Time
                  <input
                    disabled={!canEdit}
                    type="time"
                    value={form.finishedTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        finishedTime: event.target.value
                      }))
                    }
                  />
                </label>
              </div>

              <div className="two-column-grid">
                <div className="duration-group">
                  <label>
                    ETA To Job Hours
                    <select
                      disabled={!canEdit}
                      value={form.etaToHours}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          etaToHours: Number(event.target.value)
                        }))
                      }
                    >
                      {ETA_HOUR_OPTIONS.map((value) => (
                        <option key={value} value={value}>
                          {value} hr
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    ETA To Job Minutes
                    <select
                      disabled={!canEdit}
                      value={form.etaToMinutes}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          etaToMinutes: Number(event.target.value)
                        }))
                      }
                    >
                      {ETA_MINUTE_OPTIONS.map((value) => (
                        <option key={value} value={value}>
                          {value} min
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="duration-group">
                  <label>
                    ETA From Job Hours
                    <select
                      disabled={!canEdit}
                      value={form.etaFromHours}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          etaFromHours: Number(event.target.value)
                        }))
                      }
                    >
                      {ETA_HOUR_OPTIONS.map((value) => (
                        <option key={value} value={value}>
                          {value} hr
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    ETA From Job Minutes
                    <select
                      disabled={!canEdit}
                      value={form.etaFromMinutes}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          etaFromMinutes: Number(event.target.value)
                        }))
                      }
                    >
                      {ETA_MINUTE_OPTIONS.map((value) => (
                        <option key={value} value={value}>
                          {value} min
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <label>
                ETA From Job Destination
                <select
                  disabled={!canEdit}
                  value={form.etaFromDestination}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      etaFromDestination: event.target.value
                    }))
                  }
                >
                  {ETA_DESTINATIONS.map((destination) => (
                    <option key={destination} value={destination}>
                      {destination === "next_job" ? "Next Job" : "Home"}
                    </option>
                  ))}
                </select>
              </label>

              <button className="primary-button" type="submit" disabled={!canEdit || saving}>
                {saving ? "Saving entry..." : "Submit Entry"}
              </button>
            </form>
          </article>

          <article className="panel entries-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Centre Right</p>
                <h3>Added Entries</h3>
              </div>
              <span className="pill muted">{filteredJobs.length} in period</span>
            </div>

            {filteredJobs.length === 0 ? (
              <div className="empty-card">
                <strong>No entries for this period yet.</strong>
                <p>Once jobs are added, they will appear here with their payroll breakdown.</p>
              </div>
            ) : (
              <div className="entry-list">
                {filteredJobs.map((job) => (
                  <article className="entry-card" key={job.id}>
                    <div className="entry-card-header">
                      <div>
                        <h4>{job.customer}</h4>
                        <p>
                          {job.technicianName} - {formatDisplayDate(job.date)}
                        </p>
                      </div>
                      {canEdit ? (
                        <button
                          className="danger-button"
                          onClick={() => handleDeleteJob(job.id)}
                          disabled={working}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>

                    <div className="entry-meta-grid">
                      <span>Location: {job.location}</span>
                      <span>Dispatch: {job.dispatchTime}</span>
                      <span>Arrival: {job.arrivalTime}</span>
                      <span>Finished: {job.finishedTime}</span>
                    </div>

                    <p className="entry-issue">{job.issue}</p>

                    <div className="entry-footer">
                      <span className="hours-pill regular">
                        Regular {formatHours(job.payroll?.regularHours || 0)}h
                      </span>
                      <span className="hours-pill after">
                        After {formatHours(job.payroll?.afterHours || 0)}h
                      </span>
                      <span className="hours-pill total">
                        Total {formatHours(job.payroll?.totalHours || 0)}h
                      </span>
                    </div>

                    <small className="entry-created-by">
                      Added by {job.createdByName || job.createdByUsername || "Portal user"}
                      {job.payroll?.holidayName ? ` - Holiday: ${job.payroll.holidayName}` : ""}
                    </small>
                  </article>
                ))}
              </div>
            )}
          </article>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Bottom Summary</p>
              <h3>Technician Payroll Cards</h3>
            </div>
            <span className="pill muted">Click any card for history and exports</span>
          </div>

          <div className="summary-grid">
            {summaryCards.map((technician) => (
              <button
                key={technician.name}
                className="technician-card"
                onClick={() => {
                  setSelectedTech(technician);
                  setHistoryMonth(selectedMonth);
                  setHistoryYear(selectedYear);
                }}
              >
                <div className="technician-card-header">
                  <div>
                    <h4>{technician.name}</h4>
                    <p>{payTypeLabel(technician.payType)}</p>
                  </div>
                  <span className="pill muted">{technician.jobCount} jobs</span>
                </div>

                <div className="technician-stat regular">
                  <span>Regular</span>
                  <strong>{formatHours(technician.regularHours)}</strong>
                </div>
                <div className="technician-stat after">
                  <span>After</span>
                  <strong>{formatHours(technician.afterHours)}</strong>
                </div>
                <div className="technician-stat total">
                  <span>Total</span>
                  <strong>{formatHours(technician.totalHours)}</strong>
                </div>
              </button>
            ))}
          </div>
        </section>

        {selectedTech ? (
          <div className="modal-backdrop" onClick={() => setSelectedTech(null)}>
            <div className="modal-card modal-large" onClick={(event) => event.stopPropagation()}>
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Technician Detail</p>
                  <h3>{selectedTech.name} Job History</h3>
                </div>
                <button className="ghost-button" onClick={() => setSelectedTech(null)}>
                  Close
                </button>
              </div>

              <div className="toolbar-controls detail-toolbar">
                <select value={historyMonth} onChange={(event) => setHistoryMonth(Number(event.target.value))}>
                  {MONTH_NAMES.map((monthName, index) => (
                    <option key={monthName} value={index}>
                      {monthName}
                    </option>
                  ))}
                </select>
                <select value={historyYear} onChange={(event) => setHistoryYear(Number(event.target.value))}>
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <button
                  className="secondary-button"
                  onClick={() =>
                    downloadExcelReport({
                      technicianName: selectedTech.name,
                      jobs: historyJobs,
                      summary: historySummary,
                      month: historyMonth,
                      year: historyYear
                    })
                  }
                >
                  Export Excel
                </button>
                <button
                  className="secondary-button"
                  onClick={() =>
                    downloadPdfReport({
                      technicianName: selectedTech.name,
                      jobs: historyJobs,
                      summary: historySummary,
                      month: historyMonth,
                      year: historyYear
                    })
                  }
                >
                  Export PDF
                </button>
              </div>

              <div className="metric-grid compact">
                <article className="metric-card compact">
                  <span>Pay Type</span>
                  <strong>{payTypeLabel(selectedTech.payType)}</strong>
                </article>
                <article className="metric-card compact">
                  <span>Regular Hours</span>
                  <strong>{formatHours(historySummary?.regularHours || 0)}</strong>
                </article>
                <article className="metric-card compact">
                  <span>After Hours</span>
                  <strong>{formatHours(historySummary?.afterHours || 0)}</strong>
                </article>
                <article className="metric-card compact">
                  <span>Total Hours</span>
                  <strong>{formatHours(historySummary?.totalHours || 0)}</strong>
                </article>
              </div>

              {historyJobs.length === 0 ? (
                <div className="empty-card">
                  <strong>No jobs for that month and year.</strong>
                  <p>Select another period to review the technician&apos;s current or previous-year history.</p>
                </div>
              ) : (
                <div className="entry-list">
                  {historyJobs.map((job) => (
                    <article key={`${job.id}-${job.date}`} className="entry-card history-card">
                      <div className="entry-card-header">
                        <div>
                          <h4>{job.customer}</h4>
                          <p>{formatDisplayDate(job.date)}</p>
                        </div>
                        <span className="pill muted">{job.location}</span>
                      </div>
                      <div className="entry-meta-grid">
                        <span>Dispatch: {job.dispatchTime}</span>
                        <span>Arrival: {job.arrivalTime}</span>
                        <span>Finished: {job.finishedTime}</span>
                        <span>
                          ETA From: {job.etaFromHours || 0}h {job.etaFromMinutes || 0}m
                        </span>
                      </div>
                      <p className="entry-issue">{job.issue}</p>
                      <div className="entry-footer">
                        <span className="hours-pill regular">
                          Regular {formatHours(job.payroll?.regularHours || 0)}h
                        </span>
                        <span className="hours-pill after">
                          After {formatHours(job.payroll?.afterHours || 0)}h
                        </span>
                        <span className="hours-pill total">
                          Total {formatHours(job.payroll?.totalHours || 0)}h
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {showUserManager ? (
          <div className="modal-backdrop" onClick={() => setShowUserManager(false)}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Admin Panel</p>
                  <h3>User Access</h3>
                </div>
                <button className="ghost-button" onClick={() => setShowUserManager(false)}>
                  Close
                </button>
              </div>

              <div className="modal-section">
                <h4>Pending Requests</h4>
                {pendingUsers.length === 0 ? (
                  <div className="empty-card">
                    <strong>No pending access requests.</strong>
                    <p>New requests from the login page will appear here.</p>
                  </div>
                ) : (
                  pendingUsers.map((user) => (
                    <div key={user.id} className="admin-row">
                      <div>
                        <strong>{user.fullName}</strong>
                        <p>
                          @{user.username} - Requested {roleLabel(user.requestedRole)}
                        </p>
                      </div>
                      <div className="admin-actions">
                        <button
                          className="secondary-button"
                          onClick={() =>
                            handleUserUpdate(user.id, {
                              role: "viewer",
                              status: "approved"
                            })
                          }
                        >
                          Approve Viewer
                        </button>
                        <button
                          className="secondary-button"
                          onClick={() =>
                            handleUserUpdate(user.id, {
                              role: "editor",
                              status: "approved"
                            })
                          }
                        >
                          Approve Editor
                        </button>
                        <button
                          className="ghost-button"
                          onClick={() => handleUserUpdate(user.id, { status: "suspended" })}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="modal-section">
                <h4>Approved Team Members</h4>
                {managedUsers.map((user) => (
                  <div key={user.id} className="admin-row">
                    <div>
                      <strong>{user.fullName}</strong>
                      <p>
                        @{user.username} - {roleLabel(user.role)} - {statusLabel(user.status)}
                      </p>
                    </div>
                    {user.role === "admin" ? (
                      <span className="pill muted">Protected admin</span>
                    ) : (
                      <div className="admin-actions">
                        <button
                          className="secondary-button"
                          onClick={() =>
                            handleUserUpdate(user.id, {
                              role: "viewer",
                              status: "approved"
                            })
                          }
                        >
                          {user.status === "suspended" ? "Reinstate Viewer" : "Set Viewer"}
                        </button>
                        <button
                          className="secondary-button"
                          onClick={() =>
                            handleUserUpdate(user.id, {
                              role: "editor",
                              status: "approved"
                            })
                          }
                        >
                          {user.status === "suspended" ? "Reinstate Editor" : "Set Editor"}
                        </button>
                        <button
                          className="ghost-button"
                          onClick={() => handleUserUpdate(user.id, { status: "suspended" })}
                        >
                          Suspend
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {showTechManager ? (
          <div className="modal-backdrop" onClick={() => setShowTechManager(false)}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Admin Panel</p>
                  <h3>Technician Roster</h3>
                </div>
                <button className="ghost-button" onClick={() => setShowTechManager(false)}>
                  Close
                </button>
              </div>

              <form className="inline-form" onSubmit={handleAddTechnician}>
                <input
                  value={newTechnician.name}
                  onChange={(event) =>
                    setNewTechnician((current) => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                  placeholder="Add technician name"
                />
                <select
                  value={newTechnician.payType}
                  onChange={(event) =>
                    setNewTechnician((current) => ({
                      ...current,
                      payType: event.target.value
                    }))
                  }
                >
                  <option value="salary">Salary</option>
                  <option value="hourly">Hourly</option>
                </select>
                <button className="primary-button" type="submit" disabled={working}>
                  Add Technician
                </button>
              </form>

              <div className="modal-section">
                {technicians.map((technician) => (
                  <div key={technician._id} className="admin-row">
                    <div>
                      <strong>{technician.name}</strong>
                      <p>
                        {payTypeLabel(technician.payType)} -{" "}
                        {technician.active ? "Visible in entry form" : "Hidden from entry form"}
                      </p>
                    </div>
                    <div className="admin-actions">
                      <button
                        className="secondary-button"
                        onClick={() =>
                          handleTechnicianUpdate(technician._id, {
                            payType: "salary"
                          })
                        }
                      >
                        Set Salary
                      </button>
                      <button
                        className="secondary-button"
                        onClick={() =>
                          handleTechnicianUpdate(technician._id, {
                            payType: "hourly"
                          })
                        }
                      >
                        Set Hourly
                      </button>
                      <button
                        className="ghost-button"
                        onClick={() =>
                          handleTechnicianUpdate(technician._id, {
                            active: !technician.active
                          })
                        }
                      >
                        {technician.active ? "Hide" : "Show"}
                      </button>
                      <button
                        className="danger-button"
                        onClick={() => handleTechnicianDelete(technician._id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
