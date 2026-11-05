import type { ReactNode } from 'react'

interface PanelProps {
  title: string
  aside?: ReactNode
  children: ReactNode
}

export function Panel({ title, aside, children }: PanelProps) {
  return (
    <section className="rounded-lg border border-line bg-surface shadow-lift">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  )
}
