# TokenScan — Frontend

> React + Vite single-page application for the TokenScan KPLC Utility Dashboard.  
> Displays real-time prepaid electricity balance, consumption trends, and transaction history sourced from the backend via Server-Sent Events.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Directory Structure](#directory-structure)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Component Reference](#component-reference)
- [Hooks Reference](#hooks-reference)
- [Data Flow](#data-flow)
- [Backend Integration](#backend-integration)

---

## Overview

The frontend is a **mobile-first single-page app** (max-width `lg`) that:

1. **Captures** meter LCD photos or M-Pesa screenshots via the Omnibox Portal and uploads them to the backend.
2. **Subscribes** to the backend SSE stream (`GET /api/events`) to receive live updates.
3. **Displays** balance, load, estimated days remaining, a 7-day trend chart, and a token transaction ledger.
4. **Falls back** to a built-in mock simulation when no backend is configured (no `VITE_API_URL`).

---

## Tech Stack

| Package | Version | Role |
|---|---|---|
| `react` | ^18.3 | UI library |
| `react-dom` | ^18.3 | DOM rendering |
| `lucide-react` | ^0.441 | SVG icon set |
| `vite` | ^5.3 | Dev server + bundler |
| `tailwindcss` | ^3.4 | Utility-first CSS (via PostCSS) |
| `autoprefixer` | ^10.4 | CSS vendor prefixing |
| `@vitejs/plugin-react` | ^4.3 | Vite React plugin (Fast Refresh) |

---

## Directory Structure

```
frontend/
├── index.html                 # HTML shell (Vite entry point)
├── vite.config.js             # Vite configuration
├── tailwind.config.js         # Tailwind theme + content paths
├── postcss.config.js          # PostCSS plugin config
├── package.json
│
├── public/                    # Static assets (served as-is)
│
└── src/
    ├── main.jsx               # React root — mounts <App /> into #root
    ├── App.jsx                # Root component — state, SSE wiring, layout
    ├── index.css              # Global styles + Tailwind directives
    │
    ├── components/
    │   ├── Header.jsx         # Sticky app header with network status indicator
    │   ├── OmniboxPortal.jsx  # Image capture + upload UI
    │   ├── BalanceGauge.jsx   # Radial SVG gauge (balance / days left / load)
    │   ├── TrendChart.jsx     # 7-day daily consumption bar chart
    │   ├── BillingTable.jsx   # Token transaction ledger table
    │   └── ErrorModal.jsx     # Visual parse failure alert modal
    │
    └── hooks/
        └── useSSE.js          # SSE connection hook with mock simulation fallback
```

---

## Environment Variables

Create a `.env` file in the `frontend/` directory:

```bash
# Optional — omit to run in mock simulation mode
VITE_API_URL=http://localhost:3001/api
```

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | No | Full URL to the backend `/api` prefix. If unset, the app runs with a built-in mock simulator. |

> All Vite env vars must be prefixed with `VITE_` to be accessible in the browser bundle.

---

## Getting Started

### Prerequisites

- Node.js **v18+**

### Install & Run

```bash
# From the frontend/ directory
npm install

# Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Other Scripts

| Script | Command | Description |
|---|---|---|
| Dev server | `npm run dev` | Vite HMR dev server on port 5173 |
| Production build | `npm run build` | Outputs to `dist/` |
| Preview build | `npm run preview` | Preview the production bundle locally |

---

## Component Reference

### `<Header />`

**File:** [`src/components/Header.jsx`](src/components/Header.jsx)

Sticky top bar displaying the TokenScan logo and a live network status indicator.

| Prop | Type | Values |
|---|---|---|
| `networkStatus` | `string` | `'connected'` \| `'syncing'` \| `'offline'` |

---

### `<OmniboxPortal />`

**File:** [`src/components/OmniboxPortal.jsx`](src/components/OmniboxPortal.jsx)

The primary image capture and upload interface. Supports:
- Camera capture (mobile)
- File picker (desktop)
- Drag-and-drop upload

Calls `POST /api/ingestion` when `VITE_API_URL` is set, or simulates a local capture otherwise.

| Prop | Type | Description |
|---|---|---|
| `onCapture` | `function({ source, units })` | Called after a successful capture with source type and units parsed |

---

### `<BalanceGauge />`

**File:** [`src/components/BalanceGauge.jsx`](src/components/BalanceGauge.jsx)

Animated radial SVG gauge showing:
- **Remaining balance** in kWh (arc fill)
- **Estimated days remaining** (centre label)
- **Current load** in kW (secondary label)

| Prop | Type | Description |
|---|---|---|
| `balance` | `number` | Current balance in kWh |
| `daysLeft` | `number` | Estimated days until balance depletes |
| `currentLoad` | `number` | Live power draw in kW |

---

### `<TrendChart />`

**File:** [`src/components/TrendChart.jsx`](src/components/TrendChart.jsx)

7-day daily consumption bar chart. Anomaly bars are rendered in a distinct accent colour.

| Prop | Type | Description |
|---|---|---|
| `data` | `Array<{ value: number, anomaly: boolean }>` | 7-element array (index 0 = oldest, index 6 = today) |

---

### `<BillingTable />`

**File:** [`src/components/BillingTable.jsx`](src/components/BillingTable.jsx)

Scrollable transaction ledger listing all meter readings and top-ups. Firmware upgrade entries expand to show all 3 token strings.

| Prop | Type | Description |
|---|---|---|
| `entries` | `Array<LedgerEntry>` | Transaction records (newest first) |

**LedgerEntry shape:**

```js
{
  id: string,             // e.g. "TXN-001"
  date: string,           // Formatted date string
  source: string,         // "M-Pesa" | "Meter Scan"
  units: number,          // kWh added (0 for scan-only readings)
  status: string,         // "Confirmed" | "Verified" | "Pending"
  isFirmware: boolean,    // true if this is a 3-token firmware upgrade
  tokens: string[] | null // Array of 20-digit token strings, or null
}
```

---

### `<ErrorModal />`

**File:** [`src/components/ErrorModal.jsx`](src/components/ErrorModal.jsx)

Full-screen overlay shown when the backend returns a `VISUAL_PARSE_FAILED` or `error_event` SSE message. Provides three action buttons: **Retry**, **Report Outage**, and **Dismiss**.

| Prop | Type | Description |
|---|---|---|
| `isOpen` | `boolean` | Controls modal visibility |
| `message` | `string` | Error message to display |
| `onClose` | `function` | Dismiss the modal |
| `onRetry` | `function` | Re-trigger the capture flow |
| `onReportOutage` | `function` | Opens the KPLC outage form (external) |

---

## Hooks Reference

### `useSSE(onEvent, interval?)`

**File:** [`src/hooks/useSSE.js`](src/hooks/useSSE.js)

Manages the SSE connection lifecycle. Automatically switches between **real backend** mode and **mock simulation** mode based on `VITE_API_URL`.

```js
import { useSSE } from './hooks/useSSE';

useSSE((event) => {
  const { type, payload } = event;
  // handle event
}, 8000 /* mock interval ms */);
```

#### Real Backend Mode (`VITE_API_URL` is set)

- Connects to `GET /api/events` via `EventSource`
- Handles named SSE events: `state_snapshot`, `reading_committed`, `error_event`, `anomaly_alert`
- Maps backend payloads to frontend event shapes (see adapter in hook source)
- Auto-reconnects after 5 seconds on disconnect

#### Mock Simulation Mode (no `VITE_API_URL`)

Fires random events every `interval` ms to simulate a live backend:

| Probability | Event Type | Effect |
|---|---|---|
| 35% | `balance_update` | Decrements balance, randomises load |
| 30% | `ledger_entry` | Prepends a new transaction |
| 25% | `chart_update` | Updates a random day in the trend chart |
| 10% | `error_event` | Triggers the error modal |

#### Dispatched Event Types

| Type | Payload | Description |
|---|---|---|
| `status_change` | `{ status }` | Connection state update |
| `balance_update` | `{ deltaBalance, currentLoad }` | Balance delta + live load |
| `ledger_entry` | `LedgerEntry` | New transaction record |
| `chart_update` | `{ dayIndex, value, anomaly }` | Single bar update |
| `error_event` | `{ message }` | Error modal trigger |
| `state_snapshot` | Full snapshot | Initial hydration on SSE connect |
| `reading_committed` | Full backend payload | Raw backend broadcast (used internally) |

---

## Data Flow

```
User captures image
        │
        ▼
  OmniboxPortal
        │  POST /api/ingestion (multipart)
        ▼
  Backend (Gemma 4 AI)
        │  SSE: reading_committed / error_event
        ▼
   useSSE hook
        │  dispatches typed events
        ▼
     App.jsx  (state management)
        │
        ├──▶  BalanceGauge   (balance, load, daysLeft)
        ├──▶  TrendChart     (chartData)
        ├──▶  BillingTable   (ledger)
        └──▶  ErrorModal     (errorModal)
```

All state is managed in `App.jsx` via `useState`. There is no global state library; the component tree is shallow enough that prop drilling is sufficient.

---

## Backend Integration

To connect to the real backend:

1. Start the backend server (see [`../backend/README.md`](../backend/README.md)).
2. Set `VITE_API_URL=http://localhost:3001/api` in `frontend/.env`.
3. Restart `npm run dev`.

The `useSSE` hook will automatically detect the environment variable and open a live SSE connection instead of using the mock simulator.
