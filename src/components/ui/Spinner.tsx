interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

export function Spinner({ size = 'md', label = 'Loading' }: SpinnerProps) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }
  return (
    <div 
      className={`${sizes[size]} border-2 border-amber-400 border-t-transparent rounded-full animate-spin`}
      role="status"
      aria-label={label}
      aria-live="polite"
    />
  )
}
