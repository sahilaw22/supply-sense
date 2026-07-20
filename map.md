# SupplySense — UI Map

> Every button, title, heading, and section across the frontend, with exact file:line locations.

---

## Root Layout (`app/layout.tsx`)

| Element | Type | Location |
|---------|------|----------|
| Page title | `<title>` | `:7` |
| Description meta | `<meta>` | `:8-11` |
| Viewport / themeColor `#0A0A0B` | meta | `:14-19` |
| AuthProvider wrapper | context | `:33` |
| Inter font (Google) | `<link>` | `:27` |
| JetBrains Mono font (Google) | `<link>` | `:28` |

---

## Login Page (`app/login/page.tsx`)

| Element | Type | Lines |
|---------|------|-------|
| SupplySense logo | `<Image>` | `:44` |
| "SupplySense" heading | `<h1>` | `:46` |
| "AI Supply Chain Intelligence" subtitle | `<p>` | `:47` |
| Email field (id: `auth-email`) | `<input>` | `:52-60` |
| Password field (id: `auth-password`) | `<input>` | `:65-73` |
| Show/hide password toggle | `<button>` | `:74-81` |
| Error message | `<p>` | `:85` |
| "Sign in" submit button | `<button type="submit">` | `:87-90` |

---

## Sidebar (`components/supplysense/dashboard.tsx:180`)

| Element | Icon | Route | Lines |
|---------|------|-------|-------|
| Brand mark (logo home link) | `<Image>` | `/` | `:182` |
| Group headers (Sales & Inv, etc.) | — | — | `:194` |
| Sub-page items (Store Sales, etc.) | — | — | `:203` |

---

## Header / Topbar (`components/supplysense/dashboard.tsx:270`)

| Element | ID / Class | Lines |
|---------|-----------|-------|
| "AI Supply Chain Intelligence" eyebrow | `.eyebrow` | `:284` |
| "SupplySense" title | `<h1>` | `:285` |
| Mobile menu hamburger | `button.mobile-menu` | `:283` |
| Search input | `input.search-box` | `:289` |
| Executive brief button | `button.summary-label` | `:293` |
| User avatar "SC" | `button.avatar` | `:294` |
| Profile dropdown — name | `.profile-info strong` | `:300` |
| **Sign out** button | `button.profile-logout` | `:308` |

---

## KPI Strip (`dashboard.tsx:310`)

| KPI Card | Lines |
|----------|-------|
| Active shipments | `:312-321` |
| Inventory at risk | `:312-321` |
| Supplier reliability | `:312-321` |
| Avg. lead time | `:312-321` |

---

## Page Intro (`dashboard.tsx:575`)

| Element | Type | Lines |
|---------|------|-------|
| Page intro header | `.dashboard-intro` | `:576-613` |

---

## Navigation Grid (`dashboard.tsx:869`)

| Element | Type | Lines |
|---------|------|-------|
| Overview sub-feature grid | `.navigation-grid` | `:870-894` |

---

## Forecast Chart (`dashboard.tsx:830`)

| Element | Type | Lines |
|---------|------|-------|
| 12-Week Battery Demand Forecast | `<Forecast>` | `:830-865` (rendered at `:1075`)

---

## Copilot Drawer (`dashboard.tsx:395`)

| Element | ID / Lines |
|---------|-----------|
| SupplySense Copilot title | `:400` |
| "Online" status | `:400` |
| Typewriter answer text | `<TypewriterText>` | `:435` |
| Prompt chips (5 questions) | `:420` |
| Query input `#copilot-input` | `:479` |
| Send button `#copilot-send` | `:480` |
| Close (X) button | `:402` |

---

## Executive Summary Modal (`dashboard.tsx:495`)

| Element | ID / Lines |
|---------|-----------|
| "Executive disruption brief" `<h2>` | `:507` |
| Markdown summary `<pre>` | `:517` |
| **Send to procurement** button `#send-to-procurement-btn` | `:530` |

---

## Guided Demo Tour (`components/supplysense/guided-demo.tsx:15`)

| Step | Element | Lines |
|------|---------|-------|
| 0 | "Welcome to SupplySense" `<h2>` | `:50` |
| 0 | "Start Guided Tour" button | `:52` |
| 1 | "Explore Key Actions" `<h2>` | `:59` |

---

## Auth Guard (`components/supplysense/auth-guard.tsx`)

| Element | Lines |
|---------|-------|
| Redirect to `/login` if no user | `:12` |

---

## Floating Copilot (`dashboard.tsx:908`)

| Element | ID / Lines |
|---------|-----------|
| Floating Ask Copilot button | `#floating-copilot` | `:908` |

---

## Global Styles (`app/globals.css`)

| Section | Approx lines |
|---------|-------------|
| Expanded Sidebar | `:47-66` |
| Overview Navigation Grid | `:1090-1150` |
| Automated Insights Feed | `:1150-1200` |
| SSO Builder Layout | `:1200-1270` |
| Typewriter blinking cursor | `:1270-1300` |
| Mobile Navigation Drawer accordion | `:1420-1500` |
| Ask Copilot Header Button Styles | `:1509-1536` |



---

## How to Update

1. Edit the component file at the line listed above.
2. After every change, update both:
   - `map.md` — keep UI element locations accurate
   - `memory.md` — keep architecture/tech/context up to date
3. After editing, run `pnpm run lint` to check for issues.
