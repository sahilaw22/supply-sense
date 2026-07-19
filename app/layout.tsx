import type { Metadata, Viewport } from 'next'
import './globals.css'
import 'leaflet/dist/leaflet.css'
import { AuthProvider } from '@/lib/auth-context'

export const metadata: Metadata = {
  title: 'AI Supply Chain Intelligence',
  description:
    'Real-time inventory, supplier, and logistics risk intelligence powered by AI — built for India\'s supply chain ecosystem.',
  generator: 'SupplySense',
  keywords: ['supply chain', 'inventory intelligence', 'risk management', 'India logistics', 'AI'],
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0A0A0B',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-background dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
