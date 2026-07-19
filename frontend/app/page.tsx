import { AuthGuard } from '@/components/supplysense/auth-guard'
import { Dashboard } from '@/components/supplysense/dashboard'

export default function Page() {
  return (
    <AuthGuard>
      <Dashboard />
    </AuthGuard>
  )
}
