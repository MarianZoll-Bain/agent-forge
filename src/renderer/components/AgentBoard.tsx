/**
 * Worktree Board: grid of worktree cards + add button.
 */

import { EmptyState } from './EmptyState'
import { AgentCard } from './AgentCard'
import { AgentSetupCard } from './AgentSetupCard'
import { useAppStore } from '../store/useAppStore'

export function AgentBoard() {
  const agents = useAppStore((s) => s.state?.agents ?? [])
  const draftAgents = useAppStore((s) => s.draftAgents)
  const addDraftAgent = useAppStore((s) => s.addDraftAgent)
  const refreshState = useAppStore((s) => s.refreshState)
  const refreshAllStatuses = useAppStore((s) => s.refreshAllStatuses)
  const refreshingAll = useAppStore((s) => s.refreshingAllStatuses)

  async function handleRemove() {
    await refreshState()
  }

  const isEmpty = agents.length === 0 && draftAgents.length === 0

  return (
    <div className="flex flex-col flex-1 min-h-0 p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          {agents.length > 0 && (
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400 tabular-nums">
              {agents.length} worktree{agents.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 rounded-2xl border border-slate-200/80 dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.02] overflow-auto">
        {isEmpty ? (
          <EmptyState />
        ) : (
          <div className="p-5">
            <div className="flex justify-end gap-2 mb-4">
              <button
                type="button"
                onClick={addDraftAgent}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 shadow-sm transition-all"
                title="Add worktree"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Add worktree
              </button>
              {agents.length > 0 && (
                <button
                  type="button"
                  onClick={refreshAllStatuses}
                  disabled={refreshingAll}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors disabled:opacity-50"
                  title="Refresh all worktree statuses"
                  aria-label="Refresh all worktree statuses"
                >
                  <svg className={`w-3.5 h-3.5 ${refreshingAll ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>{refreshingAll ? 'Refreshing...' : 'Refresh all'}</span>
                </button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {draftAgents.map((draft) => (
                <AgentSetupCard key={draft.id} draftId={draft.id} />
              ))}
              {agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} onRemove={handleRemove} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
