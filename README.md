# SupplySense — AI Supply Chain Risk & Inventory Intelligence

Real-time supply chain intelligence platform detecting disruptions, predicting shortages, and recommending procurement actions using AI — built for Indian logistics.

## Demo Credentials

`demo@supplysense.ai` / `Hackathon2026!`

---

## Features

### AI Copilot
Natural-language queries via a slide-out drawer: ask about stockout risk, supplier delays, warehouse allocation, disruption root cause, and alternate sourcing. Powered by Google Gemini with tool-calling (SQL queries, supplier ranking, reroute simulation). Returns structured responses with summaries, data tables, and one-click action buttons.

### Interactive Flow Map
Leaflet + CartoDB dark tiles showing 18 Indian supply chain nodes (ports, warehouses, suppliers). Animated directional routes, color-coded node health (healthy/warning/critical), hover tooltips, and click-to-inspect popups.

### Disruption Simulation
One-click JNPT port strike simulation — shows impact on active POs, projected ₹1.2 Cr exposure, reroute recommendations via Pune-Mumbai highway corridor.

### 29 Data Pages
| Category | Pages |
|----------|-------|
| **Sales & Inventory** | Store Sales, eComm Sales, eComm Inventory, eComm In-stock Rate, eComm Returns |
| **Supply Chain** | DC Logistics Metrics, Order Forecast, Demand Forecast |
| **Performance** | Vendor Scorecard, Tender Analysis, Store Markdowns |
| **Planning** | Modular Shelf Plan, Future Store Pipeline, Item Master |
| **Operations** | Store Order Calculator (SSO Builder), Alert Exceptions, Demand-Order Alignment, Automated Insights Feed |

### Supplier Scorecards
SVG circular progress rings for fulfillment %, delivery performance, lead-time variance. Color-coded thresholds (green ≥85, amber ≥70, red <70).

### Demand Forecasting
12-week Recharts area chart with Lithium-Ion Battery demand trend, +46% projected growth, gradient fills, forecast vs actual overlay.

### Inventory Risk Table
Cover days, reorder points, current stock levels with color-coded status pills (critical/warning/healthy).

### KPI Strip
4 live metrics: Active Shipments, Inventory at Risk, Supplier Reliability, Avg Lead Time.

### Warehouse Utilization
Capacity bars per location with critical/warning/healthy thresholds.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | **Next.js 16** (Turbopack), **React 19**, TypeScript |
| Styling | Tailwind CSS v4 + custom design tokens |
| Icons | **Lucide React** |
| Charts | **Recharts** |
| Maps | **Leaflet** + react-leaflet + CartoDB dark tiles |
| Backend | **FastAPI** (Python), SQLite with parameterized queries |
| AI / LLM | **Google Gemini** — risk scoring, intent classification, tool calling |
| Auth | React Context + localStorage |

---

## Project Structure

```
codebenders/
├── app/                          # Next.js App Router
│   ├── page.tsx                 # Landing (Dashboard overview)
│   ├── [section]/page.tsx       # 29 dynamic section routes
│   ├── login/page.tsx           # Auth login
│   ├── layout.tsx               # Root layout + fonts
│   └── globals.css              # Global styles
├── backend/                      # FastAPI backend
│   ├── main.py                  # API endpoints (20+ routes)
│   ├── db.py                    # SQLite connection helpers
│   ├── data.py                  # Seed data + query functions
│   ├── orchestrator.py          # Gemini AI orchestrator
│   ├── tools.py                 # Agent tool functions
│   ├── risk.py                  # Stockout risk formula
│   ├── disruptions.py           # JNPT disruption engine
│   └── supplysense.db           # Seeded SQLite database
├── api/index.py                  # Vercel Python serverless entry
├── components/supplysense/
│   ├── dashboard.tsx            # Main dashboard + copilot drawer (~950 lines)
│   ├── flow-map.tsx             # Leaflet interactive map
│   ├── score-progress.tsx       # SVG circular progress rings
│   └── auth-guard.tsx           # Route protection wrapper
├── lib/
│   ├── supplysense-api.ts       # API client (fetch wrappers)
│   ├── supplysense-data.ts      # Static fallback data + prompt options
│   ├── auth-context.tsx          # Auth provider
│   └── types.ts                 # TypeScript type definitions
├── public/                       # Static assets (bot-icon, logo)
├── Dockerfile.backend            # Fly.io container image
├── fly.toml                      # Fly.io deployment config
├── vercel.json                   # Vercel deployment config
├── next.config.mjs               # Next.js configuration
├── tsconfig.json                 # TypeScript strict config
└── package.json                  # Dependencies
```

---

## Quick Start

### Backend
```bash
python -m venv venv
# Windows: venv\Scriptives\activate
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
# Add GEMINI_API_KEY to backend/.env
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
pnpm install
pnpm run dev
```

Open `http://localhost:3000` — login with `demo@supplysense.ai` / `Hackathon2026!`

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Backend health + LLM status |
| POST | `/api/query` | Natural-language query → AI → structured response |
| GET | `/api/snapshot` | Dashboard KPI, inventory, suppliers, warehouses, shipments |
| POST | `/api/simulate` | Run JNPT disruption simulation |
| POST | `/api/calculate-sso` | Store order optimization calculator |
| GET | `/api/*` | 15 data endpoints (store-sales, ecomm-sales, dc-metrics, vendor-scorecard, etc.) |

---

## Code Quality

| Metric | Status |
|--------|--------|
| TypeScript strict mode | ✅ `"strict": true` in tsconfig |
| Build passes | ✅ `pnpm run build` clean |
| Zero unused dependencies | ✅ 8 packages removed: `shadcn`, `tw-animate-css`, `@vercel/analytics`, `@base-ui/react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `chromadb` |
| Dead code removed | ✅ guided-demo.tsx, button.tsx, utils.ts, empty divs, dead handlers |
| CSS deduplicated | ✅ Merged duplicate media queries, removed duplicate selectors |
| Backend | ✅ Parameterized SQL queries, async endpoints, FastAPI |

---

## Deployment

| Platform | Config | Guide |
|----------|--------|-------|
| **Vercel** (Frontend) | `vercel.json` + `next.config.mjs` | Set `NEXT_PUBLIC_API_BASE_URL` env var |
| **Fly.io** (Backend) | `Dockerfile.backend` + `fly.toml` | Set `GEMINI_API_KEY` secret |

See `guide.md` for step-by-step deployment instructions.

---

## Database Schema

10 tables: `suppliers`, `warehouses`, `components`, `inventory_levels`, `purchase_orders`, `store_sales`, `ecomm_sales`, `vendor_scorecard`, `tender_analysis`, `item_master`. All with realistic India-specific seed data (Mumbai, Chennai, Delhi NCR, Pune, Kolkata, Hyderabad, Ahmedabad, Bengaluru).

---

## License

© 2026 SupplySense. All rights reserved.
