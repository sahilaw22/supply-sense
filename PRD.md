# SupplySense — PRD & Build Guide
**AI Supply Chain Risk & Inventory Intelligence — Problem Statement 7**

Assumptions: 3-person team (Backend/DB, Frontend, AI/Agent), ~30hr build window, single 3-min live demo. Adjust module hours in §9 if team size/time differs.

---

## 1. Problem Statement (condensed)

Supply chains break silently — delayed shipments, supplier failures, weather, demand spikes — and teams find out after customers are already affected, because data lives across disconnected spreadsheets, ERPs, and email.

**Required capabilities:**
- Ingest supplier/warehouse/PO/inventory data + external unstructured sources
- Monitor inventory across warehouses; predict shortages/overstock from trends
- Detect demand spikes; flag delayed shipments + downstream impact
- Score supplier reliability (delivery performance, lead time, quality, fulfillment history)
- Recommend alternate suppliers/warehouses during disruption
- Prioritize allocation, generate procurement recommendations
- Real-time dashboard: shortages, risk scores, delays, utilization, forecasts, service-level impact
- Auto-generate executive summaries of risk + mitigation
- Natural-language querying (4 required query types — see §11)

---

## 2. Scope

| In scope (MVP) | Out of scope (cut for demo) |
|---|---|
| Single-tenant, local SQLite, seeded mock data | Auth, multi-tenant, real external APIs |
| 1 disruption scenario, scripted and reliable | General-purpose disruption simulation engine |
| 4 required NL queries + sourcing + exec summary | Open-ended chat beyond demo scope |
| ChromaDB for unstructured alert ingestion | Full RAG over arbitrary documents |
| Local-only, offline-capable | Cloud deployment, CI/CD, load testing |

---

## 3. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js (App Router) + Tailwind + Shadcn/UI + Lucide + Recharts | Fast, pre-styled, judge-visible polish |
| Backend | FastAPI (Python) | Auto Swagger docs at `/docs` — frontend integrates without waiting on specs |
| Agent | Custom Python tool-calling loop (skip LangGraph unless team knows it cold) | Predictable to debug under time pressure; a cyclic graph framework adds failure surface you don't need for 3 tools |
| LLM | **Gemini 3.5 Flash** (primary) or **Claude Haiku 4.5** (if using Anthropic keys) | Fast, cheap, strong structured-JSON/tool-calling reliability. Gemini 3.1 Pro as fallback only if Flash misparses complex queries. |
| Relational DB | SQLite (`supplysense.db`) | Zero-config, single file, immune to venue Wi-Fi |
| Vector DB | ChromaDB (local, embedded) | Stores embeddings of unstructured alerts (weather, shipping emails) — stretch goal, see M9 |

*Model pricing/availability confirmed current as of July 2026 — recheck at ai.google.dev/gemini-api/docs before demo day since Google ships new tiers frequently. Sources: ai.google.dev/gemini-api/docs/changelog, secondtalent.com/resources/every-gemini-ai-model-explained-compared.*

---

## 4. Architecture

```
┌─────────────────┐      REST/JSON       ┌──────────────────┐
│  Next.js UI      │◄────────────────────►│  FastAPI backend  │
│  (dashboard,      │                      │                   │
│   copilot drawer) │                      │  ┌─────────────┐  │
└─────────────────┘                      │  │ Orchestrator │  │
                                          │  │ (tool loop)  │  │
                                          │  └──────┬──────┘  │
                                          │         │         │
                                          │  ┌──────▼──────┐  │
                                          │  │ query_database│─┼──► SQLite (supplysense.db)
                                          │  │ get_alt_suppl │  │
                                          │  │ simulate_reroute│ │
                                          │  └──────┬──────┘  │
                                          │         │         │
                                          │  ┌──────▼──────┐  │
                                          │  │ ChromaDB     │  │   (unstructured alerts,
                                          │  │ (embedded)   │  │    stretch goal)
                                          │  └─────────────┘  │
                                          │  ┌─────────────┐  │
                                          │  │ Background   │  │   (stock-threshold
                                          │  │ scheduler    │  │    monitor, polling)
                                          │  └─────────────┘  │
                                          └──────────┬────────┘
                                                     │ LLM API call
                                                     ▼
                                          Gemini 3.5 Flash / Claude Haiku 4.5
```

