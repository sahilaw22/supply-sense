'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, ArrowRight, ArrowUp, Bell, Box, Check, ChevronRight, CircleGauge,
  FileText, LayoutDashboard, LogOut, Map, Menu, PackageSearch, Play, RotateCcw, Search,
  Send, ShieldCheck, Sparkles, Truck, Warehouse, X, SlidersHorizontal,
  TrendingUp, Clock3, Route, Building2, CircleDollarSign, Table2, Info,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  copilotResponses, demandPoints, forecastPoints, inventory, kpis, promptOptions,
  shipments, suppliers, warehouses,
} from '@/lib/supplysense-data'
import {
  askCopilot,
  generateExecutiveSummary,
  getDashboardSnapshot,
  runDisruptionSimulation,
  type ContractResponse,
  type DashboardSnapshot,
} from '@/lib/supplysense-api'
import dynamic from 'next/dynamic'
import { useAuth } from '@/lib/auth-context'
import { GuidedDemo } from './guided-demo'
import { ScoreProgress } from './score-progress'

const FlowMap = dynamic(() => import('./flow-map').then(m => m.FlowMap), { ssr: false })

const statusClass = { critical: 'status-critical', warning: 'status-warning', healthy: 'status-healthy' }
type InventoryRow = typeof inventory[number]
type SupplierRow = typeof suppliers[number]
type WarehouseRow = typeof warehouses[number]
type ShipmentRow = typeof shipments[number]
type KpiRow = typeof kpis[number]

function riskLevel(value?: string): InventoryRow['status'] {
  const normalized = value?.toLowerCase()
  if (normalized === 'critical') return 'critical'
  if (normalized === 'warning') return 'warning'
  return 'healthy'
}

function scoreToPercent(score: number) {
  return Math.max(0, Math.min(100, Math.round(score * 20)))
}

function daysUntil(date: string) {
  const target = new Date(date).getTime()
  if (Number.isNaN(target)) return null
  return Math.max(0, Math.ceil((target - Date.now()) / 86_400_000))
}

function mapSnapshot(snapshot: DashboardSnapshot | null) {
  if (!snapshot) {
    return {
      kpiRows: kpis,
      inventoryRows: inventory,
      supplierRows: suppliers,
      warehouseRows: warehouses,
      shipmentRows: shipments,
    }
  }

  const inventoryRows = snapshot.inventory.slice(0, 8).map((row): InventoryRow => {
    const coverDays = row.forecasted_demand > 0 ? Math.max(0, Math.floor(row.current_stock / row.forecasted_demand)) : 0
    const demandDelta = row.reorder_point > 0 ? Math.round((row.forecasted_demand / row.reorder_point) * 100) : 0
    return {
      sku: row.item_id,
      name: row.item_name,
      warehouse: row.warehouse_location || row.warehouse_name,
      stock: row.current_stock,
      cover: `${coverDays} days`,
      demand: `+${demandDelta}%`,
      status: riskLevel(row.risk_category),
    }
  })

  const supplierRows = snapshot.suppliers.slice(0, 8).map((row): SupplierRow => ({
    name: row.name,
    region: row.location,
    score: scoreToPercent(row.delivery_performance_score),
    issue: row.lead_time_days > 14 ? 'Long lead time' : row.historical_fulfillment_rate < 0.88 ? 'Fulfillment variance' : 'On target',
    status: row.delivery_performance_score < 3 ? 'critical' : row.delivery_performance_score < 4 ? 'warning' : 'healthy',
  }))

  const warehouseRows = snapshot.warehouses.slice(0, 8).map((row): WarehouseRow => {
    // Backend sends utilization as 0.0–1.0 decimal — multiply by 100 for display
    const utilization = Math.round(row.current_utilization * 100)
    return {
      city: row.name,
      code: row.warehouse_id,
      utilization,
      status: utilization >= 90 ? 'critical' : utilization >= 80 ? 'warning' : 'healthy',
    }
  })

  const shipmentRows = snapshot.purchase_orders.slice(0, 8).map((row): ShipmentRow => {
    const etaDays = daysUntil(row.expected_delivery_date)
    return {
      po: row.po_id,
      item: row.item_name,
      route: row.transit_route,
      eta: etaDays === null ? row.expected_delivery_date : etaDays === 0 ? 'Today' : `${etaDays}d`,
      status: row.status,
    }
  })

  const activeShipments = snapshot.purchase_orders.filter(row => row.status !== 'Delivered').length
  const atRiskItems = snapshot.inventory.filter(row => riskLevel(row.risk_category) !== 'healthy').length
  const reliability = snapshot.suppliers.length
    ? `${Math.round(snapshot.suppliers.reduce((sum, row) => sum + scoreToPercent(row.delivery_performance_score), 0) / snapshot.suppliers.length)}%`
    : '0%'
  const leadTime = snapshot.suppliers.length
    ? `${(snapshot.suppliers.reduce((sum, row) => sum + row.lead_time_days, 0) / snapshot.suppliers.length).toFixed(1)}d`
    : '0d'

  return {
    kpiRows: [
      { label: 'Active shipments', value: String(activeShipments), detail: `${snapshot.purchase_orders.length} purchase orders`, trend: 'Live' },
      { label: 'Inventory at risk', value: String(atRiskItems), detail: 'Items warning or critical', trend: atRiskItems ? '+risk' : 'stable', risk: atRiskItems > 0 },
      { label: 'Supplier reliability', value: reliability, detail: `Across ${snapshot.suppliers.length} suppliers`, trend: 'Live' },
      { label: 'Avg. lead time', value: leadTime, detail: 'Supplier mean', trend: 'Live' },
    ] satisfies KpiRow[],
    inventoryRows: inventoryRows.length ? inventoryRows : inventory,
    supplierRows: supplierRows.length ? supplierRows : suppliers,
    warehouseRows: warehouseRows.length ? warehouseRows : warehouses,
    shipmentRows: shipmentRows.length ? shipmentRows : shipments,
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Brand mark — red wing SupplySense logo
───────────────────────────────────────────────────────────────────────────── */
function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <Image src="/logo.png" alt="SupplySense" width={38} height={38} style={{ objectFit: 'contain' }} priority />
    </div>
  )
}

