# SupplySense — Project Memory

## Project Overview

**Name:** SupplySense (package: `my-project`)  
**Purpose:** AI-powered supply chain risk & inventory intelligence platform for Indian logistics. Detects disruptions, predicts shortages, recommends procurement actions. Hackathon project for Problem Statement 7.  
**Tagline:** AI Supply Chain Risk & Inventory Intelligence  
**Demo creds:** `demo@supplysense.ai` / `Hackathon2026!`

---

## Tech Stack

| Layer | Tech | Version |
|-------|------|---------|
| Frontend | Next.js (App Router) | 16.2.6 |
| UI Library | React | ^19 |
| Language | TypeScript | 5.7.3 |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`) | ^4.3.3 |
| Shadcn/ui | `@base-ui/react` + `class-variance-authority` | ^1.5.0 |
| Icons | Lucide React | ^1.16.0 |
| Charts | Recharts | ^3.9.2 |
| Maps | Leaflet + react-leaflet + CartoDB dark tiles | ^1.9.4 / ^5.0.0 |
| Animations | tw-animate-css | ^1.4.0 |
| UI Utils | clsx + tailwind-merge | ^2.1.1 / ^3.3.1 |
| Backend | FastAPI (Python) | 0.104.1 |
| Database | SQLite (`supplysense.db`) | — |
| AI/LLM | Gemini 2.5 Flash (REST API via httpx) | — |
| Auth | localStorage + React Context | — |
| Package Mgr | pnpm | — |
| Deployment | Docker (Node 20 Alpine), AWS EC2 (GHActions) | — |

---

## Directory Tree

```
├── .github/workflows/deploy.yml          # AWS EC2 deploy pipeline
├── api/index.py                          # Vercel Python entry (auto-seeds DB)
├── app/                                  # Next.js App Router
│   ├── [section]/page.tsx                # Dynamic: network, inventory, shipments, warehouses, suppliers
│   ├── login/page.tsx                    # Login page
│   ├── globals.css                       # ALL styles (~2000+ lines)
│   ├── layout.tsx                        # Root layout + AuthProvider
│   └── page.tsx                          # Home (dashboard)
├── backend/                              # FastAPI backend
│   ├── main.py                           # 7 endpoints (488 lines)
│   ├── db.py                             # SQLite connection + query helpers
│   ├── risk.py                           # P(S) stockout risk formula
│   ├── orchestrator.py                   # Gemini tool-calling loop (REST)
│   ├── tools.py                          # 3 agent tools
│   ├── disruptions.py                    # JNPT port strike simulation
│   ├── data.py                           # Seed data generator (seed=42)
│   ├── requirements.txt
│   └── .env.example / .env.local
├── components/
│   ├── supplysense/
│   │   ├── dashboard.tsx                 # MAIN component (697 lines)
│   │   ├── flow-map.tsx                  # Leaflet interactive map (217 lines)
│   │   ├── score-progress.tsx            # SVG circular progress ring (45 lines)
│   │   ├── auth-guard.tsx                # Route protection (19 lines)
│   │   └── guided-demo.tsx               # Onboarding tour overlay (96 lines)
│   └── ui/button.tsx                     # Shadcn button (58 lines)
├── frontend/                             # Legacy/alternate frontend dir
│   └── .env.local                        # NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
├── lib/
│   ├── auth-context.tsx                  # Auth context + provider (localStorage)
│   ├── supply-chain-geo.ts              # Geo nodes/routes for Leaflet map (253 lines)
│   ├── supplysense-api.ts               # API client (fetch wrappers, 108 lines)
│   ├── supplysense-data.ts              # Static fallback data (219 lines)
│   └── utils.ts                          # cn() utility
├── public/                               # Static assets (icons, logos, images)
├── tests/
│   ├── conftest.py                       # Fixtures (db_path, TestClient)
│   ├── run_tests.py                      # Seed + pytest runner
│   ├── test_api_endpoints.py             # 30+ E2E API tests
│   ├── test_data_integrity.py            # 15 DB schema/data tests
│   ├── test_disruption.py                # 14 disruption tests
│   └── test_risk.py                      # 15 risk formula tests
├── supplysense.db                        # Seeded SQLite database
├── package.json / pnpm-lock.yaml
├── tsconfig.json / next.config.mjs / postcss.config.mjs
├── docker-compose.yml / Dockerfile
├── vercel.json / components.json
├── .npmrc / .gitignore
├── PRD.md / IMPLEMENTATION_ROADMAP.md / README.md
└── requirements.txt (root)
```

---

## Database Schema (SQLite)

```sql
-- Core Tables
CREATE TABLE suppliers (
    supplier_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    historical_fulfillment_rate REAL NOT NULL,
    delivery_performance_score REAL NOT NULL,
    lead_time_days INTEGER NOT NULL
);