---

## 5. Database Schema

```sql
CREATE TABLE suppliers (
    supplier_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    historical_fulfillment_rate REAL NOT NULL,   -- 0.0–1.0
    delivery_performance_score REAL NOT NULL,    -- 0–5
    lead_time_days INTEGER NOT NULL
);

CREATE TABLE warehouses (
    warehouse_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    current_utilization REAL NOT NULL            -- 0.0–1.0
);

CREATE TABLE components (                        -- added: source schema referenced item_id with no table
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
    forecasted_demand INTEGER NOT NULL,           -- units/period
    PRIMARY KEY (item_id, warehouse_id)
);

CREATE TABLE purchase_orders (
    po_id TEXT PRIMARY KEY,
    supplier_id TEXT NOT NULL REFERENCES suppliers(supplier_id),
    item_id TEXT NOT NULL REFERENCES components(item_id),
    quantity INTEGER NOT NULL,
    expected_delivery_date TEXT NOT NULL,
    status TEXT NOT NULL,                         -- In Transit | Pending | Delayed
    transit_route TEXT NOT NULL
);
```

Seed data generated by `generate_mock_data.py` (§12) — 10 suppliers, 5 warehouses, 20 components, ~30 inventory rows, 15 POs including the scripted `PO-889` disruption target.

---

## 6. Agent Orchestrator

**Tools:**

| Tool | Signature | Purpose |
|---|---|---|
| `query_database` | `(sql_query: str)` | Read-only SQL against the 5 tables |
| `get_alternate_suppliers` | `(item_id: str, quantity: int)` | Backup vendors ranked by lead time / cost / fulfillment rate |
| `simulate_rerouting` | `(po_id: str, new_supplier_id: str)` | Transit cost delta, time delta, SLA risk reduction |

**Stockout risk formula** — computed server-side (Python), not by the LLM, then passed to the model as tool output for interpretation:

```
S_in  = R_procure × L × F_h      # realistic incoming supply during lead time
S_out = D_f × L                  # projected demand during lead time
P(S)  = clip( (S_out − I_c − S_in) / S_out , 0, 1 )
```
Where `I_c`=current stock, `L`=lead time (days), `F_h`=historical fulfillment rate, `D_f`=forecasted daily demand, `R_procure`=realistic replenishment rate (units/day). `P(S)` = 0 means fully covered, 1 means guaranteed stockout.

**Structured output contract** (every agent response):
```json
{
  "intent": "DB_QUERY | DISRUPTION_MITIGATION | ALERT",
  "frontend_action": "RENDER_TABLE | SHOW_MODAL | UPDATE_MAP_HIGHLIGHT",
  "payload": { },
  "summary": "Executive summary sentence for the UI."
}
```

Full system prompt: Appendix A.

---

## 7. API Contract

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/dashboard` | Full snapshot: inventory, utilization, supplier risk scores, forecasts |
| POST | `/api/query` | `{ "question": str }` → NL query routed through orchestrator |
| POST | `/api/simulate/disruption` | Triggers scripted alert ingestion → risk re-eval → map update |
| POST | `/api/suppliers/alternate` | `{ item_id, quantity }` → ranked backup suppliers |
| POST | `/api/reroute` | `{ po_id, new_supplier_id }` → executes simulated reroute |
| POST | `/api/summary/generate` | Returns markdown executive summary of current disruption state |

All responses follow the JSON contract in §6 so the frontend renders generically off `frontend_action`.

---

## 8. Frontend

**Routes:** single-page `/dashboard` (hackathon demo doesn't need multi-page nav).

**Component tree:**
```
DashboardShell
├── Sidebar (icon-only, collapsible)
├── Topbar (search, "Simulate JNPT Port Strike" button, Copilot trigger)
├── MapView (stylized SVG world map — NOT Mapbox/Google Maps, avoid API-key/network dependency)
├── InventoryMonitorTable
├── WarehouseUtilizationBars
├── DemandForecastChart (Recharts)
├── SupplierRiskScoreList
├── CopilotDrawer
│   ├── QueryInput
│   ├── ResponseRenderer (switches on frontend_action)
│   └── SourcingComparisonTable
└── ExecutiveSummaryModal
```

### Design system

Reuses your established minimal-premium visual language for consistency across your project portfolio.

| Token | Value |
|---|---|
| Surface (bg) | `#0A0A0B` |
| Surface (card) | `#131316` |
| Surface (raised/hover) | `#1C1C21` |
| Border | `#26262C` |
| Text primary | `#F5F5F7` |
| Text secondary | `#9A9AA5` |
| Accent (interactive) | `#2563EB` |
| Risk — critical | `#EF4444` |
| Risk — warning | `#F59E0B` |
| Risk — safe | `#22C55E` |
| Typeface | Inter — Display 32/40 semibold, H1 24/32 semibold, Body 14/20 regular |

