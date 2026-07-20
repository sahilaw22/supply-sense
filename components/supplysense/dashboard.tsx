'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight, ArrowUp, Check, ChevronRight,
  LayoutDashboard, LogOut, Menu, PackageSearch, Sparkles,
  ShieldCheck, Truck, X, SlidersHorizontal,
  Building2, Table2, Info,
  CheckCircle, HelpCircle, Maximize, Minimize
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Legend
} from 'recharts'
import {
  copilotResponses, demandPoints, forecastPoints, inventory, kpis, promptOptions,
  shipments, suppliers, warehouses,
  fallbackStoreSales, fallbackEcommSales, fallbackEcommInventory, fallbackEcommInstock,
  fallbackEcommReturns, fallbackDcMetrics, fallbackOrderForecast, fallbackDemandForecast,
  fallbackVendorScorecard, fallbackTenderAnalysis, fallbackStoreMumd, fallbackModularPlan,
  fallbackFutureValidStores, fallbackItemMaster, fallbackExceptions, fallbackDemandIntelligence,
  fallbackAutomatedInsights
} from '@/lib/supplysense-data'
import {
  askCopilot,
  getDashboardSnapshot,
  runDisruptionSimulation,
  type ContractResponse,
  type DashboardSnapshot,
  getStoreSales,
  getEcommSales,
  getEcommInventory,
  getEcommInstock,
  getEcommReturns,
  getDcMetrics,
  getOrderForecast,
  getDemandForecast,
  getVendorScorecard,
  getTenderAnalysis,
  getStoreMumd,
  getModularPlan,
  getFutureValidStores,
  getItemMaster,
  getExceptions,
  getDemandIntelligence,
  getAutomatedInsights,
  calculateSso
} from '@/lib/supplysense-api'
import dynamic from 'next/dynamic'
import { useAuth } from '@/lib/auth-context'

import { ScoreProgress } from './score-progress'

const FlowMap = dynamic(() => import('./flow-map').then(m => m.FlowMap), { ssr: false })

const STORES = [
  'Reliance Retail - Mumbai',
  'Reliance Retail - Bengaluru',
  'Reliance Retail - Delhi NCR',
  'Reliance Retail - Pune',
  'Reliance Retail - Kolkata',
  'Reliance Retail - Hyderabad',
  'Reliance Retail - Ahmedabad',
  'Reliance Retail - Chennai'
]

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
    : '88%'
  const leadTime = snapshot.suppliers.length
    ? `${(snapshot.suppliers.reduce((sum, row) => sum + row.lead_time_days, 0) / snapshot.suppliers.length).toFixed(1)}d`
    : '8.5d'

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
   Brand mark
 ───────────────────────────────────────────────────────────────────────────── */
function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <Image src="/logo.png" alt="SupplySense" width={38} height={38} style={{ objectFit: 'contain' }} priority />
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   Navigation groups setup matching the mobile accordion mockup
 ───────────────────────────────────────────────────────────────────────────── */
const navGroups = [
  {
    title: 'Sales & Inventory',
    icon: PackageSearch,
    items: [
      { name: 'Store Sales', href: '/store-sales' },
      { name: 'eComm Sales', href: '/ecomm-sales' },
      { name: 'eComm Inventory', href: '/ecomm-inventory' },
      { name: 'eComm In-stock Rate', href: '/ecomm-instock' },
      { name: 'eComm Returns Register', href: '/ecomm-returns' },
    ]
  },
  {
    title: 'Supply Chain',
    icon: Truck,
    items: [
      { name: 'DC Logistics Metrics', href: '/dc-metrics' },
      { name: 'Order Forecast', href: '/order-forecast' },
      { name: 'Demand Forecast', href: '/demand-forecast' },
    ]
  },
  {
    title: 'Performance',
    icon: ShieldCheck,
    items: [
      { name: 'Vendor Scorecard', href: '/vendor-scorecard' },
      { name: 'Tender Analysis', href: '/tender-analysis' },
      { name: 'Store Markdowns', href: '/store-mumd' },
    ]
  },
  {
    title: 'Planning',
    icon: Building2,
    items: [
      { name: 'Modular Shelf Plan', href: '/modular-plan' },
      { name: 'Future Store Pipeline', href: '/future-valid-stores' },
      { name: 'Item Master', href: '/item-master' },
    ]
  },
  {
    title: 'Operations',
    icon: SlidersHorizontal,
    items: [
      { name: 'Store Order Calculator', href: '/sso-builder' },
      { name: 'Alert Exceptions', href: '/exceptions' },
      { name: 'Demand-Order Alignment', href: '/demand-intelligence' },
      { name: 'Automated Insights Feed', href: '/automated-insights' },
    ]
  }
] as const

function groupForPage(page: PageKey): string | null {
  for (const group of navGroups) {
    if (group.items.some(item => item.href.substring(1) === page)) return group.title
  }
  return null
}

