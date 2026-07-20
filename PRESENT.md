# SupplySense — Hackathon Presentation Guide

## Pitch (30 seconds)

> "SupplySense is an AI-powered supply chain intelligence platform for Indian logistics. It detects disruptions, predicts shortages, and recommends procurement actions — all through a natural language copilot. We built it for the 72-hour hackathon using Next.js, FastAPI, and Google Gemini."

---

## Demo Flow (5 minutes)

### 1. Login Screen (:30)
- Open the app — show the clean auth page
- Click "Demo Login" — credentials auto-fill
- **Say:** *"One-click login into the SupplySense command center"*

### 2. Overview Dashboard (1:00)
- Show the 4 KPI cards: Active Shipments, Inventory at Risk, Supplier Reliability, Avg Lead Time
- Point out the dark theme, grid layout, professional UI
- **Say:** *"Real-time snapshot of the entire supply chain — shipments, inventory risk, supplier health"*

### 3. Interactive Flow Map (0:30)
- Hover over nodes (Mumbai, Chennai, Delhi)
- Show the animated route lines
- **Say:** *"18 Indian supply chain nodes on an interactive Leaflet map with live health status"*

### 4. AI Copilot — The Core Feature (1:30)
- Click "Ask Copilot" button in the header
- Type or click: *"Which products are at risk of going out of stock?"*
- Show the typewriter response with reference details table
- Then ask: *"Recommend alternate suppliers for Lithium-Ion Battery Pack"*
- Point out the "Quick Reorder" action button
- **Say:** *"Natural language query → AI classifies intent → queries database → returns structured response with recommendations and one-click actions"*

### 5. Data Pages (1:00)
- Navigate to **Store Sales** — show paginated table with ₹ revenue
- Navigate to **Vendor Scorecard** — show SVG progress rings
- Navigate to **Demand Forecast** — show Recharts area chart with forecast projection
- **Say:** *"29 data-driven pages covering every aspect of retail supply chain — sales, inventory, logistics, vendor performance"*

### 6. Code Quality & Architecture (0:30)
- Show the clean project structure
- **Say:** *"Production-quality codebase: TypeScript throughout, component separation, FastAPI backend with parameterized SQL queries, responsive design, zero unused dependencies after optimization"*

---

## Key Technical Highlights for Judges

| Aspect | What to say |
|--------|------------|
| **AI Integration** | Gemini API with tool-calling — classifies intent, queries SQLite, generates structured JSON responses with summaries + action recommendations |
| **Frontend Architecture** | Next.js App Router, 29 dynamic routes via `[section]/page.tsx`, Server Components + Client Components separation |
| **Backend Design** | FastAPI with async endpoints, parameterized SQL queries (no injection risk), modular orchestrator pattern |
| **UI/UX** | Dark theme, responsive mobile-first, Tailwind CSS + custom design tokens, Lucide icons, Recharts for data viz |
| **Supply Chain Domain** | India-specific data: JNPT port, Mumbai-Delhi corridor, ₹ INR currency, Indian supplier names — realistic demo data |
| **Code Quality** | Zero unused dependencies, clean imports, no dead code, merged duplicate CSS, TypeScript strict types throughout |

---

## What Makes This Stand Out

1. **Working AI copilot** — not just a demo UI, but actual Gemini integration that classifies queries and returns structured data
2. **29 functional pages** — far beyond a typical hackathon landing page, this is a full application
3. **Domain authenticity** — realistic India supply chain data, actual port names (JNPT, Mundra), suppliers, products
4. **Professional UI** — dark theme, smooth animations, responsive design, polished component library
5. **One-click simulation** — JNPT disruption scenario shows real business impact (₹1.2 Cr exposure)
6. **Clean codebase** — optimized for production, no garbage, proper TypeScript types

---

## Live Demo Script

```
1. Open browser → Login page appears
2. Click "Demo Login" (auto-fills credentials)
3. Overview dashboard loads — KPI cards animate in
4. Point at the Flow Map → "Interactive supply chain network"
5. Click "Ask Copilot" → Type "Which products are at risk?"
6. Wait for AI response → "See it recommends Lithium-Ion Battery Pack"
7. Click "Recommend alternate suppliers" → "Shows 3 alternate suppliers with scores"
8. Click "Quick Reorder" → "One-click procurement action created"
9. Navigate sidebar → Store Sales / Vendor Scorecard / Demand Forecast
10. End: "Built in 72 hours — production-ready AI supply chain intelligence"
```

---

## Technical Q&A Preparation

**Q: How does the AI copilot work?**
A: User query → POST /api/query → Gemini API with tool definitions → Gemini classifies intent → dispatches to database function → returns structured JSON with summary + payload → frontend renders response cards

**Q: Is this production-ready?**
A: Yes — parameterized SQL queries, async endpoints, TypeScript strict mode, responsive design, zero unused deps, FastAPI with proper error handling

**Q: What's the database schema?**
A: SQLite with 10+ tables: inventory, suppliers, warehouses, shipments, purchase_orders, store_sales, ecomm_sales, vendor_scorecards, etc.

**Q: Can it handle other supply chains beyond India?**
A: The architecture is location-agnostic — swap the seed data and map coordinates for any region

**Q: How long did it take to build?**
A: 72 hours — frontend + backend + AI integration + 29 data pages + demo data + deployment
