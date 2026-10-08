import {
  AREAS,
  COMPANIES,
  ENGS,
  PARAMS,
  PNAME,
  STATES,
  WEIGHTS,
} from "../data/constants";

/* ─── Basic state / health ────────────────────────────────────────────── */

export const state = (parameter, value) => {
  const numericValue = Number(value);

  if (value == null || Number.isNaN(numericValue)) return 0;

  if (parameter.k === "Leakage_Current_mA" && numericValue <= 0.01) return 0;

  if (parameter.dir === "high") {
    return numericValue >= parameter.c
      ? 2
      : numericValue >= parameter.w
        ? 1
        : 0;
  }

  return numericValue <= parameter.c ? 2 : numericValue <= parameter.w ? 1 : 0;
};

export const health = (reading) => {
  if (!reading) return 0;

  const penalty = PARAMS.reduce((total, parameter, index) => {
    const severity = state(parameter, reading[parameter.k]);
    if (severity === 2) return total + WEIGHTS[index] * 0.65;
    if (severity === 1) return total + WEIGHTS[index] * 0.25;
    return total;
  }, 0);

  return Math.max(0, Math.round(100 - penalty));
};

export const overall = (reading) => {
  if (!reading) return 0;
  return Math.max(
    ...PARAMS.map((parameter) => state(parameter, reading[parameter.k])),
  );
};

export const thresholdRange = (p) => {
  if (p.dir === "high") {
    return `Normal < ${p.w} ${p.u} · Warning ${p.w}–< ${p.c} ${p.u} · Critical ≥ ${p.c} ${p.u}`;
  }
  return `Normal > ${p.w} ${p.u} · Warning ${p.c}–${p.w} ${p.u} · Critical ≤ ${p.c} ${p.u}`;
};

/* ─── Utility ────────────────────────────────────────────────────────── */

export const hash = (value) => {
  let hashValue = 2166136261;
  for (const character of value) {
    hashValue ^= character.charCodeAt(0);
    hashValue = Math.imul(hashValue, 16777619);
  }
  return hashValue >>> 0;
};

export const rng = (seed) => {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let temporary = Math.imul(value ^ (value >>> 15), 1 | value);
    temporary =
      (temporary + Math.imul(temporary ^ (temporary >>> 7), 61 | temporary)) ^
      temporary;
    return ((temporary ^ (temporary >>> 14)) >>> 0) / 4294967296;
  };
};

export const minBy = (arr, key) =>
  arr.reduce(
    (best, item) =>
      item[key] != null && (best == null || item[key] < best[key])
        ? item
        : best,
    null,
  );

/* ─── ETA: days to warning / critical (linear regression on forecast) ── */
export const eta = (p, d, STEP_DAYS = 1) => {
  const cur = d.live?.[p.k];
  const fc = (d.fc || []).map((x) => x[p.k]).filter(Number.isFinite);

  if (cur == null) return { dW: null, dC: null };

  let sl = 0;
  if (fc.length > 1) {
    const n = fc.length;
    const mx = (n - 1) / 2;
    const my = fc.reduce((a, b) => a + b, 0) / n;
    let nu = 0,
      de = 0;
    fc.forEach((y, i) => {
      nu += (i - mx) * (y - my);
      de += (i - mx) ** 2;
    });
    sl = nu / de;
  }

  const dir = p.dir === "high" ? 1 : -1;
  const go = (threshold) => {
    // 1. Direct breach check: See if any forecast point explicitly crosses the threshold
    const breachIndex = fc.findIndex((v) => dir * (v - threshold) >= 0);
    if (breachIndex !== -1) {
      return (breachIndex + 1) * STEP_DAYS;
    }

    // 2. Linear regression extrapolation (if no direct breach in the forecast window)
    const gap = dir * (threshold - cur);
    if (gap <= 0) return 0;
    const sp = dir * sl;
    return sp > 1e-9 ? (gap / sp) * STEP_DAYS : null;
  };

  return { dW: go(p.w), dC: go(p.c), sl };
};

