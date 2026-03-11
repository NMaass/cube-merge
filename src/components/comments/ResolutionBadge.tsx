import { CommentResolution } from '../../types/firestore'
import { Badge } from '../ui/Badge'

export function ResolutionBadge({ resolution }: { resolution: CommentResolution }) {
  if (resolution === 'none') return null
  const configs = {
    blocking: { variant: 'red' as const, label: '⚠ Blocking' },
    resolved: { variant: 'green' as const, label: '✓ Resolved' },
  }
  const { variant, label } = configs[resolution]
  return <Badge variant={variant}>{label}</Badge>
}
