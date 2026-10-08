import React from "react";

import { PARAMS, STATES } from "../data/constants";
import { format } from "../utils/engine";

export function Empty({ title, message, ok = false }) {
  return (
    <div className="empty">
      <div className="ring">{ok ? "✓" : "⌖"}</div>
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}

export function Kpi({ label, value, color, action }) {
  return (
    <div
      className={`card kpi ${action ? "click" : ""}`}
      onClick={action}
      role={action ? "button" : undefined}
      tabIndex={action ? 0 : undefined}
      onKeyDown={(event) => {
        if (action && (event.key === "Enter" || event.key === " ")) {
          action();
        }
      }}
    >
      <span className="lbl">{label}</span>
      <div className="v" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="sh">
      <div>
        {eyebrow && <span className="lbl">{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="sh-actions">{actions}</div>}
    </div>
  );
}

export function Pill({ state, label }) {
  const safeState = Math.max(0, Math.min(2, Number(state) || 0));

  return (
    <span className={`pill s${safeState}`}>
      {label || STATES[safeState].toUpperCase()}
    </span>
  );
}

export function ParameterCards({ data, parameters }) {
  if (!data?.live) return null;

  return (
    <div className="param-grid">
      {(parameters || PARAMS).map((parameter) => (
        <div className="card" key={parameter.k}>
          <span className="lbl">{parameter.n}</span>
          <strong>
            {format(data.live[parameter.k])} {parameter.u}
          </strong>
        </div>
      ))}
    </div>
  );
}