/* ─── Per-parameter forecast summary ────────────────────────────────── */
export const summary = (p, d, STEP_DAYS = 1) => {
  const cur = d.live?.[p.k];
  const fc = (d.fc || [])
    .map((x) => x[p.k])
    .filter((v) => v != null && !Number.isNaN(v));

  if (cur == null || !fc.length) return null;

  const cs = state(p, cur);
  const ss = fc.map((v) => state(p, v));
  const worst = Math.max(...ss);
  const end = fc.at(-1);
  const pct = ((end - cur) / Math.abs(cur || 1)) * 100;
  const e = eta(p, d, STEP_DAYS);
  const fi = ss.findIndex((s) => s > cs);
  const dw = Math.abs(pct) < 1 ? "holds steady" : pct > 0 ? "rises" : "falls";
  const pc = Math.abs(pct).toFixed(1) + "%";

  const direction =
    p.dir === "high"
      ? end > cur
        ? "upward"
        : "downward"
      : end < cur
        ? "downward"
        : "upward";

  const why =
    worst === 2
      ? p.cause
      : worst === 1
        ? `The trend is approaching the ${STATES[worst].toLowerCase()} threshold of ${p.w} ${p.u}. ${p.cause}`
        : "The forecast remains within the normal operating range, so there is no immediate threshold risk.";

  const action =
    worst === 2
      ? `Priority action: ${p.check}`
      : worst === 1
        ? `Recommended action: ${p.check}`
        : "Continue monitoring and compare the next readings with this forecast.";

  return {
    cur,
    end,
    cs,
    worst,
    fi,
    pct,
    dw,
    pc,
    direction,
    change: Math.abs(end - cur).toFixed(2),
    why,
    action,
    ...e,
  };
};

/* ─── Anomaly detection score 0–1 ───────────────────────────────────── */
export const anomalyScore = (d) => {
  if (!d?.live) return 0;
  let score = 0;
  const weights = [0.3, 0.25, 0.15, 0.15, 0.15];
  const warnWeights = [0.12, 0.1, 0.06, 0.06, 0.06];
  PARAMS.forEach((p, i) => {
    const st = state(p, d.live[p.k]);
    score += st === 2 ? weights[i] : st === 1 ? warnWeights[i] : 0;
  });
  return Math.min(1, +score.toFixed(2));
};

