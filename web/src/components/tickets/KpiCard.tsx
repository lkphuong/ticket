import type { DashboardKpi, KpiTone } from '../../lib/dashboardSummary.ts'

const VALUE_TONE_CLASSES: Record<KpiTone, string> = {
  neutral: 'text-ink',
  accent: 'text-accent-700',
  danger: 'text-brick-700',
  success: 'text-moss-700',
}

// Left edge marks the tone so a glance across the row shows what needs attention
const EDGE_TONE_CLASSES: Record<KpiTone, string> = {
  neutral: 'border-l-line-strong',
  accent: 'border-l-accent-600',
  danger: 'border-l-brick-500',
  success: 'border-l-moss-700',
}

export function KpiCard({ kpi }: { kpi: DashboardKpi }) {
  return (
    <div className={`rounded-lg border border-l-4 border-line bg-surface px-4 py-3 shadow-lift ${EDGE_TONE_CLASSES[kpi.tone]}`}>
      <dt className="text-xs font-semibold text-ink-muted">{kpi.label}</dt>
      <dd className={`mt-1 text-3xl font-bold tracking-tight ${VALUE_TONE_CLASSES[kpi.tone]}`}>{kpi.value}</dd>
      <p className="mt-1 text-xs text-ink-muted">{kpi.hint}</p>
    </div>
  )
}