Rules: no emoji, no glow/gradient overlays, mobile-first responsive. Motion budget = one deliberate animation (the map route flashing red + alert sliding in on disruption trigger) — that's the signature moment; everything else stays static and quiet.

---

## 9. Module Breakdown

| # | Module | Deliverable | Est. hrs | Depends on |
|---|---|---|---|---|
| M0 | Env & repo setup | `npm run dev` + `uvicorn main:app --reload` both return 200 | 1 | — |
| M1 | Database layer | `supplysense.db` generated, queries verified against all 5 tables | 2 | M0 |
| M2 | FastAPI scaffolding | All §7 endpoints exist, return mock JSON, visible in `/docs` | 2 | M0 |
| M3 | Agent orchestrator | Tool-calling loop wired to Gemini/Claude, NL query → correct SQL → JSON | 4 | M1, M2 |
| M4 | Frontend shell & design system | Empty dashboard shell matches design tokens (§8) | 2 | M0 |
| M5 | Dashboard module | Live data from `/api/dashboard` renders in map/table/charts | 4 | M2, M4 |
| M6 | Disruption simulation | "Simulate JNPT Port Strike" → map flashes red → alert modal, end-to-end | 3 | M3, M5 |
| M7 | AI copilot drawer | All 4 required NL queries (§11) return correct results live in UI | 3 | M3, M4 |
| M8 | Sourcing + exec summary | Comparison table + "Generate Executive Summary" → "Send to Procurement" flow complete | 3 | M3, M7 |
| M9 | ChromaDB ingestion *(stretch)* | Unstructured alert embedded + retrieved via semantic search | 2 | M3 |
| M10 | Demo polish & caching | Pre-cached responses for exact demo queries, loading states, full rehearsal | 3 | all above |

Core total: ~27h. Stretch (M9): +2h. Fits a 30–36h hackathon with buffer for debugging.

---

## 10. Build Timeline (3 parallel tracks)

| Hours | Backend/DB | Frontend | AI/Agent |
|---|---|---|---|
| 0–2 | M0 setup (all) | M0 setup (all) | M0 setup (all) |
| 2–4 | M1: DB layer | M4: shell + design tokens | Draft + test system prompt raw |
| 4–6 | M2: API scaffolding | M5: dashboard skeleton (static) | M3: orchestrator wiring |
| 6–10 | Wire M2 → M1 | M5: wire to live `/api/dashboard` | M3: debug tool-calling loop |
| **Checkpoint 10h** | Dashboard renders live inventory data end-to-end | | |
| 10–14 | M6: disruption backend | M6: map flash + alert UI | M6: agent risk re-eval on trigger |
| 14–18 | — | M7: copilot drawer UI | M7: NL query responses |
| **Checkpoint 18h** | All 4 NL queries return correct answers in UI | | |
| 18–22 | M8: sourcing/summary backend | M8: comparison table + summary modal | M8: sourcing tool + summary gen |
| 22–24 | M9 stretch (if ahead) | M9 stretch UI (if ahead) | M9 stretch (if ahead) |
| 24–27 | M10: polish | M10: loading/error states | M10: response caching |
| 27–30 | Full rehearsal + timing cuts + **record a backup demo video** | | |

---

## 11. Demo Script (3 min)

