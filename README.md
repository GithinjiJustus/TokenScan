# TokenScan

> **KPLC Prepaid Electricity Utility Dashboard**  
> AI-powered meter reading and real-time energy monitoring for Kenya Power (KPLC) prepaid customers.

TokenScan lets you photograph your physical meter LCD or upload an M-Pesa payment screenshot. Gemma 4 Vision AI extracts the reading, commits it to a live ledger, and streams updates to your dashboard via Server-Sent Events — all in seconds.

---

## ✨ Features

- **AI Meter Reading** — Gemma 4 multimodal vision parses meter LCD photos and M-Pesa screenshots into structured data
- **Real-Time Dashboard** — Live balance gauge, 7-day consumption trend chart, and transaction ledger updated over SSE
- **Anomaly Detection** — Automatic alerts for consumption spikes (>2.5× daily average) and grid dropout events
- **Firmware Upgrade Support** — Handles KPLC 3-token firmware upgrade sequences automatically
- **Offline Resilience** — Frontend falls back to a built-in mock simulator when the backend is unavailable
- **Error Recovery** — Visual parse failures (cracked screens, power outages) surface actionable error dialogs

---

## 🛠️ Tech Stack

### Frontend — [`/frontend`](./frontend/README.md)
- **React 18** — UI library
- **Vite 5** — Dev server + bundler
- **Tailwind CSS 3** — Utility-first styling
- **Lucide React** — SVG icons
- **`EventSource` (native)** — SSE client

### Backend — [`/backend`](./backend/README.md)
- **Node.js (ESM)** — JavaScript runtime
- **Express 4** — HTTP server + routing
- **Gemma 4 (`gemma-4-27b-it`)** — Google AI multimodal vision model
- **busboy** — Streaming multipart file parser
- **In-memory ledger** — Zero-dependency stateful data store (swap for a DB in production)

---

## 📂 Project Structure

```
TokenScan/
├── README.md                  # ← You are here
├── .gitignore
│
├── backend/                   # Express API server
│   ├── README.md              # Backend-specific docs
│   ├── server.js              # Entry point — routes, SSE registry
│   ├── app.js
│   ├── .env.example
│   ├── controllers/
│   │   └── ingestion.js       # POST /api/ingestion handler
│   ├── services/
│   │   └── gemma.js           # Gemma 4 vision AI pipeline
│   └── database/
│       └── models/
│           └── ledger.js      # In-memory energy ledger
│
└── frontend/                  # React + Vite SPA
    ├── README.md              # Frontend-specific docs
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── App.jsx            # Root component + state management
        ├── main.jsx
        ├── index.css
        ├── components/
        │   ├── Header.jsx
        │   ├── OmniboxPortal.jsx   # Image capture & upload
        │   ├── BalanceGauge.jsx    # Radial kWh gauge
        │   ├── TrendChart.jsx      # 7-day consumption chart
        │   ├── BillingTable.jsx    # Transaction ledger
        │   └── ErrorModal.jsx      # Error & outage alerts
        └── hooks/
            └── useSSE.js           # SSE connection + mock fallback
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js v18+**
- A **Google AI API key** with access to `gemma-4-27b-it`

### 1. Clone the Repository

```bash
git clone <repository-url>
cd TokenScan
```

### 2. Configure the Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `backend/.env`:

```env
GEMINI_API_KEY=your_google_ai_api_key_here
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

### 3. Configure the Frontend

```bash
cd ../frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:3001/api
```

> **Tip:** Omit `VITE_API_URL` to run the frontend in mock simulation mode (no backend required).

### 4. Start Both Servers

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
# Server starts on http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# App opens on http://localhost:5173
```

---

## 📡 API Overview

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ingestion` | Upload meter image → AI inference → ledger commit → SSE broadcast |
| `GET` | `/api/events` | Open SSE stream — receives live dashboard updates |
| `GET` | `/api/state` | Fetch current ledger state snapshot (REST fallback) |
| `GET` | `/health` | Service health check |

→ Full API documentation: [`backend/README.md`](./backend/README.md)

---

## 📡 SSE Events

| Event | Trigger |
|---|---|
| `state_snapshot` | Sent immediately on SSE connection — hydrates the UI |
| `reading_committed` | Successful meter image ingestion |
| `error_event` | Visual parse failure (blank screen, power outage) |
| `anomaly_alert` | Consumption spike or unexpected balance drop to zero |

---

## 🏗️ How It Works

```
📸 User photographs meter
        │
        ▼
┌── OmniboxPortal ──┐
│  POST /api/ingestion (multipart image)
└───────────────────┘
        │
        ▼
┌── Gemma 4 Vision Pipeline ──────────────────────────────┐
│  Phase 1: System guardrails (JSON-only output)          │
│  Phase 2: Multimodal prompt (image + grid context)      │
│  Phase 3: Schema-enforced JSON response                 │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌── In-Memory Ledger ─────────────────────────────────────┐
│  Constraint validation → analytics → state commit       │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌── SSE Broadcast ────────────────────────────────────────┐
│  reading_committed → all connected frontend clients     │
└─────────────────────────────────────────────────────────┘
        │
        ▼
📊 Dashboard updates live (gauge, chart, ledger)
```

---

## 📖 Further Reading

- [Backend README](./backend/README.md) — API reference, pipeline stages, environment variables
- [Frontend README](./frontend/README.md) — Component API, hooks, data flow, mock simulation

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Commit your changes: `git commit -m 'feat: add my feature'`
3. Push the branch: `git push origin feature/my-feature`
4. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.
