'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/lib/auth-context'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const { user, loading, login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('demo@supplysense.ai')
  const [password, setPassword] = useState('Hackathon2026!')
  const [error, setError] = useState('')
  const [logging, setLogging] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (!loading && user) router.push('/')
  }, [user, loading, router])

  if (loading) return null
  if (user) return null

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLogging(true)
    try {
      const ok = await login(email, password)
      if (ok) router.push('/')
      else setError('Invalid credentials')
    } catch {
      setError('Authentication failed')
    } finally {
      setLogging(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo">
          <Image src="/logo.png" alt="SupplySense" width={56} height={56} priority />
        </div>
        <h1 className="auth-title">SupplySense</h1>
        <p className="auth-subtitle">AI Supply Chain Intelligence</p>

        <form onSubmit={handleLogin} className="auth-form">
          <div className="auth-field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="demo@supplysense.ai"
              autoComplete="email"
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="auth-password">Password</label>
            <div className="auth-password-wrap">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-submit" disabled={logging}>
            {logging ? 'Signing in…' : 'Sign in'}
            {!logging && <ArrowRight size={16} />}
          </button>
        </form>
      </div>
    </div>
  )
}
