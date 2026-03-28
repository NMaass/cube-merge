import { Textarea } from './Textarea'
import { SuggestionMenu } from './SuggestionMenu'
import { useAutocomplete } from '../../hooks/useAutocomplete'

interface AutocompleteTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  autoFocus?: boolean
  diffCards?: string[]
  reviewerNames?: string[]
  /** Extra onKeyDown handler — runs after autocomplete dismiss check. */
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}

export function AutocompleteTextarea({
  value, onChange, placeholder = 'Add a note… / for cards, @ for names',
  rows = 3, autoFocus, diffCards = [], reviewerNames = [],
  onKeyDown,
}: AutocompleteTextareaProps) {
  const { textareaRef, suggestions, activeIndex, anchor, onTextareaChange, applySuggestion, dismiss, moveActive, getActive } =
    useAutocomplete({ diffCards, reviewerNames })

  const menuId = 'autocomplete-suggestions'

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        aria-expanded={suggestions.length > 0}
        aria-controls={suggestions.length > 0 ? menuId : undefined}
        aria-activedescendant={activeIndex >= 0 ? `${menuId}-${activeIndex}` : undefined}
        aria-autocomplete="list"
        onChange={e => {
          onChange(e.target.value)
          onTextareaChange(e.target.value, e.target.selectionStart ?? e.target.value.length)
        }}
        onKeyDown={e => {
          if (suggestions.length > 0) {
            if (e.key === 'Escape') { e.stopPropagation(); dismiss(); return }
            if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); return }
            if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); return }
            if (e.key === 'Enter') {
              const active = getActive()
              if (active) { e.preventDefault(); applySuggestion(active, value, onChange); return }
            }
          }
          onKeyDown?.(e)
        }}
        rows={rows}
      />
      <SuggestionMenu
        suggestions={suggestions}
        activeIndex={activeIndex}
        menuId={menuId}
        anchor={anchor}
        onSelect={s => applySuggestion(s, value, onChange)}
      />
    </div>
  )
}
