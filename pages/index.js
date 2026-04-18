import Head from "next/head";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

const emptyLogin = {
  username: "",
  password: ""
};

const emptyRequest = {
  fullName: "",
  username: "",
  password: "",
  requestedRole: "viewer"
};

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState("signin");
  const [setupRequired, setSetupRequired] = useState(false);
  const [loginForm, setLoginForm] = useState(emptyLogin);
  const [requestForm, setRequestForm] = useState(emptyRequest);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    loadSession();
  }, []);

  async function loadSession() {
    try {
      const token =
        typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
      const response = await fetch("/api/session", {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await response.json();

      if (data.user) {
        router.replace("/dashboard");
        return;
      }

      if (token) {
        window.localStorage.removeItem("token");
      }

      setSetupRequired(Boolean(data.setupRequired));
      setMode(data.setupRequired ? "setup" : "signin");
    } catch (error) {
      setNotice({
        type: "error",
        message:
          "The portal could not connect yet. Check MongoDB and your environment variables, then refresh."
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn(event) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to sign in.");
      }

      window.localStorage.setItem("token", data.token);
      router.replace("/dashboard");
    } catch (error) {
      setNotice({
        type: "error",
        message: error.message
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestAccess(event) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...requestForm,
          ...(setupRequired ? { setupInitialAdmin: true } : {})
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to submit your access request.");
      }

      if (data.token) {
        window.localStorage.setItem("token", data.token);
        router.replace("/dashboard");
        return;
      }

      setNotice({
        type: "success",
        message:
          data.message ||
          "Request submitted. An admin can now approve your account."
      });
      setRequestForm(emptyRequest);
      setMode("signin");
    } catch (error) {
      setNotice({
        type: "error",
        message: error.message
      });
    } finally {
      setSubmitting(false);
    }
  }

  const cardTitle = setupRequired ? "Create the first admin account" : "Operational payroll portal";

  return (
    <>
      <Head>
        <title>M&apos;s Fleet Service | Portal Login</title>
      </Head>

      <div className="auth-shell">
        <div className="auth-grid">
          <section className="auth-hero">
            <div className="hero-badge">M&apos;s Fleet Service</div>
            <h1>Payroll visibility, technician activity, and approvals in one polished workspace.</h1>
            <p>
              Review daily field jobs, calculate regular and after-hours totals,
              manage who can edit the portal, and hand senior leadership a clean operational view.
            </p>

            <div className="hero-points">
              <div className="hero-point">
                <span className="point-number">01</span>
                <div>
                  <strong>Role-based access</strong>
                  <p>Admins approve users, editors submit and delete entries, viewers stay read-only.</p>
                </div>
              </div>
              <div className="hero-point">
                <span className="point-number">02</span>
                <div>
                  <strong>Built for payroll review</strong>
                  <p>Sunday, holiday, single-job, and after-hours rules are calculated in the dashboard.</p>
                </div>
              </div>
              <div className="hero-point">
                <span className="point-number">03</span>
                <div>
                  <strong>Shareable reports</strong>
                  <p>Technician history can be filtered by month and year, then exported to Excel or PDF.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="auth-card">
            <div className="auth-card-header">
              <p className="eyebrow">Operations Management</p>
              <h2>{cardTitle}</h2>
              <p>
                {setupRequired
                  ? "This runs once after deployment so the portal has its first approved admin."
                  : "Sign in to continue, or request access if you still need approval."}
              </p>
            </div>

            {notice ? (
              <div className={`notice ${notice.type}`}>{notice.message}</div>
            ) : null}

            {loading ? (
              <div className="loading-state">Loading portal access...</div>
            ) : (
              <>
                {!setupRequired ? (
                  <div className="segmented-control">
                    <button
                      type="button"
                      className={mode === "signin" ? "active" : ""}
                      onClick={() => setMode("signin")}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      className={mode === "request" ? "active" : ""}
                      onClick={() => setMode("request")}
                    >
                      Request Access
                    </button>
                  </div>
                ) : null}

                {mode === "signin" ? (
                  <form className="auth-form" onSubmit={handleSignIn}>
                    <label>
                      Username
                      <input
                        value={loginForm.username}
                        onChange={(event) =>
                          setLoginForm((current) => ({
                            ...current,
                            username: event.target.value
                          }))
                        }
                        placeholder="fleet.admin"
                        autoComplete="username"
                      />
                    </label>

                    <label>
                      Password
                      <input
                        type="password"
                        value={loginForm.password}
                        onChange={(event) =>
                          setLoginForm((current) => ({
                            ...current,
                            password: event.target.value
                          }))
                        }
                        placeholder="Enter your password"
                        autoComplete="current-password"
                      />
                    </label>

                    <button className="primary-button" type="submit" disabled={submitting}>
                      {submitting ? "Signing in..." : "Open Portal"}
                    </button>
                  </form>
                ) : (
                  <form className="auth-form" onSubmit={handleRequestAccess}>
                    <label>
                      Full Name
                      <input
                        value={requestForm.fullName}
                        onChange={(event) =>
                          setRequestForm((current) => ({
                            ...current,
                            fullName: event.target.value
                          }))
                        }
                        placeholder="Operations coordinator"
                        autoComplete="name"
                      />
                    </label>

                    <label>
                      Username
                      <input
                        value={requestForm.username}
                        onChange={(event) =>
                          setRequestForm((current) => ({
                            ...current,
                            username: event.target.value
                          }))
                        }
                        placeholder="first.last"
                        autoComplete="username"
                      />
                    </label>

                    <label>
                      Password
                      <input
                        type="password"
                        value={requestForm.password}
                        onChange={(event) =>
                          setRequestForm((current) => ({
                            ...current,
                            password: event.target.value
                          }))
                        }
                        placeholder="Create a secure password"
                        autoComplete="new-password"
                      />
                    </label>

                    {!setupRequired ? (
                      <label>
                        Requested Access
                        <select
                          value={requestForm.requestedRole}
                          onChange={(event) =>
                            setRequestForm((current) => ({
                              ...current,
                              requestedRole: event.target.value
                            }))
                          }
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                        </select>
                      </label>
                    ) : null}

                    <button className="primary-button" type="submit" disabled={submitting}>
                      {submitting
                        ? setupRequired
                          ? "Creating admin..."
                          : "Sending request..."
                        : setupRequired
                        ? "Create Admin & Continue"
                        : "Send Access Request"}
                    </button>
                  </form>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
