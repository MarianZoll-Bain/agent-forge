/**
 * Project switcher bar — sits below the header nav.
 */

import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'

type Tool = 'cursor' | 'claude' | 'claude-ollama'

const TOOL_BUTTON_STYLES: Record<Tool, string> = {
  cursor: 'bg-violet-100 hover:bg-violet-200 text-violet-700 dark:bg-violet-500/15 dark:hover:bg-violet-500/25 dark:text-violet-300 border border-violet-200/80 dark:border-violet-500/20',
  claude: 'bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-500/15 dark:hover:bg-orange-500/25 dark:text-orange-300 border border-orange-200/80 dark:border-orange-500/20',
  'claude-ollama': 'bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 dark:text-amber-300 border border-amber-200/80 dark:border-amber-500/20',
}

const TOOL_LABELS: Record<Tool, string> = {
  cursor: 'Cursor',
  claude: 'Claude',
  'claude-ollama': 'Ollama',
}

export function ProjectBar() {
  const repoName = useAppStore((s) => s.repoName())
  const refreshState = useAppStore((s) => s.refreshState)
  const pullMain = useAppStore((s) => s.pullMain)
  const pullingMain = useAppStore((s) => s.pullingMain)
  const baseBranch = useAppStore((s) => s.state?.settings.baseBranch || 'main')
  const settings = useAppStore((s) => s.state?.settings)
  const [switching, setSwitching] = useState(false)
  const [openBusy, setOpenBusy] = useState<Tool | null>(null)
  const [tiling, setTiling] = useState(false)
  const [tileToast, setTileToast] = useState<string | null>(null)

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

  async function handleOpenTool(tool: Tool) {
    const api = window.agentForge
    if (!api || openBusy) return
    setOpenBusy(tool)
    try {
      await api.openRepo({ tool })
    } finally {
      setOpenBusy(null)
    }
  }

  async function handleTileTerminals() {
    const api = window.agentForge
    if (!api || tiling) return
    setTiling(true)
    setTileToast(null)
    try {
      const result = await api.tileTerminals()
      if (result.ok) {
        const msg = result.tiledCount === 0
          ? 'No terminal windows found'
          : `Tiled ${result.tiledCount} terminal${result.tiledCount > 1 ? 's' : ''}`
        setTileToast(msg)
        setTimeout(() => setTileToast(null), 3000)
      }
    } finally {
      setTiling(false)
    }
  }

  const enabledTools: Tool[] = []
  if (settings?.enableCursor) enabledTools.push('cursor')
  if (settings?.enableClaude) enabledTools.push('claude')
  if (settings?.enableClaudeOllama) enabledTools.push('claude-ollama')

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
      <div className="ml-auto flex items-center gap-1.5">
        {enabledTools.map((tool) => (
          <button
            key={tool}
            type="button"
            onClick={() => handleOpenTool(tool)}
            disabled={openBusy !== null}
            title={`Open ${TOOL_LABELS[tool]} in project root`}
            className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50 ${TOOL_BUTTON_STYLES[tool]}`}
          >
            {openBusy === tool ? 'Opening...' : TOOL_LABELS[tool]}
          </button>
        ))}
        <div className="relative">
          <button
            type="button"
            onClick={handleTileTerminals}
            disabled={tiling}
            title="Tile agent Terminal windows side-by-side"
            className="text-xs font-semibold px-3 py-1 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {tiling ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 4H5a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V5a1 1 0 00-1-1zm10 0h-4a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V5a1 1 0 00-1-1zm-10 10H5a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1v-4a1 1 0 00-1-1zm10 0h-4a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1v-4a1 1 0 00-1-1z" />
              </svg>
            )}
            Tile
          </button>
          {tileToast && (
            <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-lg z-10">
              {tileToast}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={pullMain}
          disabled={pullingMain}
          title={`git pull --ff-only origin ${baseBranch}`}
          className="text-xs font-semibold px-3 py-1 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          {pullingMain ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          )}
          {pullingMain ? 'Pulling...' : `Update ${baseBranch}`}
        </button>
        <button
          type="button"
          onClick={handleSwitchProject}
          disabled={switching}
          className="text-xs font-semibold px-3 py-1 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 disabled:opacity-50 transition-colors"
        >
          {switching ? 'Switching...' : 'Switch'}
        </button>
      </div>
    </div>
  )
}
