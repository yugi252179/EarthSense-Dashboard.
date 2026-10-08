import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  DEFAULTS,
  ENGS,
  LIVE_PIT,
  LIVE_TR,
  PARAMS,
  PASS,
  SEV_AUTO,
  USERS,
} from "../data/constants";
import {
  buildFleet,
  buildTransformers,
  eta,
  generateData,
  minBy,
  overall,
  state,
} from "../utils/engine";
import { loadLiveState, normalizeForecast } from "../services/api";

const Context = createContext(null);
const TRANSFORMERS = buildTransformers();

function readJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function getInitialConfig() {
  const saved = readJSON("es_cfg3", {});
  return { ...DEFAULTS, ...saved, REFRESH: 10000 };
}

/* ─── Task seed: create initial realistic tasks from fleet state ──── */
function seedTasks(fleet) {
  const critical = fleet.filter((r) => r.o === 2).slice(0, 4);
  return critical.map((r, i) => ({
    id: `TASK-${1000 + i}`,
    tr: r.t.id,
    pit: r.p.id,
    type: "Corrective action",
    title: `Investigate ${(r.drv?.n || "earth pit").toLowerCase()} on ${r.p.id}`,
    prio: "High",
    eng: r.t.eng.name,
    engId: r.t.eng.id,
    due: new Date(Date.now() + [2, 1, -1, 2][i] * 864e5)
      .toISOString()
      .slice(0, 10),
    status: ["assigned", "in_progress", "pending_verification", "assigned"][i],
    autoAssigned: false,
    note:
      i === 2
        ? "Re-terminated clamp and re-tested. Ready for verification."
        : "",
    by: "Suresh Iyer",
    byId: "SO-101",
    created: new Date(Date.now() - [5, 1, 3, 0.2][i] * 864e5).toISOString(),
    completedAt:
      i === 2 ? new Date(Date.now() - 14 * 3600000).toISOString() : null,
    verificationStatus: null,
    verificationNote: "",
    verifiedAt: null,
    verifiedBy: null,
    reworkReason: "",
    pitNormalSince:
      i === 2 ? new Date(Date.now() - 14 * 3600000).toISOString() : null,
  }));
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => readJSON("es_user3", null));
  const [pageState, setPageState] = useState(
    () => sessionStorage.getItem("es_page") || "dashboard",
  );
  const setPage = useCallback((p) => {
    sessionStorage.setItem("es_page", p);
    setPageState(p);
  }, []);
  const page = pageState;
  const [trState, setTrState] = useState(
    () => sessionStorage.getItem("es_tr") || "",
  );
  const setTransformerId = useCallback((id) => {
    sessionStorage.setItem("es_tr", id);
    setTrState(id);
  }, []);
  const transformerId = trState;

  const [pitState, setPitState] = useState(
    () => sessionStorage.getItem("es_pit") || "",
  );
  const setPitId = useCallback((id) => {
    sessionStorage.setItem("es_pit", id);
    setPitState(id);
  }, []);
  const pitId = pitState;
  const [config, setConfig] = useState(getInitialConfig);
  const [liveState, setLiveState] = useState({
    live: null,
    status: null,
    pred: null,
    history: [],
    errors: [],
    connected: false,
    partial: false,
  });
  const [open, setOpen] = useState(new Set());
  const [acknowledged, setAcknowledged] = useState(new Set());
  const [taskFilter, setTaskFilter] = useState("all");
  const [alarmFilter, setAlarmFilter] = useState("all");
  const [tab, setTab] = useState("all");
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(null);
  const [companyTab, setCompanyTab] = useState("overview");
  const [demoTick, setDemoTick] = useState(0);
  const [tasks, setTasks] = useState(() => readJSON("es_tasks_v5", null));

  /* ─── Auth ──────────────────────────────────────────────────────── */
  const login = useCallback((email, password) => {
    const normalizedEmail = email?.trim().toLowerCase();
    const account = USERS[normalizedEmail];
    if (!account || password !== PASS) {
      setToast("Invalid email or password");
      return false;
    }
    const nextUser = { ...account, email: normalizedEmail };
    localStorage.setItem("es_user3", JSON.stringify(nextUser));
    setUser(nextUser);
    setPage("dashboard");
    return true;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("es_user3");
    setUser(null);
    setTransformerId("");
    setPitId("");
  }, []);

  /* ─── Live data refresh ─────────────────────────────────────────── */
  const refresh = useCallback(async () => {
    if (transformerId !== LIVE_TR || pitId !== LIVE_PIT) {
      setDemoTick((v) => v + 1);
      return;
    }
    const next = await loadLiveState(config);
    setLiveState((previous) => {
      // If the API provided history, use it. Otherwise, accumulate locally.
      let baseHistory =
        next.history && next.history.length > 0
          ? next.history
          : previous.history || [];

      // Prevent duplicate appending if the live reading is already the last item in history
      const lastHist = baseHistory[baseHistory.length - 1];
      const newLive = next.live;
      const isDuplicate =
        lastHist && newLive && lastHist.timestamp === newLive.timestamp;

      return {
        ...next,
        history: [
          ...baseHistory,
          ...(newLive && !isDuplicate ? [newLive] : []),
        ].slice(-240),
      };
    });
  }, [config, transformerId, pitId]);

  useEffect(() => {
    if (!user) return;
    refresh();
  }, [user, refresh]);

  useEffect(() => {
    if (!user) return undefined;
    const interval = window.setInterval(() => {
      refresh();
      setDemoTick((v) => v + 1);
    }, config.REFRESH || 10000);
    return () => window.clearInterval(interval);
  }, [user, refresh, config.REFRESH]);

  /* ─── Asset selection ────────────────────────────────────────────── */
  const selectTransformer = useCallback((id) => {
    setTransformerId(id);
    const transformer = TRANSFORMERS.find((item) => item.id === id);
    setPitId(transformer?.pits[0]?.id || "");
  }, []);

  const selectPit = useCallback((id) => setPitId(id), []);

  const openPit = useCallback((id, selectedPit) => {
    setTransformerId(id);
    setPitId(selectedPit);
    setPage("pit");
  }, []);

  /* ─── Data retrieval ────────────────────────────────────────────── */
  const getData = useCallback(
    (selectedPit) => {
      if (selectedPit === LIVE_PIT && liveState.live) {
        let fc = normalizeForecast(liveState.pred);
        if (!fc || fc.length === 0) {
          const l = liveState.live;
          const liveVals = [
            l.Earth_Resistance_Ohm,
            l.Leakage_Current_mA,
            l.Soil_Moisture_Percent,
            l.Soil_Temperature_C,
            l.Soil_Resistivity_Ohm_m,
          ];
          const demoFallback = generateData(selectedPit, liveVals, demoTick);
          fc = demoFallback.fc;
        }

        return {
          history: liveState.history || [],
          fc,
          live: liveState.live,
          status: liveState.status,
          demo: false,
        };
      }
      const demo = generateData(selectedPit, undefined, demoTick);
      const latestDemoReading = demo.history.at(-1) || null;
      return {
        ...demo,
        hist: demo.history,
        live: latestDemoReading,
        demo: true,
        status: { model_status: "SIMULATED", prediction_ready: true },
      };
    },
    [transformerId, liveState, demoTick],
  );

  const fleet = useMemo(() => buildFleet(TRANSFORMERS, getData), [getData]);
  const selected = useMemo(
    () => (pitId ? getData(pitId) : null),
    [pitId, getData],
  );

  /* ─── Tasks: init and auto-assign ──────────────────────────────── */
  useEffect(() => {
    if (!fleet.length) return;
    if (tasks !== null) return; // already loaded from storage or set
    // seed initial tasks from first fleet build
    const seeded = seedTasks(fleet);
    setTasks(seeded);
  }, [fleet, tasks]);

  const saveTasks = useCallback((nextTasks) => {
    setTasks(nextTasks);
    try {
      localStorage.setItem("es_tasks_v5", JSON.stringify(nextTasks));
    } catch {}
  }, []);

  /* Auto-assign: called when fleet updates. Creates tasks for pits
     predicted to go critical within SEV_AUTO days and no active task. */
  const autoAssignTasks = useCallback(
    (fleetData, currentTasks) => {
      if (!currentTasks) return;
      const activePitIds = new Set(
        currentTasks
          .filter((t) =>
            ["assigned", "in_progress", "pending_verification"].includes(
              t.status,
            ),
          )
          .map((t) => t.pit),
      );

      const newTasks = [];
      fleetData.forEach((row) => {
        if (activePitIds.has(row.p.id)) return;
        if (row.dC == null || row.dC > SEV_AUTO) return;

        const eng = row.t.eng;
        newTasks.push({
          id: `AUTO-${row.p.id}-${Date.now()}`,
          tr: row.t.id,
          pit: row.p.id,
          type: "Corrective action",
          title: `Auto-assigned: ${row.drv?.n || "Earth pit condition"} — ${row.p.id} predicted critical in ${Math.ceil(row.dC)} day${Math.ceil(row.dC) === 1 ? "" : "s"}`,
          prio: row.o === 2 ? "High" : "Medium",
          eng: eng.name,
          engId: eng.id,
          due: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10),
          status: "assigned",
          autoAssigned: true,
          note: "",
          by: "EarthSense System",
          byId: "SYS-001",
          created: new Date().toISOString(),
          completedAt: null,
          verificationStatus: null,
          verificationNote: "",
          verifiedAt: null,
          verifiedBy: null,
          reworkReason: "",
          pitNormalSince: null,
        });
      });

      if (newTasks.length > 0) {
        saveTasks([...currentTasks, ...newTasks]);
      }
    },
    [saveTasks],
  );

  /* Run auto-assign once fleet and tasks are ready */
  useEffect(() => {
    if (fleet.length && tasks !== null) {
      autoAssignTasks(fleet, tasks);
    }
  }, [fleet]); // intentionally only on fleet change to avoid loops

  /* Auto-verify tasks if pit is healthy for >12h */
  useEffect(() => {
    if (fleet.length && tasks !== null) {
      let changed = false;
      const nextTasks = tasks.map((t) => {
        if (t.status === "pending_verification") {
          const pit = fleet.find((r) => r.p.id === t.pit);
          if (pit) {
            const hrs = (Date.now() - new Date(t.completedAt).getTime()) / 3600000;
            if (hrs >= 12) {
              changed = true;
              if (pit.o === 0) {
                return {
                  ...t,
                  status: "verified",
                  verificationNote:
                    "Auto-verified: System confirmed pit remained healthy for 12 hours.",
                  verifiedAt: new Date().toISOString(),
                  verifiedBy: "System (Auto-verify)",
                };
              } else {
                return {
                  ...t,
                  status: "rework",
                  title: t.title.startsWith("[Rework]")
                    ? t.title
                    : `[Rework] ${t.title}`,
                  reworkReason: `Auto-rework: System detected pit is still in ${
                    pit.o === 2 ? "CRITICAL" : "WARNING"
                  } state after 12 hours.`,
                };
              }
            }
          }
        }
        return t;
      });
      if (changed) saveTasks(nextTasks);
    }
  }, [fleet]);

  /* ─── Task actions ──────────────────────────────────────────────── */

  /** Manually create a task (Safety Officer) */
  const createTask = useCallback(
    (taskData) => {
      const newTask = {
        id: `TASK-${Date.now()}`,
        status: "assigned",
        autoAssigned: false,
        note: "",
        completedAt: null,
        verificationStatus: null,
        verificationNote: "",
        verifiedAt: null,
        verifiedBy: null,
        reworkReason: "",
        pitNormalSince: null,
        created: new Date().toISOString(),
        ...taskData,
      };
      saveTasks([...(tasks || []), newTask]);
      return newTask;
    },
    [tasks, saveTasks],
  );

  /** Maintenance: start work */
  const startTask = useCallback(
    (id) => {
      saveTasks(
        (tasks || []).map((t) =>
          t.id === id ? { ...t, status: "in_progress" } : t,
        ),
      );
    },
    [tasks, saveTasks],
  );

  /** Maintenance: mark work complete (sends to Safety for verification, or auto-verifies if normal) */
  const completeTask = useCallback(
    (id, note) => {
      saveTasks(
        (tasks || []).map((t) => {
          if (t.id !== id) return t;
          const pitRow = fleet.find((r) => r.p.id === t.pit);
          const isNormal = pitRow && pitRow.o === 0;

          if (isNormal) {
            return {
              ...t,
              status: "verified",
              verificationStatus: "verified",
              verificationNote:
                "System auto-verified: Pit readings returned to normal.",
              verifiedAt: new Date().toISOString(),
              verifiedBy: "System",
              note,
              completedAt: new Date().toISOString(),
              pitNormalSince: new Date().toISOString(),
            };
          } else {
            return {
              ...t,
              status: "pending_verification",
              note,
              completedAt: new Date().toISOString(),
              pitNormalSince: null,
            };
          }
        }),
      );
    },
    [tasks, saveTasks, fleet],
  );

  /** Safety Officer: mark task verified (completed) */
  const verifyTask = useCallback(
    (id, verifierName, verifierId, verificationNote) => {
      saveTasks(
        (tasks || []).map((t) =>
          t.id === id
            ? {
                ...t,
                status: "verified",
                verificationStatus: "verified",
                verificationNote,
                verifiedAt: new Date().toISOString(),
                verifiedBy: verifierName,
              }
            : t,
        ),
      );
    },
    [tasks, saveTasks],
  );

  /** Safety Officer: request rework with reason */
  const requestRework = useCallback(
    (id, reworkReason) => {
      saveTasks(
        (tasks || []).map((t) =>
          t.id === id
            ? {
                ...t,
                status: "rework",
                title: t.title.startsWith("[Rework]")
                  ? t.title
                  : `[Rework] ${t.title}`,
                reworkReason,
                completedAt: null,
                pitNormalSince: null,
              }
            : t,
        ),
      );
    },
    [tasks, saveTasks],
  );

  /** Maintenance: acknowledge rework and re-start */
  const acknowledgeRework = useCallback(
    (id) => {
      saveTasks(
        (tasks || []).map((t) =>
          t.id === id ? { ...t, status: "in_progress", reworkReason: "" } : t,
        ),
      );
    },
    [tasks, saveTasks],
  );

  /* ─── Misc ───────────────────────────────────────────────────────── */
  const toggleOpen = useCallback((id) => {
    setOpen((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const acknowledge = useCallback((id) => {
    setAcknowledged((previous) => new Set([...previous, id]));
  }, []);

  const showToast = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }, []);

  /* ─── Context value ─────────────────────────────────────────────── */
  const contextValue = useMemo(
    () => ({
      user,
      login,
      logout,
      page,
      setPage,
      tr: transformerId,
      pit: pitId,
      TRS: TRANSFORMERS,
      selectTransformer,
      selectPit,
      openPit,
      cfg: config,
      setCfg: setConfig,
      liveState,
      refresh,
      fleet,
      selected,
      open,
      toggleOpen,
      ack: acknowledged,
      acknowledge,
      taskFilter,
      setTaskFilter,
      alarmFilter,
      setAlarmFilter,
      tab,
      setTab,
      toast,
      showToast,
      modal,
      setModal,
      companyTab,
      setCompanyTab,
      demoTick,
      role: user?.role,
      tasks: tasks || [],
      createTask,
      startTask,
      completeTask,
      verifyTask,
      requestRework,
      acknowledgeRework,
      getData,
    }),
    [
      user,
      login,
      logout,
      page,
      transformerId,
      pitId,
      selectTransformer,
      selectPit,
      openPit,
      config,
      liveState,
      refresh,
      fleet,
      selected,
      open,
      toggleOpen,
      acknowledged,
      acknowledge,
      taskFilter,
      alarmFilter,
      tab,
      toast,
      showToast,
      modal,
      companyTab,
      demoTick,
      tasks,
      createTask,
      startTask,
      completeTask,
      verifyTask,
      requestRework,
      acknowledgeRework,
      getData,
    ],
  );

  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
}

export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
