/**
 * Shared toggle component for tool enablement with verification.
 * Used in both SettingsPanel and OnboardingWizard.
 */

import { useState, useEffect } from 'react'

interface ToolToggleProps {
  tool: 'cursor' | 'claude' | 'claude-ollama' | 'gh'
  label: string
  enabled: boolean
  onToggle: (enabled: boolean) => void
}

type VerifyState =
  | { status: 'idle' }
  | { status: 'verifying' }
  | { status: 'success'; version: string }
  | { status: 'error'; message: string }

export function ToolToggle({ tool, label, enabled, onToggle }: ToolToggleProps) {
  const [verify, setVerify] = useState<VerifyState>({ status: 'idle' })

  useEffect(() => {
    if (!enabled) {
      setVerify({ status: 'idle' })
      return
    }
    let cancelled = false
    async function run() {
      const api = window.agentForge
      if (!api) return
      setVerify({ status: 'verifying' })
      try {
        const result = await api.verifyTool({ tool })
        if (cancelled) return
        if (result.ok) {
          setVerify({ status: 'success', version: result.version })
        } else {
          setVerify({ status: 'error', message: result.message })
        }
      } catch (e) {
        if (cancelled) return
        setVerify({ status: 'error', message: e instanceof Error ? e.message : 'Verification failed' })
      }
    }
    run()
    return () => { cancelled = true }
  }, [enabled, tool])

  return (
    <div className="flex items-center gap-3 py-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onToggle(!enabled)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          enabled ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-zinc-600'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      <span className="text-sm text-slate-800 dark:text-slate-200 font-semibold min-w-[120px]">{label}</span>
      <span className="text-xs flex items-center gap-1.5">
        {verify.status === 'verifying' && (
          <span className="text-indigo-500 dark:text-indigo-400 font-medium">Verifying...</span>
        )}
        {verify.status === 'success' && (
          <>
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-medium">{verify.version}</span>
          </>
        )}
        {verify.status === 'error' && (
          <>
            <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="text-red-500 dark:text-red-400 font-medium">{verify.message}</span>
          </>
        )}
      </span>
    </div>
  )
}
