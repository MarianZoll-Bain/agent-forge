/**
 * Project switcher bar — sits below the header nav.
 */

import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'

export function ProjectBar() {
  const repoName = useAppStore((s) => s.repoName())
  const refreshState = useAppStore((s) => s.refreshState)
  const [switching, setSwitching] = useState(false)

  if (!repoName) return null

  async function handleSwitchProject() {
    const api = window.agentForge
    if (!api || switching) return
    setSwitching(true)
    try {
      const result = await api.selectRepository()
      if (result.ok) {
        await refreshState()
      }
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/80 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.06] shadow-sm">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-600 leading-none">Project</span>
          <span className="text-sm font-bold text-slate-900 dark:text-white truncate leading-tight" title={repoName}>
            {repoName}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={handleSwitchProject}
        disabled={switching}
        className="ml-auto text-xs font-semibold px-3 py-1 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 disabled:opacity-50 transition-colors"
      >
        {switching ? 'Switching...' : 'Switch'}
      </button>
    </div>
  )
}
