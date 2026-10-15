import type { ReactNode } from 'react'

export function CenteredMessage({ children }: { children: ReactNode }) {
  return <main className="centered">{children}</main>
}
