import React, { useState } from "react";

import { NAV, PASS, ROLES, TITLES, USERS } from "../data/constants";
import { useApp } from "../context/AppContext";

const icons = {
  dashboard: "▦",
  fleet: "◇",
  alarms: "◉",
  tracker: "✓",
  support: "?",
  pit: "⌖",
  tasks: "✓",
  diagnostics: "⌁",
  workorders: "⚒",
};

const DEMO_ACCOUNTS = [
  ["manager@earthsense.com", "Plant Officer"],
  ["safety@earthsense.com", "Safety Officer"],
  ["arun.kumar@apexindustrial.com", "Arun · Maintenance"],
  ["priya.nair@apexindustrial.com", "Priya · Maintenance"],
  ["rahul.menon@apexindustrial.com", "Rahul · Maintenance"],
  ["nova.officer@earthsense.com", "Nova · Plant Officer"],
  ["nova.safety@earthsense.com", "Nova · Safety"],
  ["kaveri.officer@earthsense.com", "Kaveri · Plant Officer"],
  ["kaveri.safety@earthsense.com", "Kaveri · Safety"],
  ["admin@earthsense.com", "EarthSense Admin"],
];

export function Login() {
  const { login } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (event) => {
    event.preventDefault();
    login(email, password);
  };

  return (
    <section className="auth">
      <div className="auth-brand">
        <div className="brand big">
          <img
            className="brand-logo"
            src={`${import.meta.env.BASE_URL}earthsense-logo.png`}
            alt="EarthSense"
          />
        </div>

        <div className="auth-copy">
          <span className="eyebrow">ELECTRICAL SAFETY INTELLIGENCE</span>
          <h1>
            Know your earthing.
            <br />
            <em>Before it becomes a fault.</em>
          </h1>
          <p>
            Live monitoring and machine-learning forecasts for transformer
            earth-pit systems, with workflows built for each role on your plant.
          </p>
          <ul>
            <li>Five-parameter continuous monitoring</li>
            <li>Predicted normal / warning / critical outlook</li>
            <li>Role-specific safety, asset and engineering tools</li>
          </ul>
        </div>
      </div>

      <div className="auth-wrap">
        <form className="auth-card" onSubmit={submit}>
          <h2>Welcome back</h2>
          <p>Sign in to your EarthSense workspace.</p>

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="name@company.com"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              placeholder="••••••••"
            />
          </label>

          <button className="btn primary wide" type="submit">
            Login
          </button>

          <div className="demo">
            <span>
              Platform accounts · password <b>{PASS}</b>
            </span>

            {DEMO_ACCOUNTS.map(([accountEmail, label]) => (
              <button
                key={accountEmail}
                type="button"
                onClick={() => {
                  setEmail(accountEmail);
                  setPassword(PASS);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </form>
      </div>
    </section>
  );
}

export function Sidebar() {
  const { user, page, setPage, liveState, logout, setModal } = useApp();

  return (
    <aside>
      <div className="brand">
        <img
          className="brand-logo"
          src={`${import.meta.env.BASE_URL}earthsense-logo.png`}
          alt="EarthSense"
        />
      </div>

      <div className="role">{ROLES[user.role].toUpperCase()}</div>

      <nav>
        {NAV[user.role].map(([id, name]) => (
          <button
            key={id}
            className={
              page === id || (page === "asset" && id === "fleet")
                ? "active"
                : ""
            }
            onClick={() => setPage(id)}
          >
            <span>{icons[id] || "•"}</span>
            <span>{name}</span>
            {id === "alarms" && <i>{liveState.errors?.length || ""}</i>}
          </button>
        ))}
      </nav>

      <div className="aside-bottom">
        <div className="gw">
          <span className={`dot ${liveState.connected ? "" : "off"}`} />
          <div>
            <b>{liveState.connected ? "Connected" : "No live feed"}</b>
            <small>
              {liveState.errors?.length
                ? liveState.errors[0]
                : "EarthSense gateway"}
            </small>
          </div>
        </div>

        <button onClick={() => setModal("settings")}>⚙ Settings</button>
        <button onClick={logout}>⇥ Sign out</button>
      </div>
    </aside>
  );
}

export function Topbar() {
  const { user, page, refresh, setModal, liveState } = useApp();

  const title =
    TITLES[page] || (user.role === "admin" ? "Admin Console" : "Dashboard");

  const showAssetBar =
    ["pit", "asset", "diagnostics"].includes(page) ||
    (page === "dashboard" && ["safety"].includes(user.role));

  return (
    <>
      <header>
        <div>
          <small>EARTHSENSE / {ROLES[user.role].toUpperCase()}</small>
          <h1>{title}</h1>
        </div>

        <div className="head-actions">
          <button onClick={refresh} aria-label="Refresh">
            ↻
          </button>
          <button onClick={() => setModal("alarms")} aria-label="Notifications">
            ♧{liveState.errors?.length > 0 && <span className="cnt">!</span>}
          </button>
          <button className="user" onClick={() => setModal("user")}>
            <b>
              {user.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)}
            </b>
            <span>{user.name}</span>
          </button>
        </div>
      </header>

      {showAssetBar && <AssetBar />}
    </>
  );
}

function AssetBar() {
  const { TRS, tr, pit, selectTransformer, selectPit, user, setPage } =
    useApp();

  const handleSelectPit = (val) => {
    selectPit(val);
    if (val) setPage(user.role === "manager" ? "asset" : "pit");
  };

  const allowedTrs =
    user.role === "maintenance"
      ? TRS.filter((t) => t.eng.id === user.id)
      : TRS.filter(
          (t) =>
            user.role === "admin" ||
            user.role === "safety" ||
            t.company.id === user.companyId,
        );

  const transformer = TRS.find((item) => item.id === tr);
  const isLive = tr === "TR-001" && pit === "EP-01";

  return (
    <div className="assetbar">
      <div className="step">
        <span>1</span>
        <label>
          Transformer
          <select
            value={tr}
            onChange={(event) => selectTransformer(event.target.value)}
          >
            <option value="">Select transformer</option>
            {allowedTrs.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id} · {item.area}
              </option>
            ))}
          </select>
        </label>
      </div>

      <em>›</em>

      <div className="step">
        <span>2</span>
        <label>
          Earth pit
          <select
            value={pit}
            onChange={(event) => handleSelectPit(event.target.value)}
            disabled={!transformer}
          >
            <option value="">Select earth pit</option>
            {transformer?.pits.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id} · {item.loc}
              </option>
            ))}
          </select>
        </label>
      </div>

      <span className={`badge ${pit ? "demo" : "none"}`}>
        {pit ? `● ${isLive ? "LIVE" : "SIMULATED"}` : "NO ASSET SELECTED"}
      </span>
    </div>
  );
}

