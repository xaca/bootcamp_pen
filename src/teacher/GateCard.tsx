import type { ReactNode } from 'react'
import { LangToggle } from '../components/LangToggle'

export function GateCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="centered">
      <div className="card join">
        <div className="join__top">
          <span className="brand">🪐 Orbit</span>
          <LangToggle />
        </div>
        <h1>{title}</h1>
        {children}
      </div>
    </main>
  )
}
