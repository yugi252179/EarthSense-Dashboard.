import React, { useMemo, useState } from "react";

import TrendChart from "../components/TrendChart";
import { useApp } from "../context/AppContext";
import {
  COMPANIES,
  ENGS,
  PARAMS,
  ROLES,
  SEV,
  SEV_AUTO,
  SLA,
  STATES,
  USERS,
} from "../data/constants";
import {
  age,
  anomalyScore,
  eta,
  fd,
  forecastNarrative,
  format,
  health,
  healthReason,
  isLate,
  minBy,
  overall,
  overallForecastNarrative,
  state,
  summary,
} from "../utils/engine";
import { Empty, Kpi, PageHeader, ParameterCards, Pill } from "../components/ui";

/* ─── Shared helpers ──────────────────────────────────────────────── */

function SelectedHeader() {
  const { TRS, tr, pit, selected } = useApp();
  const transformer = TRS.find((item) => item.id === tr);
  const earthPit = transformer?.pits.find((item) => item.id === pit);
  if (!transformer || !earthPit) return null;
  return (
    <PageHeader
      eyebrow={`Selected earth pit · ${selected?.demo ? "Predicted data" : "Live data"}`}
      title={`${transformer.id} · ${earthPit.id}`}
      description={`${transformer.area} · ${transformer.sector} · ${transformer.company.name}${selected?.live ? ` · Updated ${new Date(selected.live.timestamp).toLocaleString()}` : ""}`}
    />
  );
}

const taskStatusLabel = {
  assigned: "PENDING",
  in_progress: "IN PROGRESS",
  pending_verification: "AWAITING VERIFY",
  verified: "VERIFIED",
  rework: "REWORK",
};
const taskStatusClass = {
  assigned: "",
  in_progress: "progress",
  pending_verification: "pending-verify",
  verified: "completed",
  rework: "rework-st",
};

function TaskStatusBadge({ status }) {
  return (
    <span className={`st ${taskStatusClass[status] || ""}`}>
      {taskStatusLabel[status] || status?.toUpperCase()}
    </span>
  );
}

function hoursSince(isoString) {
  if (!isoString) return 0;
  return (Date.now() - new Date(isoString).getTime()) / 3600000;
}

/* ─── EARTH PIT DASHBOARD ────────────────────────────────────────── */

