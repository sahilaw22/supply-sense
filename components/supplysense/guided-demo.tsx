'use client'

import { X, ArrowRight } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useState } from 'react'

interface GuidedDemoProps {
  open: boolean
  onDismiss: () => void
  onSimulateDemandSpike: () => void
  onCheckSupplierRisk: () => void
  onGenerateSummary: () => void
}

export function GuidedDemo({ open, onDismiss, onSimulateDemandSpike, onCheckSupplierRisk, onGenerateSummary }: GuidedDemoProps) {
  const [step, setStep] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (open) { setStep(0); setDismissed(false) }
  }, [open])

  useEffect(() => {
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') handleDismiss() }
    if (open) window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])

  if (!open || dismissed) return null

  const handleDismiss = () => { setDismissed(true); onDismiss() }

  return (
    <div className="gd-shell" role="dialog" aria-modal="true" aria-label="SupplySense guided tour">
      <button className="gd-backdrop" onClick={handleDismiss} aria-label="Dismiss" />
      <div className="gd-card">
        <div className="gd-header">
          <div className="gd-brand">
            <Image src="/logo.png" alt="SupplySense" width={36} height={36} />
            <div>
              <strong>SupplySense</strong>
              <small>AI Supply Chain Intelligence</small>
            </div>
          </div>
          <button className="gd-close" onClick={handleDismiss} aria-label="Dismiss"><X size={18} /></button>
        </div>
        <div className="gd-body">
          {step === 0 && (
            <>
              <h2>Welcome to SupplySense</h2>
              <p>You're viewing the Global Operations view — designed for C-level executives who need to move from identifying a risk to executing a solution in under 30 seconds.</p>
              <button className="gd-primary" onClick={() => setStep(1)}>
                Start Guided Tour <ArrowRight size={15} />
              </button>
            </>
          )}
          {step === 1 && (
            <>
              <h2>Explore Key Actions</h2>
              <p>Try one of these scenarios to see SupplySense in action:</p>
              <div className="gd-actions">
                <button className="gd-action" onClick={() => { onSimulateDemandSpike(); handleDismiss() }}>
                  <div className="gd-action-text">
                    <strong>Simulate Demand Spike</strong>
                    <small>Trigger a real-time inventory scenario to test network resilience</small>
                  </div>
                  <ArrowRight size={14} />
                </button>
                <button className="gd-action" onClick={() => { onCheckSupplierRisk(); handleDismiss() }}>
                  <div className="gd-action-text">
                    <strong>Check Supplier Risk</strong>
                    <small>Run AI-powered risk analysis across your supplier network</small>
                  </div>
                  <ArrowRight size={14} />
                </button>
                <button className="gd-action" onClick={() => { onGenerateSummary(); handleDismiss() }}>
                  <div className="gd-action-text">
                    <strong>Generate Executive Summary</strong>
                    <small>Showcase AI-generated insights with actionable recommendations</small>
                  </div>
                  <ArrowRight size={14} />
                </button>
              </div>
            </>
          )}
        </div>
        <div className="gd-footer">
          <div className="gd-dots">
            {[0, 1].map(i => <span key={i} className={i === step ? 'gd-dot active' : 'gd-dot'} />)}
          </div>
          <button className="gd-skip" onClick={handleDismiss}>Skip tour</button>
        </div>
      </div>
    </div>
  )
}
