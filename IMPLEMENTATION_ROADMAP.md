# SupplySense — Comprehensive Implementation Roadmap

**Version:** 1.0  
**Date:** July 2026  
**Target:** 3-person team, ~30hr build window, single 3-min live demo  
**Status:** Ready for Development

---

## Executive Summary

This roadmap provides a step-by-step guide to build SupplySense, an AI-powered supply chain risk and inventory intelligence platform. It consolidates:

1. **Product vision** (PRD.md) — 7 core capabilities: real-time monitoring, shortage prediction, supplier scoring, disruption detection, alternate sourcing, allocation recommendations, and natural language querying
2. **Frontend design** (frontend.md) — dark-themed dashboard with map, tables, charts, and AI copilot drawer
3. **Test data** (data.py) — 10 suppliers, 5 warehouses, 20 components, 15 POs, including scripted `PO-889` disruption scenario

**Deliverables by phase:** Working dashboard → disruption simulation → AI-powered NL queries → sourcing + executive summaries → full demo-ready system.

---

## Part 1: Foundation & Setup

### Phase 0: Environment & Repository Setup (1 hour)

**Objectives:**
- Initialize frontend and backend projects
- Verify both development servers run without error
- Confirm test data generation works

**Tasks:**

#### 0.1 Backend Setup
- [ ] Create `/backend` directory with Python project structure
  - [ ] `main.py` — FastAPI app scaffold with CORS enabled
  - [ ] `requirements.txt` — FastAPI, uvicorn, google-generativeai (or anthropic), sqlite3, chromadb
  - [ ] `.env.example` — `GEMINI_API_KEY` or `CLAUDE_API_KEY`
  - [ ] `pyproject.toml` or `poetry.lock` (optional but recommended for reproducibility)

**Acceptance:** `uvicorn backend.main:app --reload` starts at `http://localhost:8000` with Swagger docs at `/docs`

#### 0.2 Frontend Setup
- [ ] Create `/frontend` directory (Next.js App Router)
  - [ ] `npm create next-app@latest` with TypeScript, Tailwind, App Router enabled
  - [ ] Install shadcn/ui, Lucide icons, Recharts
  - [ ] Tailwind config updated with design tokens (see §1.3 below)
  - [ ] `lib/api.ts` — fetch wrapper functions for backend endpoints

**Acceptance:** `npm run dev` starts at `http://localhost:3000` with hot reload

#### 0.3 Data Layer Initialization
- [ ] Copy `data.py` to `/backend/data.py`
- [ ] Run `python backend/data.py` → generates `supplysense.db`
- [ ] Verify SQLite structure:
  ```bash
  sqlite3 supplysense.db ".schema"
  ```
  Should output all 5 tables: suppliers, warehouses, components, inventory_levels, purchase_orders

**Acceptance:** `supplysense.db` exists, contains 10 suppliers, 5 warehouses, 20 components, 15 POs, `PO-889` present with status "In Transit" on "JNPT-Mumbai Port Corridor"

#### 0.4 Git & Documentation
- [ ] Initialize git repo, commit initial structure
- [ ] Create root `README.md` with:
  - Quick-start commands (backend, frontend)
  - How to regenerate mock data
  - Design system token reference
  - Architecture diagram (copy from PRD §4)

**Success Criteria:**
- ✅ Both servers run simultaneously without errors
- ✅ `/api/docs` (Swagger) is accessible
- ✅ Mock database is reproducible and complete
- ✅ README is clear enough for a new team member to onboard in <5 min

---

### Phase 1: Database Layer & Core Utilities (2 hours)

**Objectives:**
- Build SQLite abstraction layer with safe, efficient queries
- Implement risk scoring formula (P(S) from PRD §6)
- Prepare query helper functions used by agent orchestrator

**Tasks:**

#### 1.1 SQLite Connection & Query Helpers
- [ ] Create `backend/db.py`
  - [ ] `get_connection()` — returns SQLite conn with row factory set to Dict-like
  - [ ] `execute_query(sql_query: str) -> List[Dict]` — safe read-only wrapper
  - [ ] `get_supplier_by_id(supplier_id: str) -> Dict`
  - [ ] `get_component_by_id(item_id: str) -> Dict`
  - [ ] `get_inventory_level(item_id: str, warehouse_id: str) -> Dict`
  - [ ] `get_all_purchase_orders() -> List[Dict]`
  - [ ] `get_po_by_id(po_id: str) -> Dict`

**Implementation detail:** Use parameterized queries to prevent SQL injection (all are read-only, but good practice). Return empty lists/dicts gracefully on miss.

#### 1.2 Risk Scoring Module
- [ ] Create `backend/risk.py`
  - [ ] `calculate_stockout_risk(item_id: str, warehouse_id: str) -> float`
    - Input: current stock, reorder point, forecasted demand, lead time, historical fulfillment rate
    - Formula (from PRD §6):
      ```
      S_in  = realistic_replenishment × L × F_h
      S_out = D_f × L
      P(S)  = clip((S_out - I_c - S_in) / S_out, 0, 1)
      ```
    - Output: float 0.0–1.0 (0 = fully covered, 1 = guaranteed stockout)
  - [ ] `get_risk_category(risk_score: float) -> str` → "Safe" (≤0.2), "Warning" (0.2–0.6), "Critical" (>0.6)
  - [ ] `get_risk_color(risk_score: float) -> str` → "#22C55E" (safe), "#F59E0B" (warning), "#EF4444" (critical)

**Validation:** Hand-test with ITEM-001 (battery pack) at WH-001 (Bhiwandi). Verify P(S) is between 0 and 1.

#### 1.3 Design System / Tailwind Config
- [ ] Update `frontend/tailwind.config.ts` with design tokens (from PRD §8):
  ```typescript
  theme: {
    colors: {
      surface: {
        base: "#0A0A0B",
        card: "#131316",
        raised: "#1C1C21",
      },
      border: "#26262C",
      text: {
        primary: "#F5F5F7",
        secondary: "#9A9AA5",
      },
      accent: "#2563EB",
      risk: {
        safe: "#22C55E",
        warning: "#F59E0B",
        critical: "#EF4444",
      },
    },
    fontFamily: {
      sans: "Inter, sans-serif",
    },
    fontSize: {
      "display-xl": ["32px", { lineHeight: "40px", fontWeight: "600" }],
      "h1": ["24px", { lineHeight: "32px", fontWeight: "600" }],
      "body": ["14px", { lineHeight: "20px", fontWeight: "400" }],
    },
  }
  ```

