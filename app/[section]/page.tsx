import { notFound } from 'next/navigation'
import { AuthGuard } from '@/components/supplysense/auth-guard'
import { Dashboard, type PageKey } from '@/components/supplysense/dashboard'

const sections: PageKey[] = [
  'network', 'inventory', 'shipments', 'warehouses', 'suppliers',
  'store-sales', 'ecomm-sales', 'ecomm-inventory', 'ecomm-instock', 'ecomm-returns',
  'dc-metrics', 'order-forecast', 'demand-forecast',
  'vendor-scorecard', 'tender-analysis', 'store-mumd',
  'modular-plan', 'future-valid-stores', 'item-master',
  'sso-builder', 'exceptions', 'demand-intelligence', 'automated-insights'
]

export function generateStaticParams() {
  return sections.map((section) => ({ section }))
}

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  if (!sections.includes(section as PageKey)) notFound()
  return (
    <AuthGuard>
      <Dashboard page={section as PageKey} />
    </AuthGuard>
  )
}
