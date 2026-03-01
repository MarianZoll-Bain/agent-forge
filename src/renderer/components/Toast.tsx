/**
 * US-039: Toast notification system.
 * Renders active toasts from the Zustand store at the bottom-right of the screen.
 */

import { createPortal } from 'react-dom'
import { useAppStore } from '../store/useAppStore'
import type { Toast as ToastItem } from '../store/useAppStore'

const TOAST_STYLES: Record<ToastItem['type'], string> = {
  success: 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20',
  error: 'bg-red-600 text-white shadow-lg shadow-red-600/20',
  info: 'bg-zinc-800 dark:bg-zinc-700 text-white shadow-lg shadow-zinc-800/20',
}

const TOAST_ICONS: Record<ToastItem['type'], React.ReactNode> = {
  success: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
}

export function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts)
  const removeToast = useAppStore((s) => s.removeToast)

  if (toasts.length === 0) return null

  return createPortal(
    <div
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 pointer-events-none"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-xl max-w-sm pointer-events-auto animate-slide-in-right font-medium text-sm ${TOAST_STYLES[toast.type]}`}
        >
          {TOAST_ICONS[toast.type]}
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            aria-label="Dismiss"
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>,
    document.body,
  )
}
