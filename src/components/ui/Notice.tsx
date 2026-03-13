import React from 'react'

interface NoticeProps {
  tone?: 'error' | 'info' | 'success'
  title?: string
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}

const toneClasses = {
  error: 'border-red-500/30 bg-red-500/10 text-red-100',
  info: 'border-blue-500/30 bg-blue-500/10 text-blue-100',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
}

export function Notice({
  tone = 'info',
  title,
  children,
  action,
  className = '',
}: NoticeProps) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 shadow-sm ${toneClasses[tone]} ${className}`}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {title && <p className="text-sm font-semibold">{title}</p>}
          <div className="text-sm text-current/90">{children}</div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  )
}