function Sidebar({ page }: { page: PageKey }) {
  const [openGroup, setOpenGroup] = useState<string | null>(groupForPage(page) ?? 'Sales & Inventory')

  useEffect(() => {
    const g = groupForPage(page)
    if (g) setOpenGroup(g)
  }, [page])

  const toggleGroup = (title: string) => {
    setOpenGroup(openGroup === title ? null : title)
  }

  return (
    <aside className="sidebar">
      <Link href="/" aria-label="SupplySense overview" className="sidebar-brand">
        <BrandMark />
        <span className="brand-text">SupplySense</span>
      </Link>
      <nav aria-label="Primary navigation" className="sidebar-nav">
        <Link href="/" className={page === 'overview' ? 'nav-link active' : 'nav-link'}>
          <LayoutDashboard size={16} />
          <span>Overview</span>
        </Link>
        
        {navGroups.map(group => {
          const GroupIcon = group.icon
          const isOpen = openGroup === group.title
          return (
            <div key={group.title} className="nav-group">
              <button className="nav-group-header" onClick={() => toggleGroup(group.title)}>
                <GroupIcon size={16} />
                <span>{group.title}</span>
                <ChevronRight size={14} className={isOpen ? 'rotate-90' : ''} />
              </button>
              {isOpen && (
                <div className="nav-group-items">
                  {group.items.map(item => {
                    const activeKey = item.href.substring(1)
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={page === activeKey ? 'nav-sub-link active' : 'nav-sub-link'}
                      >
                        {item.name}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

export type PageKey =
  | 'overview'
  | 'network'
  | 'inventory'
  | 'shipments'
  | 'warehouses'
  | 'suppliers'
  | 'store-sales'
  | 'ecomm-sales'
  | 'ecomm-inventory'
  | 'ecomm-instock'
  | 'ecomm-returns'
  | 'dc-metrics'
  | 'order-forecast'
  | 'demand-forecast'
  | 'vendor-scorecard'
  | 'tender-analysis'
  | 'store-mumd'
  | 'modular-plan'
  | 'future-valid-stores'
  | 'item-master'
  | 'sso-builder'
  | 'exceptions'
  | 'demand-intelligence'
  | 'automated-insights'

function MobileNav({ open, page, onClose, onCopilot }: { open: boolean; page: PageKey; onClose: () => void; onCopilot: () => void }) {
  const [openGroup, setOpenGroup] = useState<string | null>(groupForPage(page) ?? 'Sales & Inventory')

  useEffect(() => { setOpenGroup(groupForPage(page) ?? 'Sales & Inventory') }, [page])

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  return (
    <div className={open ? 'mobile-nav-shell open' : 'mobile-nav-shell'} aria-hidden={!open}>
      <button className="mobile-nav-backdrop" onClick={onClose} aria-label="Close navigation" />
      <aside className="mobile-nav" role="dialog" aria-modal="true" aria-label="Mobile navigation">
        <header>
          <div className="mobile-nav-brand">
            <BrandMark />
            <div>
              <strong>SupplySense</strong>
              <span>Retail Command Center</span>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close menu"><X size={18} /></button>
        </header>
        <div className="mobile-nav-list">
          <Link href="/" onClick={onClose} className={page === 'overview' ? 'active' : ''}>
            <LayoutDashboard size={18} />
            <span>Overview</span>
          </Link>
          {navGroups.map(group => {
            const GroupIcon = group.icon
            const isOpen = openGroup === group.title
            return (
              <div key={group.title} className="mobile-nav-group">
                <button className="mobile-group-header" onClick={() => setOpenGroup(isOpen ? null : group.title)}>
                  <GroupIcon size={18} />
                  <span>{group.title}</span>
                  <ChevronRight size={14} className={isOpen ? 'rotate-90' : ''} />
                </button>
                {isOpen && (
                  <div className="mobile-group-items">
                    {group.items.map(item => {
                      const activeKey = item.href.substring(1)
                      return (
                        <Link key={item.name} href={item.href} onClick={onClose} className={page === activeKey ? 'active' : ''}>
                          {item.name}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <footer>
          <div className="avatar">SC</div>
          <span><strong>Supply Chain Director</strong><small>India Operations</small></span>
        </footer>
      </aside>
    </div>
  )
}

function Header({ onCopilot, onMenu }: { onCopilot: () => void; onMenu: () => void }) {
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
      <div className="topbar-title">
        <button className="mobile-menu" onClick={onMenu} aria-label="Open menu"><Menu size={19} /></button>
        <div>
          <span className="eyebrow">AI Supply Chain Intelligence</span>
          <h1>SupplySense</h1>
        </div>
      </div>
      <div className="header-actions">
        <button className="secondary-button copilot-header-btn" onClick={onCopilot} id="copilot-header-btn">
          <Image src="/bot-icon.png" alt="Copilot" width={22} height={22} style={{ objectFit: 'contain', marginRight: '6px' }} />
          <span>Ask Copilot</span>
        </button>
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

function KpiStrip({ rows }: { rows: KpiRow[] }) {
  return (
    <section className="kpi-strip" aria-label="Supply chain key performance indicators">
      {rows.map((kpi) => (
        <article className="kpi" key={kpi.label}>
          <div className="kpi-heading">
            <span>{kpi.label}</span>
            <span className={kpi.risk ? 'trend negative' : 'trend'}>{kpi.trend}</span>
          </div>
          <strong>{kpi.value}</strong>
          <small>{kpi.detail}</small>
        </article>
      ))}
    </section>
  )
}

function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  return (
    <section className="panel inventory-panel" id="inventory">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Exception queue</span>
          <h2>Inventory at risk</h2>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>Item</th><th>Location</th><th>On hand</th><th>Cover</th><th>Demand</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={`${row.sku}-${row.warehouse}`}>
                <td><strong>{row.name}</strong><span>{row.sku}</span></td>
                <td>{row.warehouse}</td>
                <td>{row.stock.toLocaleString('en-IN')}</td>
                <td>{row.cover}</td>
                <td>{row.demand}</td>
                <td><span className={`status-pill ${statusClass[row.status]}`}><i />{row.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="inventory-cards">
        {rows.map(row => (
          <article key={`${row.sku}-${row.warehouse}`}>
            <header>
              <span><strong>{row.name}</strong><small>{row.sku} · {row.warehouse}</small></span>
              <span className={`status-pill ${statusClass[row.status]}`}><i />{row.status}</span>
            </header>
            <dl>
              <div><dt>On hand</dt><dd>{row.stock.toLocaleString('en-IN')}</dd></div>
              <div><dt>Cover</dt><dd>{row.cover}</dd></div>
              <div><dt>Demand</dt><dd>{row.demand}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  )
}

function TypewriterText({ text, speed = 15 }: { text: string; speed?: number }) {
  const [displayedText, setDisplayedText] = useState('')
  
  useEffect(() => {
    setDisplayedText('')
    let index = 0
    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(prev => prev + text.charAt(index))
        index++
      } else {
        clearInterval(timer)
      }
    }, speed)
    
    return () => clearInterval(timer)
  }, [text, speed])
  
  return <span>{displayedText}</span>
}

function PayloadRenderer({ result }: { result: ContractResponse }) {
  const { payload } = result

  if (payload.rows && Array.isArray(payload.rows) && (payload.rows as unknown[]).length > 0) {
    const rows = payload.rows as Record<string, unknown>[]
    const keys = Object.keys(rows[0]).slice(0, 6)
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

function CopilotDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [backendResult, setBackendResult] = useState<ContractResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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

  return (
    <div className={open ? 'drawer-shell open' : 'drawer-shell'} aria-hidden={!open}>
      <button className="drawer-backdrop" aria-label="Close Copilot" onClick={onClose} />
      <aside className={`copilot-drawer ${fullscreen ? 'fullscreen' : ''}`} role="dialog" aria-modal="true" aria-label="SupplySense Copilot">
        <header className="copilot-header">
          <div className="copilot-title">
            <Image src="/bot-icon.png" alt="SupplySense AI" width={56} height={56} style={{ objectFit: 'contain' }} />
            <span><strong>SupplySense AI</strong><small>Online</small></span>
          </div>
          <div className="copilot-header-actions">
            <button className="copilot-fullscreen" onClick={() => setFullscreen(v => !v)} aria-label={fullscreen ? 'Minimize' : 'Full screen'}>{fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}</button>
            <button className="copilot-close" onClick={onClose} aria-label="Close Copilot"><X size={18} /></button>
          </div>
        </header>
        <div className="copilot-body">
          <div className="assistant-intro">
            <p>Ask me anything about</p>
            <h3>Shipments • Risks • Suppliers</h3>
          </div>
          <div className="prompt-chips">
            {promptOptions.map(p => <button key={p} onClick={() => ask(p)}>{p}<ArrowRight size={13} /></button>)}
          </div>
          {loading && <div className="thinking" role="status"><div className="thinking-bar" /><span>Analyzing...</span></div>}
          {displayResponse && !loading && (
            <div className="response-card">
              <div className="resp-summary">
                <h3>{displayResponse.title}</h3>
                <p><TypewriterText text={displayResponse.summary} /></p>
              </div>

              {displayResponse.bullets.length > 0 && (
                <div className="resp-data">
                  <div className="resp-data-head">
                    <Table2 size={13} />
                    <span>Reference Details</span>
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

              {backendResult && <PayloadRenderer result={backendResult} />}

              <div className="resp-action">
                {!!(!answer?.startsWith('__') && (answer === 'Which products are at risk of going out of stock?' ||
                  answer === 'Recommend alternate suppliers for Lithium-Ion Battery Pack' ||
                  (backendResult?.intent === 'DISRUPTION_MITIGATION' && backendResult?.payload?.alternates))) && (
                  <button className="primary-button reroute" onClick={() => setAnswer('rerouted')}>
                    Quick Reorder from Supplier B <ArrowRight size={14} />
                  </button>
                )}
                {!!(answer !== 'rerouted' && !backendResult?.intent && !answer?.includes('supplier') && !answer?.startsWith('__')) && (
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
            <textarea ref={inputRef} value={query} onChange={e => { setQuery(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px' }} placeholder="Message SupplySense..." aria-label="Ask Copilot" id="copilot-input" rows={1} />
            <button type="submit" aria-label="Send query" disabled={!query.trim()} id="copilot-send" className={query.trim() ? 'has-text' : ''}>
              <ArrowUp size={18} />
            </button>
          </div>
        </form>
      </aside>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   Dynamic Section Rendering and Layouts
 ───────────────────────────────────────────────────────────────────────────── */
function PageIntro({ page }: { page: PageKey }) {
  const meta: Record<PageKey, { eyebrow: string; title: string }> = {
    overview: { eyebrow: 'Saturday, July 19, 2026 · India Standard Time', title: 'Executive dashboard' },
    network: { eyebrow: 'Network intelligence · India edition', title: 'India logistics network' },
    inventory: { eyebrow: 'Inventory control · All warehouses', title: 'Inventory intelligence' },
    shipments: { eyebrow: 'Shipment control · All corridors', title: 'Shipment operations' },
    warehouses: { eyebrow: 'Capacity planning · 5 facilities', title: 'Warehouse operations' },
    suppliers: { eyebrow: 'Supplier intelligence · 10 suppliers', title: 'Supplier risk center' },
    'store-sales': { eyebrow: 'Retail operations · Store level', title: 'Store sales analytics' },
    'ecomm-sales': { eyebrow: 'Omnichannel fulfillment', title: 'eComm sales intelligence' },
    'ecomm-inventory': { eyebrow: 'Fulfillment center levels', title: 'eComm inventory monitoring' },
    'ecomm-instock': { eyebrow: 'Service level compliance', title: 'eComm instock metrics' },
    'ecomm-returns': { eyebrow: 'Reverse logistics', title: 'eComm returns registry' },
    'dc-metrics': { eyebrow: 'Distribution center operations', title: 'DC logistics metrics' },
    'order-forecast': { eyebrow: 'Replenishment forecasting', title: 'Order pipeline forecast' },
    'demand-forecast': { eyebrow: 'Customer demand signals', title: 'Consumer demand forecast' },
    'vendor-scorecard': { eyebrow: 'Supplier scorecards', title: 'Vendor service evaluation' },
    'tender-analysis': { eyebrow: 'Freight carrier bidding', title: 'Tender logistics analysis' },
    'store-mumd': { eyebrow: 'Pricing and promotion', title: 'Store markdown / markup' },
    'modular-plan': { eyebrow: 'Planogram management', title: 'Modular planning' },
    'future-valid-stores': { eyebrow: 'Retail store pipeline', title: 'Future valid stores' },
    'item-master': { eyebrow: 'SKU attributes database', title: 'Item master catalog' },
    'sso-builder': { eyebrow: 'Store-Specific Order Builder', title: 'SSO auto-ordering builder' },
    exceptions: { eyebrow: 'Automated exception queue', title: 'Exception detection' },
    'demand-intelligence': { eyebrow: 'Demand & order alignment', title: 'Demand intelligence' },
    'automated-insights': { eyebrow: 'Real-time concerns & alerts', title: 'Automated insights feed' },
  }
  const { eyebrow, title } = meta[page] || meta.overview
  return (
    <div className="dashboard-intro">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <span className="last-updated"><i /> Live</span>
    </div>
  )
}

const months = ['Apr 22', 'May 06', 'May 20', 'Jun 03', 'Jun 17', 'Jul 01', 'Jul 15', 'Jul 29', 'Aug 12', 'Aug 26', 'Sep 09', 'Sep 23', 'Oct 07', 'Oct 21', 'Nov 04', 'Nov 18', 'Dec 02', 'Dec 16']
const chartData: Array<{ month: string; demand: number | null; forecast: number | null }> = [
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
  return (
    <section className="panel forecast-panel" style={{ marginTop: '20px' }}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">12-week signal · EV Battery demand</span>
          <h2>Lithium-Ion Battery demand forecast</h2>
        </div>
        <div className="forecast-controls" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="forecast-change" style={{ color: '#f59e0b', fontSize: '11px', fontWeight: 'bold' }}>+46% demand</span>
          <button className={`filter-chip ${showForecast ? 'active' : ''}`} onClick={() => setShowForecast(v => !v)}>
            {showForecast ? 'Hide forecast' : 'Show forecast'}
          </button>
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
          <Area type="monotone" dataKey="demand" stroke="#3b82f6" strokeWidth={2} fill="url(#demandGradient)" dot={{ r: 3, fill: '#3b82f6', stroke: 'none' }} activeDot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} name="demand" connectNulls={false} />
          {showForecast && <Area type="monotone" dataKey="forecast" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" fill="url(#forecastGradient)" dot={{ r: 3, fill: '#f59e0b', stroke: 'none' }} activeDot={{ r: 5, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }} name="forecast" connectNulls />}
        </AreaChart>
      </ResponsiveContainer>
    </section>
  )
}

function NavigationGrid() {
  return (
    <div className="navigation-grid">
      {navGroups.slice(0, 4).map(group => {
        const GroupIcon = group.icon
        return (
          <div key={group.title} className="nav-card">
            <div className="nav-card-header">
              <div className="nav-card-icon-wrap">
                <GroupIcon size={20} />
              </div>
              <h3>{group.title}</h3>
            </div>
            <div className="nav-card-items">
              {group.items.map(item => {
                return (
                  <Link key={item.name} href={item.href} className="nav-card-item-link">
                    <span>{item.name}</span>
                    <ArrowRight size={14} />
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function Dashboard({ page = 'overview' }: { page?: PageKey }) {
  const { user, loading: authLoading } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null)
  
  // Datasets states
  const [storeSalesRows, setStoreSalesRows] = useState<any[]>([])
  const [ecommSalesRows, setEcommSalesRows] = useState<any[]>([])
  const [ecommInventoryRows, setEcommInventoryRows] = useState<any[]>([])
  const [ecommInstockRows, setEcommInstockRows] = useState<any[]>([])
  const [ecommReturnsRows, setEcommReturnsRows] = useState<any[]>([])
  const [dcMetricsRows, setDcMetricsRows] = useState<any[]>([])
  const [orderForecastRows, setOrderForecastRows] = useState<any[]>([])
  const [demandForecastRows, setDemandForecastRows] = useState<any[]>([])
  const [vendorScorecardRows, setVendorScorecardRows] = useState<any[]>([])
  const [tenderAnalysisRows, setTenderAnalysisRows] = useState<any[]>([])
  const [storeMumdRows, setStoreMumdRows] = useState<any[]>([])
  const [modularPlanRows, setModularPlanRows] = useState<any[]>([])
  const [futureValidStoresRows, setFutureValidStoresRows] = useState<any[]>([])
  const [itemMasterRows, setItemMasterRows] = useState<any[]>([])
  
  const [exceptionsData, setExceptionsData] = useState<any>(null)
  const [demandIntelData, setDemandIntelData] = useState<any>(null)
  const [automatedInsightsList, setAutomatedInsightsList] = useState<any[]>([])

  // SSO Builder Interactive state
  const [selectedStore, setSelectedStore] = useState('Reliance Retail - Mumbai')
  const [selectedItem, setSelectedItem] = useState('Lithium-Ion Battery Pack')
  const [targetCover, setTargetCover] = useState(15)
  const [minOrder, setMinOrder] = useState(50)
  const [ssoCalcResult, setSsoCalcResult] = useState<any>(null)
  const [ssoCalculating, setSsoCalculating] = useState(false)
  const [ssoConfirmed, setSsoConfirmed] = useState(false)

  const data = mapSnapshot(snapshot)

  // Fetch core snapshot on mount
  useEffect(() => {
    getDashboardSnapshot()
      .then(setSnapshot)
      .catch(() => {})
  }, [])

  // Dynamic datasets loading based on page selection
  useEffect(() => {
    if (page === 'store-sales') {
      getStoreSales().then(setStoreSalesRows).catch(() => setStoreSalesRows(fallbackStoreSales))
    } else if (page === 'ecomm-sales') {
      getEcommSales().then(setEcommSalesRows).catch(() => setEcommSalesRows(fallbackEcommSales))
    } else if (page === 'ecomm-inventory') {
      getEcommInventory().then(setEcommInventoryRows).catch(() => setEcommInventoryRows(fallbackEcommInventory))
    } else if (page === 'ecomm-instock') {
      getEcommInstock().then(setEcommInstockRows).catch(() => setEcommInstockRows(fallbackEcommInstock))
    } else if (page === 'ecomm-returns') {
      getEcommReturns().then(setEcommReturnsRows).catch(() => setEcommReturnsRows(fallbackEcommReturns))
    } else if (page === 'dc-metrics') {
      getDcMetrics().then(setDcMetricsRows).catch(() => setDcMetricsRows(fallbackDcMetrics))
    } else if (page === 'order-forecast') {
      getOrderForecast().then(setOrderForecastRows).catch(() => setOrderForecastRows(fallbackOrderForecast))
    } else if (page === 'demand-forecast') {
      getDemandForecast().then(setDemandForecastRows).catch(() => setDemandForecastRows(fallbackDemandForecast))
    } else if (page === 'vendor-scorecard') {
      getVendorScorecard().then(setVendorScorecardRows).catch(() => setVendorScorecardRows(fallbackVendorScorecard))
    } else if (page === 'tender-analysis') {
      getTenderAnalysis().then(setTenderAnalysisRows).catch(() => setTenderAnalysisRows(fallbackTenderAnalysis))
    } else if (page === 'store-mumd') {
      getStoreMumd().then(setStoreMumdRows).catch(() => setStoreMumdRows(fallbackStoreMumd))
    } else if (page === 'modular-plan') {
      getModularPlan().then(setModularPlanRows).catch(() => setModularPlanRows(fallbackModularPlan))
    } else if (page === 'future-valid-stores') {
      getFutureValidStores().then(setFutureValidStoresRows).catch(() => setFutureValidStoresRows(fallbackFutureValidStores))
    } else if (page === 'item-master') {
      getItemMaster().then(setItemMasterRows).catch(() => setItemMasterRows(fallbackItemMaster))
    } else if (page === 'exceptions') {
      getExceptions().then(setExceptionsData).catch(() => setExceptionsData(fallbackExceptions))
    } else if (page === 'demand-intelligence') {
      getDemandIntelligence().then(setDemandIntelData).catch(() => setDemandIntelData(fallbackDemandIntelligence))
    } else if (page === 'automated-insights' || page === 'overview') {
      getAutomatedInsights().then(setAutomatedInsightsList).catch(() => setAutomatedInsightsList(fallbackAutomatedInsights))
    }
  }, [page])

  const handleSsoCalculate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSsoCalculating(true)
    setSsoConfirmed(false)
    try {
      const res = await calculateSso(selectedStore, selectedItem, targetCover, minOrder)
      setSsoCalcResult(res)
    } catch {
      // Local calculation fallback
      const costMap: Record<string, number> = {
        'Lithium-Ion Battery Pack': 7055.75,
        'Microcontroller Unit': 517.70,
        'Chassis Assembly': 11857.00,
        'Brushless DC Motor': 3235.60
      }
      const packMap: Record<string, number> = {
        'Lithium-Ion Battery Pack': 12,
        'Microcontroller Unit': 48,
        'Chassis Assembly': 6,
        'Brushless DC Motor': 24
      }
      const dailySales = 5.8
      const rawNeeded = Math.max(minOrder, Math.round(dailySales * targetCover))
      const packSize = packMap[selectedItem] || 12
      const cases = Math.ceil(rawNeeded / packSize)
      const recommendedQty = cases * packSize
      const cost = recommendedQty * (costMap[selectedItem] || 2500)
      setSsoCalcResult({
        store_name: selectedStore,
        item_name: selectedItem,
        avg_daily_sales: dailySales,
        target_cover_days: targetCover,
        raw_quantity_needed: rawNeeded,
        pack_size: packSize,
        cases_to_order: cases,
        recommended_order_qty: recommendedQty,
        estimated_cost_inr: cost,
        total_weight_kg: recommendedQty * 2.1,
        msg: `Optimal order recommended: ${cases} cases (${recommendedQty} units) of ${selectedItem} for ${selectedStore}.`
      })
    } finally {
      setSsoCalculating(false)
    }
  }

  const handleSsoConfirm = () => {
    setSsoConfirmed(true)
    setTimeout(() => {
      setSsoConfirmed(false)
      setSsoCalcResult(null)
    }, 4000)
  }

  if (authLoading) return null

  return (
    <div className="app-shell">
      <Sidebar page={page} />
      <div className="workspace">
        <Header
          onMenu={() => setMenuOpen(true)}
          onCopilot={() => setCopilotOpen(true)}
          
        />
        <main className="dashboard-main">
          <PageIntro page={page} />
          
          {/* Overview / Landing Page */}
          {page === 'overview' && (
            <>
              <KpiStrip rows={data.kpiRows} />
              
              <Forecast />
              
              <div className="section-divider" />
              
              <div className="overview-container">
                <div className="overview-main-left">
                  <div className="panel-title-row">
                    <span className="eyebrow">Interactive command map</span>
                    <h3>Retail Store and Distribution Grid</h3>
                  </div>
                  <div className="map-panel" style={{ height: '360px', overflow: 'hidden', borderRadius: '8px' }}>
                    <FlowMap disrupted={false} onReroute={() => {}} />
                  </div>
                  
                  <div className="section-divider" />
                  
                  <div className="panel-title-row">
                    <span className="eyebrow">Sub-feature shortcuts</span>
                    <h3>Omnichannel Store Control Center</h3>
                  </div>
                  <NavigationGrid />
                </div>
                
                <div className="overview-main-right">
                  <div className="panel automated-insights-panel">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">Real-time narrative</span>
                        <h2>Automated Concerns Feed</h2>
                      </div>
                      <Sparkles size={16} className="text-amber-500" />
                    </div>
                    <div className="insights-feed-list">
                      {automatedInsightsList.map(ins => (
                        <div key={ins.id} className={`insight-feed-card border-l-2 ${ins.severity === 'critical' ? 'border-red-500' : ins.severity === 'warning' ? 'border-amber-500' : 'border-green-500'}`}>
                          <div className="insight-card-top">
                            <strong>{ins.title}</strong>
                            <span className={`severity-tag ${ins.severity}`}>{ins.severity}</span>
                          </div>
                          <p>{ins.description}</p>
                          <div className="insight-card-rec">
                            <Info size={12} />
                            <span>Rec: {ins.recommendation}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 1. Sales & Inventory Pages */}
          {page === 'store-sales' && (
            <div className="panel">
              <div className="panel-header-actions">
                <h3>Store Sales Registry</h3>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>Store Name</th><th>Item Name</th><th>Date</th><th>Quantity Sold</th><th>Revenue (₹)</th></tr>
                  </thead>
                  <tbody>
                    {storeSalesRows.map((r, i) => (
                      <tr key={i}>
                        <td><strong>{r.store_name}</strong></td>
                        <td>{r.item_name}</td>
                        <td><span className="mono-label">{r.date}</span></td>
                        <td>{r.quantity_sold}</td>
                        <td className="text-green-500 font-mono">₹{r.revenue_inr.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page === 'ecomm-sales' && (
            <div className="panel">
              <div className="panel-header-actions">
                <h3>eComm Sales Metrics</h3>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>Channel</th><th>Item Name</th><th>Date</th><th>Orders</th><th>Revenue (₹)</th></tr>
                  </thead>
                  <tbody>
                    {ecommSalesRows.map((r, i) => (
                      <tr key={i}>
                        <td><span className="channel-badge">{r.channel_name}</span></td>
                        <td>{r.item_name}</td>
                        <td><span className="mono-label">{r.date}</span></td>
                        <td>{r.orders_count}</td>
                        <td className="text-green-500 font-mono">₹{r.revenue_inr.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page === 'ecomm-inventory' && (
            <div className="panel">
              <div className="panel-header-actions">
                <h3>eComm Inventory Balance</h3>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>Fulfillment Center</th><th>Item Name</th><th>Stock On Hand</th><th>Committed Stock</th><th>Safety Stock</th><th>Net Available</th></tr>
                  </thead>
                  <tbody>
                    {ecommInventoryRows.map((r, i) => (
                      <tr key={i}>
                        <td><strong>{r.facility_name}</strong></td>
                        <td>{r.item_name}</td>
                        <td className="font-mono">{r.stock_on_hand}</td>
                        <td className="font-mono text-amber-500">{r.committed_stock}</td>
                        <td className="font-mono text-blue-500">{r.safety_stock}</td>
                        <td className="font-mono font-bold text-green-500">{r.stock_on_hand - r.committed_stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page === 'ecomm-instock' && (
            <div className="panel">
              <div className="panel-header-actions">
                <h3>eComm Instock Compliance</h3>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>Item Name</th><th>Date</th><th>Instock Rate</th><th>Out of Stock (Min)</th><th>Service Status</th></tr>
                  </thead>
                  <tbody>
                    {ecommInstockRows.map((r, i) => (
                      <tr key={i}>
                        <td><strong>{r.item_name}</strong></td>
                        <td><span className="mono-label">{r.date}</span></td>
                        <td className="font-mono font-bold">{r.instock_rate_pct}%</td>
                        <td className="font-mono">{r.out_of_stock_minutes} mins</td>
                        <td>
                          <span className={`status-pill ${r.instock_rate_pct >= 98 ? 'status-healthy' : r.instock_rate_pct >= 95 ? 'status-warning' : 'status-critical'}`}>
                            <i />{r.instock_rate_pct >= 98 ? 'Compliant' : r.instock_rate_pct >= 95 ? 'Warning' : 'Violation'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page === 'ecomm-returns' && (
            <div className="panel">
              <div className="panel-header-actions">
                <h3>eComm Returns Log</h3>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>Return ID</th><th>Customer</th><th>Item Name</th><th>Return Reason</th><th>Refund Status</th></tr>
                  </thead>
                  <tbody>
                    {ecommReturnsRows.map((r, i) => (
                      <tr key={i}>
                        <td><span className="mono-label">{r.return_id}</span></td>
                        <td>{r.customer_name}</td>
                        <td>{r.item_name}</td>
                        <td><span className="text-amber-500">{r.return_reason}</span></td>
                        <td>
                          <span className={`status-pill ${r.refund_status === 'Refund Issued' ? 'status-healthy' : 'status-warning'}`}>
                            {r.refund_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2. Supply Chain Pages */}
          {page === 'dc-metrics' && (
            <div className="panel">
              <div className="panel-header-actions">
                <h3>DC Operational Metrics</h3>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>DC Name</th><th>Date</th><th>Inbound Pallets</th><th>Outbound Pallets</th><th>Avg processing Time</th><th>Service Level</th></tr>
                  </thead>
                  <tbody>
                    {dcMetricsRows.map((r, i) => (
                      <tr key={i}>
                        <td><strong>{r.dc_name}</strong></td>
                        <td><span className="mono-label">{r.date}</span></td>
                        <td>{r.inbound_pallets}</td>
                        <td>{r.outbound_pallets}</td>
                        <td>{r.processing_time_hours} hrs</td>
                        <td className="font-mono text-green-500">{r.service_level_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page === 'order-forecast' && (
            <div className="panel">
              <div className="panel-header-actions">
                <h3>Order Pipeline Forecast</h3>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>Item Name</th><th>Target Week Start</th><th>Forecasted Orders (Units)</th></tr>
                  </thead>
                  <tbody>
                    {orderForecastRows.map((r, i) => (
                      <tr key={i}>
                        <td><strong>{r.item_name}</strong></td>
                        <td><span className="mono-label">{r.date}</span></td>
                        <td className="font-mono text-blue-500 font-bold">{r.forecasted_orders.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page === 'demand-forecast' && (
            <div className="panel">
              <div className="panel-header-actions">
                <h3>Consumer Demand Forecast</h3>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>Item Name</th><th>Target Week Start</th><th>Forecasted Consumer Demand</th></tr>
                  </thead>
                  <tbody>
                    {demandForecastRows.map((r, i) => (
                      <tr key={i}>
                        <td><strong>{r.item_name}</strong></td>
                        <td><span className="mono-label">{r.date}</span></td>
                        <td className="font-mono text-amber-500 font-bold">{r.forecasted_demand_qty.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. Performance Pages */}
          {page === 'vendor-scorecard' && (
            <div className="panel">
              <div className="panel-header-actions">
                <h3>Supplier Scorecards</h3>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>Supplier Name</th><th>On-Time Delivery</th><th>Quality Acceptance</th><th>Lead Time Variance</th><th>Cost Variance</th></tr>
                  </thead>
                  <tbody>
                    {vendorScorecardRows.map((r, i) => (
                      <tr key={i}>
                        <td><strong>{r.supplier_name}</strong></td>
                        <td className="font-mono text-green-500">{r.on_time_delivery_pct}%</td>
                        <td className="font-mono text-blue-500">{r.quality_acceptance_pct}%</td>
                        <td className="font-mono">{r.lead_time_variance_days > 0 ? `+${r.lead_time_variance_days}` : r.lead_time_variance_days} days</td>
                        <td className={`font-mono ${r.cost_variance_pct > 0 ? 'text-red-500' : 'text-green-500'}`}>{r.cost_variance_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page === 'tender-analysis' && (
            <div className="panel">
              <div className="panel-header-actions">
                <h3>Tender Bid Logistics</h3>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>Carrier Name</th><th>Route Corridor</th><th>Lane Rate</th><th>Transit Time</th><th>Bid Status</th></tr>
                  </thead>
                  <tbody>
                    {tenderAnalysisRows.map((r, i) => (
                      <tr key={i}>
                        <td><strong>{r.carrier_name}</strong></td>
                        <td>{r.route_name}</td>
                        <td className="font-mono">₹{r.lane_rate_inr.toLocaleString('en-IN')}</td>
                        <td>{r.transit_time_days} days</td>
                        <td>
                          <span className={`status-pill ${r.bid_status === 'Accepted' ? 'status-healthy' : r.bid_status === 'Bid Under Review' ? 'status-warning' : 'status-critical'}`}>
                            {r.bid_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page === 'store-mumd' && (
            <div className="panel">
              <div className="panel-header-actions">
                <h3>Markdown / Markup Pricing Ledger</h3>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>Store Name</th><th>Item Name</th><th>Original Price</th><th>Markdown Rate</th><th>Promo Units Sold</th><th>Promo Revenue</th></tr>
                  </thead>
                  <tbody>
                    {storeMumdRows.map((r, i) => (
                      <tr key={i}>
                        <td><strong>{r.store_name}</strong></td>
                        <td>{r.item_name}</td>
                        <td className="font-mono">₹{r.original_price_inr.toLocaleString('en-IN')}</td>
                        <td className="font-mono text-red-500">{Math.round(r.markdown_pct * 100)}% markdown</td>
                        <td>{r.promotional_units_sold}</td>
                        <td className="font-mono text-green-500">₹{roundMoney(r.original_price_inr * (1 - r.markdown_pct) * r.promotional_units_sold).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. Planning Pages */}
          {page === 'modular-plan' && (
            <div className="panel">
              <div className="panel-header-actions">
                <h3>Planogram Configurations</h3>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>Category Shelf</th><th>Planogram ID</th><th>Category Shelf Share</th><th>Linear Feet Capacity</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {modularPlanRows.map((r, i) => (
                      <tr key={i}>
                        <td><strong>{r.category_name}</strong></td>
                        <td><span className="mono-label">{r.planogram_id}</span></td>
                        <td className="font-mono">{r.shelf_share_pct}%</td>
                        <td>{r.linear_feet} ft</td>
                        <td>
                          <span className={`status-pill ${r.status === 'Active' ? 'status-healthy' : 'status-warning'}`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page === 'future-valid-stores' && (
            <div className="panel">
              <div className="panel-header-actions">
                <h3>Upcoming Retail Stores Pipeline</h3>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>Store Code</th><th>City Region</th><th>Target Opening Date</th><th>Format Size</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {futureValidStoresRows.map((r, i) => (
                      <tr key={i}>
                        <td><span className="mono-label">{r.store_code}</span></td>
                        <td><strong>{r.city}</strong></td>
                        <td><span className="mono-label">{r.projected_opening_date}</span></td>
                        <td>{r.store_size_sqft.toLocaleString()} sqft</td>
                        <td>
                          <span className={`status-pill ${r.status.includes('Upcoming') ? 'status-warning' : 'status-critical'}`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page === 'item-master' && (
            <div className="panel">
              <div className="panel-header-actions">
                <h3>Item Master catalog</h3>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>SKU ID</th><th>Item Name</th><th>Category</th><th>Domestic Cost (INR)</th><th>Inner Pack Size</th><th>Dimensions</th><th>Weight</th></tr>
                  </thead>
                  <tbody>
                    {itemMasterRows.map((r, i) => (
                      <tr key={i}>
                        <td><span className="mono-label">{r.item_id}</span></td>
                        <td><strong>{r.name}</strong></td>
                        <td>{r.category}</td>
                        <td className="font-mono">₹{r.unit_cost_inr.toLocaleString('en-IN')}</td>
                        <td>{r.pack_size} units/case</td>
                        <td>{r.dimensions}</td>
                        <td>{r.weight_kg} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. Operations / Dynamic Pages */}
          {page === 'sso-builder' && (
            <div className="sso-builder-container">
              <div className="sso-form-card panel">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">Breakpack Auto-ordering</span>
                    <h2>SSO Order parameters</h2>
                  </div>
                </div>
                <form onSubmit={handleSsoCalculate} className="sso-form">
                  <div className="form-group">
                    <label>Target Retail Store</label>
                    <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>
                      {STORES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Item Name SKU</label>
                    <select value={selectedItem} onChange={e => setSelectedItem(e.target.value)}>
                      <option value="Lithium-Ion Battery Pack">Lithium-Ion Battery Pack</option>
                      <option value="Microcontroller Unit">Microcontroller Unit</option>
                      <option value="Chassis Assembly">Chassis Assembly</option>
                      <option value="Brushless DC Motor">Brushless DC Motor</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Target Inventory Cover (Days)</label>
                    <input type="number" min={5} max={60} value={targetCover} onChange={e => setTargetCover(Number(e.target.value))} />
                  </div>
                  <div className="form-group">
                    <label>Minimum Order Threshold</label>
                    <input type="number" min={10} max={1000} value={minOrder} onChange={e => setMinOrder(Number(e.target.value))} />
                  </div>
                  <button type="submit" className="primary-button w-full" disabled={ssoCalculating}>
                    {ssoCalculating ? 'Calculating Breakpack...' : 'Calculate SSO Order'}
                  </button>
                </form>
              </div>

              <div className="sso-output-card panel">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">Calculated recommendation</span>
                    <h2>Recommended Store-Specific Order</h2>
                  </div>
                </div>
                {ssoCalcResult ? (
                  <div className="sso-results">
                    <div className="sso-msg-card">
                      <Sparkles size={16} />
                      <p>{ssoCalcResult.msg}</p>
                    </div>
                    <dl className="sso-metrics-grid">
                      <div><dt>Average Daily Sales</dt><dd>{ssoCalcResult.avg_daily_sales} units/day</dd></div>
                      <div><dt>Pack size / Case count</dt><dd>{ssoCalcResult.pack_size} units ({ssoCalcResult.cases_to_order} cases)</dd></div>
                      <div><dt>Recommended Order</dt><dd className="text-green-500 font-bold">{ssoCalcResult.recommended_order_qty} units</dd></div>
                      <div><dt>Total Weight</dt><dd>{ssoCalcResult.total_weight_kg} kg</dd></div>
                      <div><dt>Estimated Cost (INR)</dt><dd className="text-blue-500 font-mono">₹{ssoCalcResult.estimated_cost_inr.toLocaleString('en-IN')}</dd></div>
                    </dl>
                    <div className="sso-actions">
                      <button onClick={handleSsoConfirm} className="primary-button" disabled={ssoConfirmed}>
                        {ssoConfirmed ? 'Purchase Order Created!' : 'Confirm & Send PO'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="sso-placeholder">
                    <HelpCircle size={38} />
                    <p>Select parameters and click "Calculate SSO Order" to evaluate optimal store order volume.</p>
                  </div>
                )}
                {ssoConfirmed && (
                  <div className="success-note mt-4">
                    <CheckCircle size={16} />
                    <span><strong>Order generated successfully!</strong> Purchase order has been routed to regional distribution hub.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {page === 'exceptions' && exceptionsData && (
            <div className="exceptions-container">
              <div className="panel">
                <h3>Instock Compliance Violations</h3>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr><th>Item Name</th><th>Date</th><th>Instock Rate</th><th>Out of Stock (Min)</th></tr>
                    </thead>
                    <tbody>
                      {exceptionsData.instock_exceptions.map((r: any, i: number) => (
                        <tr key={i}>
                          <td><strong>{r.item_name}</strong></td>
                          <td><span className="mono-label">{r.date}</span></td>
                          <td className="text-red-500 font-bold">{r.instock_rate_pct}%</td>
                          <td>{r.out_of_stock_minutes} mins</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel mt-6">
                <h3>Under Safety Stock Reorder Point Alerts</h3>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr><th>Item Name</th><th>Warehouse</th><th>Current Stock</th><th>Reorder point</th></tr>
                    </thead>
                    <tbody>
                      {exceptionsData.inventory_exceptions.map((r: any, i: number) => (
                        <tr key={i}>
                          <td><strong>{r.item_name}</strong></td>
                          <td>{r.warehouse_name}</td>
                          <td className="text-amber-500 font-bold">{r.current_stock}</td>
                          <td>{r.reorder_point}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel mt-6">
                <h3>Critical Ordering Gaps (No Purchase Order in Transit)</h3>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr><th>Item Name</th><th>Warehouse</th><th>Current Stock</th><th>Reorder point</th></tr>
                    </thead>
                    <tbody>
                      {exceptionsData.ordering_gap_exceptions.map((r: any, i: number) => (
                        <tr key={i}>
                          <td><strong>{r.item_name}</strong></td>
                          <td>{r.warehouse_name}</td>
                          <td className="text-red-500 font-bold">{r.current_stock}</td>
                          <td>{r.reorder_point}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {page === 'demand-intelligence' && demandIntelData && (
            <div className="demand-intelligence-container">
              <div className="panel">
                <h3>Demand-vs-Order Alignment</h3>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr><th>Item Name</th><th>Forecasted Demand (Units)</th><th>Forecasted Orders (Units)</th><th>Alignment Gap</th></tr>
                    </thead>
                    <tbody>
                      {demandIntelData.demand_order_alignment.map((r: any, i: number) => (
                        <tr key={i}>
                          <td><strong>{r.item_name}</strong></td>
                          <td className="text-amber-500 font-mono font-bold">{r.total_demand}</td>
                          <td className="text-blue-500 font-mono font-bold">{r.total_orders}</td>
                          <td className={`font-mono font-bold ${r.total_demand > r.total_orders ? 'text-red-500' : 'text-green-500'}`}>
                            {r.total_demand - r.total_orders > 0 ? `Under-ordered by ${r.total_demand - r.total_orders}` : `Aligned`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel mt-6">
                <h3>Sell-Through Analysis</h3>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr><th>Item Name</th><th>Total Units Sold</th><th>FC Stock On Hand</th><th>Sell-Through Rate</th></tr>
                    </thead>
                    <tbody>
                      {demandIntelData.sell_through_analysis.map((r: any, i: number) => (
                        <tr key={i}>
                          <td><strong>{r.item_name}</strong></td>
                          <td>{r.total_sold}</td>
                          <td>{r.stock_on_hand}</td>
                          <td className="font-mono text-green-500 font-bold">{r.sell_through_pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {page === 'automated-insights' && (
            <div className="panel">
              <div className="panel-header-actions">
                <h3>Automated Narrative Analysis Feed</h3>
              </div>
              <div className="insights-feed-list max-w-4xl">
                {automatedInsightsList.map(ins => (
                  <div key={ins.id} className={`insight-feed-card border-l-2 ${ins.severity === 'critical' ? 'border-red-500' : ins.severity === 'warning' ? 'border-amber-500' : 'border-green-500'}`}>
                    <div className="insight-card-top">
                      <strong>{ins.title}</strong>
                      <span className={`severity-tag ${ins.severity}`}>{ins.severity}</span>
                    </div>
                    <p className="mt-2">{ins.description}</p>
                    <div className="insight-card-rec mt-2">
                      <Info size={12} />
                      <span>Recommendation: {ins.recommendation}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      <MobileNav
        open={menuOpen}
        page={page}
        onClose={() => setMenuOpen(false)}
        onCopilot={() => setCopilotOpen(true)}
      />

      <CopilotDrawer open={copilotOpen} onClose={() => setCopilotOpen(false)} />
    </div>
  )
}

function roundMoney(num: number) {
  return Math.round(num * 100) / 100
}
