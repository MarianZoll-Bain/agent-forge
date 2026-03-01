/**
 * Worktree Board: grid of worktree cards + add button.
 */

import { EmptyState } from './EmptyState'
import { AgentCard } from './AgentCard'
import { AgentSetupCard } from './AgentSetupCard'
import { useAppStore } from '../store/useAppStore'

export function AgentBoard() {
  const agents = useAppStore((s) => s.state?.agents ?? [])
  const hasRepo = useAppStore((s) => s.hasRepo())
  const draftAgents = useAppStore((s) => s.draftAgents)
  const addDraftAgent = useAppStore((s) => s.addDraftAgent)
  const refreshState = useAppStore((s) => s.refreshState)

  function handleAdd() {
    addDraftAgent()
  }

  function handleRemove() {
    refreshState()
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
        <button
          type="button"
          onClick={handleAdd}
          disabled={!hasRepo}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 hover:from-indigo-600 hover:via-indigo-700 hover:to-violet-700 text-white font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          title={hasRepo ? 'Add worktree' : 'Select a repository first'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Add worktree
        </button>
      </div>

      <div className="flex-1 min-h-0 rounded-2xl border border-slate-200/80 dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.02] overflow-auto">
        {isEmpty ? (
          <EmptyState />
        ) : (
          <div className="p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {draftAgents.map((draft) => (
              <AgentSetupCard key={draft.id} draftId={draft.id} />
            ))}
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} onRemove={handleRemove} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
