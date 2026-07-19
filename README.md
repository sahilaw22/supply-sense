# SupplySense — AI Supply Chain Risk & Inventory Intelligence

Real-time supply chain intelligence platform that detects disruptions, predicts shortages, and recommends procurement actions using AI — purpose-built for Indian logistics.

## Problem & Solution

| Problem | Solution |
|---------|----------|
| Manual supply chain monitoring across 10+ suppliers, 5 warehouses, 15+ POs | AI copilot answers questions in natural language — stockout risk, supplier scores, allocation |
| Disruption response takes hours (emails, spreadsheets) | One-click JNPT port strike simulation shows ₹1.2 Cr impact in seconds |
| Inventory data scattered across disconnected tools | Unified dashboard: risk-ranked inventory, warehouse utilization, supplier scorecards |
| No visibility into alternate sourcing during crises | AI recommends qualified alternate suppliers with lead time & fulfillment data |
| Complex supply chain data hard to digest | Leaflet flow map with live node health, interactive hover panels, animated routes |

## Features

| Feature | Details |
|---------|---------|
| **AI Copilot** | Natural-language queries: stockout risk, supplier delays, warehouse allocation, disruption analysis |
| **Disruption Simulation** | One-click JNPT port strike — impact on PO-889, projected ₹1.2 Cr exposure, reroute recommendations |
| **Interactive Flow Map** | Leaflet + CartoDB dark tiles, 18 Indian nodes, animated directional lines, node health dots, hover panels |
| **Supplier Scorecards** | Fulfillment %, delivery performance, lead-time variance — SVG circular progress rings |
| **Inventory Risk Table** | Cover days, demand, stock levels — color-coded critical/warning/healthy status pills |
| **Warehouse Utilization** | Capacity bars per location with critical/warning/healthy thresholds |
| **Demand Forecast** | 12-week Lithium-Ion Battery demand trend with +46% projected growth |
| **Guided Demo** | 3-button onboarding: Simulate Demand Spike, Check Supplier Risk, Generate Executive Summary |
| **Responsive + Dark Theme** | Mobile-friendly sidebar nav, `#0A0A0B` dark surface, red accent `#FF3B30` |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | **Next.js 16** (Turbopack), **React 19**, TypeScript |
| Mapping | **Leaflet** + react-leaflet + CartoDB dark tiles (free, no API key) |
| Icons | **Lucide React** |
| Backend | **FastAPI** (Python), SQLite with parameterized queries |
| AI / LLM | **Gemini 3.5 Flash** / Claude — risk scoring, intent classification, response generation |
| Auth | localStorage + React Context (demo credentials pre-filled) |
| CSS | Single `globals.css` — no CSS modules, no Tailwind |

## Quick Start

### Prerequisites
- Python 3.8+, Node.js 18+, pnpm

### Backend
```bash
python -m venv venv
# Windows: venv\Scripts\activate
cd backend
pip install -r requirements.txt
cp .env.example .env   # add GEMINI_API_KEY
cd ..
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd frontend
pnpm install
pnpm run dev
```

Open `http://localhost:3000` — login with `demo@supplysense.ai` / `Hackathon2026!`

## Project Structure

```
.
├── backend/
│   ├── main.py           # FastAPI entry — endpoints: /api/ask, /api/simulate, /api/snapshot
│   ├── db.py             # SQLite helpers (parameterized queries)
│   ├── risk.py           # Risk scoring engine (0.0–3.0)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── app/              # Next.js App Router pages (/login, /[section])
│   ├── components/       # React components (dashboard, flow-map, score-progress, etc.)
│   ├── lib/              # Data, types, auth context, API client
│   └── public/           # Static assets (logo, bot-icon)
├── tests/                # pytest unit tests (db, risk modules)
├── supplysense.db        # SQLite seed database
└── data.py               # Seed data generator
```

## Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| Surface (bg) | `#0A0A0B` | Main background |
| Surface (card) | `#131316` | Card backgrounds |
| Surface (raised) | `#1C1C21` | Hover/active states |
| Border | `#26262C` | Dividers and borders |
| Text primary | `#F5F5F7` | Main text |
| Text secondary | `#9A9AA5` | Secondary text |
| Accent | `#FF3B30` | Brand red — interactive elements, auth button |
| Risk Critical | `#EF4444` | High-risk indicators |
| Risk Warning | `#F59E0B` | Medium-risk indicators |
| Risk Safe | `#22C55E` | Low-risk indicators |

Font: **Inter** — Display 32/40 semibold, H1 24/32 semibold, Body 14/20 regular

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ask` | Natural-language query → intent classification + DB response |
| POST | `/api/simulate` | Run disruption simulation (JNPT strike) |
| GET | `/api/snapshot` | Dashboard summary snapshot |
| GET | `/api/health` | Backend health + LLM status |

## License

© 2025 SupplySense. All rights reserved.
