import { ChangeType } from '../../types/firestore'
import { Badge } from '../ui/Badge'

export function ChangeTypeBadge({ type }: { type: ChangeType }) {
  const configs: Record<ChangeType, { variant: 'green' | 'red' | 'yellow' | 'teal' | 'orange' | 'purple'; label: string }> = {
    add: { variant: 'green', label: 'Add' },
    remove: { variant: 'red', label: 'Remove' },
    swap: { variant: 'yellow', label: 'Swap' },
    keep: { variant: 'teal', label: 'Keep' },
    reject: { variant: 'orange', label: 'Reject' },
    decline: { variant: 'purple', label: 'Decline' },
  }
  const { variant, label } = configs[type]
  return <Badge variant={variant}>{label}</Badge>
}
