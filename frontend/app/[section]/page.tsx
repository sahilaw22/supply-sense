import { notFound } from 'next/navigation'
import { AuthGuard } from '@/components/supplysense/auth-guard'
import { Dashboard, type PageKey } from '@/components/supplysense/dashboard'

const sections: PageKey[] = ['network', 'inventory', 'shipments', 'warehouses', 'suppliers']

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
