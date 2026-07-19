# SupplySense Frontend Design & Build Prompt

Build a production-quality, hackathon-winning frontend named **SupplySense**: an AI-powered supply-chain command center for operations leaders. The experience must feel credible enough for an enterprise procurement team, but memorable enough to stand out during a three-minute demo. Use deterministic mock data only; every visible control and primary demo interaction must work without a backend.

## Product Story

SupplySense gives operations teams one place to monitor global inventory, warehouse utilization, supplier health, demand forecasts, and active shipments. The signature demo is a simulated Gulf port labor strike that disrupts PO-889, raises financial exposure, highlights an affected shipping route, and lets an AI Copilot recommend and prepare an alternate supplier reroute.

## Required Demo Flow

1. Open on a complete dashboard populated with realistic mock data.
2. Present four KPIs: inventory value, at-risk value, on-time delivery, and active shipments.
3. Show a global logistics map with labeled locations and active routes.
4. Clicking **Simulate Gulf port strike** enters a short calculating state, changes the Gulf route to critical red, updates the at-risk KPI, marks PO-889 disrupted, and reveals a critical impact alert.
5. Clicking **Ask Copilot** opens an accessible side drawer on desktop and bottom sheet on mobile.
6. Support prompt chips for risk prioritization, a seven-day plan, and alternate suppliers for PO-889.
7. Selecting Enercell Mexico creates a successful reroute-prepared state.
8. **Executive brief** opens a modal with impact, mitigation, recovery, and a working send-to-procurement confirmation.
9. Reset returns the disruption scenario to baseline.
10. Every desktop rail and mobile menu item opens a dedicated Next.js route: `/`, `/network`, `/inventory`, `/shipments`, `/warehouses`, and `/suppliers`. Each route has focused KPIs, filters, supporting insights, and an active navigation state; never place the entire product on one long page.

## Visual Direction

Use a dark industrial operations-console aesthetic: precise, dense, restrained, and professional. It should resemble a premium mission-control interface rather than a generic SaaS card dashboard. Use subtle grid texture only on wide desktop screens, crisp 1px borders, compact mono labels, strong information hierarchy, and one memorable animated route-disruption moment.

### Color System

Use exactly five main colors:

- Background: `#0A0A0B`
- Surface: `#131316` with raised neutral `#1C1C21`
- Foreground/neutral text: `#F4F4F5` and muted values derived from it
- Primary blue: `#3B82F6`
- Semantic accent group: red `#EF4444`, amber `#F59E0B`, green `#22C55E` used sparingly for status

Do not use purple, gradients, glows, decorative blobs, excessive shadows, or glass-card effects. Every changed background must have an explicit high-contrast text color.

## Typography

Use Geist Sans for interface copy and Geist Mono for status labels, timestamps, codes, and metrics. Limit the interface to these two font families. Body text must be at least 14px where reading is required, with 1.4–1.6 line height. Use balanced headings and clear semantic hierarchy.

## Desktop Layout

- Fixed 64px icon rail on the left.
- Sticky 64px command header with search, notifications, executive brief, Copilot, and avatar.
- Content max width near 1580px.
- Intro row, horizontally aligned KPI strip, disruption control, large map with shipment panel, inventory exception table, then forecast/utilization/supplier panels.
- The map is the visual anchor and must receive the largest share of space.
- Cards use approximately 6–8px radii, compact 14–20px padding, and 12–16px gaps.

## Mobile Layout

Design mobile-first for widths from 320px upward.

- Sticky compact header with real menu, search toggle, notification, and compact Copilot button.
- Menu opens a left-side sheet with section navigation, primary actions, user identity, Escape/backdrop close behavior, and 44px minimum targets.
- KPI cards become a horizontal, snap-scrolling rail rather than a cramped grid.
- Dashboard panels stack in order of urgency.
- Inventory table transforms into readable item cards with status and three key metrics.
- Map remains at least 250px tall with readable labels and no clipping.
- Copilot becomes a 92dvh bottom sheet with safe-area padding.
- Executive brief becomes a bottom-aligned, scrollable modal with a sticky full-width action.
- Keep a floating Copilot pill above the safe area.

## Components

Create focused React components for:

- BrandMark
- Desktop Sidebar
- Mobile Navigation Sheet
- Sticky Header and mobile search
- KPI Strip
- Disruption Scenario / Critical Alert
- Logistics Network Map
- Active Shipments
- Inventory Exceptions table and mobile cards
- Demand Forecast
- Warehouse Utilization
- Supplier Health
- Copilot Drawer / Bottom Sheet
- Executive Brief Modal

Use semantic HTML, real buttons, accessible labels, dialog titles, focus-visible states, and Escape/backdrop close behavior. Do not use clickable divs. Avoid components larger than roughly 200 lines where practical.

## Mock Data

Include realistic records such as:

- PO-889: 500 Lithium-Ion Battery Packs, Shanghai to Houston
- Warehouses: Reno, Houston, Monterrey
- Suppliers: Enercell Mexico, VoltWorks Canada, Kinetix Taiwan
- Inventory statuses: critical, warning, healthy
- Financial exposure baseline around `$1.60M`, disruption state around `$2.28M`, and event impact of `$1.2M`
- Twelve weeks of actual and forecast demand with a visible +38% rise

Keep data in a separate local module and make all scenario transitions deterministic.

## Motion

Motion must clarify state, not decorate it:

- Alert slides in with opacity + transform.
- Gulf route switches to a red animated dash flow.
- Critical map node gently pulses.
- Drawers and sheets use transform-based transitions.
- Copilot thinking state uses three restrained dots.
- Respect `prefers-reduced-motion` and disable nonessential animation.

## Implementation Constraints

Use Next.js App Router, React, TypeScript, and Tailwind/CSS design tokens. Avoid heavy dependencies when CSS and React state are sufficient. Do not fetch in `useEffect`; this demo uses imported mock data. Keep all functionality offline-ready. Ensure metadata and viewport settings describe SupplySense and support dark mobile browser chrome.

## Quality Checklist

- Works at 320px, 375px, 753px, 1024px, 1440px, and 1920px.
- No horizontal page overflow.
- Mobile menu, search, drawers, modal, scenario, reroute, and send actions work.
- Keyboard navigation and Escape close flows work.
- Minimum 44px touch targets on mobile actions.
- No console errors or hydration errors.
- TypeScript and production build pass.
- Visual hierarchy remains dense but immediately scannable.
- The three-minute hackathon narrative can be completed without dead ends.


# here is the design link to see 
link: https://v0.app/chat/supplysense-dashboard-crt8Ko6AcQT
alternate link: https://supplysense-gamma.vercel.app/