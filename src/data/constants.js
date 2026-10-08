export const REMOTE_DEFAULTS = {
  LIVE: "https://zz4fonhxsf.execute-api.us-east-1.amazonaws.com/data",
  STATUS: "https://3f2vz55km0.execute-api.us-east-1.amazonaws.com",
  PRED: "https://3f2vz55km0.execute-api.us-east-1.amazonaws.com/test",
  HISTORY: "",
  REFRESH: 10000,
  STEP_DAYS: 1,
};

export const DEFAULTS = {
  LIVE: "/api/earthsense-data",
  STATUS: "/api/earthsense-status",
  PRED: "/api/earthsense-test",
  HISTORY: "",
  REFRESH: 10000,
  STEP_DAYS: 1,
};

export const LIVE_TR = "TR-001";
export const LIVE_PIT = "EP-01";
export const SEV = 14; // early-warning horizon (days)
export const SEV_AUTO = 14; // auto-assign threshold (days to critical)
export const SLA = 2; // task SLA (days)
export const PASS = "earthsense";

export const COMPANIES = [
  {
    id: "ES-C01",
    name: "Apex Industrial Systems",
    industry: "Electrical Manufacturing",
    plants: 3,
    status: "Active",
    manager: "Meena Rao",
  },
  {
    id: "ES-C02",
    name: "Nova Process Industries",
    industry: "Automotive Components",
    plants: 2,
    status: "Active",
    manager: "Priya Nair",
  },
  {
    id: "ES-C03",
    name: "Kaveri Engineering Works",
    industry: "Heavy Engineering",
    plants: 4,
    status: "Active",
    manager: "Rahul Menon",
  },
];

export const USERS = {
  "manager@earthsense.com": {
    name: "Meena Rao",
    id: "PM-001",
    role: "manager",
    company: "Apex Industrial Systems",
    companyId: "ES-C01",
    sector: "Electrical Distribution",
  },
  "safety@earthsense.com": {
    name: "Suresh Iyer",
    id: "SO-101",
    role: "safety",
    company: "Apex Industrial Systems",
    companyId: "ES-C01",
    sector: "Plant Safety",
  },
  "arun.kumar@apexindustrial.com": {
    name: "Arun Kumar",
    id: "ME-201",
    role: "maintenance",
    company: "Apex Industrial Systems",
    companyId: "ES-C01",
    sector: "North-East Grid",
  },
  "priya.nair@apexindustrial.com": {
    name: "Priya Nair",
    id: "ME-202",
    role: "maintenance",
    company: "Apex Industrial Systems",
    companyId: "ES-C01",
    sector: "South Grid",
  },
  "rahul.menon@apexindustrial.com": {
    name: "Rahul Menon",
    id: "ME-203",
    role: "maintenance",
    company: "Apex Industrial Systems",
    companyId: "ES-C01",
    sector: "Furnace & Utilities",
  },
  "arjun.nambiar@earthsense.com": {
    name: "Arjun Nambiar",
    id: "ME-204",
    role: "maintenance",
    company: "Nova Process Industries",
    companyId: "ES-C02",
    sector: "Nova Operations",
  },
  "sindhu.pillai@earthsense.com": {
    name: "Sindhu Pillai",
    id: "ME-205",
    role: "maintenance",
    company: "Kaveri Engineering Works",
    companyId: "ES-C03",
    sector: "Kaveri Operations",
  },
  "admin@earthsense.com": {
    name: "Kiran Das",
    id: "ES-001",
    role: "admin",
    company: "EarthSense Platform",
    companyId: "EARTHSENSE",
    sector: "All companies",
  },
  "nova.officer@earthsense.com": {
    name: "Anjali Varma",
    id: "PO-201",
    role: "manager",
    company: "Nova Process Industries",
    companyId: "ES-C02",
    sector: "Plant Operations",
  },
  "nova.safety@earthsense.com": {
    name: "Vivek Shah",
    id: "SO-202",
    role: "safety",
    company: "Nova Process Industries",
    companyId: "ES-C02",
    sector: "Plant Safety",
  },
  "kaveri.officer@earthsense.com": {
    name: "Deepa Krishnan",
    id: "PO-301",
    role: "manager",
    company: "Kaveri Engineering Works",
    companyId: "ES-C03",
    sector: "Plant Operations",
  },
  "kaveri.safety@earthsense.com": {
    name: "Mohan Raj",
    id: "SO-302",
    role: "safety",
    company: "Kaveri Engineering Works",
    companyId: "ES-C03",
    sector: "Plant Safety",
  },
};