const navigation = [
  [LayoutDashboard, 'Overview', '/'], [Map, 'Network', '/network'], [PackageSearch, 'Inventory', '/inventory'],
  [Truck, 'Shipments', '/shipments'], [Warehouse, 'Warehouses', '/warehouses'], [ShieldCheck, 'Suppliers', '/suppliers'],
] as const

function Sidebar({ page }: { page: PageKey }) {
  return (
    <aside className="sidebar">
      <Link href="/" aria-label="SupplySense overview"><BrandMark /></Link>
      <nav aria-label="Primary navigation">
        {navigation.map(([Icon, label, href]) => <Link key={label} href={href} className={page === label.toLowerCase() ? 'nav-icon active' : 'nav-icon'} aria-label={label} title={label}><Icon size={18} /></Link>)}
      </nav>
    </aside>
  )
}

export type PageKey = 'overview' | 'network' | 'inventory' | 'shipments' | 'warehouses' | 'suppliers'

function MobileNav({ open, page, onClose, onCopilot, onSummary }: { open: boolean; page: PageKey; onClose: () => void; onCopilot: () => void; onSummary: () => void }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])
  return <div className={open ? 'mobile-nav-shell open' : 'mobile-nav-shell'} aria-hidden={!open}>
    <button className="mobile-nav-backdrop" onClick={onClose} aria-label="Close navigation" />
    <aside className="mobile-nav" role="dialog" aria-modal="true" aria-label="Mobile navigation">
      <header><div className="mobile-nav-brand"><BrandMark /><div><strong>SupplySense</strong><span>India supply chain</span></div></div><button className="icon-button" onClick={onClose} aria-label="Close menu"><X size={18} /></button></header>
      <nav aria-label="Mobile primary navigation">{navigation.map(([Icon, label, href]) => <Link key={label} href={href} onClick={onClose} className={page === label.toLowerCase() ? 'active' : ''}><Icon size={18} /><span>{label}</span><ChevronRight size={16} /></Link>)}</nav>
      <div className="mobile-nav-actions"><button className="secondary-button" onClick={() => { onSummary(); onClose() }}><FileText size={16} /> Executive brief</button></div>
      <footer><div className="avatar">SC</div><span><strong>Supply Chain Director</strong><small>India Operations</small></span></footer>
    </aside>
  </div>
}

