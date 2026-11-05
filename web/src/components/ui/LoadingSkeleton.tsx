const SKELETON_ROW_COUNT = 6

interface LoadingSkeletonProps {
  label: string
}

// Placeholder rows shown while ticket data is being fetched
export function LoadingSkeleton({ label }: LoadingSkeletonProps) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
        <div key={index} className="h-14 animate-pulse rounded-lg border border-line bg-surface" />
      ))}
    </div>
  )
}