**Acceptance:** Tailwind build completes, no warnings. Can reference `bg-surface-card`, `text-text-primary`, `text-risk-critical` in component classes.

---

## Part 2: Backend API & Agent Core

### Phase 2: FastAPI Scaffolding & Endpoints (2 hours)

**Objectives:**
- Build all 6 API endpoints from PRD §7
- Wire them to database layer (M1)
- Verify Swagger docs are complete and discoverable

**Tasks:**

#### 2.1 Endpoint Stubs
- [ ] Create `backend/main.py` with FastAPI app
  - [ ] `GET /api/dashboard` — returns full snapshot (see 2.2 below)
  - [ ] `POST /api/query` — NL query entry point (request: `{"question": str}`, response: JSON contract)
  - [ ] `POST /api/simulate/disruption` — triggers scripted alert
  - [ ] `POST /api/suppliers/alternate` — request: `{"item_id": str, "quantity": int}`, returns ranked alternates
  - [ ] `POST /api/reroute` — request: `{"po_id": str, "new_supplier_id": str}`, simulates reroute
  - [ ] `POST /api/summary/generate` — returns markdown executive summary

All endpoints return the **structured JSON contract** (PRD §6):
```json
{
  "intent": "DB_QUERY | DISRUPTION_MITIGATION | ALERT",
  "frontend_action": "RENDER_TABLE | SHOW_MODAL | UPDATE_MAP_HIGHLIGHT",
  "payload": { },
  "summary": "Executive summary sentence for the UI."
}
```

#### 2.2 Dashboard Data Shape
- [ ] `/api/dashboard` aggregates:
  - **Inventory snapshot:** all inventory_levels with risk scores
  - **Utilization:** all warehouses with capacity/utilization %
  - **Supplier risk:** all suppliers with delivery_performance_score, historical_fulfillment_rate, lead_time_days
  - **Forecasts:** components with demand trends (naive: forecasted_demand from inventory_levels)
  - **Active POs:** all purchase_orders with status, transit route, supplier name
  - **Map data:** GeoJSON-like structure (warehouse locations, supplier locations, active routes)

Example response structure:
```json
{
  "inventory": [
    {
      "item_id": "ITEM-001",
      "item_name": "Lithium-Ion Battery Pack",
      "warehouse_id": "WH-001",
      "warehouse_name": "Mumbai Distribution Hub",
      "current_stock": 120,
      "reorder_point": 200,
      "forecasted_demand": 80,
      "risk_score": 0.45,
      "risk_category": "Warning"
    }
  ],
  "warehouses": [
    {
      "warehouse_id": "WH-001",
      "name": "Mumbai Distribution Hub",
      "location": "Bhiwandi, Maharashtra",
      "capacity": 15000,
      "current_utilization": 0.72
    }
  ],
  "suppliers": [
    {
      "supplier_id": "SUP-001",
      "name": "Konkan Components Pvt Ltd",
      "location": "Mumbai, Maharashtra",
      "delivery_performance_score": 4.2,
      "historical_fulfillment_rate": 0.94,
      "lead_time_days": 5
    }
  ],
  "purchase_orders": [
    {
      "po_id": "PO-889",
      "supplier_id": "SUP-001",
      "supplier_name": "Konkan Components Pvt Ltd",
      "item_id": "ITEM-001",
      "item_name": "Lithium-Ion Battery Pack",
      "quantity": 500,
      "expected_delivery_date": "2026-07-24",
      "status": "In Transit",
      "transit_route": "JNPT-Mumbai Port Corridor"
    }
  ]
}
```

#### 2.3 Mock Responses
- [ ] For now, endpoints return hardcoded mock JSON (replace in M3 with real LLM calls)
- [ ] Ensure response times are <200ms (no async delays yet)

**Acceptance:** 
- ✅ All 6 endpoints exist
- ✅ GET `/api/docs` shows all endpoints with schemas
- ✅ Sample calls return 200 with correct structure
- ✅ No CORS errors when called from `http://localhost:3000`

---

### Phase 3: Agent Orchestrator & Tool-Calling Loop (4 hours)

**Objectives:**
- Build the core AI orchestrator that translates natural language → tools → structured JSON
- Wire Gemini 3.5 Flash (or Claude) for NL understanding
- Implement the 3 required tools: `query_database`, `get_alternate_suppliers`, `simulate_rerouting`
- **Test thoroughly** with the 4 required demo queries + sourcing + exec summary

**Tasks:**

#### 3.1 Tool Implementation
- [ ] Create `backend/tools.py` with tool functions:

**`query_database(sql_query: str) -> Dict`**
- Takes a SQL query string (generated by LLM)
- Calls `db.execute_query(sql_query)`
- Returns rows as list of dicts + row count
- **Safety:** Hard-code a whitelist of allowable table names and columns; reject any INSERT/UPDATE/DELETE
- **Example use:** LLM sees "Which items are below reorder point?" → generates `SELECT item_id, name, current_stock, reorder_point FROM inventory_levels WHERE current_stock < reorder_point` → tool runs it → returns results

**`get_alternate_suppliers(item_id: str, quantity: int) -> List[Dict]`**
- Query all suppliers not already supplying this item (or alternative suppliers)
- Rank by: (1) lead time, (2) historical fulfillment rate, (3) unit cost
- Include: supplier_id, name, location, lead_time_days, fulfillment_rate, unit_cost (lookup from components table)
- Return top 3–5
- **Example use:** LLM sees "PO-889 is delayed, recommend alternates for Lithium-Ion Battery Pack" → calls tool with item_id="ITEM-001", quantity=500 → returns ranked list

**`simulate_rerouting(po_id: str, new_supplier_id: str) -> Dict`**
- Look up original PO: original supplier, quantity, current location/route
- Look up new supplier: location, lead time
- Return structure:
  ```json
  {
    "original_supplier": "SUP-001",
    "original_lead_time": 5,
    "new_supplier": "SUP-003",
    "new_lead_time": 7,
    "lead_time_delta_days": 2,
    "estimated_cost_delta_usd": 450.00,
    "stockout_risk_reduction": 0.15,
    "recommendation": "Switch recommended — higher lead time but 94% fulfillment rate offsets risk."
  }
  ```
- **Example use:** LLM recommends Supplier B → calls tool → shows cost/time tradeoffs → user approves