/* ─── Health reasoning text ─────────────────────────────────────────── */
export const healthReason = (d) => {
  if (!d?.live) return "No current reading is available.";
  const h = health(d.live);
  const ranked = PARAMS.map((p) => ({
    p,
    s: state(p, d.live[p.k]),
    v: d.live[p.k],
  }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  if (!ranked.length)
    return "All five monitored parameters are currently inside their normal bands.";

  const x = ranked[0];
  return `${x.p.n} is the main reason for the ${h}/100 health score (${format(x.v)} ${x.p.u}). ${x.p.cause}`;
};

/* ─── Per-parameter forecast narrative ──────────────────────────────── */
export const forecastNarrative = (p, d, STEP_DAYS = 1) => {
  const s = summary(p, d, STEP_DAYS);
  if (!s)
    return "More readings are required before the forecast can be explained confidently.";

  const stateNow = STATES[s.cs];
  const trend =
    s.direction === "upward"
      ? "moving upward"
      : s.direction === "downward"
        ? "moving downward"
        : "remaining broadly stable";
  const timing =
    s.dC != null
      ? s.dC === 0
        ? "the critical limit has already been breached (Sudden Onset Anomaly)"
        : `the critical limit is estimated in ${fd(s.dC)}`
      : s.dW != null
        ? `the warning limit is estimated in ${fd(s.dW)}`
        : "no threshold crossing is expected in the current forecast window";

  const urgency =
    s.worst === 2
      ? s.dC === 0
        ? "This requires immediate escalation. The ML model detected a sudden spike bypassing the 14-day early warning window, strongly indicating acute physical damage, severed bonding, or severe environmental disruption rather than gradual degradation."
        : "This requires priority attention because the forecast is in the critical band."
      : s.worst === 1
        ? "This is an early warning condition; maintenance should be planned before the limit is reached."
        : "The outlook is currently within the normal operating range.";

  return `Current: ${p.n} is ${stateNow} at ${format(s.cur)} ${p.u}. Trend is ${trend}, forecast reaching ~${format(s.end)} ${p.u}. ${timing.charAt(0).toUpperCase() + timing.slice(1)}. ${urgency} Why: ${s.why} Action: ${s.action}`;
};

/* ─── Overall multi-parameter narrative ─────────────────────────────── */
export const overallForecastNarrative = (sums, d) => {
  const valid = sums.map((x, i) => x && { ...x, p: PARAMS[i] }).filter(Boolean);

  if (!valid.length)
    return "Insufficient data: Further readings are required before the overall forecast can be confidently articulated.";

  const rank = [...valid].sort(
    (a, b) => b.worst - a.worst || (a.dC ?? 999) - (b.dC ?? 999),
  );
  const critical = valid.filter((x) => x.worst === 2);
  const warning = valid.filter((x) => x.worst === 1);
  const normal = valid.filter((x) => x.worst === 0);
  const worsening = valid.filter(
    (x) =>
      (x.direction === "upward" && x.p.dir === "high") ||
      (x.direction === "downward" && x.p.dir === "low"),
  );
  const improving = valid.filter(
    (x) =>
      (x.direction === "downward" && x.p.dir === "high") ||
      (x.direction === "upward" && x.p.dir === "low"),
  );

  const lead = rank[0];
  const overallStatus =
    lead.worst === 2 ? "CRITICAL" : lead.worst === 1 ? "WARNING" : "NORMAL";
  const names = (a) => a.map((x) => x.p.n).join(", ");

  let text = `System Assessment: The overall forecast status is ${overallStatus}. EarthSense evaluates all ${valid.length} monitored parameters in conjunction to formulate this prognosis. `;

  if (critical.length) {
    text += `Critical Parameters: Immediate intervention is required for ${names(critical)}, which are projected to enter the critical operating range. `;
  } else if (warning.length) {
    text += `Elevated Risk: While no immediate critical failures are forecast, ${names(warning)} are demonstrating trends toward their respective warning thresholds and warrant close observation. `;
  } else {
    text += `Normal Operation: All monitored parameters are projected to remain within their designated safe operating limits. `;
  }

  if (worsening.length) text += `Deteriorating Trends: ${names(worsening)}. `;
  if (improving.length) text += `Improving Trends: ${names(improving)}. `;
  if (normal.length)
    text += `Stable Parameters (${normal.length}): ${names(normal)}. `;

  const times = valid.filter((x) => x.dC != null).sort((a, b) => a.dC - b.dC);
  if (times.length)
    text += `Threshold Proximity: The earliest projected threshold breach is anticipated for ${times[0].p.n} in approximately ${fd(times[0].dC)}. `;

  text +=
    "Recommendation: Utilize this forecast as a predictive decision support tool. It is advised to investigate the primary driving parameters and subsequently verify system stability following any corrective maintenance.";
  return text;
};

/* ─── Fleet builders ─────────────────────────────────────────────────── */

/**
 * Exact original fleet rule:
 * 30 transformers distributed across 3 companies in order.
 * Apex = 3 pits/transformer, Nova = 4, Kaveri = 5.
 * Engineers assigned round-robin (5 engineers → 24 pits each).
 * Result: 30 transformers and exactly 120 earth pits.
 */
export const buildTransformers = () => {
  let earthPitNumber = 0;

  return Array.from({ length: 120 }, (_, index) => {
    const transformerNumber = index + 1;
    const id = `TR-${String(transformerNumber).padStart(3, "0")}`;
    const company = COMPANIES[index % COMPANIES.length];
    const pitCount =
      company.id === "ES-C01" ? 3 : company.id === "ES-C02" ? 4 : 5;

    const latitude = 11.0168 + (index % 6) * 0.0012;
    const longitude = 76.9558 + Math.floor(index / 6) * 0.0014;

    const companyEngs = ENGS.filter((e) => e.companyId === company.id);

    return {
      id,
      company,
      area: AREAS[index % AREAS.length],
      sector: [
        "North-East Grid",
        "South Grid",
        "Furnace & Utilities",
        "Assembly & Packing",
      ][index % 4],
      lat: latitude,
      lng: longitude,
      eng: companyEngs[Math.floor(index / COMPANIES.length) % companyEngs.length],
      pits: Array.from({ length: pitCount }, (_, pitIndex) => {
        earthPitNumber += 1;
        return {
          id: `EP-${String(earthPitNumber).padStart(2, "0")}`,
          loc: PNAME[pitIndex],
          lat: latitude + pitIndex * 0.0002,
          lng: longitude + pitIndex * 0.0002,
        };
      }),
    };
  });
};

export const format = (value, decimals = 2) => {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return Number(value).toFixed(decimals);
};

export const fd = (days) => {
  if (days == null) return "Not expected";
  if (days <= 0) return "Reached";
  if (days < 1) return "< 1 day";
  if (days > 365) return "> 1 year";
  const rounded = Math.round(days);
  return `${rounded} ${rounded === 1 ? "day" : "days"}`;
};

export const age = (task) => {
  const end = task.completedAt ? new Date(task.completedAt) : Date.now();
  return Math.floor((end - new Date(task.created)) / 864e5);
};

export const isLate = (task) => {
  if (task.status === "completed" || task.status === "verified") return false;

  // If no progress has been made (still just "assigned") and it's past due (3 days)
  if (task.status === "assigned" && task.due) {
    return new Date(`${task.due}T23:59:59`) < Date.now();
  }

  // If it's already in progress, give it standard overdue check
  if (task.due) return new Date(`${task.due}T23:59:59`) < Date.now();
  return age(task) > 2;
};

export function generateData(id, baseValues, tick = 0) {
  const random = rng(hash(`${id}:${tick}`));
  const history = [];
  const forecast = [];
  const defaults = baseValues || [1.3, 12, 46, 27, 45];
  const severity = [0.1, 0.2, 0.75, 1.15, 1.18, 1.21, 1.24][hash(id) % 7];

  const targets = PARAMS.map((parameter, index) => {
    const base = defaults[index] * (0.9 + random() * 0.2);
    const end =
      parameter.dir === "high"
        ? base + (parameter.c - base) * severity
        : base - (base - parameter.c) * severity;
    return [base, end];
  });

  for (let offset = -59; offset <= 20; offset += 1) {
    const reading = {
      timestamp: new Date(Date.now() + offset * 864e5).toISOString(),
      sequence: 100 + offset,
    };

    PARAMS.forEach((parameter, index) => {
      const [base, end] = targets[index];
      const progress = (offset + 60) / 80;
      const noise =
        offset <= 0
          ? (random() - 0.5) * (Math.abs(end - base) * 0.06 + base * 0.01)
          : 0;
      reading[parameter.k] = base + (end - base) * progress + noise;
    });

    if (offset <= 0) {
      history.push(reading);
    } else {
      forecast.push(reading);
    }
  }

  return { history, fc: forecast };
}

export const buildFleet = (transformers, getData) =>
  transformers.flatMap((transformer) =>
    transformer.pits.map((pit) => {
      const data = getData(pit.id);
      const latest = data.history.at(-1);
      const overallState = overall(latest);
      const healthScore = health(latest);
      const forecast = data.fc || [];
      const predictedWorst = Math.max(
        overallState,
        ...forecast.map((reading) => overall(reading)),
      );
      const driver = PARAMS.map((parameter) => ({
        parameter,
        severity: state(parameter, latest?.[parameter.k]),
      })).sort((a, b) => b.severity - a.severity)[0];

      // ETA for each parameter
      const etaResults = PARAMS.map((p) => ({
        p,
        ...eta(p, { live: latest, fc: forecast }),
      }));
      const minDC = minBy(etaResults, "dC");
      const minDW = minBy(etaResults, "dW");

      return {
        t: transformer,
        p: pit,
        d: { ...data, live: latest },
        l: latest,
        h: healthScore,
        o: predictedWorst,
        pw: predictedWorst,
        dC: minDC?.dC ?? null,
        dW: predictedWorst >= 1 ? 0 : (minDW?.dW ?? null),
        drv: driver?.severity ? driver.parameter : null,
        dev: false,
      };
    }),
  );