CREATE TABLE warehouses (
    warehouse_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    current_utilization REAL NOT NULL
);

CREATE TABLE components (
    item_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit_cost REAL NOT NULL
);

CREATE TABLE inventory_levels (
    item_id TEXT NOT NULL REFERENCES components(item_id),
    warehouse_id TEXT NOT NULL REFERENCES warehouses(warehouse_id),
    current_stock INTEGER NOT NULL,
    reorder_point INTEGER NOT NULL,
    forecasted_demand INTEGER NOT NULL,
    PRIMARY KEY (item_id, warehouse_id)
);

CREATE TABLE purchase_orders (
    po_id TEXT PRIMARY KEY,
    supplier_id TEXT NOT NULL REFERENCES suppliers(supplier_id),
    item_id TEXT NOT NULL REFERENCES components(item_id),
    quantity INTEGER NOT NULL,
    expected_delivery_date TEXT NOT NULL,
    status TEXT NOT NULL,
    transit_route TEXT NOT NULL
);

-- New Retail & Logistics Tables
CREATE TABLE store_sales (
    store_name TEXT NOT NULL,
    item_name TEXT NOT NULL,
    date TEXT NOT NULL,
    quantity_sold INTEGER NOT NULL,
    revenue_inr REAL NOT NULL
);

CREATE TABLE ecomm_sales (
    channel_name TEXT NOT NULL,
    item_name TEXT NOT NULL,
    date TEXT NOT NULL,
    orders_count INTEGER NOT NULL,
    revenue_inr REAL NOT NULL
);

CREATE TABLE ecomm_inventory (
    facility_name TEXT NOT NULL,
    item_name TEXT NOT NULL,
    stock_on_hand INTEGER NOT NULL,
    committed_stock INTEGER NOT NULL,
    safety_stock INTEGER NOT NULL
);

CREATE TABLE ecomm_instock (
    item_name TEXT NOT NULL,
    date TEXT NOT NULL,
    instock_rate_pct REAL NOT NULL,
    out_of_stock_minutes INTEGER NOT NULL
);

CREATE TABLE ecomm_returns (
    return_id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    item_name TEXT NOT NULL,
    return_reason TEXT NOT NULL,
    refund_status TEXT NOT NULL
);

CREATE TABLE dc_metrics (
    dc_name TEXT NOT NULL,
    date TEXT NOT NULL,
    inbound_pallets INTEGER NOT NULL,
    outbound_pallets INTEGER NOT NULL,
    processing_time_hours REAL NOT NULL,
    service_level_pct REAL NOT NULL
);

CREATE TABLE order_forecast (
    item_name TEXT NOT NULL,
    date TEXT NOT NULL,
    forecasted_orders INTEGER NOT NULL
);

CREATE TABLE demand_forecast (
    item_name TEXT NOT NULL,
    date TEXT NOT NULL,
    forecasted_demand_qty INTEGER NOT NULL
);

CREATE TABLE vendor_scorecard (
    supplier_name TEXT PRIMARY KEY,
    on_time_delivery_pct REAL NOT NULL,
    quality_acceptance_pct REAL NOT NULL,
    lead_time_variance_days REAL NOT NULL,
    cost_variance_pct REAL NOT NULL
);

CREATE TABLE tender_analysis (
    carrier_name TEXT NOT NULL,
    route_name TEXT NOT NULL,
    lane_rate_inr REAL NOT NULL,
    transit_time_days REAL NOT NULL,
    bid_status TEXT NOT NULL
);

