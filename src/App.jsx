import React from "react";

import { useApp } from "./context/AppContext";
import { Login, Shell } from "./components/layout";
import {
  ManagerDashboard,
  SafetyDashboard,
  MaintenanceDashboard,
  AdminDashboard,
} from "./features/dashboards";
import {
  EarthPitPage,
  FleetPage,
  SearchPage,
  AlarmsPage,
  DiagnosticsPage,
  TasksPage,
  VerifyPage,
  WorkOrdersPage,
  SupportPage,
  TrackerPage,
  CompanyPage,
} from "./features/pages";

export default function App() {
  const { user, page } = useApp();

  if (!user) {
    return <Login />;
  }

  const dashboards = {
    manager: <ManagerDashboard />,
    safety: <SafetyDashboard />,
    maintenance: <MaintenanceDashboard />,
    admin: <AdminDashboard />,
  };

  const pages = {
    fleet: <FleetPage />,
    pit: <EarthPitPage />,
    asset: <EarthPitPage />,
    search: <SearchPage />,
    alarms: <AlarmsPage />,
    diagnostics: <DiagnosticsPage />,
    tasks: <TasksPage />,
    verify: <VerifyPage />,
    workorders: <WorkOrdersPage />,
    support: <SupportPage />,
    tracker: <TrackerPage />,
    company: <CompanyPage />,
  };

  const content = page === "dashboard" ? dashboards[user.role] : pages[page];

  return <Shell>{content || dashboards[user.role]}</Shell>;
}