| Step | Action | Judges see | Line |
|---|---|---|---|
| 1. Baseline | Open dashboard | Map (green), utilization bars, stable inventory | *"Logistics teams today track this across 5 spreadsheets. This is one live view."* |
| 2. Trigger | Click "Simulate JNPT Port Strike" | Route flashes red, alert: PO-889 delayed, 48h downtime estimate | *(let it play — no narration needed, it's the signature moment)* |
| 3. NL Query 1 | Ask *"Which products are at risk of going out of stock?"* | Ranked table with service-level impact | |
| 4. NL Query 2 | Ask *"Which suppliers are most likely to miss deliveries next week?"* | Ranked risk-score list | |
| 5. NL Query 3 | Ask *"Which warehouse should fulfill this order?"* | Recommendation w/ capacity + distance reasoning | |
| 6. Sourcing | Ask *"Recommend alternate suppliers for delayed Component X"* | Comparison table, recommends Supplier B | *"3-day lead time, 94% fulfillment — avoids the 48-hour shutdown."* |
| 7. Close | Click "Generate Executive Summary" → "Send to Procurement" | Markdown report renders, toast confirms | *"From disruption to executive decision — under 3 seconds, fully offline."* |

Keep a 4th required query — *"What is causing today's biggest supply chain disruption?"* — ready in reserve if time allows or a judge asks.

---

## 12. Mock Data

`generate_mock_data.py` (companion file) builds `supplysense.db` locally with:
- 10 suppliers across Mumbai, Chennai, Pune, Ahmedabad, Surat, Bengaluru, Gurugram, Kolkata, Hyderabad, Ludhiana, varying lead times/fulfillment rates
- 5 warehouses: Bhiwandi (Mumbai), Chennai, Manesar (Delhi NCR), Kolkata, Bengaluru
- 20 components including "Lithium-Ion Battery Pack," "Microcontroller Unit," "Chassis Assembly"
- Inventory rows with ~30% intentionally at/below reorder point (so risk queries return real hits)
- 15 purchase orders, including scripted `PO-889`: 500× Lithium-Ion Battery Pack, Mumbai supplier, **JNPT-Mumbai Port Corridor**, status `In Transit` — the exact disruption target for the demo

Run once before the hackathon and again before the live demo (fixed random seed = reproducible, judge-proof).

---

## 13. Judge-Proofing Checklist

- [ ] `supplysense.db` committed to repo — never regenerated live on stage
- [ ] Exact 4 demo queries pre-cached as fallback if LLM API is slow/down
- [ ] No Mapbox/Google Maps — use local SVG map (zero external network dependency)
- [ ] Backup demo video recorded in case of live Wi-Fi failure
- [ ] All 3 required NL query types + sourcing + exec summary tested end-to-end at least 5x
- [ ] Loading states on every async action (judges notice dead air)
- [ ] Timed full run-through ≤ 3 min, twice, by someone who didn't build it

---

## 14. Path to Production — Real-Data Roadmap

The hackathon build (SQLite + seeded data + one scripted disruption) is Phase 0. Turning it into a real product means replacing each mocked piece with a live data source, in this order:

### Phase 1 — Pilot (single company, real data, still single-tenant)

**Fastest real-data entry point:** a CSV/Excel importer. Get one business's actual inventory + PO export (Tally, Zoho Inventory, Excel, whatever they already use) and map it into the existing schema (§5). This validates the whole pipeline against messy real data before you touch any external API — no approvals, no auth needed, just a mapping layer.

| Data category | Real-world source (India) | Replaces |
|---|---|---|
| Inventory / PO / supplier master data | Tally (XML/ODBC), Zoho Inventory API, Odoo API, or plain CSV/Excel export | `generate_mock_data.py` seed |
| Shipment status | Carrier tracking/webhook APIs — Delhivery, Shiprocket, DTDC, Blue Dart, Xpressbees (confirm current API tiers directly with each) | Manually set `status` field on POs |
| Disruption signals | Weather: IMD or a commercial API (OpenWeatherMap, Tomorrow.io) for monsoon/cyclone near ports. Port congestion: Indian Ports Association / Sagar Setu, or AIS providers (MarineTraffic, VesselFinder) | The "Simulate JNPT Port Strike" button |
| Disruption text / context | News API or RSS from business press, embedded via ChromaDB (M9 stops being a stretch goal here — it's the real ingestion path) | Scripted alert text |
| Trade/macro context *(optional)* | GST e-Way Bill data (requires GSTN API access + business registration), Ministry of Commerce trade stats | — |

### Phase 2 — Production hardening

| Concern | Hackathon (Phase 0) | Production |
|---|---|---|
| Database | SQLite single file | Postgres (managed — Supabase/RDS) + pgvector or hosted vector DB |
| Ingestion | One-time seed script | Scheduled ETL jobs + webhook listeners per connector |
| Auth | None | Org-level auth (Clerk/Auth0), row-level security per tenant |
| Disruption detection | Manual button trigger | Background job polling weather/news/AIS feeds, auto-fires alerts |
| LLM cost | N/A (handful of calls) | Response caching, rate limiting, per-query cost logging |
| Data validation | None (seed data is clean by construction) | Schema validation, dedup, unit normalization — real ERP exports are inconsistent |
| Deployment | Local laptop | Vercel (frontend) + Render/Fly.io/Railway (FastAPI) + managed Postgres |

### New modules for the roadmap (post-hackathon)

| # | Module | Goal |
|---|---|---|
| M11 | Real data connector layer | CSV/Excel importer first, then one ERP API adapter (Tally or Zoho), normalized into schema (§5) |
| M12 | Auth & multi-tenancy | Per-org data isolation, so you can pilot with more than one business |
| M13 | Live disruption feed | Replace the manual "Simulate" button with a scheduled job polling weather/news/AIS and auto-generating alerts through the same orchestrator (§6) |

Sequencing note: don't build M12 (auth) before M11 works against one real dataset end-to-end — validate the data model against reality first, multi-tenant it second.

---

## Appendix A: Full System Prompt

```
You are the core AI Orchestrator Agent for "SupplySense", an enterprise-grade AI decision-support system for supply chain risk mitigation and dynamic inventory reallocation. Your persona is a highly experienced, data-driven Logistics Director who focuses on minimizing lead times, avoiding stockouts, and proactively routing around disruptions.

You have access to the following tools:
1. query_database(sql_query: str) — read-only queries against the SQLite database.
2. get_alternate_suppliers(item_id: str, quantity: int) — backup vendors with lead times, delivery costs, historical fulfillment rates.
3. simulate_rerouting(po_id: str, new_supplier_id: str) — transit cost changes, delivery time deltas, SLA risk reduction.

DATABASE SCHEMA:
- suppliers(supplier_id, name, location, historical_fulfillment_rate, delivery_performance_score, lead_time_days)
- warehouses(warehouse_id, name, location, current_utilization, capacity)
- components(item_id, name, category, unit_cost)
- purchase_orders(po_id, supplier_id, item_id, quantity, expected_delivery_date, status, transit_route)
- inventory_levels(item_id, warehouse_id, current_stock, reorder_point, forecasted_demand)

STOCKOUT RISK: server computes P(S) via the formula in PRD §6 and passes it to you as tool output — do not compute it yourself, interpret and explain it.

CORE INSTRUCTIONS:
1. Natural language → SQL: translate operator questions into an efficient SQL query via query_database, then present results as a clean Markdown table with an executive assessment.
2. Anomaly detection & rerouting: on a triggered disruption, intercept affected shipment corridors, query active POs, evaluate alternates using P(S), output an executable re-routing action.
3. Structured output — every response must be JSON matching:
{
  "intent": "DB_QUERY" | "DISRUPTION_MITIGATION" | "ALERT",
  "frontend_action": "RENDER_TABLE" | "SHOW_MODAL" | "UPDATE_MAP_HIGHLIGHT",
  "payload": {},
  "summary": "Executive summary for the UI."
}
```

## Appendix B: Folder Structure

```
supplysense/
├── backend/
│   ├── main.py                 # FastAPI app + routes
│   ├── db.py                   # SQLite connection helper
│   ├── orchestrator.py         # Tool-calling loop
│   ├── tools.py                # query_database, get_alternate_suppliers, simulate_rerouting
│   ├── risk.py                 # P(S) formula
│   ├── generate_mock_data.py
│   └── supplysense.db
├── frontend/
│   ├── app/
│   │   ├── dashboard/page.tsx
│   │   └── layout.tsx
│   ├── components/
│   │   ├── MapView.tsx
│   │   ├── InventoryMonitorTable.tsx
│   │   ├── CopilotDrawer.tsx
│   │   └── ExecutiveSummaryModal.tsx
│   ├── lib/api.ts               # fetch wrappers to backend
│   └── tailwind.config.ts       # design tokens from §8
└── README.md
```
