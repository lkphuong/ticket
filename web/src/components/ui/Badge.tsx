interface BadgeProps {
  label: string
  toneClass: string
}

export function Badge({ label, toneClass }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-md tracking-wide px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${toneClass}`}>
      {label}
    </span>
  )
}
