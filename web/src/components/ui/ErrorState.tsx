import { Button } from './Button.tsx'

interface ErrorStateProps {
  title: string
  description: string
  onRetry: () => void
  isRetrying?: boolean
}

export function ErrorState({ title, description, onRetry, isRetrying = false }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-brick-500/30 bg-surface px-6 py-12 text-center">
      <p className="font-semibold text-ink">{title}</p>
      <p className="text-sm text-ink-muted">{description}</p>
      <Button variant="secondary" onClick={onRetry} disabled={isRetrying}>
        {isRetrying ? 'Đang thử lại...' : 'Thử lại'}
      </Button>
    </div>
  )
}
