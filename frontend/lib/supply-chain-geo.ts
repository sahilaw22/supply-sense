export interface GeoNode {
  id: string
  name: string
  type: 'warehouse' | 'supplier' | 'port'
  lat: number
  lng: number
  status: 'healthy' | 'warning' | 'critical'
  description: string
}

export interface GeoRoute {
  id: string
  from: string
  to: string
  label: string
  status: 'healthy' | 'warning' | 'critical'
  issue?: string
  impact?: string
  etaDays?: number
}

export type NodeMap = Record<string, GeoNode>

export const nodes: GeoNode[] = [
  // Warehouses
  {
    id: 'WH-001',
    name: 'Mumbai Distribution Hub',
    type: 'warehouse',
    lat: 19.076,
    lng: 72.8777,
    status: 'warning',
    description: 'Bhiwandi, Maharashtra · 87% utilized',
  },
  {
    id: 'WH-002',
    name: 'South India Fulfillment Center',
    type: 'warehouse',
    lat: 13.0827,
    lng: 80.2707,
    status: 'healthy',
    description: 'Chennai, Tamil Nadu · 72% utilized',
  },
  {
    id: 'WH-003',
    name: 'North India Logistics Hub',
    type: 'warehouse',
    lat: 28.35,
    lng: 76.95,
    status: 'critical',
    description: 'Manesar, Haryana · 91% utilized',
  },
  {
    id: 'WH-004',
    name: 'East India Regional Warehouse',
    type: 'warehouse',
    lat: 22.5726,
    lng: 88.3639,
    status: 'healthy',
    description: 'Kolkata, West Bengal · 58% utilized',
  },
  {
    id: 'WH-005',
    name: 'Bengaluru Tech Corridor Depot',
    type: 'warehouse',
    lat: 12.9716,
    lng: 77.5946,
    status: 'healthy',
    description: 'Bengaluru, Karnataka · 65% utilized',
  },
  // Suppliers
  {
    id: 'SUP-001',
    name: 'Konkan Components Pvt Ltd',
    type: 'supplier',
    lat: 19.076,
    lng: 72.8777,
    status: 'critical',
    description: 'Mumbai · Score 62 · JNPT port exposure',
  },
  {
    id: 'SUP-002',
    name: 'Tapi Component Works',
    type: 'supplier',
    lat: 21.1702,
    lng: 72.8311,
    status: 'warning',
    description: 'Surat, Gujarat · Score 74 · Lead-time variance',
  },
  {
    id: 'SUP-003',
    name: 'Deccan Manufacturing Co',
    type: 'supplier',
    lat: 18.5204,
    lng: 73.8567,
    status: 'healthy',
    description: 'Pune, Maharashtra · Score 88 · On target',
  },
  {
    id: 'SUP-004',
    name: 'Bengaluru Circuit Systems',
    type: 'supplier',
    lat: 12.9716,
    lng: 77.5946,
    status: 'healthy',
    description: 'Bengaluru · Score 94 · On target',
  },
  {
    id: 'SUP-005',
    name: 'Sabarmati Industrial Supply',
    type: 'supplier',
    lat: 23.0225,
    lng: 72.5714,
    status: 'warning',
    description: 'Ahmedabad · Score 78 · Mundra route',
  },
  // Ports
  {
    id: 'PORT-JNPT',
    name: 'JNPT (Jawaharlal Nehru Port)',
    type: 'port',
    lat: 18.9518,
    lng: 72.9464,
    status: 'critical',
    description: 'Navi Mumbai · 55% of India container cargo',
  },
  {
    id: 'PORT-MUNDRA',
    name: 'Mundra Port',
    type: 'port',
    lat: 22.7641,
    lng: 69.7147,
    status: 'healthy',
    description: 'Gujarat · Major west coast port',
  },
  {
    id: 'PORT-CHENNAI',
    name: 'Chennai Port',
    type: 'port',
    lat: 13.0827,
    lng: 80.2707,
    status: 'healthy',
    description: 'Tamil Nadu · South India gateway',
  },
]

export const routes: GeoRoute[] = [
  // Supplier → Warehouse routes
  {
    id: 'R-001',
    from: 'SUP-001',
    to: 'WH-001',
    label: 'Konkan → Mumbai Hub',
    status: 'critical',
    issue: 'JNPT port operations suspended — monsoon flood',
    impact: '3–5 day shipping delay · PO-889 impacted',
    etaDays: 5,
  },
  {
    id: 'R-002',
    from: 'SUP-003',
    to: 'WH-001',
    label: 'Deccan → Mumbai Hub',
    status: 'healthy',
    issue: undefined,
    impact: undefined,
    etaDays: 2,
  },
  {
    id: 'R-003',
    from: 'SUP-004',
    to: 'WH-002',
    label: 'Bengaluru Circuits → Chennai Hub',
    status: 'healthy',
    issue: undefined,
    impact: undefined,
    etaDays: 1,
  },
  {
    id: 'R-004',
    from: 'SUP-002',
    to: 'WH-003',
    label: 'Tapi → North Hub',
    status: 'warning',
    issue: 'Elevated lead-time variance on Mundra route',
    impact: '1–2 day potential delay',
    etaDays: 4,
  },
  {
    id: 'R-005',
    from: 'SUP-005',
    to: 'WH-003',
    label: 'Sabarmati → North Hub',
    status: 'warning',
    issue: 'Pending PO on highway corridor',
    impact: 'Delivery confirmation pending',
    etaDays: 3,
  },
  {
    id: 'R-006',
    from: 'SUP-001',
    to: 'WH-005',
    label: 'Konkan → Bengaluru Depot',
    status: 'critical',
    issue: 'JNPT disruption cascading to south routes',
    impact: '3–4 day delay on intermodal transfer',
    etaDays: 6,
  },
  // Port → Warehouse connections
  {
    id: 'R-007',
    from: 'PORT-JNPT',
    to: 'WH-001',
    label: 'JNPT → Mumbai Hub',
    status: 'critical',
    issue: 'Port closure due to monsoon flooding',
    impact: '48-hour ops pause · ₹1.2 Cr exposure',
    etaDays: 5,
  },
  {
    id: 'R-008',
    from: 'PORT-MUNDRA',
    to: 'WH-003',
    label: 'Mundra → North Hub',
    status: 'healthy',
    issue: undefined,
    impact: undefined,
    etaDays: 3,
  },
  {
    id: 'R-009',
    from: 'PORT-CHENNAI',
    to: 'WH-002',
    label: 'Chennai Port → South Hub',
    status: 'healthy',
    issue: undefined,
    impact: undefined,
    etaDays: 1,
  },
  // Inter-warehouse transfers
  {
    id: 'R-010',
    from: 'WH-001',
    to: 'WH-005',
    label: 'Mumbai → Bengaluru transfer',
    status: 'healthy',
    issue: undefined,
    impact: undefined,
    etaDays: 3,
  },
]

export const nodeMap: NodeMap = Object.fromEntries(nodes.map(n => [n.id, n]))
