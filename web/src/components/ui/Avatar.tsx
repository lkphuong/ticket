import type { Department } from '../../domain/ticket.ts'
import { useAttachmentObjectUrl } from '../tickets/useAttachmentObjectUrl.ts'
import { badgeStyleFor } from './departmentBadges.ts'
import { Icon } from './Icon.tsx'

interface AvatarProps {
  department: Department
  sizeClass?: string
  // Uploaded profile picture; the department glyph shows while it loads or when none is set
  attachmentId?: string
}

function DepartmentGlyph() {
  return <Icon name="user" className="size-[60%]" />
}

// Keyed by attachment id by the caller so a changed picture never shows the previous object URL
function AvatarPicture({ attachmentId }: { attachmentId: string }) {
  const { url } = useAttachmentObjectUrl(attachmentId)
  return url ? <img src={url} alt="" className="size-full rounded-full object-cover" /> : <DepartmentGlyph />
}

// Person glyph tinted with the department colour, or the member's picture; the name is always written beside it
export function Avatar({ department, sizeClass = 'size-7', attachmentId }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${sizeClass}`}
      style={badgeStyleFor(department)}
    >
      {attachmentId ? <AvatarPicture key={attachmentId} attachmentId={attachmentId} /> : <DepartmentGlyph />}
    </span>
  )
}
