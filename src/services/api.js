import { DEFAULTS, LIVE_PIT, REMOTE_DEFAULTS } from "../data/constants";

const PROXY_ENDPOINTS = {
  LIVE: DEFAULTS.LIVE,
  STATUS: DEFAULTS.STATUS,
  PRED: DEFAULTS.PRED,
};

function resolveEndpoint(kind, configuredUrl) {
  return PROXY_ENDPOINTS[kind];
}

function withPit(url) {
  if (!url) return url;

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}earth_pit_id=${encodeURIComponent(LIVE_PIT)}&eartth_pit_id=${encodeURIComponent(LIVE_PIT)}&_ts=${Date.now()}`;
}

import { MOCK_API_RESPONSE } from "../data/mockData";

async function getJson(url) {
  const fullUrl = withPit(url);

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12000);

  try {
    const finalUrl = import.meta.env.PROD && fullUrl.startsWith("http")
      ? `https://api.allorigins.win/raw?url=${encodeURIComponent(fullUrl)}`
      : fullUrl;
    const response = await fetch(finalUrl, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    if (finalUrl.includes("EP-01")) {
      console.warn("API failed, falling back to dummy data for EP-01", err);
      if (finalUrl.includes("data")) {
        return {
          latest_sensor_reading: MOCK_API_RESPONSE.latest_sensor_reading,
        };
      }
      return MOCK_API_RESPONSE;
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

const pick = (object, ...keys) => {
  for (const key of keys) {
    if (
      object?.[key] !== undefined &&
      object?.[key] !== null &&
      object?.[key] !== ""
    ) {
      return object[key];
    }
  }

  return null;
};

export const normalizeReading = (raw) => {
  const source = raw?.latest_sensor_reading || raw?.data || raw;
  if (!source) return null;

  const values = {
    Earth_Resistance_Ohm: pick(
      source,
      "Earth_Resistance_ohm",
      "Earth_Resistance_Ohm",
      "Earth_Resistance",
      "earth_resistance_ohm",
    ),
    Leakage_Current_mA: pick(
      source,
      "Earth_Leakage_Current_mA",
      "Leakage_Current_mA",
      "Leakage_Current",
      "leakage_current_mA",
    ),
    Soil_Moisture_Percent: pick(
      source,
      "Soil_Moisture_Relative_pct",
      "Soil_Moisture_Percent",
      "Soil_Moisture",
      "soil_moisture_percent",
    ),
    Soil_Temperature_C: pick(
      source,
      "Soil_Temperature_C",
      "Soil_Temperature",
      "soil_temperature_c",
    ),
    Soil_Resistivity_Ohm_m: pick(
      source,
      "Soil_Resistivity_ohm_m",
      "Soil_Resistivity_Ohm_m",
      "Soil_Resistivity",
      "soil_resistivity_ohm_m",
    ),
    anomaly_score: pick(source, "anomaly_score", "Anomaly_Score"),
  };

  if (Object.values(values).every((value) => value == null)) {
    return null;
  }

  return {
    timestamp: source.timestamp ?? source.Timestamp ?? new Date().toISOString(),
    sequence: source.sequence ?? source.Sequence ?? null,
    ...Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        value == null ? null : Number(value),
      ]),
    ),
  };
};

export const normalizeForecast = (raw) => {
  let predictions =
    raw?.prediction?.future_predictions ||
    raw?.future_predictions ||
    raw?.forecast ||
    raw?.data?.future_predictions ||
    [];

  if (!predictions.length && raw?.predictions) {
    predictions = Array.isArray(raw.predictions)
      ? raw.predictions
      : (raw.predictions[LIVE_PIT] || Object.values(raw.predictions)[0])
          ?.future_predictions || [];
  }

  if (Array.isArray(predictions) && predictions.length) {
    return predictions.map(normalizeReading).filter(Boolean);
  }

  const nextExpected = raw?.prediction?.next_expected;

  return nextExpected
    ? [
        normalizeReading({
          ...nextExpected,
          timestamp: raw.prediction.generated_at || raw.generated_at,
        }),
      ].filter(Boolean)
    : [];
};

export async function loadLiveState(config = DEFAULTS) {
  const endpoints = {
    LIVE: resolveEndpoint("LIVE", config.LIVE),
    STATUS: resolveEndpoint("STATUS", config.STATUS),
    PRED: resolveEndpoint("PRED", config.PRED),
  };

  const [live, status, prediction, history] = await Promise.allSettled([
    getJson(endpoints.LIVE),
    getJson(endpoints.STATUS),
    getJson(endpoints.PRED),
    config.HISTORY ? getJson(config.HISTORY) : Promise.resolve(null),
  ]);

  const errors = [];
  const liveValue =
    live.status === "fulfilled" ? normalizeReading(live.value) : null;

  if (live.status !== "fulfilled") {
    errors.push(`Live data: ${live.reason?.message || "request failed"}`);
  } else if (!liveValue) {
    errors.push("Live data: response format not recognised");
  }

  const statusValue = status.status === "fulfilled" ? status.value : null;
  if (status.status !== "fulfilled") {
    errors.push(`Status: ${status.reason?.message || "request failed"}`);
  }

  const predictionValue =
    prediction.status === "fulfilled" ? prediction.value : null;
  if (prediction.status !== "fulfilled") {
    errors.push(
      `Prediction: ${prediction.reason?.message || "request failed"}`,
    );
  }

  let historyValue = [];

  if (config.HISTORY) {
    if (history.status === "fulfilled") {
      historyValue = (history.value?.readings || history.value?.history || [])
        .map(normalizeReading)
        .filter(Boolean);
    } else {
      errors.push(`History: ${history.reason?.message || "request failed"}`);
    }
  }

  return {
    live: liveValue,
    status: statusValue,
    pred: predictionValue,
    history: historyValue,
    errors,
    connected: Boolean(liveValue),
    partial: errors.length > 0 && Boolean(liveValue),
  };
}
