interface EmptyStateProps {
  title: string
  description: string
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-muted">{description}</p>
    </div>
  )
}
