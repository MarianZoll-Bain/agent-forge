/**
 * US-001: Select Repository screen. Shown when no repo is selected or state is empty.
 */

import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'

export function SelectRepository() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const refreshState = useAppStore((s) => s.refreshState)
  const setLoadError = useAppStore((s) => s.setLoadError)

  const handleSelect = async () => {
    const api = window.agentForge
    if (!api) {
      setError('App API not available')
      return
    }
    setLoading(true)
    setError(null)
    setLoadError(null)
    try {
      const result = await api.selectRepository()
      if (result.ok) {
        await refreshState()
      } else {
        const msg = result.code ? `[${result.code}] ${result.message}` : result.message
        setError(msg)
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      const code = (e as { code?: string }).code
      setError(code ? `[${code}] ${err.message}` : err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50/80 dark:from-zinc-950 dark:via-zinc-900 dark:to-indigo-950/30 p-6 relative">
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-400/10 dark:bg-indigo-500/[0.06] rounded-full blur-3xl" />
      <div className="relative w-full max-w-md rounded-2xl glass-heavy shadow-elevated border border-slate-200/60 dark:border-white/[0.06] p-10">
        <h1 className="text-3xl font-extrabold mb-2 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 dark:from-indigo-400 dark:via-violet-400 dark:to-purple-400 bg-clip-text text-transparent tracking-tight">AgentForge</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8">Select a Git repository to get started.</p>
        <button
          type="button"
          onClick={handleSelect}
          disabled={loading}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 text-white font-semibold hover:from-indigo-600 hover:via-indigo-700 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 transition-all duration-200 text-base"
        >
          {loading ? 'Opening...' : 'Select Repository'}
        </button>
        {error && (
          <div className="mt-5 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20 text-sm font-mono" role="alert">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
