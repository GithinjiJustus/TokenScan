# TokenScan — Backend

> Express.js REST + SSE API server powering the TokenScan KPLC Utility Dashboard.  
> Ingests meter images and M-Pesa screenshots, runs Gemma 4 AI vision inference, and streams live updates to the frontend via Server-Sent Events.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Directory Structure](#directory-structure)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [SSE Event Reference](#sse-event-reference)
- [Pipeline Stages](#pipeline-stages)
- [In-Memory Database](#in-memory-database)

---

## Architecture Overview

```
Client (multipart POST)
        │
        ▼
┌─────────────────────────────────────────────┐
│              server.js                      │
│  Express + CORS + SSE client registry       │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│      controllers/ingestion.js               │
│  1. Parse multipart image via busboy        │
│  2. Attach server-side tracking context     │
│  3. Call Gemma 4 pipeline                   │
│  4. Commit to in-memory ledger              │
│  5. Broadcast SSE event                     │
└────────┬──────────────┬──────────────────────┘
         │              │
         ▼              ▼
┌─────────────┐  ┌──────────────────────────────┐
│ services/   │  │  database/models/ledger.js   │
│ gemma.js    │  │  In-memory state + analytics  │
│ Gemma 4     │  │  Constraint validation        │
│ Vision AI   │  │  Anomaly detection            │
└─────────────┘  └──────────────────────────────┘
```

---

## Tech Stack

| Package | Version | Role |
|---|---|---|
| `express` | ^4.19 | HTTP server + routing |
| `@google/genai` | ^1.10 | Gemma 4 multimodal AI client |
| `busboy` | ^1.6 | Streaming multipart file parser |
| `cors` | ^2.8 | Cross-origin request handling |
| `dotenv` | ^16.4 | Environment variable loader |
| `uuid` | ^10.0 | Request / session ID generation |

**Runtime:** Node.js ESM (`"type": "module"`)

---

## Directory Structure

```
backend/
├── server.js                  # Entry point — Express app, SSE registry, all routes
├── app.js                     # (Minimal app export for testing)
├── package.json
├── .env                       # Local secrets (git-ignored)
├── .env.example               # Environment variable template
│
├── controllers/
│   └── ingestion.js           # POST /api/ingestion handler (Stages 2–6)
│
├── services/
│   └── gemma.js               # Gemma 4 vision pipeline (Stage 3)
│
└── database/
    └── models/
        └── ledger.js          # In-memory energy ledger (Stage 4)
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | ✅ Yes | — | Google AI API key for Gemma 4 inference |
| `PORT` | No | `3001` | Port the HTTP server listens on |
| `NODE_ENV` | No | `development` | `development` \| `production` |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed frontend origin for CORS |

> **Note:** The server will start without `GEMINI_API_KEY`, but every ingestion call will fail until it is set.

---

## Getting Started

### Prerequisites

- Node.js **v18+** (ESM support required)
- A valid Google AI API key with access to `gemma-4-27b-it`

### Install & Run

```bash
# From the backend/ directory
npm install

# Development mode (auto-restarts on file change)
npm run dev

# Production
npm start
```

The server prints a startup banner:

```
╔══════════════════════════════════════════════════════════╗
║         TokenScan Backend — API Server Running           ║
╠══════════════════════════════════════════════════════════╣
║  Port       : 3001                                       ║
║  POST /api/ingestion  — Multipart image upload + AI      ║
║  GET  /api/events     — SSE real-time event stream       ║
║  GET  /api/state      — Current ledger state snapshot    ║
║  GET  /health         — Service health check             ║
╚══════════════════════════════════════════════════════════╝
```

---

## API Reference

### `GET /health`

Returns server health and runtime info.

**Response:**
```json
{
  "status": "ok",
  "service": "TokenScan Backend",
  "version": "1.0.0",
  "timestamp": "2026-07-24T12:00:00.000Z",
  "sse_clients": 2,
  "env": {
    "port": 3001,
    "node_version": "v20.11.0",
    "gemini_key_set": true
  }
}
```

---

### `POST /api/ingestion`

Accepts a meter LCD photo or M-Pesa screenshot, runs Gemma 4 AI inference, commits to the ledger, and broadcasts an SSE event to all connected clients.

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | `image/*` | ✅ | Meter photo or M-Pesa screenshot |
| `session_id` | `string` | No | Client session identifier |
| `meter_id_hint` | `string` | No | Known meter serial for verification |

**Optional headers:**

| Header | Description |
|---|---|
| `X-Session-Id` | Client session identifier |
| `X-Meter-Id` | Meter serial hint |

**Accepted MIME types:** `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`  
**Max file size:** 10 MB

**Success Response `200 OK`:**
```json
{
  "ok": true,
  "request_id": "uuid-v4",
  "session_id": "uuid-v4",
  "captured_at": "2026-07-24T12:00:00.000Z",
  "latency_ms": 1234,
  "parsed": {
    "meter_serial_number": "KEN-NBI-04-1234",
    "data_source_type": "PHYSICAL_LCD",
    "remaining_units_kwh": 42.5,
    "load_kilowatts": 0.34,
    "token_strings": ["12345678901234567890"],
    "active_error_code": null
  },
  "transaction": { ... },
  "analytics": { ... },
  "state_snapshot": { ... }
}
```

**Error Responses:**

| Status | Error Code | Cause |
|---|---|---|
| `400` | `INVALID_PAYLOAD` | No file in request or multipart parse failure |
| `413` | `FILE_TOO_LARGE` | Image exceeds 10 MB |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | Non-image MIME type |
| `422` | `VISUAL_PARSE_FAILED` | Blank/cracked screen, power outage |
| `422` | `CONSTRAINT_VIOLATION` | Parsed values fail physical parameter checks |
| `500` | `PIPELINE_ERROR` | Unexpected Gemma API or server error |

---

### `GET /api/events`

Opens a persistent **Server-Sent Events** stream. The frontend subscribes once on mount.

On connection, immediately sends a `state_snapshot` event with the full current ledger state. Sends a keep-alive comment every **25 seconds** to prevent proxy timeouts.

**Event stream format:**
```
event: state_snapshot
data: {"session_id":"...","snapshot":{...}}

event: reading_committed
data: {"transaction":{...},"gauge":{...},"chart":{...},"alert":null}

: heartbeat 2026-07-24T12:00:25.000Z
```

---

### `GET /api/state`

REST fallback — returns the current ledger state snapshot without opening an SSE stream.

**Response:**
```json
{
  "ok": true,
  "snapshot": {
    "meter_serial": "KEN-NBI-04-XXXX",
    "current_balance_kwh": 42.5,
    "current_load_kw": 0.34,
    "days_left": 5,
    "daily_consumption_kwh": [7.2, 9.8, 6.1, 8.4, 11.3, 5.7, 8.9],
    "last_reading_at": "2026-07-24T12:00:00.000Z",
    "recent_transactions": [ ... ]
  },
  "timestamp": "2026-07-24T12:00:00.000Z"
}
```

---

## SSE Event Reference

| Event Name | Trigger | Key Payload Fields |
|---|---|---|
| `state_snapshot` | On SSE client connect | `snapshot` (full ledger state) |
| `reading_committed` | Successful image ingestion | `transaction`, `gauge`, `chart`, `alert` |
| `error_event` | Visual parse failure (blank/cracked screen) | `message`, `error_code`, `session_id` |
| `anomaly_alert` | Consumption spike or grid dropout | `message`, `transaction_id` |

---

## Pipeline Stages

The ingestion flow is split into **6 stages**, each in a separate module:

| Stage | Location | Description |
|---|---|---|
| **1** | `server.js` | Express setup, SSE registry, route mounting |
| **2** | `controllers/ingestion.js` | Multipart parse, context attachment, validation |
| **3** | `services/gemma.js` | Gemma 4 vision AI inference (3-phase pipeline) |
| **4** | `database/models/ledger.js` | Constraint validation, analytics, state commit |
| **5** | `server.js` + `controllers/ingestion.js` | SSE broadcast to all connected clients |
| **6** | `controllers/ingestion.js` | Structured HTTP response |

### Gemma 4 Pipeline (Stage 3)

The `services/gemma.js` module implements a **three-phase non-conversational pipeline**:

- **Phase 1 — Guardrails:** System instructions forcing pure JSON schema output. No prose.
- **Phase 2 — Ingestion:** Raw image buffer + server context sent as a multimodal prompt.
- **Phase 3 — Structured Enforcement:** `responseMimeType: 'application/json'` + `responseSchema` for deterministic output.

**Model:** `gemma-4-27b-it` · **Thinking budget:** 8192 tokens · **Temperature:** 0.1

---

## In-Memory Database

`database/models/ledger.js` is a **zero-dependency in-memory store** that holds:

- Current meter balance, load, and last reading timestamp
- 7-day rolling daily consumption array
- Transaction ledger (newest-first, capped at 200 entries)

### Physical Constraints

| Parameter | Min | Max |
|---|---|---|
| `remaining_units_kwh` | 0 | 999.9 kWh |
| `load_kilowatts` | 0 | 15 kW |
| Anomaly spike threshold | — | 2.5× daily average |

### KPLC Token Handling

- Standard tokens: exactly **20 numeric digits**
- Firmware upgrade sequence: **3 × 20-digit tokens** (or one 60-digit concatenated string, auto-segmented)
- `data_source_type` must be `PHYSICAL_LCD` or `MPESA_SCREENSHOT`

> **Note:** This is an in-memory store — all data resets on server restart. Swap `ledger.js` for a persistent adapter (PostgreSQL, Redis, etc.) when moving to production.