CREATE TABLE store_mumd (
    store_name TEXT NOT NULL,
    item_name TEXT NOT NULL,
    original_price_inr REAL NOT NULL,
    markdown_pct REAL NOT NULL,
    promotional_units_sold INTEGER NOT NULL
);

CREATE TABLE modular_plan (
    category_name TEXT NOT NULL,
    planogram_id TEXT PRIMARY KEY,
    shelf_share_pct REAL NOT NULL,
    linear_feet INTEGER NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE future_valid_stores (
    store_code TEXT PRIMARY KEY,
    city TEXT NOT NULL,
    projected_opening_date TEXT NOT NULL,
    store_size_sqft INTEGER NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE item_master (
    item_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit_cost_inr REAL NOT NULL,
    pack_size INTEGER NOT NULL,
    dimensions TEXT NOT NULL,
    weight_kg REAL NOT NULL
);
```

**Seed counts:** 10 suppliers, 5 warehouses, 20 components, ~60 inventory rows, 15 POs. Additionally, 14 retail datasets fully seeded for Indian regions (Mumbai, Bengaluru, Delhi NCR, Pune, Kolkata, Hyderabad, Ahmedabad, Chennai).

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| GET | `/health` | Status check |
| GET | `/api/dashboard` | Full snapshot (inventory, warehouses, suppliers, POs, map) |
| POST | `/api/query` | NL query -> AI orchestrator -> JSON contract |
| GET | `/api/store-sales` | Retrieve Store Sales data |
| GET | `/api/ecomm-sales` | Retrieve eComm Sales data |
| GET | `/api/ecomm-inventory` | Retrieve eComm Inventory levels |
| GET | `/api/ecomm-instock` | Retrieve eComm Instock metrics |
| GET | `/api/ecomm-returns` | Retrieve eComm Returns list |
| GET | `/api/dc-metrics` | Retrieve DC logistics metrics |
| GET | `/api/order-forecast` | Retrieve order replenishment forecasts |
| GET | `/api/demand-forecast` | Retrieve consumer demand forecasts |
| GET | `/api/vendor-scorecard` | Retrieve vendor scorecard evaluation metrics |
| GET | `/api/tender-analysis` | Retrieve carrier bidding and rates |
| GET | `/api/store-mumd` | Retrieve store markdown/markup details |
| GET | `/api/modular-plan` | Retrieve planogram shelf alignments |
| GET | `/api/future-valid-stores` | Retrieve store expansion pipeline |
| GET | `/api/item-master` | Retrieve SKU master attributes |
| GET | `/api/exceptions` | Run exception detection logic |
| GET | `/api/demand-intelligence` | Retrieve demand-vs-order alignment and sell-through |
| GET | `/api/automated-insights` | Get automated operations concern alerts |
| POST | `/api/sso-builder/calculate` | Execute breakpack ordering calculation |

All agent responses follow JSON contract: `{intent, frontend_action, payload, summary}`

---

## Frontend Routes

| Route | File | Content |
|-------|------|---------|
| `/` | `app/page.tsx` | Executive Dashboard (overview) |
| `/login` | `app/login/page.tsx` | Login page |
| `/[section]` | `app/[section]/page.tsx` | Dynamic router supporting 14 retail sub-pages, maps, scorecards, exception queues, and interactive SSO Builder calculator |

All pages (except login) wrapped in `<AuthGuard>`.

---

## Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#0A0A0B` | Main bg |
| `--card` | `#131316` | Card bg |
| `--card-raised` | `#1C1C21` | Hover/active |
| `--border` | `#2A2A30` | Dividers |
| `--foreground` | `#F4F4F5` | Main text |
| `--muted` | `#9A9AA3` | Secondary text |
| `--primary` | `#22C55E` | Green accent |
| `--accent-strong` | `#2563EB` | Blue accent |
| `--critical` | `#EF4444` | High risk |
| `--warning` | `#F59E0B` | Medium risk |
| `--healthy` | `#22C55E` | Low risk |
| Fonts | Inter (sans), JetBrains Mono (mono), Anta (display) | |

---

## Key Backend Logic

### Risk Formula (`backend/risk.py`)
```
S_in = replenishment * lead_time * fulfillment_rate
S_out = forecasted_demand * lead_time
P(S) = clamp((S_out - I_c - S_in) / S_out, 0, 1)
```
Categories: Safe (≤0.2), Warning (0.2–0.6), Critical (>0.6)

### AI Agent (`backend/orchestrator.py`)
- Model: Gemini 2.5 Flash (REST API, no SDK)
- 2-turn conversation: generates tool calls, then final response with results
- Falls back to offline mock if no API key
- Tools: `query_database` (read-only SQL), `get_alternate_suppliers` (ranked), `simulate_rerouting` (cost/time delta)

### Disruption Engine (`backend/disruptions.py`)
- In-memory state (resets on restart)
- `trigger_jnpt_disruption()`: finds POs on JNPT-Mumbai route, computes risk deltas

---

## Key Frontend Components

### `Dashboard` (`components/supplysense/dashboard.tsx`)
- Sub-components: BrandMark, Sidebar, MobileNav, Header, KpiStrip, DisruptionCard, InventoryTable, Warehouses, Forecast (Recharts), Suppliers, Shipments, CopilotDrawer, PayloadRenderer, SummaryModal, PageIntro, FilterBar, InsightRail, ActivityFeed, PageContent
- Data: fetches `/api/dashboard` on mount, falls back to `supplysense-data.ts`

### `FlowMap` (`components/supplysense/flow-map.tsx`)
- Leaflet with CartoDB dark tiles, centered India [21.5, 78.5], zoom 5
- 14 geo nodes (warehouses/suppliers/ports), 10 routes with color-coded animations

### `ScoreProgress` (`components/supplysense/score-progress.tsx`)
- SVG circular progress: red (<70), amber (<85), green (>=85)

### `AuthGuard` (`components/supplysense/auth-guard.tsx`)
- Redirects to `/login` if unauthenticated

---

## Commands

```bash
pnpm install          # Install frontend deps
pnpm run dev          # Next.js dev (webpack)
pnpm run build        # Next.js build
pnpm run start        # Next.js start
pnpm run lint         # ESLint

cd backend && pip install -r requirements.txt && uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
python backend/data.py   # Seed DB (idempotent)

python tests/run_tests.py
python -m pytest tests/ -v --tb=short

docker-compose up -d
```

---

## Component Dependency Map

```
Next.js App Router
└── layout.tsx (AuthProvider)
    ├── /login -> LoginPage
    └── /* -> AuthGuard -> Dashboard(activePage)
         ├── BrandMark
         ├── Sidebar (Links: /network /inventory /shipments /warehouses /suppliers)
         ├── Header (search, Simulate JNPT, Executive Brief, Copilot toggle, user menu)
         ├── MobileNav
         ├── KpiStrip (4 cards)
         ├── DisruptionCard (conditional)
         ├── FlowMap (network page)
         ├── Shipments list
         ├── InventoryTable
         ├── Forecast (Recharts)
         ├── Warehouses (util bars)
         ├── Suppliers (ScoreProgress)
         ├── CopilotDrawer -> API /api/query -> PayloadRenderer
         ├── SummaryModal -> API /api/summary/generate
         └── GuidedDemo (first visit overlay)
```

---

## Demo Flow (3-min)

1. Dashboard → KPI strip shows live data
2. Click "Simulate JNPT Port Strike" → map route red, alert modal shows PO-889 impact, ₹1.2 Cr exposure
3. Ask "Which products are at risk?" → ranked table
4. Ask "Which suppliers miss deliveries next week?" → ranked risk list
5. Ask "Which warehouse should fulfill this order?" → recommendation
6. Ask "Recommend alternate suppliers for Lithium-Ion Battery Pack" → comparison, recommends Deccan Manufacturing (Pune)
7. "Generate Executive Summary" → markdown modal, "Send to Procurement" copies to clipboard

---

## Maintenance Rule

After every code change, update BOTH files:
- `memory.md` — keep project context, tech stack, architecture, and schema accurate
- `map.md` — keep UI element locations (file:line) for every button, heading, section, and page up to date