export function Shell({ children }) {
  const { toast, modal, setModal, liveState } = useApp();

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Topbar />
        {!liveState.connected && (
          <div className="banner s2" style={{ marginBottom: "20px" }}>
            <div className="ic" style={{ background: "var(--r)", color: "white" }}>!</div>
            <div>
              <b style={{ color: "var(--r)", fontSize: "16px" }}>PRIORITY ALERT: EP1 Sensor Data Offline</b>
              <p style={{ fontWeight: 500 }}>Sensor data is not being received from Earth Pit 1. Please check the connection immediately.</p>
            </div>
          </div>
        )}
        {children}
      </main>

      {toast && <div className="toast show">{toast}</div>}
      {modal && <Modal type={modal} close={() => setModal(null)} />}
    </div>
  );
}

function Modal({ type, close }) {
  const { user, liveState, fleet } = useApp();

  let attentionPits = [];
  if (type === "assistant" && fleet) {
    const companyFleet = fleet.filter((r) => r.t.company.id === user.companyId);
    attentionPits = companyFleet
      .filter((r) => r.o === 2 || (r.dC != null && r.dC <= 14))
      .sort((a, b) => b.o - a.o || (a.dC ?? 999) - (b.dC ?? 999));
  }

  return (
    <div
      className="modal"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="modalbox">
        <button className="close" onClick={close}>
          ×
        </button>

        {type === "user" ? (
          <>
            <span className="lbl">Account</span>
            <h2>{user.name}</h2>
            <p>
              {ROLES[user.role]}
              <br />
              {user.email}
            </p>
          </>
        ) : type === "settings" ? (
          <>
            <span className="lbl">API connection</span>
            <h2>Settings</h2>
            <p>Live: {liveState.connected ? "Connected" : "Unavailable"}</p>
            <p>
              {liveState.errors?.length
                ? liveState.errors.join(" · ")
                : "No API errors."}
            </p>
          </>
        ) : type === "assistant" ? (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16,
              }}
            >
              <span style={{ color: "#0f9d76", fontSize: 24 }}>✦</span>
              <h2 style={{ margin: 0 }}>AI Assistant</h2>
            </div>
            <p style={{ color: "var(--mut)", lineHeight: 1.6 }}>
              I have analyzed the current Plant Overview for {user.company}.
              {attentionPits.length === 0 ? (
                " There are currently no earth pits predicted to reach critical condition within the next 14 days. The plant is operating normally."
              ) : (
                <>
                  {" "}
                  I detected {attentionPits.length} earth pit(s) requiring
                  immediate attention:
                  <ul
                    style={{ marginTop: 10, marginBottom: 10, paddingLeft: 20 }}
                  >
                    {attentionPits.map((r) => (
                      <li key={r.p.id} style={{ marginBottom: 6 }}>
                        <strong>
                          {r.t.id} · {r.p.id}
                        </strong>
                        :
                        {r.o === 2
                          ? " Currently CRITICAL"
                          : ` Predicted to reach critical in ${Math.round(r.dC)} days`}
                        . (Driver: {r.drv?.n || "Multiple parameters"})
                      </li>
                    ))}
                  </ul>
                  Please review these escalated alarms and ensure tasks are
                  actively being worked on by your maintenance engineers.
                </>
              )}
            </p>
            <button
              className="btn primary"
              style={{ marginTop: 20 }}
              onClick={close}
            >
              Understood
            </button>
          </>
        ) : (
          <>
            <span className="lbl">Notifications</span>
            <h2>Connection & alarms</h2>
            <p>
              {liveState.errors?.length
                ? liveState.errors.join(" · ")
                : "No connection errors reported."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
