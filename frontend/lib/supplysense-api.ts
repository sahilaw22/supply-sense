const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '')

export type ApiHealth = 'connecting' | 'online' | 'offline'

export type DashboardSnapshot = {
  inventory: Array<{
    item_id: string
    item_name: string
    warehouse_id: string
    warehouse_name: string
    warehouse_location: string
    current_stock: number
    reorder_point: number
    forecasted_demand: number
    risk_score: number
    risk_category: string
  }>
  warehouses: Array<{
    warehouse_id: string
    name: string
    location: string
    capacity: number
    current_utilization: number
  }>
  suppliers: Array<{
    supplier_id: string
    name: string
    location: string
    historical_fulfillment_rate: number
    delivery_performance_score: number
    lead_time_days: number
  }>
  purchase_orders: Array<{
    po_id: string
    supplier_id: string
    supplier_name: string
    item_id: string
    item_name: string
    quantity: number
    expected_delivery_date: string
    status: string
    transit_route: string
  }>
  active_disruption?: {
    type?: string
    route?: string
    affected_pos?: string[]
    affected_items?: Array<{ item_id: string; item_name: string }>
    duration_estimate_hours?: number
    alert_text?: string
    triggered_at?: string
  } | null
}

export type ContractResponse = {
  intent: string
  frontend_action: string
  payload: Record<string, unknown>
  summary: string
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Request failed with ${response.status}`)
  }

  return response.json() as Promise<T>
}

export function getDashboardSnapshot() {
  return requestJson<DashboardSnapshot>('/api/dashboard')
}

export function runDisruptionSimulation() {
  return requestJson<ContractResponse>('/api/simulate/disruption', { method: 'POST' })
}

export function askCopilot(question: string) {
  return requestJson<ContractResponse>('/api/query', {
    method: 'POST',
    body: JSON.stringify({ question }),
  })
}

export function generateExecutiveSummary() {
  return requestJson<ContractResponse>('/api/summary/generate', { method: 'POST' })
}

export function resetDisruption() {
  return requestJson<ContractResponse>('/api/simulate/disruption/reset', { method: 'DELETE' })
}

export function getAlternateSuppliers(itemId: string, quantity: number = 100) {
  return requestJson<ContractResponse>('/api/suppliers/alternate', {
    method: 'POST',
    body: JSON.stringify({ item_id: itemId, quantity }),
  })
}

