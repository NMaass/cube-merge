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
  const { textareaRef, suggestions, anchor, onTextareaChange, applySuggestion, dismiss } =
    useAutocomplete({ diffCards, reviewerNames })

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={e => {
          onChange(e.target.value)
          onTextareaChange(e.target.value, e.target.selectionStart ?? e.target.value.length)
        }}
        onKeyDown={e => {
          if (e.key === 'Escape' && suggestions.length > 0) {
            e.stopPropagation()
            dismiss()
            return
          }
          onKeyDown?.(e)
        }}
        rows={rows}
      />
      <SuggestionMenu
        suggestions={suggestions}
        anchor={anchor}
        onSelect={s => applySuggestion(s, value, onChange)}
      />
    </div>
  )
}
