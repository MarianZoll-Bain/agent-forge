/**
 * Banner warning shown when tmux is not installed locally.
 * Checks once on mount via the tools:verify IPC channel.
 */

import { useEffect, useState } from 'react'

export function TmuxWarning() {
  const [missing, setMissing] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    window.agentForge?.verifyTool({ tool: 'tmux' }).then((res) => {
      if (!res.ok) setMissing(true)
    })
  }, [])

  if (!missing || dismissed) return null

  return (
    <div className="mx-4 mt-2 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300 shrink-0">
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span className="flex-1">
        <strong>tmux</strong> is not installed. Agent terminals will run without session management.{' '}
        <button
          type="button"
          onClick={() => window.agentForge?.openExternal('https://github.com/tmux/tmux/wiki/Installing')}
          className="underline hover:no-underline font-medium"
        >
          Install tmux
        </button>
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="p-0.5 rounded hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