export function EarthPitPage() {
  const { selected, tr, pit, cfg } = useApp();
  const STEP_DAYS = cfg?.STEP_DAYS || 1;

  if (!tr) {
    return (
      <Empty
        title="Select a transformer"
        message="Choose one of the 30 transformers above, then pick an earth pit to see its data."
      />
    );
  }
  if (!pit) {
    return (
      <Empty
        title="Now select an earth pit"
        message="Choose an earth pit to load its readings and forecast."
      />
    );
  }
  if (!selected?.live) {
    return (
      <Empty
        title="Waiting for live data"
        message="The live feed has not returned a reading yet. TR-001 / EP-01 is the live API pair; other assets use the local model."
      />
    );
  }

  const reading = selected.live;
  const pitHealth = health(reading);
  const overallState = overall(reading);
  const sums = PARAMS.map((p) => summary(p, selected, STEP_DAYS));
  const predictedWorst = Math.max(
    overallState,
    ...sums.map((s) => s?.worst ?? 0),
  );
  const anomaly = anomalyScore(selected);
  const hreason = healthReason(selected);
  const overallNarr = overallForecastNarrative(sums, selected);
  const etaResults = PARAMS.map((p) => ({ p, ...eta(p, selected, STEP_DAYS) }));
  const minDC = minBy(etaResults, "dC");
  const minDW = minBy(
    etaResults.map((e) => ({ ...e, dW: overallState >= 1 ? 0 : e.dW })),
    "dW",
  );

  return (
    <>
      <SelectedHeader />

      {/* AI Assistant Summary */}
      <div
        className="card"
        style={{
          background: "linear-gradient(135deg, #121c25 0%, #0d1217 100%)",
          border: "1px solid rgba(15, 157, 118, 0.3)",
          padding: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <span style={{ color: "#0f9d76", fontSize: 18 }}>✦</span>
          <b style={{ color: "#eef2f2", fontSize: 16 }}>
            Executive Pit Summary
          </b>
        </div>
        <p
          style={{
            color: "var(--mut)",
            fontSize: 14,
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {predictedWorst === 0
            ? `This pit is currently in excellent condition with a health score of ${pitHealth}/100 and no immediate anomalies detected. All 5 safety parameters are well within operational limits, and our models predict it will remain stable for the foreseeable future. No maintenance action is required.`
            : predictedWorst === 1
              ? `This pit is experiencing early degradation. While the current health is ${pitHealth}/100, ${overallState === 1 ? `the ${minDW?.p?.n || "system"} is currently in an active Warning state` : `the predictive models indicate ${minDW?.p?.n || "a parameter"} will breach the early-warning threshold in approximately ${fd(minDW?.dW)}`}. We recommend planning proactive maintenance to prevent further drift.`
              : `Critical attention required. This pit is showing severe degradation with a health score of ${pitHealth}/100. ${minDC?.p?.n ? `The ${minDC.p.n} parameter is driving this risk.` : ""} ${anomaly > 0.4 ? "A high anomaly score indicates erratic readings." : ""} An automated task has been assigned for immediate corrective action to restore safety compliance.`}
        </p>
      </div>

      {/* KPI row */}
      <div className="kpis">
        <div className={`card kpi h s${overallState}`}>
          <span className="lbl">Earth-pit health</span>
          <div className="v">
            {pitHealth}
            <small>/100</small>
          </div>
          <Pill state={overallState} />
          <div className={`bar s${overallState}`}>
            <i style={{ width: `${pitHealth}%` }} />
          </div>
        </div>

        {PARAMS.map((parameter) => (
          <div className="card kpi" key={parameter.k}>
            <span className="lbl">{parameter.n}</span>
            <div className="v">
              {format(reading[parameter.k])}
              <small>{parameter.u}</small>
            </div>
            <Pill state={state(parameter, reading[parameter.k])} />
          </div>
        ))}
      </div>

      {/* Time-to-Unsafe + Anomaly */}
      <div className="unsafe card">
        <div className="ut">
          <span className="lbl">Whole earth pit · how long it stays safe</span>
          <h3>Time to unsafe condition</h3>
          <p>
            EarthSense combines all five parameters and ML forecast to highlight
            the earliest threshold risk.
          </p>
        </div>
        <div
          className="ub"
          style={{ "--c": overallState >= 1 ? "var(--w)" : "var(--g)" }}
        >
          <span>Pit reaches WARNING in</span>
          <b>{overallState >= 1 ? "Reached" : fd(minDW?.dW ?? null)}</b>
        </div>
        <div
          className="ub"
          style={{ "--c": overallState === 2 ? "var(--r)" : "var(--g)" }}
        >
          <span>Pit reaches CRITICAL in</span>
          <b>{overallState === 2 ? "Reached" : fd(minDC?.dC ?? null)}</b>
        </div>
        <div
          className="ub"
          style={{
            "--c":
              anomaly > 0.4
                ? "var(--r)"
                : anomaly > 0.15
                  ? "var(--w)"
                  : "var(--g)",
          }}
        >
          <span>Anomaly detection score</span>
          <b>
            {Math.round(anomaly * 100)}
            <small style={{ fontSize: 14 }}>/100</small>
          </b>
          <small>
            {anomaly > 0.4
              ? "High anomaly"
              : anomaly > 0.15
                ? "Moderate"
                : "Within normal"}
          </small>
        </div>
      </div>

      {/* Banner */}
      <div className={`banner s${predictedWorst}`}>
        <div className="ic">{predictedWorst ? "⚠" : "✓"}</div>
        <div>
          <b>Predicted outlook: {STATES[predictedWorst].toUpperCase()}</b>
          <p>
            {predictedWorst === 2
              ? "Existing critical condition requires priority attention."
              : predictedWorst === 1
                ? "Early warning condition; maintenance should be planned before the limit is reached."
                : "All five parameters are currently within normal operating limits."}
          </p>
        </div>
      </div>

      {/* Health reasoning + Overall narrative */}
      <div className="two" style={{ marginBottom: 14 }}>
        <div className="card">
          <span className="lbl">Explain the numbers</span>
          <h3>Health & anomaly reasoning</h3>
          <div className="row">
            <b>Earth-pit health</b>
            <span className="mono">{pitHealth}/100</span>
          </div>
          <div className="row">
            <b>Anomaly detection score</b>
            <span className="mono">{Math.round(anomaly * 100)}/100</span>
          </div>
          <div className="forecast-narrative" style={{ marginTop: 10 }}>
            {hreason}
          </div>
        </div>

        <div className="card">
          <span className="lbl">Overall forecast explanation</span>
          <h3>What the forecast is telling you</h3>
          <div className="forecast-narrative">{overallNarr}</div>
          <div style={{ marginTop: 12 }}>
            {sums.map((s, i) => {
              if (!s) return null;
              const p = PARAMS[i];
              return (
                <div className="row" key={p.k}>
                  <div>
                    <b>{p.n}</b>
                    <small>
                      {STATES[s.worst].toUpperCase()} · {s.direction}
                    </small>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--mut)" }}>
                    {s.dC != null
                      ? `Critical in ${fd(s.dC)}`
                      : s.dW != null
                        ? `Warning in ${fd(s.dW)}`
                        : "No crossing expected"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pgrid">
        {PARAMS.map((parameter, idx) => {
          const s = sums[idx];
          const cs = state(parameter, reading[parameter.k]);
          const ws = s?.worst ?? cs;
          const paramEta = etaResults[idx];

          return (
            <article className="card" key={parameter.k}>
              <div className="ph">
                <div>
                  <span className="lbl">{parameter.n}</span>
                  <div className="val">
                    {format(reading[parameter.k])}
                    <small>{parameter.u}</small>
                  </div>
                </div>
                <div className="tags">
                  <span className={`pill s${cs}`}>
                    <em>NOW</em>
                    {STATES[cs].toUpperCase()}
                  </span>
                  <span className={`pill s${ws}`}>
                    <em>FORECAST</em>
                    {STATES[ws].toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="chartbox">
                <TrendChart
                  index={idx}
                  parameter={parameter}
                  history={selected.history || selected.hist || []}
                  forecast={selected.fc || []}
                  color={["#0f9d76", "#c98a0b", "#d64545"][ws]}
                  stepDays={STEP_DAYS}
                />
              </div>

              <div className={`leg s${ws}`}>
                <span>
                  <i></i>Measured (history + live)
                </span>
                <span>
                  <i className="f"></i>ML forecast (days ahead)
                </span>
              </div>

              <div className={`sum s${ws}`}>
                <b>Predictive summary</b>
                <p>
                  {s
                    ? forecastNarrative(parameter, selected, STEP_DAYS)
                    : "Forecast not available yet."}
                </p>
                {s && (
                  <>
                    <div className="eta">
                      <span>
                        Time to WARNING: <b>{fd(paramEta.dW)}</b>
                      </span>
                      <span>
                        Time to CRITICAL: <b>{fd(paramEta.dC)}</b>
                      </span>
                      <span>
                        Change:{" "}
                        <b>
                          {s.direction} {s.change} {parameter.u}
                        </b>
                      </span>
                    </div>
                    <p className="rec">
                      <b>Threshold range:</b>{" "}
                      {parameter.dir === "high" ? "Warning ≥" : "Warning ≤"}{" "}
                      {parameter.w} ·{" "}
                      {parameter.dir === "high" ? "Critical ≥" : "Critical ≤"}{" "}
                      {parameter.c} {parameter.u}
                      <br />
                      <b>Why:</b> {s.why}
                      <br />
                      <b>Action:</b> {s.action}
                    </p>
                  </>
                )}
              </div>

              <span className="thr">
                Warning {parameter.dir === "high" ? "≥" : "≤"} {parameter.w} ·
                Critical {parameter.dir === "high" ? "≥" : "≤"} {parameter.c}{" "}
                {parameter.u}
              </span>
            </article>
          );
        })}
      </div>
    </>
  );
}

/* ─── FLEET PAGE ─────────────────────────────────────────────────── */

export function FleetPage() {
  const { fleet, TRS, open, toggleOpen, openPit } = useApp();

  return (
    <>
      <PageHeader
        eyebrow="Plant officer workspace"
        title="Assets & Earth Pits"
        description={`Combined asset search + fleet explorer · ${TRS.length} transformers · 480 earth pits. Expand a transformer to see its pits; open a pit for the full dashboard.`}
        actions={<button className="btn secondary">Export CSV</button>}
      />

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Transformer</th>
              <th>Area</th>
              <th>Maintenance engineer</th>
              <th>Pits</th>
              <th>Health</th>
              <th>Worst state</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {TRS.map((transformer) => {
              const rows = fleet.filter((item) => item.t.id === transformer.id);
              const worst = Math.max(...rows.map((item) => item.o));
              const averageHealth = Math.round(
                rows.reduce((sum, item) => sum + item.h, 0) / rows.length,
              );
              const expanded = open.has(transformer.id);

              return (
                <React.Fragment key={transformer.id}>
                  <tr
                    className="click"
                    onClick={() => toggleOpen(transformer.id)}
                  >
                    <td>
                      <b>
                        {expanded ? "▾" : "▸"} {transformer.id}
                      </b>
                    </td>
                    <td>{transformer.area}</td>
                    <td>
                      {transformer.eng.name}
                      <span className="sub">{transformer.eng.id}</span>
                    </td>
                    <td>{transformer.pits.length}</td>
                    <td className="mono">{averageHealth}/100</td>
                    <td>
                      <Pill state={worst} />
                    </td>
                    <td />
                  </tr>

                  {expanded &&
                    rows.map((row) => (
                      <tr
                        className="exp click"
                        key={row.p.id}
                        onClick={() => openPit(transformer.id, row.p.id)}
                      >
                        <td className="mono">&nbsp;&nbsp;&nbsp;{row.p.id}</td>
                        <td>{row.drv?.n || "—"}</td>
                        <td>{row.dC == null ? "—" : fd(row.dC)}</td>
                        <td className="mono">{row.h}/100</td>
                        <td>
                          <Pill state={row.o} />
                        </td>
                        <td>
                          <button
                            className="btn secondary sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPit(transformer.id, row.p.id);
                            }}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ─── SEARCH PAGE ────────────────────────────────────────────────── */

export function SearchPage() {
  const { fleet, openPit } = useApp();
  const [query, setQuery] = useState("");
  const rows = fleet
    .filter((row) =>
      `${row.t.id}${row.p.id}${row.t.area}${row.t.eng.name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .slice(0, 40);

  return (
    <>
      <PageHeader
        eyebrow="Plant officer workspace"
        title="Asset Search"
        description="Find any transformer or earth pit by ID, area or engineer."
      />
      <input
        className="srch"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search e.g. TR-012, EP-45, Boiler House…"
      />
      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Earth pit</th>
              <th>Transformer</th>
              <th>Engineer</th>
              <th>Health</th>
              <th>State</th>
              <th>Time to critical</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.p.id}
                className="click"
                onClick={() => openPit(row.t.id, row.p.id)}
              >
                <td>
                  <b>{row.p.id}</b>
                </td>
                <td>
                  {row.t.id}
                  <span className="sub">{row.t.area}</span>
                </td>
                <td>
                  {row.t.eng.name}
                  <span className="sub">{row.t.eng.id}</span>
                </td>
                <td className="mono">{row.h}/100</td>
                <td>
                  <Pill state={row.o} />
                </td>
                <td>{row.dC === 0 ? "Critical" : fd(row.dC)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan="6">No assets match.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ─── ALARMS PAGE ────────────────────────────────────────────────── */

export function AlarmsPage() {
  const {
    fleet,
    role,
    openPit,
    alarmFilter,
    setAlarmFilter,
    ack,
    acknowledge,
    setPage,
    selectTransformer,
    selectPit,
    tasks,
  } = useApp();

  let rows = fleet.filter((row) => row.o > 0 || row.dev);
  if (alarmFilter === "2") rows = rows.filter((row) => row.o === 2);
  if (alarmFilter === "1") rows = rows.filter((row) => row.o === 1);
  if (alarmFilter === "dev") rows = rows.filter((row) => row.dev);
  if (alarmFilter === "escalated") {
    rows = rows.filter((row) => {
      if (row.o !== 2) return false;
      const activeTask = tasks?.find(
        (t) =>
          t.pit === row.p.id &&
          !["completed", "verified"].includes(t.status)
      );
      if (!activeTask) return false;
      const ageDays = (Date.now() - new Date(activeTask.created).getTime()) / 864e5;
      return ageDays >= 3;
    });
  }

  return (
    <>
      <PageHeader
        eyebrow={`${ROLES[role]} workspace`}
        title={role === "manager" ? "Escalated alarms" : "Alarms"}
        description={
          role === "safety"
            ? "Active and predicted alarms. Assign tasks to maintenance engineers."
            : "Alarms and device faults."
        }
      />

      <div className="chips">
        <button
          className={alarmFilter === "all" ? "on" : ""}
          onClick={() => setAlarmFilter("all")}
        >
          All ({fleet.filter((row) => row.o > 0 || row.dev).length})
        </button>
        <button
          className={alarmFilter === "2" ? "on" : ""}
          onClick={() => setAlarmFilter("2")}
        >
          Critical
        </button>
        <button
          className={alarmFilter === "1" ? "on" : ""}
          onClick={() => setAlarmFilter("1")}
        >
          Warning
        </button>
        {role === "manager" && (
          <button
            className={alarmFilter === "escalated" ? "on" : ""}
            onClick={() => setAlarmFilter("escalated")}
          >
            Escalated (3+ days)
          </button>
        )}
        {role === "maintenance" && (
          <button
            className={alarmFilter === "dev" ? "on" : ""}
            onClick={() => setAlarmFilter("dev")}
          >
            Device faults
          </button>
        )}
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Severity</th>
              <th>Type</th>
              <th>Earth pit</th>
              <th>Alarm</th>
              <th>Time to critical</th>
              <th>Assigned To</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 60).map((row) => {
              const id = `${row.t.id}-${row.p.id}-${row.drv?.k || "device"}`;
              const isAcknowledged = ack.has(id);
              const activeTask = tasks?.find(t => t.pit === row.p.id && !["completed", "verified"].includes(t.status));
              return (
                <tr className={isAcknowledged ? "ack" : ""} key={id}>
                  <td>
                    <Pill state={row.dev ? 2 : row.o} />
                  </td>
                  <td>{row.dev ? "Device" : "Predictive"}</td>
                  <td>
                    <b>
                      {row.t.id} · {row.p.id}
                    </b>
                  </td>
                  <td>
                    {row.dev
                      ? "Device offline"
                      : `${row.drv?.n || "Earth pit condition"} outside normal range`}
                    <span className="sub">{row.t.area}</span>
                  </td>
                  <td>
                    {row.o === 2 ? (
                      <span className="late">Critical</span>
                    ) : (
                      fd(row.dC)
                    )}
                  </td>
                  <td>
                    {activeTask ? (
                      <>
                        {activeTask.eng}
                        <span className="sub">{activeTask.engId}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {role === "safety" && (() => {
                      const safetyTask = tasks?.find(t => t.pit === row.p.id && ["assigned", "in_progress", "pending_verification", "rework"].includes(t.status));
                      return (
                        <button
                          className="btn primary sm"
                          disabled={!!safetyTask}
                          onClick={() => {
                            selectTransformer(row.t.id);
                            selectPit(row.p.id);
                            setPage("tasks");
                          }}
                        >
                          {safetyTask ? "Assigned" : "Assign"}
                        </button>
                      );
                    })()}
                    <button
                      className="btn secondary sm"
                      onClick={() => openPit(row.t.id, row.p.id)}
                    >
                      Open
                    </button>
                    <button
                      className="btn secondary sm"
                      onClick={() => acknowledge(id)}
                    >
                      {isAcknowledged ? "✓" : "Ack"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && (
          <Empty title="All clear" message="No alarms in this view." ok />
        )}
      </div>
    </>
  );
}

/* ─── DIAGNOSTICS PAGE ───────────────────────────────────────────── */

export function DiagnosticsPage() {
  const { selected, cfg } = useApp();
  const STEP_DAYS = cfg?.STEP_DAYS || 1;

  if (!selected?.live) {
    return (
      <Empty
        title="Select a live earth pit"
        message="Choose TR-001 / EP-01 to inspect the real API diagnostics."
      />
    );
  }

  const reading = selected.live;
  const overallState = overall(reading);
  const rows = PARAMS.map((p) => ({
    p,
    s: summary(p, selected, STEP_DAYS),
    cs: state(p, reading[p.k]),
  }));
  const priority = [...rows].sort(
    (a, b) => (b.s?.worst ?? b.cs) - (a.s?.worst ?? a.cs),
  )[0];

  return (
    <>
      <SelectedHeader />
      <div className={`banner s${overallState}`}>
        <div className="ic">{overallState ? "⚠" : "✓"}</div>
        <div>
          <b>Engineering assessment: {STATES[overallState].toUpperCase()}</b>
          <p>
            {overallState
              ? "One or more monitored parameters require engineering attention."
              : "All monitored parameters are currently normal."}
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <span className="lbl">Find the problem quickly</span>
        <h3>Identify → Understand → Act</h3>
        <div className="two">
          <div>
            <b>1. Identify</b>
            <p style={{ color: "var(--mut)" }}>
              Review the parameter with the highest current severity.
            </p>
          </div>
          <div>
            <b>2. Understand</b>
            <p style={{ color: "var(--mut)" }}>
              Compare reading with warning and critical threshold.
            </p>
          </div>
          <div>
            <b>3. Act</b>
            <p style={{ color: "var(--mut)" }}>
              Inspect electrode, conductor, bonding or soil condition as
              appropriate.
            </p>
          </div>
          <div>
            <b>4. Confirm</b>
            <p style={{ color: "var(--mut)" }}>
              After corrective work, verify the reading and forecast again.
            </p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <span className="lbl">Parameter diagnosis</span>
        <table className="tbl">
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Current condition</th>
              <th>Warning / Critical</th>
              <th>Why</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, s, cs }) => (
              <tr key={p.k}>
                <td>
                  <b>{p.n}</b>
                </td>
                <td className="mono">
                  {format(reading[p.k])} {p.u}
                  <br />
                  <Pill state={cs} />
                </td>
                <td>
                  {p.w} / {p.c}
                </td>
                <td>
                  <small>{p.cause}</small>
                </td>
                <td>
                  <small>{p.check}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent data table */}
      <div className="card">
        <span className="lbl">Recent data</span>
        <table className="tbl">
          <thead>
            <tr>
              <th>#</th>
              <th>Time</th>
              {PARAMS.map((p) => (
                <th key={p.k}>{p.n}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(selected.history || selected.hist || [])
              .slice(-8)
              .reverse()
              .map((r) => (
                <tr key={r.timestamp}>
                  <td className="mono">{r.sequence ?? "—"}</td>
                  <td className="mono">
                    {r.timestamp
                      ? new Date(r.timestamp).toLocaleTimeString()
                      : "—"}
                  </td>
                  {PARAMS.map((p) => (
                    <td className="mono" key={p.k}>
                      {format(r[p.k])}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ─── TASKS PAGE (Safety Officer) ───────────────────────────────── */

export function TasksPage() {
  const { TRS, tasks, createTask, fleet, user, showToast, setPage, tr, pit } = useApp();
  const [activeTab, setActiveTab] = useState("assign");
  const [formTrId, setFormTrId] = useState(tr || TRS[0]?.id || "");
  const [formPitId, setFormPitId] = useState(pit || "");

  React.useEffect(() => {
    if (tr) setFormTrId(tr);
    if (pit) setFormPitId(pit);
  }, [tr, pit]);
  const [formType, setFormType] = useState("Corrective action");
  const [formPrio, setFormPrio] = useState("High");
  const [formTitle, setFormTitle] = useState("");
  const [formEngIdx, setFormEngIdx] = useState(0);
  const [formDue, setFormDue] = useState(
    new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10),
  );

  const formTr = TRS.find((t) => t.id === formTrId) || TRS[0];

  const handleAssign = () => {
    if (!formTitle.trim()) {
      showToast("Enter a task title");
      return;
    }
    if (!formDue) {
      showToast("Set a due date");
      return;
    }
    const eng = ENGS[formEngIdx];
    createTask({
      tr: formTrId,
      pit: formPitId || formTr.pits[0]?.id,
      type: formType,
      title: formTitle,
      prio: formPrio,
      eng: eng.name,
      engId: eng.id,
      due: formDue,
      by: user.name,
      byId: user.id,
    });
    showToast(`Task assigned to ${eng.name}`);
    setFormTitle("");
  };

  // Warning pits with no active task or overdue task
  const warningWatch = fleet.filter((row) => {
    if (row.o === 0 && row.pw === 0) return false;
    const activeTask = tasks.find(
      (t) =>
        t.pit === row.p.id &&
        ["assigned", "in_progress", "pending_verification", "rework"].includes(t.status),
    );
    if (!activeTask) return true;
    if (isLate(activeTask)) return true;
    return false;
  });

  const allTasks = [...tasks].sort(
    (a, b) => new Date(b.created) - new Date(a.created),
  );
  const openCount = tasks.filter(
    (t) =>
      !["verified"].includes(t.status) && t.status !== "completed",
  ).length;
  const overdueCount = tasks.filter((t) => isLate(t)).length;

  return (
    <>
      <PageHeader
        eyebrow="Safety officer workspace"
        title="Task Assignment"
        description="Assign corrective actions to maintenance engineers. Verify completed work before closure."
      />

      <div className="kp">
        <Kpi label="Open tasks" value={openCount} />
        <Kpi
          label={`Overdue (>${SLA}d)`}
          value={overdueCount}
          color={overdueCount ? "var(--r)" : undefined}
        />
        <Kpi
          label="Auto-assigned"
          value={tasks.filter((t) => t.autoAssigned).length}
        />
        <Kpi
          label="Warning watch"
          value={warningWatch.length}
          color={warningWatch.length ? "var(--w)" : undefined}
        />
      </div>

      <div className="tabs">
        {[
          ["assign", "+ Assign New"],
          ["warning", `⚠ Warning Watch (${warningWatch.length})`],
          ["all", "All Tasks"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={`tab ${activeTab === id ? "on" : ""}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Assign New Tab ── */}
      {activeTab === "assign" && (
        <div className="card">
          <span className="lbl">New assignment</span>
          <h3>Assign to maintenance engineer</h3>
          <div className="form">
            <label>
              Transformer
              <select
                value={formTrId}
                onChange={(e) => {
                  setFormTrId(e.target.value);
                  setFormPitId("");
                }}
              >
                {TRS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} · {t.area}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Earth pit
              <select
                value={formPitId}
                onChange={(e) => setFormPitId(e.target.value)}
              >
                <option value="">Auto (first pit)</option>
                {formTr.pits.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} · {p.loc}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Type
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
              >
                <option>Corrective action</option>
                <option>Routine inspection</option>
                <option>Safety check</option>
              </select>
            </label>
            <label>
              Priority
              <select
                value={formPrio}
                onChange={(e) => setFormPrio(e.target.value)}
              >
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </label>
            <label className="full">
              Task description
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Inspect earth conductor termination"
              />
            </label>
            <label>
              Assign to
              <select
                value={formEngIdx}
                onChange={(e) => setFormEngIdx(+e.target.value)}
              >
                {ENGS.map((e, i) => (
                  <option key={e.id} value={i}>
                    {e.name} ({e.id}) · {e.sector}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Due date
              <input
                type="date"
                value={formDue}
                onChange={(e) => setFormDue(e.target.value)}
              />
            </label>
          </div>
          <button
            className="btn primary"
            style={{ marginTop: 18 }}
            onClick={handleAssign}
          >
            Assign task
          </button>
        </div>
      )}

      {/* ── Warning Watch Tab ── */}
      {activeTab === "warning" && (
        <div className="card">
          <span className="lbl">Warning watch</span>
          <h3>Pits needing attention with no / overdue task</h3>
          <p style={{ color: "var(--mut)", marginBottom: 12 }}>
            These pits are in warning or critical state and either have no
            active task or their task is overdue. Plant Officer is notified of
            this list.
          </p>
          {warningWatch.length ? (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Earth pit</th>
                  <th>State</th>
                  <th>Predicted</th>
                  <th>Driver</th>
                  <th>Task status</th>
                  <th>Days to critical</th>
                </tr>
              </thead>
              <tbody>
                {warningWatch.map((row) => {
                  const activeTask = tasks.find(
                    (t) =>
                      t.pit === row.p.id &&
                      [
                        "assigned",
                        "in_progress",
                        "pending_verification",
                      ].includes(t.status),
                  );
                  return (
                    <tr key={row.p.id}>
                      <td>
                        <b>
                          {row.t.id} · {row.p.id}
                        </b>
                        <span className="sub">{row.t.area}</span>
                      </td>
                      <td>
                        <Pill state={row.o} />
                      </td>
                      <td>
                        <Pill state={row.pw} />
                      </td>
                      <td>{row.drv?.n || "—"}</td>
                      <td>
                        {activeTask ? (
                          <>
                            <TaskStatusBadge status={activeTask.status} />{" "}
                            {isLate(activeTask) && (
                              <span className="late"> overdue</span>
                            )}
                          </>
                        ) : (
                          <span className="late">No task assigned</span>
                        )}
                      </td>
                      <td>
                        {row.o === 2 ? (
                          <span className="late">Critical</span>
                        ) : (
                          fd(row.dC)
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <Empty
              title="All clear"
              message="Every warning/critical pit has an active, on-time task."
              ok
            />
          )}
        </div>
      )}

      {/* ── All Tasks Tab ── */}
      {activeTab === "all" && (
        <div className="card">
          <span className="lbl">Task register</span>
          <h3>All {tasks.length} assignments</h3>
          <table className="tbl">
            <thead>
              <tr>
                <th>Task</th>
                <th>Earth pit</th>
                <th>Assigned to</th>
                <th>Created</th>
                <th>Due</th>
                <th>Status</th>
                <th>Auto</th>
              </tr>
            </thead>
            <tbody>
              {allTasks.map((t) => (
                <tr key={t.id} className={isLate(t) ? "" : ""}>
                  <td>
                    <b>{t.title}</b>
                    <span className="sub">
                      {t.type} ·{" "}
                      <span className={`prio-${t.prio}`}>{t.prio}</span>
                    </span>
                    {t.reworkReason && (
                      <span className="rework-note">
                        ↩ Rework: {t.reworkReason}
                      </span>
                    )}
                  </td>
                  <td className="mono">
                    {t.tr}
                    <span className="sub">{t.pit}</span>
                  </td>
                  <td>
                    {t.eng}
                    <span className="sub">{t.engId}</span>
                  </td>
                  <td className="mono" style={{ fontSize: 11 }}>
                    {new Date(t.created).toLocaleString()}
                  </td>
                  <td>
                    {t.due || "—"}
                    {isLate(t) && <span className="late"> !</span>}
                  </td>
                  <td>
                    <TaskStatusBadge status={t.status} />
                  </td>
                  <td>
                    {t.autoAssigned ? (
                      <span className="pill s1">AUTO</span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ─── VERIFICATION PAGE (Safety Officer) ────────────────────────── */

export function VerifyPage() {
  const {
    tasks,
    verifyTask,
    requestRework,
    fleet,
    user,
    showToast,
    getData,
    TRS,
  } = useApp();
  const [reworkInput, setReworkInput] = useState({});
  const [verifyNote, setVerifyNote] = useState({});

  const pendingTasks = tasks.filter((t) => t.status === "pending_verification");
  const recentlyVerified = tasks
    .filter((t) => t.status === "verified")
    .slice(-5)
    .reverse();

  const getPitData = (tr, pit) => {
    const transformer = TRS.find((t) => t.id === tr);
    if (!transformer) return null;
    return getData(pit);
  };

  const handleVerify = (task) => {
    const note = verifyNote[task.id] || "Pit readings confirmed normal.";
    verifyTask(task.id, user.name, user.id, note);
    showToast(`✓ Task verified and closed for ${task.pit}`);
  };

  const handleRework = (task) => {
    const reason = reworkInput[task.id];
    if (!reason?.trim()) {
      showToast("Enter a rework reason");
      return;
    }
    requestRework(task.id, reason);
    showToast(`↩ Rework requested for ${task.pit} — ${task.eng} notified`);
    setReworkInput((prev) => ({ ...prev, [task.id]: "" }));
  };

  return (
    <>
      <PageHeader
        eyebrow="Safety officer workspace"
        title="Verification Centre"
        description="Review completed maintenance work. Check that the pit has been normal for at least 12 hours, then verify or request rework."
      />

      <div className="kp">
        <Kpi
          label="Awaiting verification"
          value={pendingTasks.length}
          color={pendingTasks.length ? "var(--w)" : undefined}
        />
        <Kpi
          label="Verified this session"
          value={recentlyVerified.length}
          color="var(--g)"
        />
        <Kpi
          label="12-hr check passed"
          value={
            pendingTasks.filter((t) => hoursSince(t.pitNormalSince) >= 12)
              .length
          }
          color="var(--g)"
        />
        <Kpi
          label="Need more time"
          value={
            pendingTasks.filter((t) => hoursSince(t.pitNormalSince) < 12).length
          }
          color="var(--w)"
        />
      </div>

      {pendingTasks.length === 0 ? (
        <Empty
          title="No pending verifications"
          message="All completed maintenance tasks have been verified."
          ok
        />
      ) : (
        pendingTasks.map((task) => {
          const hoursElapsed = hoursSince(task.pitNormalSince);
          const check12hr = hoursElapsed >= 12;
          const pitData = getPitData(task.tr, task.pit);
          const pitReading = pitData?.live;
          const pitState = pitReading ? overall(pitReading) : null;

          return (
            <div className="verification-panel" key={task.id}>
              <div className="vp-header">
                <div>
                  <span className="lbl">Pending verification</span>
                  <h3>{task.title}</h3>
                  <div className="vp-meta">
                    <span>
                      {task.tr} · {task.pit}
                    </span>
                    <span>
                      Engineer: <b>{task.eng}</b> ({task.engId})
                    </span>
                    <span>
                      Completed:{" "}
                      <b>
                        {task.completedAt
                          ? new Date(task.completedAt).toLocaleString()
                          : "—"}
                      </b>
                    </span>
                    {task.autoAssigned && (
                      <span className="pill s1">AUTO-ASSIGNED</span>
                    )}
                  </div>
                  {task.note && (
                    <div className="vp-completion-note">
                      <b>Engineer's note:</b> {task.note}
                    </div>
                  )}
                </div>
                <div className="vp-timer">
                  <div
                    className={`timer-circle ${check12hr ? "passed" : "waiting"}`}
                  >
                    <b>{Math.floor(hoursElapsed)}h</b>
                    <small>{check12hr ? "✓ 12hr passed" : "of 12hr"}</small>
                  </div>
                </div>
              </div>

              {/* Current pit readings */}
              {pitReading && (
                <div className="vp-readings">
                  <span className="lbl">Current pit readings</span>
                  <div className="vp-readings-grid">
                    <div className={`vp-reading-card s${pitState ?? 0}`}>
                      <span>Overall state</span>
                      <Pill state={pitState ?? 0} />
                    </div>
                    {PARAMS.map((p) => {
                      const v = pitReading[p.k];
                      const s = state(p, v);
                      return (
                        <div className={`vp-reading-card s${s}`} key={p.k}>
                          <span>{p.n}</span>
                          <b>
                            {format(v)} <small>{p.u}</small>
                          </b>
                          <Pill state={s} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Verification actions */}
              <div className="vp-actions">
                <div className="vp-verify-side">
                  <label style={{ marginTop: 0 }}>
                    Verification note (optional)
                    <input
                      value={verifyNote[task.id] || ""}
                      onChange={(e) =>
                        setVerifyNote((prev) => ({
                          ...prev,
                          [task.id]: e.target.value,
                        }))
                      }
                      placeholder="e.g. Pit confirmed normal for 12+ hours. All readings within range."
                    />
                  </label>
                  <button
                    className={`btn primary ${!check12hr ? "btn-warn-override" : ""}`}
                    onClick={() => handleVerify(task)}
                    style={{ marginTop: 10 }}
                  >
                    {check12hr
                      ? "✓ Mark Verified & Close"
                      : "⚠ Verify (12hr check not complete)"}
                  </button>
                </div>
                <div className="vp-rework-side">
                  <label style={{ marginTop: 0 }}>
                    Rework reason (required to request rework)
                    <textarea
                      rows={2}
                      value={reworkInput[task.id] || ""}
                      onChange={(e) =>
                        setReworkInput((prev) => ({
                          ...prev,
                          [task.id]: e.target.value,
                        }))
                      }
                      placeholder="e.g. Earth resistance still 3.8 Ω after corrective work. Needs re-inspection."
                    />
                  </label>
                  <button
                    className="btn danger"
                    onClick={() => handleRework(task)}
                    style={{ marginTop: 6 }}
                  >
                    ↩ Request Rework
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}

      {recentlyVerified.length > 0 && (
        <div className="card" style={{ marginTop: 14 }}>
          <span className="lbl">Recently verified</span>
          <h3>Closed in this session</h3>
          <table className="tbl">
            <thead>
              <tr>
                <th>Task</th>
                <th>Pit</th>
                <th>Engineer</th>
                <th>Verified at</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {recentlyVerified.map((t) => (
                <tr key={t.id}>
                  <td>
                    <b>{t.title}</b>
                  </td>
                  <td className="mono">{t.pit}</td>
                  <td>{t.eng}</td>
                  <td className="mono" style={{ fontSize: 11 }}>
                    {t.verifiedAt
                      ? new Date(t.verifiedAt).toLocaleString()
                      : "—"}
                  </td>
                  <td>
                    <small>{t.verificationNote || "—"}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ─── WORK ORDERS PAGE (Maintenance Engineer) ────────────────────── */

export function WorkOrdersPage() {
  const {
    user,
    tasks,
    startTask,
    completeTask,
    acknowledgeRework,
    fleet,
    showToast,
  } = useApp();
  const [completionNotes, setCompletionNotes] = useState({});
  const [activeTab, setActiveTab] = useState("mywork");
  const [query, setQuery] = useState("");

  const myTasks = tasks.filter((t) => t.engId === user.id);
  const mine = fleet.filter((r) => r.t.eng?.id === user.id);

  const reworkTasks = myTasks.filter((t) => t.status === "rework");
  const activeTasks = myTasks.filter((t) =>
    ["assigned", "in_progress"].includes(t.status),
  );
  const verifiedTasks = myTasks
    .filter((t) => t.status === "verified")
    .slice(-5)
    .reverse();

  const searchQ = query.toLowerCase();
  const filterTask = (t) =>
    !searchQ ||
    (t.title || "").toLowerCase().includes(searchQ) ||
    (t.pit || "").toLowerCase().includes(searchQ) ||
    (t.tr || "").toLowerCase().includes(searchQ);

  const filteredActive = activeTasks.filter(filterTask);
  const filteredRework = reworkTasks.filter(filterTask);
  const filteredVerified = verifiedTasks.filter(filterTask);

  const handleComplete = (taskId) => {
    const note = completionNotes[taskId];
    if (!note?.trim()) {
      showToast("Enter a completion note before marking done");
      return;
    }
    completeTask(taskId, note);
    showToast("Work marked complete — awaiting Safety Officer verification");
    setCompletionNotes((prev) => ({ ...prev, [taskId]: "" }));
  };

  return (
    <>
      <PageHeader
        eyebrow={`Maintenance engineer workspace · ${user.id}`}
        title="My Work Orders"
        description={`Tasks assigned to ${user.name}. Complete work and add a note before marking done. Safety Officer will verify the pit.`}
      />

      <div className="kp">
        <Kpi label="Active tasks" value={activeTasks.length} />
        <Kpi
          label="Rework needed"
          value={reworkTasks.length}
          color={reworkTasks.length ? "var(--r)" : undefined}
        />
        <Kpi
          label="Awaiting verify"
          value={
            myTasks.filter((t) => t.status === "pending_verification").length
          }
          color="var(--w)"
        />
        <Kpi
          label="Verified / done"
          value={verifiedTasks.length}
          color="var(--g)"
        />
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === "mywork" ? "on" : ""}`}
          onClick={() => setActiveTab("mywork")}
        >
          My Work Orders{" "}
          {reworkTasks.length > 0 && (
            <span className="tab-badge">{reworkTasks.length} rework</span>
          )}
        </button>
        <button
          className={`tab ${activeTab === "mypits" ? "on" : ""}`}
          onClick={() => setActiveTab("mypits")}
        >
          My Pits ({mine.length})
        </button>
      </div>

      {activeTab === "mywork" && (
        <input
          className="srch"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search active work orders by pit (EP-12) or title..."
          style={{ marginBottom: 16 }}
        />
      )}

      {/* ── Rework alerts ── */}
      {activeTab === "mywork" && filteredRework.length > 0 && (
        <div className="rework-alert-section">
          <span className="lbl">Rework requested by safety officer</span>
          {filteredRework.map((t) => (
            <div className="rework-alert" key={t.id}>
              <div className="ra-icon">↩</div>
              <div className="ra-body">
                <b>{t.title}</b>
                <div className="ra-meta">
                  {t.tr} · {t.pit} · Task {t.id}
                </div>
                <div className="rework-reason">
                  <b>Rework reason:</b> {t.reworkReason || "No reason provided"}
                </div>
              </div>
              <button
                className="btn secondary"
                onClick={() => {
                  acknowledgeRework(t.id);
                  showToast(
                    "Rework acknowledged — task moved back to in progress",
                  );
                }}
              >
                Acknowledge & Start Rework
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Active work orders ── */}
      {activeTab === "mywork" && (
        <div className="card">
          <span className="lbl">Active work orders</span>
          <h3>
            {filteredActive.length} task{filteredActive.length !== 1 ? "s" : ""}{" "}
            to action
          </h3>
          {filteredActive.length ? (
            filteredActive.map((t) => (
              <div className="work-order-card" key={t.id}>
                <div className="wo-header">
                  <div>
                    <b>{t.title}</b>
                    <div className="wo-meta">
                      {t.tr} · {t.pit} · {t.type} ·{" "}
                      <span className={`prio-${t.prio}`}>
                        {t.prio} priority
                      </span>
                      {t.autoAssigned && (
                        <span className="pill s1" style={{ marginLeft: 8 }}>
                          AUTO-ASSIGNED
                        </span>
                      )}
                    </div>
                    <div className="wo-meta">
                      Assigned by {t.by} on{" "}
                      {new Date(t.created).toLocaleString()} · Due{" "}
                      {t.due || "—"} ·{" "}
                      {isLate(t) ? (
                        <span className="late">Overdue!</span>
                      ) : (
                        `${age(t)}d old`
                      )}
                    </div>
                  </div>
                  <TaskStatusBadge status={t.status} />
                </div>

                {t.status === "assigned" && (
                  <button
                    className="btn secondary sm"
                    style={{ marginTop: 8 }}
                    onClick={() => {
                      startTask(t.id);
                      showToast("Work started");
                    }}
                  >
                    ▶ Start Work
                  </button>
                )}

                {t.status === "in_progress" && (
                  <div className="wo-complete">
                    <label style={{ marginTop: 8 }}>
                      Completion note (required — what was done?)
                      <input
                        value={completionNotes[t.id] || ""}
                        onChange={(e) =>
                          setCompletionNotes((prev) => ({
                            ...prev,
                            [t.id]: e.target.value,
                          }))
                        }
                        placeholder="e.g. Re-terminated clamp, watered pit, re-tested resistance. Now 1.2 Ω."
                      />
                    </label>
                    <button
                      className="btn primary sm"
                      style={{ marginTop: 8 }}
                      onClick={() => handleComplete(t.id)}
                    >
                      ✓ Mark Complete — Send to Safety Officer
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <Empty
              title="No active work orders"
              message="You have no tasks currently requiring action."
              ok
            />
          )}

          {myTasks
            .filter((t) => t.status === "pending_verification")
            .filter(filterTask).length > 0 && (
            <div style={{ marginTop: 16 }}>
              <span className="lbl">Awaiting safety officer verification</span>
              {myTasks
                .filter((t) => t.status === "pending_verification")
                .filter(filterTask)
                .map((t) => (
                  <div
                    className="work-order-card"
                    key={t.id}
                    style={{ opacity: 0.7 }}
                  >
                    <div className="wo-header">
                      <div>
                        <b>{t.title}</b>
                        <div className="wo-meta">
                          {t.pit} · Completed{" "}
                          {t.completedAt
                            ? new Date(t.completedAt).toLocaleString()
                            : "—"}
                        </div>
                        <div className="wo-meta">Note: {t.note}</div>
                      </div>
                      <TaskStatusBadge status={t.status} />
                    </div>
                  </div>
                ))}
            </div>
          )}

          {filteredVerified.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <span className="lbl">Recently verified</span>
              {filteredVerified.map((t) => (
                <div
                  className="work-order-card"
                  key={t.id}
                  style={{ opacity: 0.6 }}
                >
                  <div className="wo-header">
                    <div>
                      <b>{t.title}</b>
                      <div className="wo-meta">
                        {t.pit} · Verified by {t.verifiedBy} ·{" "}
                        {t.verifiedAt
                          ? new Date(t.verifiedAt).toLocaleDateString()
                          : "—"}
                      </div>
                      {t.verificationNote && (
                        <div className="wo-meta">
                          Verification note: {t.verificationNote}
                        </div>
                      )}
                    </div>
                    <TaskStatusBadge status={t.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── My Pits Tab ── */}
      {activeTab === "mypits" && (
        <div className="card">
          <span className="lbl">Assigned earth pits</span>
          <h3>
            {mine.length} pits assigned to {user.name}
          </h3>
          <table className="tbl">
            <thead>
              <tr>
                <th>Earth pit</th>
                <th>Transformer</th>
                <th>Area</th>
                <th>Health</th>
                <th>State</th>
                <th>Time to critical</th>
                <th>Active task</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((row) => {
                const activeTask = tasks.find(
                  (t) =>
                    t.pit === row.p.id &&
                    [
                      "assigned",
                      "in_progress",
                      "pending_verification",
                    ].includes(t.status),
                );
                return (
                  <tr key={row.p.id}>
                    <td>
                      <b>{row.p.id}</b>
                    </td>
                    <td>{row.t.id}</td>
                    <td>{row.t.area}</td>
                    <td className="mono">{row.h}/100</td>
                    <td>
                      <Pill state={row.o} />
                    </td>
                    <td>
                      {row.o === 2 ? (
                        <span className="late">Critical</span>
                      ) : (
                        fd(row.dC)
                      )}
                    </td>
                    <td>
                      {activeTask ? (
                        <TaskStatusBadge status={activeTask.status} />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ─── SUPPORT PAGE ───────────────────────────────────────────────── */

export function SupportPage() {
  const { user, TRS } = useApp();
  const allowedTrs =
    user.role === "maintenance"
      ? TRS.filter((t) => t.eng.id === user.id)
      : TRS.filter(
          (t) => user.role === "admin" || t.company.id === user.companyId,
        );
  const [formTrId, setFormTrId] = useState(allowedTrs[0]?.id || "");
  const formTr = allowedTrs.find((t) => t.id === formTrId) ||
    allowedTrs[0] || { pits: [] };
  const [formPitId, setFormPitId] = useState(formTr.pits[0]?.id || "");

  return (
    <>
      <PageHeader
        eyebrow={`${ROLES[user.role]} workspace`}
        title="Support Tickets"
        description={
          user.role === "admin"
            ? "Respond to and resolve escalations from plant maintenance engineers."
            : "Technical complaints raised by the plant team, with the action already taken on site and the response."
        }
      />

      {["manager", "safety"].includes(user.role) && (
        <div className="card" style={{ marginBottom: 14 }}>
          <span className="lbl">Escalate to EarthSense</span>
          <h3>Raise a complaint</h3>
          <p style={{ color: "var(--mut)" }}>
            Use this when a technical or device problem cannot be resolved by
            the plant team. This ticket will be sent to the EarthSense platform
            admin.
          </p>
          <div className="form">
            <label>
              Transformer
              <select
                value={formTrId}
                onChange={(e) => {
                  setFormTrId(e.target.value);
                  setFormPitId("");
                }}
              >
                {allowedTrs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} · {t.area}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Earth pit
              <select
                value={formPitId}
                onChange={(e) => setFormPitId(e.target.value)}
              >
                {formTr.pits.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} · {p.loc}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select>
                <option>Gateway offline</option>
                <option>Status reading incorrect</option>
                <option>API / data not updating</option>
                <option>Prediction model issue</option>
                <option>Other</option>
              </select>
            </label>
            <label>
              Severity
              <select>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </label>
            <label className="full">
              Problem description
              <textarea rows="2" />
            </label>
            <label className="full">
              Action already taken (required)
              <textarea
                rows="2"
                placeholder="e.g. Power-cycled node, re-checked wiring"
              />
            </label>
          </div>
          <button className="btn primary" style={{ marginTop: 18 }}>
            Submit to EarthSense support
          </button>
        </div>
      )}

      <div className="card">
        <h3>1 ticket</h3>
        <div className="tx">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <b>TK-1001 · Gateway offline</b>
            <span className="st progress">IN REVIEW</span>
          </div>
          <div className="meta">
            Apex Industrial Systems · TR-001 · EP-01 · Raised by Arun Kumar
            (ME-201) · 2d ago
          </div>
          <p>Node stopped reporting for 40 minutes.</p>
          <p>
            <b>Action by maintenance engineer:</b> Power-cycled node, checked
            antenna and Wi-Fi. No change.
          </p>
          <p className="resp">
            <b>EarthSense support:</b> Support is checking the gateway logs.
          </p>
          {user.role === "admin" && (
            <div>
              <button className="btn secondary sm">Mark in review</button>{" "}
              <button className="btn primary sm">Resolve</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── TRACKER PAGE (Plant Officer) ──────────────────────────────── */

export function TrackerPage() {
  const { tasks, fleet } = useApp();
  const [activeTab, setActiveTab] = useState("all");

  const warningUnhandled = fleet.filter((row) => {
    if (row.o === 0 && row.pw === 0) return false;
    const activeTask = tasks.find(
      (t) =>
        t.pit === row.p.id &&
        ["assigned", "in_progress", "pending_verification", "rework"].includes(t.status),
    );
    return !activeTask || isLate(activeTask);
  });

  const allTasks = [...tasks].sort(
    (a, b) => new Date(b.created) - new Date(a.created),
  );
  const overdueTasks = allTasks.filter(isLate);

  return (
    <>
      <PageHeader
        eyebrow="Plant officer workspace"
        title="Task Tracker"
        description="Full task timeline. Monitor assignment, verification and overdue actions across all maintenance engineers."
      />

      <div className="kp">
        <Kpi label="Total tasks" value={tasks.length} />
        <Kpi
          label="Overdue"
          value={overdueTasks.length}
          color={overdueTasks.length ? "var(--r)" : undefined}
        />
        <Kpi
          label="Warning / unhandled"
          value={warningUnhandled.length}
          color={warningUnhandled.length ? "var(--w)" : undefined}
        />
        <Kpi
          label="Verified / done"
          value={tasks.filter((t) => t.status === "verified").length}
          color="var(--g)"
        />
      </div>

      {/* Escalation banner */}
      {(overdueTasks.length > 0 || warningUnhandled.length > 0) && (
        <div className="banner s2">
          <div className="ic">⚠</div>
          <div>
            <b>Plant Officer notification</b>
            <p>
              {overdueTasks.length > 0 &&
                `${overdueTasks.length} task(s) are overdue. `}
              {warningUnhandled.length > 0 &&
                `${warningUnhandled.length} warning/critical pit(s) have no active or on-time task.`}
            </p>
          </div>
        </div>
      )}

      <div className="tabs">
        {[
          ["all", "All Tasks"],
          ["overdue", `Overdue (${overdueTasks.length})`],
          ["unhandled", `Warning Unhandled (${warningUnhandled.length})`],
        ].map(([id, label]) => (
          <button
            key={id}
            className={`tab ${activeTab === id ? "on" : ""}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "all" && (
        <div className="card">
          <table className="tbl">
            <thead>
              <tr>
                <th>Task</th>
                <th>Earth pit</th>
                <th>Assigned to</th>
                <th>Created</th>
                <th>Due</th>
                <th>Status</th>
                <th>Auto</th>
              </tr>
            </thead>
            <tbody>
              {allTasks.map((t) => (
                <tr key={t.id}>
                  <td>
                    <b>{t.title}</b>
                    <span className="sub">
                      {t.type} ·{" "}
                      <span className={`prio-${t.prio}`}>{t.prio}</span>
                    </span>
                  </td>
                  <td className="mono">
                    {t.tr}
                    <span className="sub">{t.pit}</span>
                  </td>
                  <td>
                    {t.eng}
                    <span className="sub">{t.engId}</span>
                  </td>
                  <td className="mono" style={{ fontSize: 11 }}>
                    {new Date(t.created).toLocaleString()}
                  </td>
                  <td>
                    {t.due || "—"}
                    {isLate(t) && <span className="late"> overdue</span>}
                  </td>
                  <td>
                    <TaskStatusBadge status={t.status} />
                  </td>
                  <td>
                    {t.autoAssigned ? (
                      <span className="pill s1">AUTO</span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "overdue" && (
        <div className="card">
          {overdueTasks.length ? (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Pit</th>
                  <th>Engineer</th>
                  <th>Due</th>
                  <th>Age</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {overdueTasks.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <b>{t.title}</b>
                    </td>
                    <td className="mono">{t.pit}</td>
                    <td>{t.eng}</td>
                    <td>
                      <span className="late">{t.due || "—"}</span>
                    </td>
                    <td>
                      <span className="late">{age(t)}d</span>
                    </td>
                    <td>
                      <TaskStatusBadge status={t.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty
              title="No overdue tasks"
              message="All tasks are within their SLA."
              ok
            />
          )}
        </div>
      )}

      {activeTab === "unhandled" && (
        <div className="card">
          {warningUnhandled.length ? (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Earth pit</th>
                  <th>State</th>
                  <th>Driver</th>
                  <th>Time to critical</th>
                  <th>Task situation</th>
                </tr>
              </thead>
              <tbody>
                {warningUnhandled.map((row) => {
                  const task = tasks.find(
                    (t) =>
                      t.pit === row.p.id &&
                      [
                        "assigned",
                        "in_progress",
                        "pending_verification",
                      ].includes(t.status),
                  );
                  return (
                    <tr key={row.p.id}>
                      <td>
                        <b>
                          {row.t.id} · {row.p.id}
                        </b>
                        <span className="sub">{row.t.area}</span>
                      </td>
                      <td>
                        <Pill state={row.o} />
                      </td>
                      <td>{row.drv?.n || "—"}</td>
                      <td>
                        {row.o === 2 ? (
                          <span className="late">Critical</span>
                        ) : (
                          fd(row.dC)
                        )}
                      </td>
                      <td>
                        {task ? (
                          <>
                            <TaskStatusBadge status={task.status} />{" "}
                            <span className="late">overdue</span>
                          </>
                        ) : (
                          <span className="late">No task assigned</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <Empty
              title="All handled"
              message="Every warning/critical pit has an active, on-time task."
              ok
            />
          )}
        </div>
      )}
    </>
  );
}

/* ─── COMPANY PAGE ───────────────────────────────────────────────── */

export function CompanyPage() {
  const { companyTab, setCompanyTab, user, fleet } = useApp();

  const companyId =
    user?.companyId === "EARTHSENSE" ? "ES-C01" : user?.companyId;
  const company =
    COMPANIES.find((item) => item.id === companyId) || COMPANIES[0];
  const companyRows = fleet.filter((row) => row.t.company.id === company.id);
  const transformers = new Map(companyRows.map((row) => [row.t.id, row.t]));
  const users = Object.entries(USERS).filter(
    ([, account]) => account.companyId === company.id,
  );

  return (
    <>
      <PageHeader
        eyebrow="Company administration"
        title={company.name}
        description={`${company.industry} · ${company.plants} plants · Manage this company's earth pits, devices and users in one place.`}
      />

      <div className="kpis" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <Kpi label="Earth pits" value={companyRows.length} />
        <Kpi label="Devices" value={companyRows.length} />
        <Kpi label="Users" value={users.length} />
      </div>

      <div className="tabs">
        {["overview", "devices", "users", "pits"].map((t) => (
          <button
            key={t}
            className={`tab ${companyTab === t ? "on" : ""}`}
            onClick={() => setCompanyTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="card">
        {companyTab === "overview" && (
          <>
            <span className="lbl">Company profile</span>
            <h3>Access and ownership</h3>
            <div className="row">
              <b>Industry</b>
              <span>{company.industry}</span>
            </div>
            <div className="row">
              <b>Plants</b>
              <span>{company.plants}</span>
            </div>
            <div className="row">
              <b>Primary manager</b>
              <span>{company.manager}</span>
            </div>
            <div className="row">
              <b>Transformers</b>
              <span>{transformers.size}</span>
            </div>
            <div className="row">
              <b>Earth pits</b>
              <span>{companyRows.length}</span>
            </div>
            <div className="row">
              <b>Device nodes</b>
              <span>{companyRows.length}</span>
            </div>
          </>
        )}

        {companyTab === "devices" && (
          <>
            <span className="lbl">Company devices</span>
            <h3>{companyRows.length} device nodes</h3>
            <p>One device node is associated with each earth pit.</p>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Earth pit</th>
                  <th>Transformer</th>
                  <th>Sector</th>
                </tr>
              </thead>
              <tbody>
                {companyRows.map((row) => (
                  <tr key={row.p.id}>
                    <td className="mono">ES-{row.p.id.slice(3)}</td>
                    <td>{row.p.id}</td>
                    <td>{row.t.id}</td>
                    <td>{row.t.sector}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {companyTab === "users" && (
          <>
            <span className="lbl">Company users</span>
            <h3>Users with access to {company.name}</h3>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Employee ID</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Sector</th>
                </tr>
              </thead>
              <tbody>
                {users.map(([email, account]) => (
                  <tr key={email}>
                    <td>
                      <b>{account.name}</b>
                    </td>
                    <td className="mono">{account.id}</td>
                    <td>{ROLES[account.role]}</td>
                    <td>{email}</td>
                    <td>{account.sector || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {companyTab === "pits" && (
          <>
            <span className="lbl">Earth pit access</span>
            <h3>
              {companyRows.length} earth pits for {company.name}
            </h3>

            <table className="tbl">
              <thead>
                <tr>
                  <th>Earth pit</th>
                  <th>Transformer</th>
                  <th>Area</th>
                  <th>Sector</th>
                </tr>
              </thead>
              <tbody>
                {companyRows.map((row) => (
                  <tr key={row.p.id}>
                    <td>
                      <b>{row.p.id}</b>
                    </td>
                    <td>{row.t.id}</td>
                    <td>{row.t.area}</td>
                    <td>{row.t.sector}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </>
  );
}