function Header({ onCopilot, onSummary, onMenu, disrupted, onSimulate, simulating }: { onCopilot: () => void; onSummary: () => void; onMenu: () => void; disrupted: boolean; onSimulate: () => void; simulating: boolean }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const { user, logout } = useAuth()
  const profileRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => { if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  return (
    <header className="topbar">
      <div className="topbar-title"><button className="mobile-menu" onClick={onMenu} aria-label="Open menu"><Menu size={19} /></button><div><span className="eyebrow">AI Supply Chain Intelligence</span><h1>SupplySense</h1></div></div>
      <div className="header-actions">
        <label className={searchOpen ? 'search-box open' : 'search-box'}><Search size={15} /><span className="sr-only">Search operations</span><input placeholder="Search SKU, PO, supplier, warehouse" /></label>
        <button className="icon-button mobile-search" onClick={() => setSearchOpen(v => !v)} aria-label="Search"><Search size={17} /></button>
        <button
          className={disrupted ? 'simulate-button jnpt-btn jnpt-active' : 'simulate-button jnpt-btn'}
          onClick={onSimulate}
          disabled={simulating || disrupted}
          id="simulate-disruption-btn"
          title="Simulate JNPT Port Strike"
        >
          <Play size={14} />
          <span className="jnpt-label">{simulating ? 'Simulating…' : disrupted ? 'JNPT Active' : 'Simulate JNPT Strike'}</span>
        </button>
        <button className="secondary-button summary-label" onClick={onSummary}><FileText size={15} /> Executive brief</button>
        <div className="profile-wrap" ref={profileRef}>
          <button className="avatar" onClick={() => setProfileOpen(v => !v)} aria-label="User menu">SC</button>
          {profileOpen && (
            <div className="profile-dropdown">
              <div className="profile-header">
                <div className="profile-avatar">SC</div>
                <div className="profile-info">
                  <strong>{user?.name || 'Supply Chain Director'}</strong>
                  <small>{user?.email || 'demo@supplysense.ai'}</small>
                </div>
              </div>
              <div className="profile-role">
                <span>Role</span>
                <strong>{user?.role || 'Director'}</strong>
              </div>
              <button className="profile-logout" onClick={logout}>
                <LogOut size={14} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function KpiStrip({ disrupted, rows }: { disrupted: boolean; rows: KpiRow[] }) {
  return <section className="kpi-strip" aria-label="Supply chain key performance indicators">
    {rows.map((kpi, i) => <article className="kpi" key={kpi.label}>
      <div className="kpi-heading"><span>{kpi.label}</span><span className={kpi.risk || (disrupted && i === 1) ? 'trend negative' : 'trend'}>{disrupted && i === 1 ? '+risk' : kpi.trend}</span></div>
      <strong>{disrupted && i === 1 ? String(Number(kpi.value) + 2) : kpi.value}</strong><small>{kpi.detail}</small>
    </article>)}
  </section>
}

/* ────────────────────────────────────────────────────────────────────────────
   Disruption scenario card — India / JNPT edition
───────────────────────────────────────────────────────────────────────────── */
function DisruptionCard({ disrupted, onReset }: { disrupted: boolean; simulating?: boolean; onSimulate?: () => void; onReset: () => void }) {
  if (!disrupted) return null
  return <section className="disruption-alert" role="alert"><div className="alert-icon"><AlertTriangle size={20} /></div><div className="alert-copy"><span className="eyebrow">Critical event · JNPT-Mumbai Port Corridor</span><h2>JNPT Port operations suspended — monsoon flood</h2><p>48-hour port closure impacts <strong>PO-889</strong> — 500× Lithium-Ion Battery Packs via Mumbai. Bhiwandi stockout exposure begins in 2 days. Immediate rerouting action recommended.</p></div><div className="alert-metrics"><div><span>Potential impact</span><strong>₹1.2 Cr</strong></div><div><span>Projected delay</span><strong>3–5 days</strong></div></div><button className="secondary-button" onClick={onReset} id="reset-disruption-btn"><RotateCcw size={14} /> Reset</button></section>
}

function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  return <section className="panel inventory-panel" id="inventory"><div className="section-heading"><div><span className="eyebrow">Exception queue</span><h2>Inventory at risk</h2></div></div><div className="table-scroll"><table><thead><tr><th>Item</th><th>Location</th><th>On hand</th><th>Cover</th><th>Demand</th><th>Status</th></tr></thead><tbody>{rows.map(row => <tr key={`${row.sku}-${row.warehouse}`}><td><strong>{row.name}</strong><span>{row.sku}</span></td><td>{row.warehouse}</td><td>{row.stock.toLocaleString('en-IN')}</td><td>{row.cover}</td><td>{row.demand}</td><td><span className={`status-pill ${statusClass[row.status]}`}><i />{row.status}</span></td></tr>)}</tbody></table></div><div className="inventory-cards">{rows.map(row => <article key={`${row.sku}-${row.warehouse}`}><header><span><strong>{row.name}</strong><small>{row.sku} · {row.warehouse}</small></span><span className={`status-pill ${statusClass[row.status]}`}><i />{row.status}</span></header><dl><div><dt>On hand</dt><dd>{row.stock.toLocaleString('en-IN')}</dd></div><div><dt>Cover</dt><dd>{row.cover}</dd></div><div><dt>Demand</dt><dd>{row.demand}</dd></div></dl></article>)}</div></section>
}

function Warehouses({ rows }: { rows: WarehouseRow[] }) {
  return <section className="panel" id="warehouses"><div className="section-heading"><div><span className="eyebrow">Capacity</span><h2>Warehouse utilization</h2></div><Warehouse size={17} /></div><div className="warehouse-list">{rows.map(w => <div className="warehouse-row" key={w.code}><div><strong>{w.city}</strong><span>{w.code}</span></div><div className="utilization"><div><i style={{ width: `${w.utilization}%` }} className={w.status === 'critical' ? 'bar-critical' : w.status === 'warning' ? 'bar-warning' : ''} /></div><span>{w.utilization}%</span></div></div>)}</div></section>
}

const months = ['Apr 22', 'May 06', 'May 20', 'Jun 03', 'Jun 17', 'Jul 01', 'Jul 15', 'Jul 29', 'Aug 12', 'Aug 26', 'Sep 09', 'Sep 23', 'Oct 07', 'Oct 21', 'Nov 04', 'Nov 18', 'Dec 02', 'Dec 16']
const chartData = [
  ...demandPoints.map((v, i) => ({ month: months[i], demand: v, forecast: null })),
  ...forecastPoints.map((v, i) => ({ month: months[demandPoints.length + i], demand: null, forecast: v })),
]

const lastActualIdx = demandPoints.length - 1
chartData[lastActualIdx] = { ...chartData[lastActualIdx], forecast: forecastPoints[0] }

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number | null; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return <div className="chart-tooltip"><div className="chart-tooltip-label">{label}</div>{payload.filter(p => p.value != null).map(p => <div key={p.dataKey} className="chart-tooltip-row"><i style={{ background: p.color }} /><span>{p.dataKey === 'demand' ? 'Actual demand' : 'Forecast'}</span><strong>{p.value}</strong></div>)}</div>
}

function Forecast() {
  const [showForecast, setShowForecast] = useState(true)
  return <section className="panel forecast-panel">
    <div className="section-heading">
      <div><span className="eyebrow">12-week signal · EV Battery demand</span><h2>Lithium-Ion Battery demand forecast</h2></div>
      <div className="forecast-controls">
        <span className="forecast-change">+46% demand</span>
        <button className={`filter-chip ${showForecast ? 'active' : ''}`} onClick={() => setShowForecast(v => !v)}>{showForecast ? 'Hide forecast' : 'Show forecast'}</button>
      </div>
    </div>
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="demandGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} /></linearGradient>
          <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} /></linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
        <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1 }} />
        <ReferenceLine x={months[lastActualIdx]} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" label={{ value: 'FORECAST', position: 'top', fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
        <Area type="monotone" dataKey="demand" stroke="#3b82f6" strokeWidth={2} fill="url(#demandGradient)" dot={{ r: 3, fill: '#3b82f6', stroke: 'none' }} activeDot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} isAnimationActive animationDuration={1000} name="demand" connectNulls={false} />
        {showForecast && <Area type="monotone" dataKey="forecast" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" fill="url(#forecastGradient)" dot={{ r: 3, fill: '#f59e0b', stroke: 'none' }} activeDot={{ r: 5, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }} isAnimationActive animationDuration={1000} name="forecast" connectNulls />}
      </AreaChart>
    </ResponsiveContainer>
  </section>
}

function scoreClass(score: number) {
  if (score < 70) return 'score-red'
  if (score < 85) return 'score-yellow'
  return 'score-green'
}

function Suppliers({ rows }: { rows: SupplierRow[] }) {
  return <section className="panel" id="suppliers"><div className="section-heading"><div><span className="eyebrow">Risk intelligence</span><h2>Supplier health</h2></div><CircleGauge size={17} /></div><div className="supplier-list">{rows.map(s => <div key={s.name} className="supplier-row"><ScoreProgress score={s.score} /><span className="supplier-name"><strong>{s.name}</strong><small>{s.region} · {s.issue}</small></span><ChevronRight size={15} className="supplier-chevron" /></div>)}</div></section>
}

function Shipments({ disrupted, rows }: { disrupted: boolean; rows: ShipmentRow[] }) {
  return <section className="panel shipments-panel" id="shipments"><div className="section-heading"><div><span className="eyebrow">In motion</span><h2>Active shipments</h2></div><span className="live-label"><i /> Live</span></div><div className="shipment-list">{rows.map((s, i) => <div key={s.po} className={disrupted && s.po === 'PO-889' ? 'shipment-row shipment-critical' : 'shipment-row'}><div className="shipment-icon">{disrupted && s.po === 'PO-889' ? <AlertTriangle size={16} /> : <Box size={16} />}</div><div><strong>{s.po} · {s.item}</strong><span>{s.route}</span></div><div><strong>{disrupted && s.po === 'PO-889' ? '+3-5d' : s.eta}</strong><span>{disrupted && s.po === 'PO-889' ? 'Disrupted · JNPT' : s.status}</span></div></div>)}</div></section>
}

/* ────────────────────────────────────────────────────────────────────────────
   Copilot payload renderer — shows tables for DB results, supplier lists, etc.
───────────────────────────────────────────────────────────────────────────── */
function PayloadRenderer({ result }: { result: ContractResponse }) {
  const { payload } = result

  // SQL query result rows
  if (payload.rows && Array.isArray(payload.rows) && (payload.rows as unknown[]).length > 0) {
    const rows = payload.rows as Record<string, unknown>[]
    const keys = Object.keys(rows[0]).slice(0, 6) // max 6 cols
    return (
      <div className="payload-table-wrap">
        <div className="payload-table-head"><Table2 size={13} /><span>{rows.length} result{rows.length !== 1 ? 's' : ''}</span></div>
        <div className="payload-table-scroll">
          <table>
            <thead><tr>{keys.map(k => <th key={k}>{k.replace(/_/g, ' ')}</th>)}</tr></thead>
            <tbody>
              {rows.slice(0, 10).map((row, i) => (
                <tr key={i}>{keys.map(k => <td key={k}>{String(row[k] ?? '—')}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Alternate supplier list
  if (payload.alternates && Array.isArray(payload.alternates) && (payload.alternates as unknown[]).length > 0) {
    const alts = payload.alternates as Array<{ supplier_id: string; name: string; location: string; lead_time_days: number; historical_fulfillment_rate: number; delivery_performance_score: number }>
    return (
      <div className="alternates-list">
        {alts.map((s, i) => (
          <div key={s.supplier_id} className="alternate-row">
            <span className="alt-rank">{i + 1}</span>
            <span className="alt-info"><strong>{s.name}</strong><small>{s.location}</small></span>
            <span className="alt-stats">
              <span>{s.lead_time_days}d lead</span>
              <span>{Math.round(s.historical_fulfillment_rate * 100)}% fulfillment</span>
            </span>
          </div>
        ))}
      </div>
    )
  }

  return null
}

/* ────────────────────────────────────────────────────────────────────────────
   Copilot drawer
───────────────────────────────────────────────────────────────────────────── */
function CopilotDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [backendResult, setBackendResult] = useState<ContractResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50) }, [open])
  useEffect(() => {
    const close = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  const ask = async (prompt: string) => {
    setLoading(true)
    setQuery('')
    setBackendResult(null)
    try {
      const result = await askCopilot(prompt)
      setBackendResult(result)
      setAnswer(prompt)
    } catch {
      if (promptOptions.includes(prompt)) {
        setAnswer(prompt)
      } else {
        const lower = prompt.toLowerCase()
        if (/^(hi|hello|hey|greetings|sup|howdy|yo)\b/.test(lower)) {
          setAnswer('__greeting__')
        } else if (/^(help|what can you do|what do you do|how.*work|capabilities|features?)\b/.test(lower)) {
          setAnswer('__help__')
        } else {
          setAnswer('__default__')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const staticResponse = answer ? copilotResponses[answer] : null
  const displayResponse = backendResult
    ? {
        title: backendResult.intent.replaceAll('_', ' ').toLowerCase(),
        summary: backendResult.summary,
        bullets: [] as string[],
      }
    : staticResponse

  return <div className={open ? 'drawer-shell open' : 'drawer-shell'} aria-hidden={!open}>
    <button className="drawer-backdrop" aria-label="Close Copilot" onClick={onClose} />
    <aside className="copilot-drawer" role="dialog" aria-modal="true" aria-label="SupplySense Copilot">
      <header className="copilot-header">
        <div className="copilot-title">
          <Image src="/bot-icon.png" alt="SupplySense AI" width={48} height={48} style={{ objectFit: 'contain' }} />
          <span><strong>SupplySense Copilot</strong><small>Online</small></span>
        </div>
        <button className="copilot-close" onClick={onClose} aria-label="Close Copilot"><X size={18} /></button>
      </header>
      <div className="copilot-body">
        <div className="assistant-intro">
          <Sparkles size={17} />
          <p>I can analyze Indian supply chain inventory, supplier risk across Tier-1/2 cities, and JNPT disruption scenarios. Try the demo queries below:</p>
        </div>
        <div className="prompt-chips">
          {promptOptions.map(p => <button key={p} onClick={() => ask(p)}>{p}<ArrowRight size={13} /></button>)}
        </div>
        {loading && <div className="thinking" role="status"><i /><i /><i /><span>Analyzing India supply network with Gemini AI…</span></div>}
        {displayResponse && !loading && (
          <div className="response-card">
            {/* Step 1: Summary — The "So What?" */}
            <div className="resp-summary">
              <span className="eyebrow">Copilot analysis</span>
              <h3>{displayResponse.title}</h3>
              <p>{displayResponse.summary}</p>
            </div>

            {/* Step 2: Visual Data — The "Evidence" */}
            {displayResponse.bullets.length > 0 && (
              <div className="resp-data">
                <div className="resp-data-head">
                  <Table2 size={13} />
                  <span>Risk assessment details</span>
                </div>
                <div className="resp-data-table">
                  {displayResponse.bullets.map((b, i) => {
                    const parts = b.split('·')
                    return (
                      <div key={i} className="resp-data-row">
                        {parts.length >= 3 ? (
                          <>
                            <span className="resp-data-item">
                              <strong>{parts[0].trim()}</strong>
                              <small>{parts[1].trim()}</small>
                            </span>
                            <span className="resp-data-metric">{parts[2].trim()}</span>
                          </>
                        ) : (
                          <span className="resp-data-item"><span>{b}</span></span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Render backend payload tables */}
            {backendResult && <PayloadRenderer result={backendResult} />}

            {/* Step 3: Action — The "Solution" */}
            <div className="resp-action">
              {!answer?.startsWith('__') && (answer === 'Which products are at risk of going out of stock?' ||
                answer === 'Recommend alternate suppliers for Lithium-Ion Battery Pack' ||
                (backendResult?.intent === 'DISRUPTION_MITIGATION' && backendResult?.payload?.alternates)) && (
                <button className="primary-button reroute" onClick={() => setAnswer('rerouted')}>
                  Quick Reorder from Supplier B <ArrowRight size={14} />
                </button>
              )}
              {answer !== 'rerouted' && !backendResult?.intent && !answer?.includes('supplier') && !answer?.startsWith('__') && (
                <button className="secondary-button reroute" onClick={() => setAnswer('rerouted')}>
                  Apply resolution <ArrowRight size={14} />
                </button>
              )}
            </div>

            {answer === 'rerouted' && (
              <div className="success-note">
                <Check size={16} />
                <span><strong>Resolution applied</strong>Deccan Manufacturing (Pune) allocation reserved. Inventory risk reduced from critical to watch. Estimated exposure avoided: ₹1.2 Cr.</span>
              </div>
            )}
          </div>
        )}
      </div>
      <form className="copilot-input" id="copilot-form" onSubmit={e => { e.preventDefault(); if (query.trim()) ask(query) }}>
        <div className="copilot-input-shell">
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Ask about India supply network…" aria-label="Ask Copilot" id="copilot-input" />
          <button type="submit" aria-label="Send query" disabled={!query.trim()} id="copilot-send"><ArrowUp size={18} /></button>
        </div>
      </form>
    </aside>
  </div>
}

/* ────────────────────────────────────────────────────────────────────────────
   Executive Summary Modal
───────────────────────────────────────────────────────────────────────────── */
function SummaryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [sent, setSent] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  useEffect(() => {
    if (!open) setSent(false)
    const close = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open, onClose])
  useEffect(() => {
    if (!open) return
    setSummary(null)
    generateExecutiveSummary()
      .then(result => {
        const markdown = result.payload.markdown
        setSummary(typeof markdown === 'string' ? markdown : result.summary)
      })
      .catch(() => setSummary(null))
  }, [open])
  if (!open) return null
  return <div className="modal-shell" role="dialog" aria-modal="true" aria-labelledby="brief-title">
    <button className="modal-backdrop" onClick={onClose} aria-label="Close executive brief" />
    <section className="brief-modal">
      <header>
        <div><span className="eyebrow">Generated from live backend · India operations</span><h2 id="brief-title">Executive disruption brief</h2></div>
        <button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </header>
      <div className="brief-body">
        <div className="brief-status">
          <AlertTriangle size={18} />
          <div><strong>Supply chain status</strong><span>India operations · Live backend summary</span></div>
          <strong>{summary ? 'Ready' : 'Loading…'}</strong>
        </div>
        {summary
          ? <pre className="brief-markdown">{summary}</pre>
          : <div className="brief-grid">
              <article><span>01 / Impact</span><p>PO-889 (500× Lithium-Ion Battery Pack) is projected to arrive 3–5 days late via JNPT-Mumbai Port Corridor, putting Bhiwandi (Mumbai Distribution Hub) below safety stock in 2 days.</p></article>
              <article><span>02 / Mitigation</span><p>Reserve 500 units with Deccan Manufacturing (Pune) via road corridor and transfer 200 units from North India Logistics Hub to bridge near-term production demand.</p></article>
              <article><span>03 / Recovery</span><p>Executing both actions restores minimum inventory coverage within 24 hours and normal service levels within 7 days. Estimated exposure avoided: ₹1.2 Cr.</p></article>
            </div>
        }
      </div>
      <footer>
        <span>{sent ? 'Brief sent to procurement queue' : 'Prepared from current India network state'}</span>
        <button className="primary-button" id="send-to-procurement-btn" onClick={() => setSent(true)} disabled={sent}>
          {sent ? <><Check size={15} /> Sent</> : <><Send size={15} /> Send to procurement</>}
        </button>
      </footer>
    </section>
  </div>
}

const pageMeta: Record<PageKey, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: 'Saturday, July 19, 2026 · India Standard Time', title: 'Supply chain overview', description: 'Monitor India inventory, supplier health, and shipment risk in real time.' },
  network: { eyebrow: 'Network intelligence · India edition', title: 'India logistics network', description: 'Trace active lanes across JNPT, Mundra, Chennai, Kolkata ports. Identify chokepoints.' },
  inventory: { eyebrow: 'Inventory control · All warehouses', title: 'Inventory intelligence', description: 'Prioritize stockout risk across Bhiwandi, Chennai, Manesar, Kolkata, Bengaluru.' },
  shipments: { eyebrow: 'Shipment control · All corridors', title: 'Shipment operations', description: 'Track every purchase order across India\'s Golden Quadrilateral and port corridors.' },
  warehouses: { eyebrow: 'Capacity planning · 5 facilities', title: 'Warehouse operations', description: 'Balance space, throughput, and service levels across India distribution network.' },
  suppliers: { eyebrow: 'Supplier intelligence · 10 suppliers', title: 'Supplier risk center', description: 'Monitor reliability across Mumbai, Chennai, Pune, Ahmedabad, Bengaluru suppliers.' },
}

function PageIntro({ page }: { page: PageKey }) {
  const meta = pageMeta[page]
  return <div className="dashboard-intro"><div><span className="eyebrow">{meta.eyebrow}</span><h2>{meta.title}</h2><p>{meta.description}</p></div></div>
}

function FilterBar({ label }: { label: string }) {
  return <div className="filter-bar"><div><SlidersHorizontal size={15} /><span>{label}</span></div><button className="filter-chip active">All</button><button className="filter-chip">Critical</button><button className="filter-chip">Watch</button></div>
}

function InsightRail({ type }: { type: PageKey }) {
  const content = {
    network: [[Route, '5 active lanes', 'India port corridors'], [Clock3, '8.5 days', 'Average lead time'], [CircleDollarSign, '₹1.2 Cr', 'Modeled exposure']],
    inventory: [[PackageSearch, '8 SKUs', 'Require action'], [TrendingUp, '+46%', 'Battery demand'], [Clock3, '2 days', 'Lowest coverage']],
    shipments: [[Truck, '15 active', 'Across 5 corridors'], [Clock3, '94%', 'On-time delivery'], [AlertTriangle, '2 orders', 'Need attention']],
    warehouses: [[Building2, '5 sites', 'Pan-India DCs'], [CircleGauge, '74%', 'Average utilization'], [Box, '12.4K', 'Daily throughput']],
    suppliers: [[ShieldCheck, '10 suppliers', 'Across 9 cities'], [CircleGauge, '88%', 'Reliability score'], [AlertTriangle, '2 suppliers', 'Elevated risk']],
    overview: [[Route, '5 active lanes', 'India port corridors'], [CircleGauge, '88%', 'Supplier reliability'], [Box, '15 orders', 'In motion']],
  }[type]
  return <section className="insight-rail" aria-label={`${type} highlights`}>{content.map(([Icon, value, label]) => <article key={label as string}><Icon size={18} /><span><strong>{value as string}</strong><small>{label as string}</small></span></article>)}</section>
}

function ActivityFeed({ page }: { page: PageKey }) {
  const events = {
    network: ['PO-889 status: In Transit on JNPT-Mumbai Corridor', 'Chennai Port Corridor — normal operations', 'Mundra Port Route ETA improved by 4 hours'],
    inventory: ['ITEM-001 Battery Pack below reorder at Bhiwandi', 'Manesar (Delhi NCR) cycle count completed', 'ITEM-006 Cooling Fan Module replenished at Chennai'],
    shipments: ['PO-800 Microcontroller crossed Karnataka checkpoint', 'PO-801 Chassis Assembly cleared Pune dispatch', 'PO-802 Wiring Harness departed Surat facility'],
    warehouses: ['Bhiwandi outbound dock at 87% capacity', 'Manesar WH-003 inbound slot released', 'Bengaluru picked 940 units today'],
    suppliers: ['Konkan Components risk score changed to 62 (JNPT exposure)', 'Deccan Manufacturing audit approved', 'Hyderabad Precision Electronics lead time updated'],
    overview: ['India supply network refreshed', 'PO-889 entered final transit stage', 'Supplier scorecard recalculated for Q3 2026'],
  }[page]
  return <section className="panel activity-panel"><div className="section-heading"><div><span className="eyebrow">Live operations</span><h2>Recent activity</h2></div><span className="live-label"><i /> Live</span></div><ol>{events.map((event, index) => <li key={event}><i /><span><strong>{event}</strong><small>{index === 0 ? '2 min ago' : `${index * 11 + 4} min ago`}</small></span></li>)}</ol></section>
}

function PageContent({ page, disrupted, simulating, onSimulate, onReset, data }: { page: PageKey; disrupted: boolean; simulating: boolean; onSimulate: () => void; onReset: () => void; data: ReturnType<typeof mapSnapshot> }) {
  const flowMap = <FlowMap disrupted={disrupted} onReroute={onSimulate} />
  if (page === 'overview') return <><KpiStrip disrupted={disrupted} rows={data.kpiRows} /><DisruptionCard disrupted={disrupted} simulating={simulating} onSimulate={onSimulate} onReset={onReset} /><div className="top-grid">{flowMap}<Shipments disrupted={disrupted} rows={data.shipmentRows} /></div><div className="overview-lower"><Forecast /><ActivityFeed page="overview" /></div></>
  if (page === 'network') return <><InsightRail type={page} /><FilterBar label="All routes · India corridors" /><div className="network-page-grid">{flowMap}<ActivityFeed page={page} /></div><DisruptionCard disrupted={disrupted} simulating={simulating} onSimulate={onSimulate} onReset={onReset} /></>
  if (page === 'inventory') return <><InsightRail type={page} /><FilterBar label="All warehouses · Pan-India" /><InventoryTable rows={data.inventoryRows} /><div className="page-two-grid"><Forecast /><ActivityFeed page={page} /></div></>
  if (page === 'shipments') return <><InsightRail type={page} /><FilterBar label="All shipment stages · India corridors" /><div className="page-two-grid"><Shipments disrupted={disrupted} rows={data.shipmentRows} /><ActivityFeed page={page} /></div>{flowMap}</>
  if (page === 'warehouses') return <><InsightRail type={page} /><FilterBar label="All facilities · Pan-India" /><div className="page-two-grid"><Warehouses rows={data.warehouseRows} /><ActivityFeed page={page} /></div><section className="facility-grid">{data.warehouseRows.map(w => <article className="facility-card" key={w.code}><div className="facility-top"><span><strong>{w.city}</strong><small>{w.code} · Regional DC</small></span><span className={`status-pill ${w.status === 'critical' ? 'status-critical' : w.status === 'warning' ? 'status-warning' : 'status-healthy'}`}><i />{w.status}</span></div><strong className="facility-metric">{w.utilization}%</strong><span>space utilized</span><div className="utilization"><div><i style={{ width: `${w.utilization}%` }} className={w.status === 'critical' ? 'bar-critical' : w.status === 'warning' ? 'bar-warning' : ''} /></div></div><dl><div><dt>Throughput</dt><dd>{w.code === 'WH-001' ? '6.2K' : w.code === 'WH-003' ? '5.4K' : '3.8K'}</dd></div><div><dt>Orders</dt><dd>{w.code === 'WH-001' ? '142' : w.code === 'WH-003' ? '118' : '86'}</dd></div></dl></article>)}</section></>
  return <><InsightRail type={page} /><FilterBar label="All supplier regions · India" /><div className="page-two-grid"><Suppliers rows={data.supplierRows} /><ActivityFeed page={page} /></div><section className="supplier-scorecards">{data.supplierRows.map((s, i) => <article key={s.name}><div className="supplier-score-head"><ScoreProgress score={s.score} /><span><strong>{s.name}</strong><small>{s.region} · Strategic supplier</small></span></div><p>{s.issue === 'On target' ? 'Performance within contracted thresholds.' : `${s.issue} is increasing delivery uncertainty.`}</p><dl><div><dt>OTIF</dt><dd>{Math.min(100, s.score + 2)}%</dd></div><div><dt>Lead time</dt><dd>{s.region.includes('Mumbai') ? '8d' : s.region.includes('Bengaluru') ? '5d' : '6d'}</dd></div><div><dt>Spend</dt><dd>{s.score > 85 ? '₹2.4Cr' : '₹1.8Cr'}</dd></div></dl><button className="text-button" onClick={() => alert(`Supplier Scorecard: ${s.name}\nScore: ${s.score}/100\nRegion: ${s.region}\nIssue: ${s.issue}\nStatus: ${s.status}\n\nFull scorecard available in the next release.`)}>Open scorecard <ArrowRight size={14} /></button></article>)}</section></>
}

/* ────────────────────────────────────────────────────────────────────────────
   Root Dashboard component
───────────────────────────────────────────────────────────────────────────── */
export function Dashboard({ page = 'overview' }: { page?: PageKey }) {
  const { user, loading: authLoading } = useAuth()
  const [disrupted, setDisrupted] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null)
  const [apiOnline, setApiOnline] = useState(false)
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [guidedDemoOpen, setGuidedDemoOpen] = useState(false)
  const data = mapSnapshot(snapshot)

  useEffect(() => {
    let active = true
    getDashboardSnapshot()
      .then(result => {
        if (!active) return
        setSnapshot(result)
        setDisrupted(Boolean(result.active_disruption))
        setApiOnline(true)
      })
      .catch(() => { if (active) setApiOnline(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!authLoading && user && !localStorage.getItem('supplysense_tour_done')) {
      const timer = setTimeout(() => setGuidedDemoOpen(true), 600)
      return () => clearTimeout(timer)
    }
  }, [user, authLoading])

  const completeTour = () => {
    localStorage.setItem('supplysense_tour_done', 'true')
    setGuidedDemoOpen(false)
  }

  const simulate = async () => {
    setSimulating(true)
    try {
      await runDisruptionSimulation()
      const result = await getDashboardSnapshot()
      setSnapshot(result)
      setApiOnline(true)
    } catch {
      // ignore - still trigger disruption
    } finally {
      setDisrupted(true)
      setSimulating(false)
    }
  }

  const resetDisruption = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/api/simulate/disruption/reset`, { method: 'DELETE' })
      const result = await getDashboardSnapshot()
      setSnapshot(result)
    } catch {
      // silent — still reset UI
    }
    setDisrupted(false)
  }

  const handleDemandSpike = () => {
    if (!disrupted) simulate()
    setCopilotOpen(true)
  }

  const handleSupplierRisk = () => {
    setCopilotOpen(true)
  }

  if (authLoading) return null

  return <div className="app-shell"><Sidebar page={page} /><div className="workspace"><Header onMenu={() => setMenuOpen(true)} onCopilot={() => setCopilotOpen(true)} onSummary={() => setSummaryOpen(true)} disrupted={disrupted} onSimulate={simulate} simulating={simulating} /><main className="dashboard-main"><PageIntro page={page} /><PageContent page={page} disrupted={disrupted} simulating={simulating} onSimulate={simulate} onReset={resetDisruption} data={data} /></main></div><button className="floating-copilot" onClick={() => setCopilotOpen(true)} id="floating-copilot"><Image src="/bot-icon.png" alt="Copilot" width={26} height={26} style={{ objectFit: 'contain' }} /><span>Ask Copilot</span></button><MobileNav open={menuOpen} page={page} onClose={() => setMenuOpen(false)} onCopilot={() => setCopilotOpen(true)} onSummary={() => setSummaryOpen(true)} /><CopilotDrawer open={copilotOpen} onClose={() => setCopilotOpen(false)} /><SummaryModal open={summaryOpen} onClose={() => setSummaryOpen(false)} /><GuidedDemo open={guidedDemoOpen} onDismiss={completeTour} onSimulateDemandSpike={handleDemandSpike} onCheckSupplierRisk={handleSupplierRisk} onGenerateSummary={() => { setSummaryOpen(true); completeTour() }} /></div>
}
