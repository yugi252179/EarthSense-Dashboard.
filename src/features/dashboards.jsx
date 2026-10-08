import React from "react";

import { Kpi, PageHeader, Pill } from "../components/ui";
import { useApp } from "../context/AppContext";
import { COMPANIES, ROLES, SLA, SEV } from "../data/constants";
import { age, fd, isLate, overall } from "../utils/engine";

export function ManagerDashboard() {
  const { user, fleet, setPage, setModal, tasks, supportTickets } = useApp();
  const [attentionTab, setAttentionTab] = React.useState("now");
  const company =
    COMPANIES.find((c) => c.id === user.companyId) || COMPANIES[0];
  const companyFleet = fleet.filter((r) => r.t.company.id === company.id);

  const companyTasks = tasks.filter((t) =>
    companyFleet.some((r) => r.t.id === t.tr),
  );

  const transformersCount = new Set(companyFleet.map((r) => r.t.id)).size;
  const critical = companyFleet.filter((r) => overall(r.l) === 2);
  const predictedCritical = companyFleet.filter((r) => overall(r.l) < 2 && (r.o === 2 || (r.dC != null && r.dC <= SEV)));
  const warning = companyFleet.filter((r) => overall(r.l) === 1 && r.o < 2 && (r.dC == null || r.dC > SEV));
  const normal = companyFleet.filter((r) => overall(r.l) === 0 && r.o < 2 && (r.dC == null || r.dC > SEV));

  const openTasks = companyTasks.filter(
    (t) => !["completed", "verified"].includes(t.status),
  );

  // Attention: Critical or heading to critical within 14 days
  const attentionPits = companyFleet
    .filter(
      (r) => critical.includes(r) || predictedCritical.includes(r)
    )
    .sort((a, b) => b.o - a.o || (a.dC ?? 999) - (b.dC ?? 999));

  const escalations = companyFleet.filter((r) => {
    if (r.o !== 2) return false;
    const t = companyTasks.find(
      (task) =>
        task.pit === r.p.id && !["completed", "verified"].includes(task.status)
    );
    if (!t) return false;
    const ageDays = (Date.now() - new Date(t.created).getTime()) / 864e5;
    return ageDays >= 3;
  });

  const tix = (supportTickets || []).filter((t) => t.status !== "Resolved");

  const activeList = attentionTab === "now" ? critical : predictedCritical;

  return (
    <>
      <PageHeader
        eyebrow="Plant officer workspace"
        title="Plant Overview"
        description={`Human-readable decision support for ${company.name}. Focus on what needs attention and why.`}
        actions={
          <button
            className="btn secondary"
            onClick={() => setModal("assistant")}
          >
            ✦ Assistant · Explain this
          </button>
        }
      />

      {attentionPits.some((r) => r.dC != null && r.dC < 14) && (
        <div className="banner s2">
          <div className="ic">⚠</div>
          <div>
            <b>Manager notification: forecast below 14 days</b>
            <p>
              {attentionPits.filter((r) => r.dC != null && r.dC < 14).length}{" "}
              earth pit(s) are predicted to reach critical within 14 days.
              Review the assigned maintenance action now.
            </p>
          </div>
        </div>
      )}

      <div className="kpis" style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
        <Kpi
          label="Critical pits"
          value={critical.length}
          color={critical.length ? "var(--r)" : undefined}
        />
        <Kpi
          label="Warning pits"
          value={warning.length}
          color={warning.length ? "var(--w)" : undefined}
        />
        <Kpi
          label="Predicted Critical"
          value={predictedCritical.length}
          color={predictedCritical.length ? "var(--r)" : undefined}
        />
        <Kpi
          label="Escalated Alarms"
          value={escalations.length}
          color={escalations.length ? "var(--r)" : "var(--g)"}
        />
        <Kpi label="Open tasks" value={openTasks.length} />
      </div>

      <div className="two">
        <div className="card">
          <span className="lbl">Needs attention</span>
          <div className="tabs" style={{ marginTop: 8, marginBottom: 12 }}>
            <button
              className={`tab ${attentionTab === "now" ? "on" : ""}`}
              onClick={() => setAttentionTab("now")}
            >
              Now Critical ({critical.length})
            </button>
            <button
              className={`tab ${attentionTab === "predicted" ? "on" : ""}`}
              onClick={() => setAttentionTab("predicted")}
            >
              Predicted Critical ({predictedCritical.length})
            </button>
          </div>

          {activeList.length ? (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Earth pit</th>
                  <th>Driver</th>
                  <th>Time to critical</th>
                  <th>Action status</th>
                </tr>
              </thead>
              <tbody>
                {activeList.slice(0, 8).map((r) => {
                  const t = companyTasks.find(
                    (task) =>
                      task.pit === r.p.id && task.status !== "completed",
                  );
                  return (
                    <tr
                      className="click"
                      key={r.p.id}
                      onClick={() => setPage("asset")}
                    >
                      <td>
                        <b>
                          {r.t.id} · {r.p.id}
                        </b>
                        <span className="sub">{r.t.area}</span>
                      </td>
                      <td>{r.drv?.n || "—"}</td>
                      <td>
                        {overall(r.l) === 2 ? (
                          <span className="late">Critical</span>
                        ) : (
                          fd(r.dC)
                        )}
                      </td>
                      <td>
                        {t ? (
                          <>
                            <span
                              className={`st ${t.status === "in_progress" ? "progress" : ""}`}
                            >
                              {t.status.replace("_", " ").toUpperCase()}
                            </span>
                            <span className="sub">
                              {t.eng} · {age(t)}d
                            </span>
                          </>
                        ) : (
                          <span className="late">No task</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="empty" style={{ padding: 30, minHeight: 0 }}>
              {attentionTab === "now" ? "No pits are currently critical." : "No pits are predicted critical within 14 days."}
            </div>
          )}
          {activeList.length > 8 && (
            <p className="meta" style={{ color: "var(--mut)", marginTop: 10 }}>
              +{activeList.length - 8} more
            </p>
          )}
        </div>

        <div className="card">
          <span className="lbl">Plant health mix</span>
          <h3>
            {companyFleet.length} earth pits across {transformersCount}{" "}
            transformers
          </h3>
          <div
            className="mix"
            style={{
              display: "flex",
              height: 12,
              borderRadius: 6,
              overflow: "hidden",
              margin: "14px 0 8px",
            }}
          >
            <i
              style={{
                width: `${(normal.length / companyFleet.length) * 100}%`,
                background: "#0f9d76",
              }}
            />
            <i
              style={{
                width: `${(warning.length / companyFleet.length) * 100}%`,
                background: "#c98a0b",
              }}
            />
            <i
              style={{
                width: `${(critical.length / companyFleet.length) * 100}%`,
                background: "#d64545",
              }}
            />
          </div>

          <div
            className="lg"
            style={{
              display: "flex",
              gap: 14,
              fontSize: 12,
              color: "var(--mut)",
              marginBottom: 20,
            }}
          >
            <span>
              Normal <b>{normal.length}</b>
            </span>
            <span>
              Warning <b>{warning.length}</b>
            </span>
            <span>
              Critical <b>{critical.length}</b>
            </span>
          </div>

          <div className="row" style={{ marginTop: 14 }}>
            <div>
              <b>Escalated alarms</b>
              <small>Critical with no action or overdue task</small>
            </div>
            <button
              className="btn secondary sm"
              onClick={() => setPage("alarms")}
            >
              {escalations.length} view
            </button>
          </div>
          <div className="row">
            <div>
              <b>Task Tracker</b>
              <small>Who is assigned, how long it has been</small>
            </div>
            <button
              className="btn secondary sm"
              onClick={() => setPage("tracker")}
            >
              Open
            </button>
          </div>
          <div className="row">
            <div>
              <b>Support tickets</b>
              <small>{tix.length} unresolved</small>
            </div>
            <button
              className="btn secondary sm"
              onClick={() => setPage("support")}
            >
              Open
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export function SafetyDashboard() {
  const { user, fleet, setPage, tasks } = useApp();

  const company =
    COMPANIES.find((c) => c.id === user.companyId) || COMPANIES[0];
  const companyFleet = fleet;

  const companyTasks = tasks.filter((t) =>
    companyFleet.some((r) => r.t.id === t.tr),
  );
  const openTasks = companyTasks.filter(
    (t) => !["verified", "completed"].includes(t.status),
  );
  const pendingVerify = companyTasks.filter(
    (t) => t.status === "pending_verification",
  );
  const isResolved = (r) =>
    companyTasks.some(
      (t) => t.pit === r.p.id && ["completed", "verified"].includes(t.status),
    );

  const critical = companyFleet.filter((r) => r.o === 2 && !isResolved(r));
  const warning = companyFleet.filter((r) => r.o === 1 && !isResolved(r));
  const normal = companyFleet.filter((r) => r.o === 0 || isResolved(r));

  const warningWatch = companyFleet.filter((row) => {
    if (isResolved(row)) return false;
    if (row.o === 0 && row.pw === 0) return false;
    const activeTask = companyTasks.find(
      (t) =>
        t.pit === row.p.id &&
        ["assigned", "in_progress", "pending_verification", "rework"].includes(t.status),
    );
    return !activeTask || isLate(activeTask);
  });

  const urgentConditions = companyFleet
    .filter(
      (row) =>
        !isResolved(row) && (row.o === 2 || (row.dC != null && row.dC < 20)),
    )
    .sort((a, b) => b.o - a.o || (a.dC ?? 999) - (b.dC ?? 999));

  return (
    <>
      <PageHeader
        eyebrow={`${ROLES[user.role]} workspace`}
        title="Safety Overview"
        description={`Welcome, ${user.name}. Track predictive alarms and manage maintenance task distribution.`}
      />

      {pendingVerify.length > 0 && (
        <div className="banner s1 click" onClick={() => setPage("verify")}>
          <div className="ic">✓</div>
          <div>
            <b>Verification required</b>
            <p>
              {pendingVerify.length} task(s) completed by maintenance engineers
              are awaiting your 12-hr check and verification.
            </p>
          </div>
        </div>
      )}

      {warningWatch.length > 0 && (
        <div className="banner s2 click" onClick={() => setPage("tasks")}>
          <div className="ic">⚠</div>
          <div>
            <b>Warning watch</b>
            <p>
              {warningWatch.length} pits in warning/critical state have no
              active or on-time task. Please assign tasks.
            </p>
          </div>
        </div>
      )}

      <div className="kpis">
        <div
          className="card kpi h click s0"
          onClick={() => setPage("alarms")}
        >
          <span className="lbl">Plant Status</span>
          <div className="v">Normal</div>
          <Pill state={0} />
          <div className="bar s0">
            <i style={{ width: "100%" }} />
          </div>
        </div>
        <Kpi
          label="Active Alarms"
          value={critical.length + warning.length}
          color={critical.length + warning.length ? "var(--r)" : undefined}
        />
        <Kpi
          label="Warning Watch"
          value={warningWatch.length}
          color={warningWatch.length ? "var(--w)" : undefined}
        />
        <Kpi label="Open Tasks" value={openTasks.length} />
        <Kpi
          label="Pending Verify"
          value={pendingVerify.length}
          color={pendingVerify.length ? "var(--g)" : undefined}
        />
      </div>

      <div className="two">
        <div className="card click" onClick={() => setPage("alarms")}>
          <div className="sh">
            <div>
              <span className="lbl">Predictive alarms</span>
              <h3>Most urgent conditions</h3>
            </div>
            <button
              className="btn secondary sm"
              onClick={(e) => {
                e.stopPropagation();
                setPage("alarms");
              }}
            >
              View all
            </button>
          </div>
          {urgentConditions.slice(0, 5).map((row) => (
            <div className="row" key={row.p.id}>
              <div>
                <b>
                  {row.t.id} · {row.p.id}
                </b>
                <small>{row.drv?.n}</small>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className={row.o === 2 ? "late" : ""}>
                  {row.dC === 0 ? "Critical" : fd(row.dC)}
                </span>
                <small>Engineer: {row.t.eng.name}</small>
              </div>
            </div>
          ))}
          {!urgentConditions.length && (
            <div className="empty" style={{ padding: 30, minHeight: 0 }}>
              No urgent alarms (&lt; 20 days).
            </div>
          )}
        </div>

        <div className="card click" onClick={() => setPage("tasks")}>
          <div className="sh">
            <div>
              <span className="lbl">Recent tasks</span>
              <h3>Task register</h3>
            </div>
            <button
              className="btn secondary sm"
              onClick={(e) => {
                e.stopPropagation();
                setPage("tasks");
              }}
            >
              Manage tasks
            </button>
          </div>
          {companyTasks.slice(0, 5).map((t) => (
            <div className="row" key={t.id}>
              <div>
                <b>{t.title}</b>
                <small>
                  {t.tr} · {t.pit}
                </small>
              </div>
              <div style={{ textAlign: "right" }}>
                <b>{t.status.replace("_", " ").toUpperCase()}</b>
                <small>{t.eng}</small>
              </div>
            </div>
          ))}
          {!companyTasks.length && (
            <div className="empty" style={{ padding: 30, minHeight: 0 }}>
              No tasks assigned yet.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function MaintenanceDashboard() {
  const { user, fleet, setPage, tasks } = useApp();

  const mine = fleet.filter((r) => r.t.eng?.id === user.id);
  const critical = mine.filter((r) => overall(r.l) === 2);
  const warning = mine.filter((r) => overall(r.l) === 1);

  const myTasks = tasks.filter((t) => t.engId === user.id);
  const reworkTasks = myTasks.filter((t) => t.status === "rework");
  const activeTasks = myTasks.filter((t) =>
    ["assigned", "in_progress"].includes(t.status),
  );
  const pendingVerify = myTasks.filter(
    (t) => t.status === "pending_verification",
  );

  const isResolved = (r) =>
    tasks.some(
      (t) => t.pit === r.p.id && ["completed", "verified"].includes(t.status),
    );

  const urgentConditions = [...critical, ...warning].filter(
    (row) =>
      !isResolved(row) && (row.o === 2 || (row.dC != null && row.dC < 20)),
  );

  return (
    <>
      <PageHeader
        eyebrow={`${ROLES[user.role]} workspace`}
        title="My Overview"
        description={`Welcome back, ${user.name}. You are monitoring ${mine.length} earth pits in the ${user.sector} sector.`}
      />

      {reworkTasks.length > 0 && (
        <div className="banner s2 click" onClick={() => setPage("workorders")}>
          <div className="ic">↩</div>
          <div>
            <b>Rework requested</b>
            <p>
              Safety Officer has requested rework on {reworkTasks.length}{" "}
              task(s). Please review the notes.
            </p>
          </div>
        </div>
      )}

      {activeTasks.length > 0 && (
        <div className="banner s1 click" onClick={() => setPage("workorders")}>
          <div className="ic">!</div>
          <div>
            <b>Work orders to action</b>
            <p>
              You have {activeTasks.length} active task(s) assigned. Complete
              the work and mark as done.
            </p>
          </div>
        </div>
      )}

      <div className="kpis">
        <div
          className={`card kpi h click s${critical.length ? 2 : warning.length ? 1 : 0}`}
          onClick={() => setPage("alarms")}
        >
          <span className="lbl">Sector Status</span>
          <div className="v">
            {critical.length
              ? "Critical"
              : warning.length
                ? "Warning"
                : "Normal"}
          </div>
          <Pill state={critical.length ? 2 : warning.length ? 1 : 0} />
          <div
            className={`bar s${critical.length ? 2 : warning.length ? 1 : 0}`}
          >
            <i style={{ width: "100%" }} />
          </div>
        </div>
        <Kpi
          label="My Alarms"
          value={critical.length + warning.length}
          color={critical.length + warning.length ? "var(--r)" : undefined}
        />
        <Kpi label="Active Work Orders" value={activeTasks.length} />
        <Kpi
          label="Rework"
          value={reworkTasks.length}
          color={reworkTasks.length ? "var(--r)" : undefined}
        />
        <Kpi label="Awaiting Verify" value={pendingVerify.length} />
      </div>

      <div className="two">
        <div className="card click" onClick={() => setPage("alarms")}>
          <div className="sh">
            <div>
              <span className="lbl">My alarms</span>
              <h3>Urgent conditions in my sector</h3>
            </div>
            <button
              className="btn secondary sm"
              onClick={(e) => {
                e.stopPropagation();
                setPage("alarms");
              }}
            >
              View all
            </button>
          </div>
          {urgentConditions.slice(0, 5).map((row) => {
            const t = tasks.find(
              (task) =>
                task.pit === row.p.id &&
                !["completed", "verified"].includes(task.status),
            );
            return (
              <div className="row" key={row.p.id}>
                <div>
                  <b>
                    {row.t.id} · {row.p.id}
                  </b>
                  <small>{row.drv?.n}</small>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className={row.o === 2 ? "late" : ""}>
                    {row.dC === 0 ? "Critical" : fd(row.dC)}
                  </span>
                  <small>
                    {t ? (
                      <span style={{ fontWeight: 800 }}>
                        {t.status.replace("_", " ").toUpperCase()}
                      </span>
                    ) : (
                      <span className="late" style={{ fontWeight: 800 }}>
                        NO TASK
                      </span>
                    )}
                  </small>
                </div>
              </div>
            );
          })}
          {!urgentConditions.length && (
            <div className="empty" style={{ padding: 30, minHeight: 0 }}>
              No urgent alarms in your sector (&lt; 20 days).
            </div>
          )}
        </div>

        <div className="card click" onClick={() => setPage("workorders")}>
          <div className="sh">
            <div>
              <span className="lbl">Work orders</span>
              <h3>My current tasks</h3>
            </div>
            <button
              className="btn secondary sm"
              onClick={(e) => {
                e.stopPropagation();
                setPage("workorders");
              }}
            >
              My Work Orders
            </button>
          </div>
          {[...reworkTasks, ...activeTasks].slice(0, 5).map((t) => (
            <div className="row" key={t.id}>
              <div>
                <b>{t.title}</b>
                <small>
                  {t.tr} · {t.pit}
                </small>
              </div>
              <div style={{ textAlign: "right" }}>
                <b className={t.status === "rework" ? "late" : ""}>
                  {t.status.replace("_", " ").toUpperCase()}
                </b>
                <small>Due {t.due}</small>
              </div>
            </div>
          ))}
          {!reworkTasks.length && !activeTasks.length && (
            <div className="empty" style={{ padding: 30, minHeight: 0 }}>
              No active tasks assigned to you.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function AdminDashboard() {
  const { user, fleet, setPage } = useApp();

  const companies = COMPANIES.length;
  const totalFleet = fleet.length;
  const critical = fleet.filter((r) => r.o === 2);
  const devices = totalFleet; // 1 device per pit

  return (
    <>
      <PageHeader
        eyebrow={`${ROLES[user.role]} workspace`}
        title="Global Administration"
        description={`Welcome, ${user.name}. You are overseeing the entire EarthSense platform.`}
      />

      <div className="kpis">
        <Kpi label="Active Companies" value={companies} />
        <Kpi label="Monitored Pits" value={totalFleet} />
        <Kpi label="Device Nodes" value={devices} />
        <Kpi
          label="Global Critical"
          value={critical.length}
          color={critical.length ? "var(--r)" : undefined}
        />
      </div>

      <div className="two">
        <div className="card click" onClick={() => setPage("company")}>
          <div className="sh">
            <div>
              <span className="lbl">Tenants</span>
              <h3>Company overview</h3>
            </div>
          </div>
          {COMPANIES.map((c) => (
            <div className="row" key={c.id}>
              <div>
                <b>{c.name}</b>
                <small>{c.industry}</small>
              </div>
              <div>{c.plants} plants</div>
            </div>
          ))}
        </div>

      </div>
    </>
  );
}
