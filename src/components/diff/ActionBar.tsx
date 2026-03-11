import { useEditMode, ActionType } from '../../context/EditModeContext'
import { Button } from '../ui/Button'

interface ActionBarProps {
  onAction: () => void
  onViewChanges: () => void
  changesCount: number
}

export function ActionBar({ onAction, onViewChanges, changesCount }: ActionBarProps) {
  const { actionType, selectedLeft, selectedRight } = useEditMode()

  const actionLabels: Record<NonNullable<ActionType>, string> = {
    add: `Add ${selectedRight.size} card${selectedRight.size !== 1 ? 's' : ''}`,
    remove: `Remove ${selectedLeft.size} card${selectedLeft.size !== 1 ? 's' : ''}`,
    swap: `Swap ${selectedLeft.size} ↔ ${selectedRight.size}`,
  }

  return (
    <div className="flex items-center gap-3 bg-slate-800/80 border-b border-slate-700 px-4 py-2.5">
      <Button
        onClick={onAction}
        disabled={!actionType}
        variant={actionType === 'remove' ? 'danger' : 'primary'}
        size="sm"
      >
        {actionType ? actionLabels[actionType] : 'Select cards to create a change'}
      </Button>

      <button
        onClick={onViewChanges}
        className="ml-auto flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        Changes ({changesCount})
      </button>
    </div>
  )
}
