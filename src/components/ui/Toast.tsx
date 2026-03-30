import { useState, useCallback, useRef, useEffect } from 'react'

interface ToastItem {
  id: number
  message: string
  onUndo?: () => void
}

const TOAST_DURATION = 4000

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const show = useCallback((message: string, onUndo?: () => void) => {
    const id = nextId.current++
    setToasts(prev => [...prev, { id, message, onUndo }])
    return id
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, show, dismiss }
}

export function ToastContainer({ toasts, onDismiss }: {
  toasts: ToastItem[]
  onDismiss: (id: number) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
      {toasts.map(toast => (
        <ToastBar key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastBar({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setExiting(true), TOAST_DURATION - 300)
    const remove = setTimeout(() => onDismiss(toast.id), TOAST_DURATION)
    return () => { clearTimeout(timer); clearTimeout(remove) }
  }, [toast.id, onDismiss])

  function handleUndo() {
    toast.onUndo?.()
    onDismiss(toast.id)
  }

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 shadow-lg transition-all duration-300 ${
        exiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
      }`}
    >
      <span className="text-sm text-slate-200 flex-1 min-w-0 truncate">{toast.message}</span>
      {toast.onUndo && (
        <button
          onClick={handleUndo}
          className="shrink-0 text-sm font-semibold text-amber-400 hover:text-amber-300 active:scale-95 transition-colors"
        >
          Undo
        </button>
      )}
    </div>
  )
}
