'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'

type AuthUser = { name: string; email: string; role: string }

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<boolean>
  demoLogin: () => Promise<boolean>
  logout: () => void
  isDemo: boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => false,
  demoLogin: async () => false,
  logout: () => {},
  isDemo: false,
})

export const DEMO_EMAIL = 'demo@supplysense.ai'
export const DEMO_PASSWORD = 'Hackathon2026!'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('supplysense_auth')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setUser(parsed.user)
        setIsDemo(parsed.isDemo || false)
      } catch {
        localStorage.removeItem('supplysense_auth')
      }
    }
    setLoading(false)
  }, [])

  const persist = useCallback((u: AuthUser, demo: boolean) => {
    localStorage.setItem('supplysense_auth', JSON.stringify({ user: u, isDemo: demo }))
    setUser(u)
    setIsDemo(demo)
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
      persist({ name: 'Supply Chain Director', email: DEMO_EMAIL, role: 'Director' }, false)
      return true
    }
    return false
  }, [persist])

  const demoLogin = useCallback(async (): Promise<boolean> => {
    persist({ name: 'Supply Chain Director (Demo)', email: DEMO_EMAIL, role: 'Director' }, true)
    return true
  }, [persist])

  const logout = useCallback(() => {
    localStorage.removeItem('supplysense_auth')
    setUser(null)
    setIsDemo(false)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, demoLogin, logout, isDemo }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