#### 3.2 Orchestrator Loop
- [ ] Create `backend/orchestrator.py` with main orchestration function:

```python
async def orchestrate_query(user_question: str) -> Dict:
    """
    Main entry point: NL query → tool calls → structured JSON response.
    """
    # Step 1: Call LLM with system prompt + user question + available tools
    # Step 2: Parse tool calls from LLM response
    # Step 3: Execute each tool, collect results
    # Step 4: Pass results back to LLM for summary/reasoning
    # Step 5: Return JSON contract with intent, frontend_action, payload, summary
```

**System Prompt** (Appendix A in PRD):
- Persona: experienced Logistics Director
- Database schema details
- Tool descriptions + signatures
- Instructions to output JSON contract
- Emphasis on risk scoring interpretation (don't compute P(S), only interpret)

**LLM Integration:**
- Use `google.generativeai` (Gemini) or `anthropic` (Claude)
- Model: **Gemini 3.5 Flash** (recommended) or Claude Haiku 4.5
- Temperature: 0.2 (low creativity, consistent)
- Structured output: Request JSON mode if available

**Tool-calling flow:**
1. Send user question + tools schema to LLM
2. LLM returns tool calls (JSON array, each with tool name + args)
3. Execute each tool sequentially (no parallelization needed for demo)
4. Collect results into `tool_results` list
5. Call LLM again with original question + results → final JSON response

**Error handling:**
- If LLM refuses the query → return error JSON with intent="ALERT", summary="I cannot help with that query."
- If tool execution fails → include error in results, let LLM decide next step
- If LLM doesn't return valid JSON → log it, return fallback schema

#### 3.3 API Integration
- [ ] Wire `/api/query` endpoint to `orchestrator.orchestrate_query()`
  - Request: `{"question": str}`
  - Response: JSON contract (intent, frontend_action, payload, summary)
- [ ] Add request/response logging for debugging

#### 3.4 Testing & Validation
- [ ] Create `backend/test_orchestrator.py` — unit tests for all 3 tools
  - Test `query_database` with known queries (e.g., "SELECT * FROM suppliers LIMIT 1")
  - Test `get_alternate_suppliers` for ITEM-001 (battery pack) → should return suppliers with good fulfillment rates
  - Test `simulate_rerouting` for PO-889 → should show lead time delta

- [ ] **Integration test** — end-to-end NL queries (see §5 below for exact queries)
  - Query 1: "Which products are at risk of going out of stock?"
  - Query 2: "Which suppliers are most likely to miss deliveries next week?"
  - Query 3: "Which warehouse should fulfill this order?"
  - Query 4: "Recommend alternate suppliers for Lithium-Ion Battery Pack"

- [ ] Verify response time: <3s per query (Gemini is fast; set timeout to 5s as safety net)

**Acceptance:**
- ✅ All 3 tools execute correctly against mock data
- ✅ Orchestrator returns valid JSON for all 4 demo queries
- ✅ Response times <3s
- ✅ Logs show tool calls and LLM reasoning (for debugging)

---

## Part 3: Frontend Dashboard

### Phase 4: Frontend Shell & Design System (2 hours)

**Objectives:**
- Build the basic layout structure (DashboardShell)
- Implement design tokens globally
- Create reusable component foundations
- NO data binding yet — everything is static/placeholder

**Tasks:**

#### 4.1 App Layout Structure
- [ ] Create `frontend/app/dashboard/page.tsx`
  - Main page component (DashboardShell)
  - Flex layout: Sidebar (left) + MainContent (right)
  - MainContent sections: Topbar, MapView, InventoryTable, Charts, etc.

- [ ] Create `frontend/components/DashboardShell.tsx`
  ```
  DashboardShell
  ├── Sidebar
  │   └── Nav icons (home, insights, settings, help)
  ├── MainContent
  │   ├── Topbar (search bar, "Simulate JNPT" button, Copilot toggle)
  │   ├── GridLayout (2–3 columns)
  │   │   ├── MapView (1/2 width)
  │   │   ├── InventoryMonitorTable (1/2 width, stacks on mobile)
  │   │   ├── WarehouseUtilizationBars (full width)
  │   │   ├── DemandForecastChart (full width)
  │   │   └── SupplierRiskScoreList (1/3 width)
  │   └── CopilotDrawer (toggles from right edge)
  └── ExecutiveSummaryModal (overlays when triggered)
  ```

#### 4.2 Design System Component Library
- [ ] Create `frontend/components/ui/` folder with shadcn/ui exports:
  - Button, Input, Card, Table, Modal, Drawer, Badge, Tooltip, etc.
  - Customize Tailwind integration to use design tokens

- [ ] Create `frontend/components/DesignTokens.tsx` (or style reference):
  - CSS custom properties (or Tailwind tokens) for colors, typography
  - Example: `--surface-base: #0A0A0B`, `--text-primary: #F5F5F7`, etc.

#### 4.3 Reusable Components
- [ ] `RiskBadge.tsx` — displays risk score (0.0–1.0) with color and label
  ```tsx
  <RiskBadge risk={0.45} /> // "Warning" (yellow)
  <RiskBadge risk={0.85} /> // "Critical" (red)
  ```

- [ ] `InventoryRow.tsx` — single row for inventory table
  - Columns: Item Name, Warehouse, Stock, Reorder Point, Risk

- [ ] `SupplierCard.tsx` — supplier info + scores
  - Supplier name, location, lead time, fulfillment rate, delivery score

- [ ] `StatBox.tsx` — simple stat display (label + large number + sparkline)
  - Used for: total warehouses, active POs, at-risk items, etc.

#### 4.4 Static Layout Demo
- [ ] Build `/dashboard` page with **hard-coded placeholder data**
  - Sidebar visible + responsive
  - Topbar with search + button
  - Placeholder content in each section (no real data yet)
  - CopilotDrawer collapsed on right edge (expandable)
  - ExecutiveSummaryModal hidden by default

- [ ] Mobile responsive: Sidebar collapses to icons on <768px

**Acceptance:**
- ✅ `/dashboard` loads without errors
- ✅ All layout sections visible and roughly positioned
- ✅ Design tokens (colors, fonts) applied throughout
- ✅ No console errors or layout shifts
- ✅ Sidebar collapse/expand works

---

### Phase 5: Dashboard Data Binding & Live Charts (4 hours)

**Objectives:**
- Fetch real data from `/api/dashboard`
- Render live inventory, utilization, forecasts, supplier risk
- Implement interactive charts (Recharts)
- Set up error handling and loading states

**Tasks:**

#### 5.1 API Client
- [ ] Create `frontend/lib/api.ts` with fetch wrappers:
  ```typescript
  export async function getDashboard(): Promise<DashboardData> {
    const res = await fetch('http://localhost:8000/api/dashboard');
    return res.json();
  }

  export async function queryNL(question: string): Promise<OrchestrationResponse> {
    const res = await fetch('http://localhost:8000/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    return res.json();
  }

  // ... other endpoints
  ```

- [ ] Define TypeScript interfaces matching the API contract:
  ```typescript
  interface InventoryItem {
    item_id: string;
    item_name: string;
    warehouse_id: string;
    current_stock: number;
    reorder_point: number;
    risk_score: number;
    risk_category: "Safe" | "Warning" | "Critical";
  }

  interface DashboardData {
    inventory: InventoryItem[];
    warehouses: Warehouse[];
    suppliers: Supplier[];
    purchase_orders: PurchaseOrder[];
  }
  ```

#### 5.2 InventoryMonitorTable
- [ ] Create `frontend/components/InventoryMonitorTable.tsx`
  - Fetch data via `getDashboard()`
  - Display table with columns: Item, Warehouse, Stock, Reorder, Risk
  - Sort by risk score (descending — highest risk first)
  - Highlight rows with risk score > 0.6 (use `bg-surface-raised` + `text-risk-critical`)
  - Pagination or scroll if >15 rows
  - Loading state: skeleton table

#### 5.3 WarehouseUtilizationBars
- [ ] Create `frontend/components/WarehouseUtilizationBars.tsx`
  - Fetch warehouses from `/api/dashboard`
  - Horizontal bar chart (Recharts BarChart)
  - Each warehouse: name + bar (current_utilization / capacity)
  - Color gradient: green (<60%), yellow (60–85%), red (>85%)

#### 5.4 DemandForecastChart
- [ ] Create `frontend/components/DemandForecastChart.tsx`
  - Line/area chart showing forecasted demand over next 30 days (synthetic data)
  - X-axis: date, Y-axis: units
  - Use Recharts LineChart
  - For MVP: fake a 30-day forecast by summing forecasted_demand per day across all items

#### 5.5 SupplierRiskScoreList
- [ ] Create `frontend/components/SupplierRiskScoreList.tsx`
  - List of top 5 suppliers by delivery_performance_score (descending)
  - Per supplier: name, location, score, fulfillment rate
  - Use SupplierCard component

#### 5.6 MapView (Stylized SVG)
- [ ] Create `frontend/components/MapView.tsx`
  - **Do NOT use Mapbox/Google Maps** — local SVG only
  - Simple SVG background: India map outline (or world map)
  - Overlay circles for warehouse locations (blue), supplier locations (green)
  - Lines for active PO routes (thin gray)
  - On hover/click: tooltip with name + details
  - **Later (M6):** routes flash red on disruption trigger
  - **Placeholder:** Use a pre-made SVG or draw simple connected nodes if no time for full map

#### 5.7 Error & Loading States
- [ ] Add React hooks (`useState`, `useEffect`) to fetch data on mount
- [ ] Implement loading spinners (Lucide `Loader2` icon, spinning)
- [ ] Handle API errors gracefully:
  - Show "Failed to load data. Retrying..." banner
  - Auto-retry after 3s
  - Max 3 retries, then fallback to static data
- [ ] Add request timeout (5s)

**Acceptance:**
- ✅ `/dashboard` fetches from `/api/dashboard` and renders real data
- ✅ Inventory table sorts by risk, highlights critical items
- ✅ Utilization bars show correct %age per warehouse
- ✅ Supplier list ranks by score
- ✅ All charts render without errors
- ✅ Loading spinners appear during fetch
- ✅ Error handling works (test by stopping backend temporarily)

---

## Part 4: Disruption Simulation & Core Demo Flow

### Phase 6: Disruption Simulation Trigger & Alert System (3 hours)

**Objectives:**
- Implement the "Simulate JNPT Port Strike" button and scripted disruption flow
- Trigger backend risk re-evaluation
- Animate map route highlight + alert modal
- Set the stage for AI recommendations

**Tasks:**

#### 6.1 Backend Disruption Endpoint
- [ ] Create `backend/disruptions.py`
  - `trigger_disruption(disruption_type: str) -> Dict`
    - Input: "JNPT_PORT_STRIKE" (or similar)
    - Effect: Mark affected POs as "Delayed", update status in memory (for demo purposes, don't persist to DB)
    - Recompute risk scores for items affected by delayed POs
    - Return structure:
      ```json
      {
        "disruption_id": "DISRUPT-2026-07-18-001",
        "type": "JNPT_PORT_STRIKE",
        "affected_pos": ["PO-889"],
        "affected_items": ["ITEM-001"],
        "affected_warehouses": ["WH-001", "WH-003"],
        "duration_estimate_hours": 48,
        "risk_delta": { "ITEM-001": { "old_risk": 0.35, "new_risk": 0.82 } },
        "alert_text": "JNPT-Mumbai Port Corridor disruption detected. Port closure estimated 48 hours. PO-889 (500 units Lithium-Ion Battery Pack) now at critical stockout risk (0.82). Immediate action recommended."
      }
      ```

- [ ] `/api/simulate/disruption` endpoint
  - POST, no parameters (hardcoded to JNPT strike for demo)
  - Returns above structure + JSON contract wrapper

#### 6.2 Frontend Disruption UI
- [ ] Add "Simulate JNPT Port Strike" button to Topbar
  - Call `/api/simulate/disruption` on click
  - Disable button for 2s to prevent double-clicks
  - Show loading spinner

#### 6.3 Map Animation
- [ ] Update MapView to support highlighting:
  - State: `activateDisruptionRoute(route: string)`
  - When disruption triggers, find POs with `transit_route: "JNPT-Mumbai Port Corridor"`
  - Highlight those route lines in **red** (#EF4444)
  - Add **pulsing animation** (CSS keyframes: opacity 1 → 0.5 → 1 over 1s, repeat)
  - Play animation for 3s, then hold red color

**CSS example:**
```css
@keyframes pulse-red {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.route-disrupted {
  stroke: #EF4444;
  stroke-width: 3;
  animation: pulse-red 1s infinite;
}
```

#### 6.4 Alert Modal
- [ ] Create `frontend/components/DisruptionAlertModal.tsx`
  - Triggered when `/api/simulate/disruption` returns
  - Title: "⚠️ Supply Chain Disruption Detected"
  - Body: Alert text from backend + affected items/warehouses
  - Show affected POs in a table:
    - PO ID, Item, Quantity, Original EDD, Current Status
  - Buttons: "Acknowledge" (closes modal), "Request Sourcing" (opens Copilot)

- [ ] Wire modal to global state (React Context or Zustand) so it persists across component tree

#### 6.5 Dashboard State Update
- [ ] On disruption trigger, re-fetch `/api/dashboard` to get updated risk scores
  - Inventory table re-renders with new risk colors
  - Items that spiked from "Warning" to "Critical" glow (subtle background highlight)

**Acceptance:**
- ✅ "Simulate JNPT Port Strike" button exists and is clickable
- ✅ Clicking it calls `/api/simulate/disruption`, returns 200
- ✅ Map route highlights red with pulsing animation for 3s
- ✅ DisruptionAlertModal appears with correct affected items
- ✅ Clicking "Acknowledge" dismisses modal
- ✅ Inventory table risk scores update (if any items' risk changed)
- ✅ Alert text is clearly visible and readable

---

## Part 5: AI-Powered Queries & Sourcing

### Phase 7: AI Copilot Drawer & NL Queries (3 hours)

**Objectives:**
- Implement the Copilot drawer (right-side slide-out panel)
- Wire all 4 required NL queries to the orchestrator
- Display results in a formatted, interactive response renderer
- Ensure all 4 queries return correct answers live in the UI

**Tasks:**

#### 7.1 CopilotDrawer Component
- [ ] Create `frontend/components/CopilotDrawer.tsx`
  - Right-side slide-out drawer (Shadcn Drawer component)
  - Trigger: "Copilot" button in Topbar or keyboard shortcut (e.g., Cmd+K)
  - Content:
    - Title: "SupplySense Copilot"
    - QueryInput: text field + send button (or Enter key)
    - ResponseRenderer: switches on `frontend_action` to display results (table, modal, highlight, etc.)
    - SourcingComparisonTable: (used in M8)

#### 7.2 QueryInput
- [ ] Create `frontend/components/QueryInput.tsx`
  - Text input for NL questions
  - Send button (or Submit on Enter)
  - Show 4 example queries as quick-buttons (tappable):
    1. "Which products are at risk of going out of stock?"
    2. "Which suppliers are most likely to miss deliveries next week?"
    3. "Which warehouse should fulfill this order?"
    4. (Reserved) "What is causing today's biggest supply chain disruption?"

#### 7.3 ResponseRenderer
- [ ] Create `frontend/components/ResponseRenderer.tsx`
  - Input: JSON response from `/api/query`
  - Switch on `frontend_action`:
    - **"RENDER_TABLE"**: Parse `payload.rows` (array of objects) → render HTML table
    - **"SHOW_MODAL"**: Parse `payload.modal_title`, `payload.modal_content` → open modal
    - **"UPDATE_MAP_HIGHLIGHT"**: Parse `payload.highlight_regions` → update map
    - Default: Show `summary` text + payload as JSON (debug view)
  - Display `summary` text always (executive summary)

#### 7.4 The 4 Required NL Queries
Test each query end-to-end. Expected behavior:

**Query 1: "Which products are at risk of going out of stock?"**
- Orchestrator calls `query_database` with SQL to fetch inventory_levels where risk_score > 0.4 (Warning+)
- Returns: item name, warehouse, stock, reorder point, risk score, demand
- Frontend renders as RENDER_TABLE
- Expected rows: items with stock below ~50% of reorder point

**Query 2: "Which suppliers are most likely to miss deliveries next week?"**
- Orchestrator calls `query_database` with SQL to fetch suppliers ranked by (1 - historical_fulfillment_rate)
- Or: fetch active POs due next week, group by supplier, rank by delivery performance score (ascending)
- Returns: supplier name, location, fulfillment rate, lead time, active POs count
- Frontend renders as RENDER_TABLE
- Expected rows: suppliers with fulfillment rate < 0.90

**Query 3: "Which warehouse should fulfill this order?"**
- Orchestrator calls `query_database` with SQL to fetch all warehouses with utilization, capacity, active inventory
- Scores each by: (1) proximity (simulated), (2) available capacity, (3) stock of needed items
- Returns: warehouse name, location, utilization %, available capacity, recommended items stock
- Frontend renders as RENDER_TABLE with "RECOMMENDED" badge on best option
- Expected: warehouse with lowest utilization or best item stock

**Query 4 (reserve): "What is causing today's biggest supply chain disruption?"**
- If disruption has been triggered: summarize from disruption state (route, affected items, duration estimate)
- If no disruption: return "No active disruptions detected. All routes nominal."
- Frontend renders as summary text

#### 7.5 Testing & Hardcoding Fallbacks
- [ ] For each query, test the orchestrator in isolation (backend unit test) — does LLM generate correct SQL? Does tool return expected results?
- [ ] Pre-cache responses for exact demo queries:
  - If LLM fails or is slow, fetch hardcoded JSON from a cache file
  - Store cache at `backend/demo_cache.json`

#### 7.6 Response Caching (Quick Wins)
- [ ] Implement simple in-memory cache in backend:
  ```python
  RESPONSE_CACHE = {
    "Which products are at risk of going out of stock?": { ... cached response ... },
    # ... other 3 queries
  }
  
  def cached_query(question: str) -> Dict:
      if question.lower() in RESPONSE_CACHE:
          return RESPONSE_CACHE[question.lower()]
      else:
          return orchestrate_query_live(question)
  ```

**Acceptance:**
- ✅ CopilotDrawer toggles open/close
- ✅ All 4 example queries are clickable (pre-fill the input)
- ✅ Sending a query calls `/api/query`, shows loading spinner
- ✅ Response renders correctly:
  - Query 1 → table with at-risk items (risk_score > 0.4)
  - Query 2 → table with low-fulfillment suppliers
  - Query 3 → table with warehouses, recommended flagged
  - Query 4 → text response about disruption state
- ✅ All 4 queries return in <3s (cached or live)
- ✅ Summary text is always visible, readable

---

### Phase 8: Sourcing Comparison & Executive Summary (3 hours)

**Objectives:**
- Implement alternate supplier sourcing via `get_alternate_suppliers` tool
- Display sourcing comparison table
- Generate and display executive summary markdown
- Complete the end-to-end sourcing + decision flow

**Tasks:**

#### 8.1 SourcingComparisonTable
- [ ] Create `frontend/components/SourcingComparisonTable.tsx`
  - Displays results from `get_alternate_suppliers` tool
  - Columns: Supplier, Location, Lead Time, Fulfillment Rate, Unit Cost, Cost Delta, Recommendation
  - Highlight "Recommended" row with `bg-surface-raised` + checkmark
  - Show cost comparison vs. original supplier
  - Show risk reduction estimate (if rerouting to this supplier)

#### 8.2 Sourcing Query Handler
- [ ] Enhance CopilotDrawer to handle "Recommend alternate suppliers for [ITEM]" queries
  - Parse item name from question (or use last-mentioned item in context)
  - Call `orchestrator.orchestrate_query()` which calls `get_alternate_suppliers` tool
  - Return JSON with `frontend_action: "RENDER_TABLE"` and SourcingComparisonTable data in payload
  - Include recommendation text from orchestrator (e.g., "Switch to Supplier B — higher lead time but 94% fulfillment rate offsets disruption risk")

#### 8.3 Executive Summary Modal
- [ ] Create `frontend/components/ExecutiveSummaryModal.tsx`
  - Button in Topbar: "Generate Executive Summary" or in CopilotDrawer
  - On click: call `/api/summary/generate`
  - Modal displays markdown formatted summary:
    - Disruption overview (if active)
    - At-risk items count + list
    - Recommended actions (sourcing, rerouting, allocation)
    - Impact estimate (delivery delay, cost delta, stockout probability)
  - Buttons: "Close", "Send to Procurement" (just shows toast "Summary copied to clipboard")

#### 8.4 Executive Summary Backend
- [ ] Implement `/api/summary/generate` endpoint
  - Aggregates current dashboard state + risk scores + any active disruptions
  - Calls LLM with prompt like:
    ```
    Given the current supply chain state:
    - {N} items at critical risk
    - {M} suppliers with <90% fulfillment
    - Active disruption: {disruption details if any}
    
    Generate a concise, executive-level markdown summary (max 500 words) covering:
    1. Current state
    2. Top 3 risks
    3. Recommended actions
    4. Expected impact if actions are taken
    ```
  - LLM returns markdown, which is returned in JSON contract

#### 8.5 "Send to Procurement" Flow
- [ ] When user clicks "Send to Procurement" button:
  - Copy summary markdown to clipboard (JavaScript `navigator.clipboard.writeText()`)
  - Show toast: "Summary copied to clipboard. Ready to email/share."
  - Optional: export as `.txt` or `.pdf` (stretch goal)

**Acceptance:**
- ✅ Querying for alternate suppliers returns SourcingComparisonTable with ranked options
- ✅ "Generate Executive Summary" button generates markdown summary in modal
- ✅ Summary includes:
  - At-risk items (with risk scores)
  - Recommended sourcing changes
  - Cost impact estimate
  - Delivery time implications
- ✅ "Send to Procurement" copies to clipboard
- ✅ All text is readable, well-formatted, no formatting errors

---

## Part 6: Polish & Demo Readiness

### Phase 9: ChromaDB Integration (Stretch Goal — 2 hours)

**Objectives:**
- Embed unstructured alert text (weather, shipping emails, news) into vector database
- Retrieve relevant alerts via semantic search
- Display alert feed in Copilot or sidebar

**Tasks:**

#### 9.1 ChromaDB Setup
- [ ] Add ChromaDB to `requirements.txt`
- [ ] Create `backend/embeddings.py`
  - `get_or_create_collection(name: str) -> chromadb.Collection`
  - Initialize with embeddings model (default: sentence-transformers)

#### 9.2 Alert Ingestion
- [ ] Create `backend/alerts.py`
  - `ingest_alert(alert_text: str, source: str, timestamp: str) -> None`
  - Embeds alert text and stores in ChromaDB collection "alerts"
  - Metadata: source (weather, shipping, news), timestamp, route/region tags

- [ ] Pre-seed ChromaDB with 5–10 sample alerts:
  ```
  "Monsoon warning: heavy rain expected in Mumbai region July 19-21. Port operations may slow."
  "JNPT-Mumbai port congestion: 3000+ containers backed up. Estimated clearance 48 hours."
  "Supplier SUP-004 reports: temporary facility closure for maintenance, July 20-22."
  ```

#### 9.3 Alert Retrieval & Display
- [ ] Add `/api/alerts/search` endpoint
  - Query: `{"query": str}` (e.g., "port disruptions")
  - Calls ChromaDB `collection.query(query_texts=[query], n_results=5)`
  - Returns: ranked alerts with relevance score
- [ ] Display in CopilotDrawer as expandable "Active Alerts" section (right below QueryInput)

**Acceptance:**
- ✅ ChromaDB collection creates without errors
- ✅ Sample alerts embed and retrieve correctly
- ✅ `/api/alerts/search` returns relevant alerts ranked by similarity
- ✅ UI displays alerts in drawer

*(If time is tight, M9 is skipped in favor of M10. It's a nice-to-have, not critical for demo.)*

---

### Phase 10: Demo Polish & Final Validation (3 hours)

**Objectives:**
- Pre-cache exact demo queries for bulletproof execution
- Add loading states, error toasts, and visual feedback throughout
- Record backup demo video
- Conduct full timing run-through (≤3 min)
- Judge-proof the demo (Wi-Fi-independent, no live LLM timeouts)

**Tasks:**

#### 10.1 Demo Query Caching
- [ ] Pre-run all 4 demo queries against live backend
- [ ] Capture exact orchestrator responses as JSON
- [ ] Store in `backend/demo_cache.json`:
  ```json
  {
    "query_1": { "question": "Which products are at risk of going out of stock?", "response": { ... } },
    "query_2": { "question": "Which suppliers are most likely to miss deliveries next week?", "response": { ... } },
    "query_3": { "question": "Which warehouse should fulfill this order?", "response": { ... } },
    "query_4": { "question": "What is causing today's biggest supply chain disruption?", "response": { ... } }
  }
  ```

- [ ] Modify `/api/query` endpoint to check cache first:
  ```python
  async def query(question: str) -> Dict:
      # Check if this question (lowercase, fuzzy match) is in demo_cache
      if fuzzy_match_in_cache(question.lower()):
          return DEMO_CACHE[matched_key]
      else:
          return await orchestrate_query_live(question)
  ```

#### 10.2 UI Polish
- [ ] **Loading states:**
  - Spinner on all API calls (dashboard fetch, query submission, disruption trigger, etc.)
  - Dim or disable buttons during loading
  - Show "Fetching..." or "Analyzing..." status text

- [ ] **Error handling:**
  - Toast notifications (Shadcn Toast or react-hot-toast) for errors
  - "Failed to load dashboard. Retrying..." message on API failure
  - Graceful fallback to static/cached data

- [ ] **Visual feedback:**
  - Button hover states (opacity change, slight background color shift)
  - Table row hover highlight
  - Ripple effect on click (optional but nice)

- [ ] **Typography & spacing:**
  - Verify all text uses correct font sizes (display/h1/body)
  - Check line heights and letter spacing match design tokens
  - Consistent padding/margins throughout

#### 10.3 Responsive Design
- [ ] Test on mobile (320px width) and tablet (768px width)
  - Sidebar collapses to icon-only on <768px
  - Map + InventoryTable stack vertically
  - CopilotDrawer works on mobile (slides in from right)
  - Charts resize responsively

#### 10.4 Full Rehearsal
- [ ] Run the 3-min demo script (from PRD §11) at least 3 times:
  1. **Baseline:** Open dashboard, narrate "Logistics teams today track this across 5 spreadsheets..."
  2. **Disruption:** Click "Simulate JNPT Port Strike," observe map flash + alert modal
  3. **Query 1:** Ask "Which products are at risk?" in Copilot, observe ranked table
  4. **Query 2:** Ask "Which suppliers most likely to miss?" observe ranked suppliers
  5. **Query 3:** Ask "Which warehouse should fulfill?" observe recommendation
  6. **Query 4 (bonus):** Ask "Recommend alternates for Battery Pack," observe sourcing table
  7. **Close:** Ask "Generate Executive Summary," show markdown output

- [ ] Time each full run. Target: ≤3 min. If >3 min, identify slow steps (cache those queries, optimize API responses).

#### 10.5 Backup Demo Video
- [ ] Record a full 3-min demo run-through on laptop (OBS or QuickTime)
  - Scenario: laptop is prepared, internet/LLM is working perfectly
  - Save as `demo_backup_2026_07_18.mp4` in repo
  - Upload to Google Drive or Dropbox as backup in case live Wi-Fi fails on demo day

#### 10.6 Judge-Proofing Checklist
- [ ] `supplysense.db` is committed to repo (no live generation on stage)
- [ ] All 4 demo queries are cached in `demo_cache.json`
- [ ] No external API dependencies except Gemini/Claude (which are cached)
- [ ] No Mapbox/Google Maps API keys needed
- [ ] Both `npm run dev` and `uvicorn main:app --reload` start without errors
- [ ] `/api/docs` is accessible and shows all endpoints
- [ ] Sidebar, Topbar, MapView, Tables, Charts all render with placeholder data even if backend is down

**Acceptance:**
- ✅ Full demo runs in ≤3 min
- ✅ All UI elements have loading states
- ✅ Errors are handled gracefully with toast notifications
- ✅ Mobile responsive (tested on browser DevTools)
- ✅ Backup demo video recorded and saved
- ✅ No external network dependencies except LLM (and that's cached)
- ✅ All judges' notes are addressed (if any)

---

## Summary: Deployment & Submission Checklist

### Before Live Demo

- [ ] **Database:** `supplysense.db` is in repo, reproducible with `python backend/data.py`
- [ ] **Backend:** All 6 endpoints exist, return valid JSON, visible in `/docs`
- [ ] **Frontend:** Dashboard renders, all 4 demo queries return in <3s
- [ ] **Orchestrator:** All 3 tools execute correctly; NL queries return correct answers
- [ ] **Disruption:** Map flashes red, alert modal appears, risk scores update
- [ ] **Sourcing & Summary:** Comparison table + executive summary modal work end-to-end
- [ ] **UI Polish:** Loading states, error handling, responsive design ✅
- [ ] **Caching:** Demo queries are pre-cached; fallback to cache if LLM is slow
- [ ] **Backup Video:** Recorded and stored safely
- [ ] **Timing:** Full demo run ≤3 min, rehearsed 3+ times

### Folder Structure (Final)

```
supplysense/
├── README.md                            # Quick-start guide
├── IMPLEMENTATION_ROADMAP.md            # This file
├── backend/
│   ├── main.py                          # FastAPI app + routes
│   ├── db.py                            # SQLite connection helpers
│   ├── risk.py                          # Stockout risk formula
│   ├── orchestrator.py                  # Tool-calling loop
│   ├── tools.py                         # query_database, get_alt_suppliers, simulate_rerouting
│   ├── disruptions.py                   # Disruption trigger logic
│   ├── alerts.py                        # ChromaDB alert ingestion (M9, optional)
│   ├── data.py                          # Mock data generator
│   ├── demo_cache.json                  # Pre-cached demo query responses
│   ├── supplysense.db                   # SQLite database (committed)
│   ├── requirements.txt                 # Python dependencies
│   └── .env.example                     # Template for API keys
├── frontend/
│   ├── app/
│   │   ├── dashboard/
│   │   │   └── page.tsx                 # Main dashboard page
│   │   └── layout.tsx
│   ├── components/
│   │   ├── DashboardShell.tsx
│   │   ├── MapView.tsx
│   │   ├── InventoryMonitorTable.tsx
│   │   ├── WarehouseUtilizationBars.tsx
│   │   ├── DemandForecastChart.tsx
│   │   ├── SupplierRiskScoreList.tsx
│   │   ├── CopilotDrawer.tsx
│   │   ├── QueryInput.tsx
│   │   ├── ResponseRenderer.tsx
│   │   ├── SourcingComparisonTable.tsx
│   │   ├── ExecutiveSummaryModal.tsx
│   │   ├── DisruptionAlertModal.tsx
│   │   ├── RiskBadge.tsx
│   │   ├── InventoryRow.tsx
│   │   ├── SupplierCard.tsx
│   │   ├── StatBox.tsx
│   │   └── ui/                          # Shadcn/ui exports
│   ├── lib/
│   │   └── api.ts                       # Fetch wrappers
│   ├── tailwind.config.ts               # Design tokens
│   ├── package.json
│   └── .env.local.example
├── demo_backup_2026_07_18.mp4           # Backup demo video
└── .gitignore
```

---

## Phase Timeline (3 Parallel Tracks)

| Hours | Backend/DB | Frontend | AI/Agent |
|---|---|---|---|
| **0–2 (M0)** | Repo setup, FastAPI scaffold | Next.js setup, Tailwind tokens | System prompt draft |
| **2–4 (M1)** | SQLite schema + helpers | Design system components | Test system prompt |
| **4–6 (M2)** | API endpoints (mock responses) | Dashboard shell (static) | Orchestrator wiring |
| **6–10 (M3, M4)** | Wire M2 to M1, debug | M5 skeleton + static data | M3 debug tool-calling |
| **✓ Checkpoint (10h)** | Dashboard data flows live | | All 4 NL queries return correct SQL |
| **10–14 (M5, M6)** | Disruption trigger, risk re-eval | Map animation, alert modal | Disruption logic |
| **14–18 (M6, M7)** | — | Copilot drawer, query input | Query responses, sourcing |
| **✓ Checkpoint (18h)** | | All 4 queries render live | |
| **18–22 (M8)** | Sourcing backend, summary gen | Comparison table, summary modal | Sourcing + summary tools |
| **22–24 (M9)** | ChromaDB setup (if ahead) | Alert UI (if ahead) | Alert retrieval (if ahead) |
| **24–27 (M10)** | Demo caching, error handling | UI polish, responsive | Response caching |
| **27–30** | Full rehearsal, backup video | Full rehearsal, backup video | Full rehearsal, backup video |

---

## Key Success Criteria

✅ **Dashboard renders live inventory + risk scores without errors**  
✅ **All 4 demo NL queries return correct answers in <3s**  
✅ **Disruption simulation: map flashes red, alert modal appears**  
✅ **Sourcing comparison table shows ranked alternates with cost/lead-time deltas**  
✅ **Executive summary markdown is generated and exportable**  
✅ **Full demo runs in ≤3 minutes, rehearsed 3+ times**  
✅ **Backup video recorded in case of live Wi-Fi failure**  
✅ **All UI has loading/error states; no dead air**  
✅ **Mobile responsive (tested on tablet + phone widths)**  
✅ **Database and cache ensure bulletproof offline execution**

---

## Notes for the Team

### Critical Path Decisions

1. **Do NOT skip M0–M2:** They are short (5h) and foundational. Rushing them will cause cascading issues later.
2. **Cache the 4 demo queries early (in M7):** Don't wait until M10 to pre-cache. Cache them as soon as the orchestrator works.
3. **MapView is NOT Mapbox/Google Maps:** Use a local SVG or pre-rendered image to avoid API keys and network dependencies.
4. **Disruption trigger is scripted, not auto-detected:** Button click → hardcoded JNPT strike → PO-889 delayed. Simple and reliable.
5. **Risk scores come from the server, not the LLM:** The formula (P(S)) is computed in `risk.py`; the LLM only interprets results. This keeps the LLM focused and consistent.

### Debugging Tips

- **Backend slow?** Check database query efficiency. Add indexes on `item_id`, `warehouse_id`, `supplier_id` if needed.
- **LLM generating bad SQL?** Test the system prompt manually (paste into Claude web UI), refine it, then deploy.
- **Frontend API calls fail?** Verify CORS is enabled in FastAPI (`CORSMiddleware`). Check browser DevTools Network tab.
- **Map doesn't animate?** Test CSS keyframes in isolation. Use `animation: pulse-red 1s infinite;` not `animation-duration` without shorthand.
- **Cache not working?** Ensure `demo_cache.json` is being loaded. Add debug log: `print(f"Cache hit for: {question}")`.

### Team Communication

- **Daily standup:** 15 min sync, each person reports: "I just finished M{N}, working on M{N+1}, blocker is {X}?"
- **Blocking issues:** Escalate immediately. E.g., if backend queries are timing out, the whole frontend is stuck.
- **Integration tests:** On checkpoint hours (10h, 18h), do a 10-min full end-to-end test. If it fails, debug together.

---

## Appendix: Quick Reference

### Design Tokens

| Token | Value | Usage |
|---|---|---|
| Surface Base | `#0A0A0B` | App background |
| Surface Card | `#131316` | Card/panel background |
| Surface Raised | `#1C1C21` | Hover/active card |
| Border | `#26262C` | Dividers, borders |
| Text Primary | `#F5F5F7` | Main text |
| Text Secondary | `#9A9AA5` | Labels, metadata |
| Accent | `#2563EB` | Buttons, links |
| Risk Safe | `#22C55E` | Risk 0.0–0.2 |
| Risk Warning | `#F59E0B` | Risk 0.2–0.6 |
| Risk Critical | `#EF4444` | Risk >0.6 |

### Database Schema Quick Ref

```sql
suppliers(supplier_id, name, location, historical_fulfillment_rate, delivery_performance_score, lead_time_days)
warehouses(warehouse_id, name, location, capacity, current_utilization)
components(item_id, name, category, unit_cost)
inventory_levels(item_id, warehouse_id, current_stock, reorder_point, forecasted_demand)
purchase_orders(po_id, supplier_id, item_id, quantity, expected_delivery_date, status, transit_route)
```

### API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/dashboard` | GET | Snapshot: inventory, warehouses, suppliers, POs, map data |
| `/api/query` | POST | NL query → orchestrator → JSON contract |
| `/api/simulate/disruption` | POST | Trigger scripted JNPT strike |
| `/api/suppliers/alternate` | POST | `{item_id, quantity}` → ranked alternates |
| `/api/reroute` | POST | `{po_id, new_supplier_id}` → cost/time deltas |
| `/api/summary/generate` | POST | Executive summary markdown |
| `/docs` | GET | Swagger documentation |

### The 4 Required NL Queries (Exact Wording for Demo)

1. **"Which products are at risk of going out of stock?"**
2. **"Which suppliers are most likely to miss deliveries next week?"**
3. **"Which warehouse should fulfill this order?"**
4. **"What is causing today's biggest supply chain disruption?"** (asked after disruption trigger)

### Bonus Sourcing Query

**"Recommend alternate suppliers for [Component Name]"** (e.g., "Lithium-Ion Battery Pack")

---

**End of Implementation Roadmap. Ready to build. Good luck! 🚀**
