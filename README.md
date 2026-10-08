# EarthSense React — Sidebar, Earth-Pit Graph & Demo-Refresh Fix

This version keeps the existing EarthSense role structure and API/proxy setup, while fixing the issues found during the latest UI check.

## Fixed

- Sidebar navigation now updates the page title as well as the page content.
- Plant Officer navigation remains role-specific: Plant Overview, Assets & Earth Pits, Escalated Alarms, Task Tracker, Support Tickets.
- Selecting an earth pit from fleet/priority tables opens that exact transformer + earth pit in the Earth Pit Dashboard.
- Earth Pit Dashboard now includes five historical + forecast trend charts.
- Charts work for both the live TR-001 / EP-01 API pair and demo earth pits.
- Demo readings now change automatically on the configured refresh interval and when Refresh is pressed.
- Demo data remains clearly marked as DEMO DATA.
- The live API remains restricted to TR-001 / EP-01; other earth pits continue using demo data.
- The Vite API proxy remains in place for localhost CORS handling.
- Source files are split into readable React components, context, services, data and utilities.

## API

Live data:
`/api/earthsense-data` -> EarthSense `/data`

Status:
`/api/earthsense-status` -> EarthSense API root

Prediction:
`/api/earthsense-test` -> EarthSense `/test`

## Demo login password

`earthsense`