export const ROLES = {
  manager: "Plant Officer",
  safety: "Safety Officer",
  maintenance: "Maintenance Engineer",
  admin: "EarthSense Admin",
};

/* 5 engineers — round-robin across 30 TRs → exactly 24 pits each (total 120) */
export const ENGS = [
  {
    name: "Arun Kumar",
    id: "ME-201",
    sector: "North-East Grid",
    companyId: "ES-C01",
  },
  {
    name: "Priya Nair",
    id: "ME-202",
    sector: "South Grid",
    companyId: "ES-C01",
  },
  {
    name: "Rahul Menon",
    id: "ME-203",
    sector: "Furnace & Utilities",
    companyId: "ES-C01",
  },
  {
    name: "Arjun Nambiar",
    id: "ME-204",
    sector: "Nova Operations",
    companyId: "ES-C02",
  },
  {
    name: "Sindhu Pillai",
    id: "ME-205",
    sector: "Kaveri Operations",
    companyId: "ES-C03",
  },
];

export const PARAMS = [
  {
    k: "Earth_Resistance_Ohm",
    n: "Earth Resistance",
    u: "Ω",
    dir: "high",
    w: 2,
    c: 4,
    cause:
      "Electrode corrosion, loose or corroded termination, or dry soil around the electrode.",
    check:
      "Measure electrode resistance, inspect conductor continuity and clamp tightness.",
  },
  {
    k: "Leakage_Current_mA",
    n: "Leakage Current",
    u: "mA",
    dir: "high",
    w: 50,
    c: 90,
    cause:
      "Insulation degradation in connected equipment, bonding fault or moisture ingress.",
    check:
      "Isolate feeders one at a time, verify bonding and insulation resistance.",
  },
  {
    k: "Soil_Moisture_Percent",
    n: "Soil Moisture",
    u: "%",
    dir: "low",
    w: 25,
    c: 15,
    cause:
      "Dry season, poor pit watering or fast drainage, which raises resistance.",
    check:
      "Water the pit, inspect the moisture-retaining backfill and drainage.",
  },
  {
    k: "Soil_Temperature_C",
    n: "Soil Temperature",
    u: "°C",
    dir: "high",
    w: 40,
    c: 50,
    cause:
      "Fault-current heating, poor contact heating or strong solar loading.",
    check: "Thermal-scan terminations and review recent fault events.",
  },
  {
    k: "Soil_Resistivity_Ohm_m",
    n: "Soil Resistivity",
    u: "Ω·m",
    dir: "high",
    w: 100,
    c: 150,
    cause:
      "Soil drying or depletion of treatment compound around the electrode.",
    check: "Re-test resistivity and renew the earthing compound if needed.",
  },
];

export const WEIGHTS = [25, 20, 15, 20, 20];
export const STATES = ["normal", "warning", "critical"];

export const AREAS = [
  "Main Distribution Yard",
  "Substation Block B",
  "Furnace Bay",
  "Utility Block",
  "Compressor House",
  "Assembly Line 1",
  "Assembly Line 2",
  "Packing Unit",
  "Boiler House",
  "Water Treatment",
];

export const PNAME = [
  "North-East Grid",
  "South Grid",
  "Neutral Grid",
  "Body Earth",
  "Lightning Earth",
];

export const NAV = {
  manager: [
    ["dashboard", "Plant Overview"],
    ["fleet", "Assets & Earth Pits"],
    ["alarms", "Escalated Alarms"],
    ["tracker", "Task Tracker"],
    ["support", "Support Tickets"],
  ],
  safety: [
    ["dashboard", "Overview"],
    ["pit", "Earth Pit Dashboard"],
    ["alarms", "Alarms"],
    ["tasks", "Task Assignment"],
    ["verify", "Verification"],
    ["support", "Support Tickets"],
  ],
  maintenance: [
    ["dashboard", "Overview"],
    ["pit", "My Earth Pits"],
    ["alarms", "Alarms"],
    ["diagnostics", "Diagnostics"],
    ["workorders", "My Work Orders"],
    ["support", "Support / Escalate"],
  ],
  admin: [
    ["dashboard", "Admin Console"],
    ["support", "Support Tickets"],
  ],
};

export const TITLES = {
  dashboard: "Dashboard",
  alarms: "Alarms",
  tasks: "Task Assignment",
  fleet: "Assets & Earth Pits",
  search: "Asset Search",
  tracker: "Task Tracker",
  asset: "Asset Detail",
  pit: "Earth Pit Dashboard",
  diagnostics: "Engineering Diagnostics",
  workorders: "My Work Orders",
  support: "Support Tickets",
  company: "Company Management",
  verify: "Verification Centre",
};
