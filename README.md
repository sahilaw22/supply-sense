<div align="center">
<h1 align="center">
  <img src="https://github.com/user-attachments/assets/45873da0-3a53-45c2-8f05-e6fd5f23336e" width="38" height="38" alt="logo" style="vertical-align: middle; margin-right: 8px;" />
  <span style="vertical-align: middle;"><b>SupplySense</b></span>
</h1>
  <h3>AI-Powered Supply Chain Risk & Inventory Intelligence</h3>
</div>

> Real-time supply chain intelligence platform detecting disruptions, predicting shortages, and recommending procurement actions.

<br>
  <!-- Shields / Badges -->
 <p align="center">
  <img src="https://img.shields.io/badge/Next.js_16-black?style=flat&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React_19-20232A?style=flat&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/FastAPI-005587?style=flat&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Google_Gemini-8E75B2?style=flat&logo=googlegemini&logoColor=white" alt="Gemini AI" />
   <br>
  <img src="https://img.shields.io/badge/Tailwind_CSS_v4-38B2AC?style=flat&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Railway-0B0D0E?style=flat&logo=railway&logoColor=white" alt="Railway" />
</p>
</div>

<br>

<div align="center">  <h2>Features</h2>
</div>

### AI Copilot
<p>Natural-language queries via a slide-out drawer: ask about stockout risk, supplier delays, warehouse allocation, disruption root cause, and alternate sourcing. Powered by Google Gemini with tool-calling (SQL queries, supplier ranking, reroute simulation). Returns structured responses with summaries, data tables, and one-click action buttons.</p>

### Interactive Flow Map
<p>Leaflet + CartoDB dark tiles showing 18 Indian supply chain nodes (ports, warehouses, suppliers). Animated directional routes, color-coded node health (healthy/warning/critical), hover tooltips, and click-to-inspect popups.</p>

| Category | Pages |
|----------|-------|
| **Sales & Inventory** | Store Sales, eComm Sales, eComm Inventory, eComm In-stock Rate, eComm Returns |
| **Supply Chain** | DC Logistics Metrics, Order Forecast, Demand Forecast |
| **Performance** | Vendor Scorecard, Tender Analysis, Store Markdowns |
| **Planning** | Modular Shelf Plan, Future Store Pipeline, Item Master |
| **Operations** | Store Order Calculator (SSO Builder), Alert Exceptions, Demand-Order Alignment, Automated Insights Feed |

### Supplier Scorecards
<p>SVG circular progress rings for fulfillment %, delivery performance, lead-time variance. Color-coded thresholds (green ≥85, amber ≥70, red <70).
</p>

### Demand Forecasting
<p>12-week Recharts area chart with Lithium-Ion Battery demand trend, +46% projected growth, gradient fills, forecast vs actual overlay.</p>

### Inventory Risk Table
<p>Cover days, reorder points, current stock levels with color-coded status pills (critical/warning/healthy).</p>

### KPI Strip
<p>4 live metrics: Active Shipments, Inventory at Risk, Supplier Reliability, Avg Lead Time.</p>

### Warehouse Utilization
<p>Capacity bars per location with critical/warning/healthy thresholds.</p>

---

<div align="center">  <h2>Application Preview</h2> </div>

| Main Dashboard | Supply Chain Map Network |
| :---: | :---: |
| <img width="450" height="1100" alt="dash" src="https://github.com/user-attachments/assets/3262ad45-06f7-49ab-8d6c-7afd640492b1" /> | <img width="471" height="1100" alt="map" src="https://github.com/user-attachments/assets/d80ba7ff-a8c4-41bb-88d5-176f653757b4" /> |

| AI Copilot | SSO Order Builder |
| :---: | :---: |
|<img width="450" height="1200" alt="ai" src="https://github.com/user-attachments/assets/d9efb59c-c97b-4527-a55c-2f98f5fc06fb" /> | <img width="471" height="1200" alt="cal" src="https://github.com/user-attachments/assets/e929b6dd-0f0c-4eba-afd3-286815e9f31d" /> |

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

## Deployment

| Platform | Config | Guide |
|----------|--------|-------|
| **Vercel** (Frontend) | `vercel.json` | Set `NEXT_PUBLIC_API_BASE_URL` env var |
| **Railway** (Backend) | `Dockerfile.backend` | Set `GEMINI_API_KEY` secret |

See `guide.md` for step-by-step deployment instructions.

---

## Database Schema

10 tables: `suppliers`, `warehouses`, `components`, `inventory_levels`, `purchase_orders`, `store_sales`, `ecomm_sales`, `vendor_scorecard`, `tender_analysis`, `item_master`. All with realistic India-specific seed data (Mumbai, Chennai, Delhi NCR, Pune, Kolkata, Hyderabad, Ahmedabad, Bengaluru).

---

## License

© 2026 SupplySense. All rights reserved.
