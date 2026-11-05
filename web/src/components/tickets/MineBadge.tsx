import { Badge } from '../ui/Badge.tsx'

const MINE_TONE_CLASS = 'bg-mine-600 text-white'

export function MineBadge({ label = 'Chờ bạn' }: { label?: string }) {
  return <Badge label={label} toneClass={MINE_TONE_CLASS} />
}
