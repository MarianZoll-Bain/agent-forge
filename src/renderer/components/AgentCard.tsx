/**
 * Agent Card: worktree info, git status, open buttons, remove.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { Agent } from '@shared/types'
import { useAppStore } from '../store/useAppStore'

interface AgentCardProps {
  agent: Agent
  onRemove: (agentId: string) => void | Promise<void>
}

/** Format an ISO date string as a human-readable relative time (e.g. "3 days ago"). */
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return 'just now'
  const secs = Math.floor(ms / 1_000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.floor(days / 365)
  return `${years}y ago`
}

// ---- Copy button ----

function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={label}
      aria-label={label}
      className="shrink-0 px-1.5 py-0.5 rounded text-xs text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 flex items-center gap-1 transition-colors"
    >
      {copied ? (
        <>
          <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {label}
        </>
      )}
    </button>
  )
}

// ---- Git status badge ----

function GitStatusBadge({
  dirty,
  branch,
  lastCommitSha,
  aheadBehind,
  refreshing,
}: {
  dirty: boolean
  branch: string
  lastCommitSha: string
  aheadBehind?: { ahead: number; behind: number }
  refreshing?: boolean
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      {refreshing && (
        <svg className="w-3 h-3 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      <span className="font-mono font-medium text-slate-600 dark:text-slate-400">{branch}</span>
      {lastCommitSha && (
        <span className="font-mono text-slate-400 dark:text-slate-600">{lastCommitSha}</span>
      )}
      <span
        className={`px-2 py-0.5 rounded-full font-semibold text-[10px] uppercase tracking-wide ${
          dirty
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
        }`}
      >
        {dirty ? 'dirty' : 'clean'}
      </span>
      {aheadBehind && (aheadBehind.ahead > 0 || aheadBehind.behind > 0) && (
        <span className="text-slate-400 dark:text-slate-500 font-medium">
          {aheadBehind.ahead > 0 && `${aheadBehind.ahead}\u2191`}
          {aheadBehind.ahead > 0 && aheadBehind.behind > 0 && ' '}
          {aheadBehind.behind > 0 && `${aheadBehind.behind}\u2193`}
        </span>
      )}
    </div>
  )
}

// ---- Remove confirmation dialog ----

function RemoveConfirmDialog({
  name,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  name: string
  busy: boolean
  error: string | null
  onConfirm: (deleteWorktree: boolean) => void
  onCancel?: () => void
}) {
  const [deleteWorktree, setDeleteWorktree] = useState(true)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30 dark:bg-black/60 animate-fade-in"
        onClick={busy || !onCancel ? undefined : onCancel}
        onKeyDown={(e) => { if (e.key === 'Escape' && !busy && onCancel) onCancel() }}
      />
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-elevated border border-slate-200/80 dark:border-white/[0.08] w-full max-w-sm mx-4 p-6 flex flex-col gap-4 animate-scale-in">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Remove worktree</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Are you sure you want to remove <span className="font-semibold text-slate-900 dark:text-white">{name}</span>?
        </p>
        <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={deleteWorktree}
            onChange={(e) => setDeleteWorktree(e.target.checked)}
            className="w-4 h-4 accent-red-600 rounded"
          />
          Delete worktree from disk
        </label>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex gap-2 justify-end pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-700 font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(deleteWorktree)}
            disabled={busy}
            className="px-4 py-2 text-sm rounded-lg bg-red-600 dark:bg-red-500 text-white font-semibold hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50"
          >
            {busy ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Info tooltip (hover popover) ----

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)

  return (
    <span
      className="relative shrink-0"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-600 cursor-help">
        ?
      </span>
      {show && (
        <span className="absolute bottom-full right-0 mb-1.5 z-40 w-56 px-3 py-2 rounded-lg text-xs leading-relaxed text-slate-700 dark:text-slate-300 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 shadow-lg pointer-events-none">
          {text}
        </span>
      )}
    </span>
  )
}

// ---- Tool button styles ----

const TOOL_BUTTON_STYLES: Record<string, string> = {
  cursor: 'bg-violet-100 hover:bg-violet-200 text-violet-700 dark:bg-violet-500/15 dark:hover:bg-violet-500/25 dark:text-violet-300 border border-violet-200/80 dark:border-violet-500/20',
  claude: 'bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-500/15 dark:hover:bg-orange-500/25 dark:text-orange-300 border border-orange-200/80 dark:border-orange-500/20',
  'claude-ollama': 'bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 dark:text-amber-300 border border-amber-200/80 dark:border-amber-500/20',
  terminal: 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-500/15 dark:hover:bg-slate-500/25 dark:text-slate-300 border border-slate-200/80 dark:border-slate-500/20',
}

// ---- Main component ----

const GIT_POLL_INTERVAL_MS = 10_000

export function AgentCard({ agent, onRemove }: AgentCardProps) {
  const gitStatus = useAppStore((s) => s.agentGitStatuses[agent.id])
  const settings = useAppStore((s) => s.state?.settings)
  const enableGitMode = useAppStore((s) => s.state?.settings.enableGitMode)
  const prStatus = useAppStore((s) => s.agentPRStatuses[agent.id])
  const bulkRefreshing = useAppStore((s) => s.agentRefreshingIds.has(agent.id))
  const { refreshState, setAgentGitStatus, setAgentPRStatus, addToast } = useAppStore()

  const [prLoading, setPRLoading] = useState(false)
  const prFetchedRef = useRef(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [removeBusy, setRemoveBusy] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const removedRef = useRef(false)
  const [openBusy, setOpenBusy] = useState<string | null>(null)
  const [pullBusy, setPullBusy] = useState(false)

  const fetchGitStatus = useCallback(async () => {
    const api = window.agentForge
    if (!api || removedRef.current) return
    const result = await api.getAgentGitStatus({ agentId: agent.id })
    if (result.ok && !removedRef.current) {
      setAgentGitStatus(agent.id, result)
    }
  }, [agent.id, setAgentGitStatus])

  useEffect(() => {
    fetchGitStatus()
    const id = setInterval(fetchGitStatus, GIT_POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetchGitStatus])

  const fetchPRStatus = useCallback(async () => {
    const api = window.agentForge
    if (!api) return
    setPRLoading(true)
    try {
      const result = await api.getAgentPRStatus({ agentId: agent.id })
      if (result.ok) {
        setAgentPRStatus(agent.id, result)
      }
    } finally {
      setPRLoading(false)
    }
  }, [agent.id, setAgentPRStatus])

  useEffect(() => {
    if (enableGitMode && !prFetchedRef.current) {
      prFetchedRef.current = true
      fetchPRStatus()
    }
  }, [enableGitMode, fetchPRStatus])

  const handlePull = useCallback(async () => {
    const api = window.agentForge
    if (!api || pullBusy) return
    setPullBusy(true)
    try {
      const result = await api.pullAgent({ agentId: agent.id })
      if (result.ok) {
        addToast(`Pulled ${agent.name}: ${result.summary} (${result.updatedSha})`, 'success')
        fetchGitStatus()
      } else {
        addToast(`Pull failed for ${agent.name}: ${result.message}`, 'error')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      addToast(`Pull failed: ${msg}`, 'error')
    } finally {
      setPullBusy(false)
    }
  }, [agent.id, agent.name, pullBusy, addToast, fetchGitStatus])

  const handleOpen = useCallback(async (tool: 'cursor' | 'claude' | 'claude-ollama' | 'terminal') => {
    const api = window.agentForge
    if (!api || openBusy) return
    setActionError(null)
    setOpenBusy(tool)
    try {
      const result = await api.openAgent({ agentId: agent.id, tool })
      if (!result.ok) {
        setActionError(result.message)
        addToast(`Failed to open ${tool}: ${result.message}`, 'error')
      } else {
        addToast(`Opened ${tool} for ${agent.name}`, 'success')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setActionError(msg)
    } finally {
      setOpenBusy(null)
    }
  }, [agent.id, agent.name, openBusy, addToast])

  const handleConfirmRemove = useCallback(
    async (deleteWorktree: boolean) => {
      const api = window.agentForge
      if (!api || removedRef.current) return
      setRemoveError(null)
      setRemoveBusy(true)
      try {
        const result = await api.removeAgent({ agentId: agent.id, deleteWorktree })
        if (!result.ok) {
          setRemoveError(result.message)
          setRemoveBusy(false)
          return
        }
        if (result.worktreeRemoveError) {
          setRemoveError(`Agent removed but worktree deletion failed: ${result.worktreeRemoveError}`)
          setRemoveBusy(false)
          return
        }
        // Mark as removed so no further state updates happen on this card.
        // Keep dialog open (busy) until parent finishes refreshing state.
        removedRef.current = true
        await onRemove(agent.id)
      } catch {
        if (!removedRef.current) setRemoveBusy(false)
      }
    },
    [agent.id, onRemove],
  )

  return (
    <div className="group rounded-2xl border border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] flex flex-col shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-bold text-slate-900 dark:text-white text-base leading-tight">{agent.name}</span>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-mono truncate">{agent.branchName}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowRemoveConfirm(true)}
          title="Remove worktree"
          aria-label="Remove worktree"
          className="p-1.5 rounded-lg text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 shrink-0 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Worktree path */}
      <div className="flex items-center gap-1 px-4 pb-2 min-w-0">
        <span
          className="text-xs text-slate-400 dark:text-slate-600 font-mono truncate"
          dir="rtl"
          title={agent.worktreePath}
        >
          <bdi>{agent.worktreePath}</bdi>
        </span>
        <CopyButton value={agent.worktreePath} label="Copy path" />
      </div>

      {/* Git status */}
      {gitStatus && (
        <div className="flex items-center gap-2 px-4 pb-3">
          <div className="flex-1 min-w-0">
            <GitStatusBadge
              dirty={gitStatus.dirty}
              branch={gitStatus.branch}
              lastCommitSha={gitStatus.lastCommitSha}
              aheadBehind={gitStatus.aheadBehind}
              refreshing={bulkRefreshing}
            />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handlePull}
              disabled={pullBusy || bulkRefreshing}
              title="Pull latest changes"
              aria-label="Pull latest changes"
              className="p-1 rounded-md text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors disabled:opacity-40"
            >
              {pullBusy ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={fetchGitStatus}
              disabled={bulkRefreshing}
              title="Refresh git status"
              aria-label="Refresh git status"
              className="p-1 rounded-md text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors disabled:opacity-40"
            >
              <svg className={`w-3.5 h-3.5 ${bulkRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Timestamps */}
      {(gitStatus?.lastCommitDate || agent.createdAt) && (
        <div className="flex items-center gap-3 px-4 pb-3 text-[11px] text-slate-400 dark:text-slate-500">
          {gitStatus?.lastCommitDate && (
            <span title={`Last commit: ${new Date(gitStatus.lastCommitDate).toLocaleString()}`}>
              Last commit {timeAgo(gitStatus.lastCommitDate)}
            </span>
          )}
          {gitStatus?.lastCommitDate && agent.createdAt && (
            <span className="text-slate-300 dark:text-slate-700">|</span>
          )}
          {agent.createdAt && (
            <span title={`Created: ${new Date(agent.createdAt).toLocaleString()}`}>
              Created {timeAgo(agent.createdAt)}
            </span>
          )}
        </div>
      )}

      {/* PR status */}
      {enableGitMode && (
        <div className="flex items-center gap-2 px-4 pb-3">
          {prLoading && !prStatus ? (
            <span className="text-xs text-slate-400 dark:text-slate-500 italic">Checking PR...</span>
          ) : prStatus?.hasPR ? (
            <>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
                prStatus.isDraft
                  ? 'bg-slate-200 text-slate-600 dark:bg-slate-600/30 dark:text-slate-400'
                  : prStatus.prState === 'MERGED'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400'
                    : prStatus.prState === 'CLOSED'
                      ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                      : prStatus.reviewDecision === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                        : prStatus.reviewDecision === 'CHANGES_REQUESTED'
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400'
                          : 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400'
              }`}>
                PR #{prStatus.prNumber}{prStatus.prState ? ` · ${
                  prStatus.isDraft ? 'Draft'
                    : prStatus.prState === 'MERGED' ? 'Merged'
                    : prStatus.prState === 'CLOSED' ? 'Closed'
                    : prStatus.reviewDecision === 'APPROVED' ? 'Approved'
                    : prStatus.reviewDecision === 'CHANGES_REQUESTED' ? 'Changes Requested'
                    : 'Open'
                }` : ''}
              </span>
              {prStatus.prUrl && (
                <button
                  type="button"
                  onClick={() => window.agentForge?.openExternal(prStatus.prUrl!)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  Open PR
                </button>
              )}
            </>
          ) : prStatus ? (
            <span className="text-xs text-slate-400 dark:text-slate-600 italic">No PR</span>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            <InfoTooltip text="Commits, pushes, and PR creation should be managed inside your CLI or IDE (Cursor, Claude CLI, etc.) — AgentForge only displays the status." />
            <button
              type="button"
              onClick={fetchPRStatus}
              disabled={prLoading || bulkRefreshing}
              title="Refresh PR status"
              aria-label="Refresh PR status"
              className="p-1 rounded-md text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors disabled:opacity-40"
            >
              <svg className={`w-3.5 h-3.5 ${prLoading || bulkRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Action error */}
      {actionError && (
        <p className="mx-4 mb-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2">
          {actionError}
        </p>
      )}

      {showRemoveConfirm && (
        <RemoveConfirmDialog
          name={agent.name}
          busy={removeBusy || removedRef.current}
          error={removeError}
          onConfirm={handleConfirmRemove}
          onCancel={removedRef.current ? undefined : () => { setShowRemoveConfirm(false); setRemoveError(null) }}
        />
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 px-4 pb-4 mt-auto">
        {settings?.enableCursor && (
          <button
            type="button"
            onClick={() => handleOpen('cursor')}
            disabled={!!openBusy}
            className={`px-3 py-1.5 text-xs rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${TOOL_BUTTON_STYLES.cursor}`}
          >
            {openBusy === 'cursor' ? 'Opening...' : (
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Cursor
              </span>
            )}
          </button>
        )}
        {settings?.enableClaude && (
          <button
            type="button"
            onClick={() => handleOpen('claude')}
            disabled={!!openBusy}
            className={`px-3 py-1.5 text-xs rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${TOOL_BUTTON_STYLES.claude}`}
          >
            {openBusy === 'claude' ? 'Opening...' : (
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Claude CLI
              </span>
            )}
          </button>
        )}
        {settings?.enableClaudeOllama && (
          <button
            type="button"
            onClick={() => handleOpen('claude-ollama')}
            disabled={!!openBusy}
            className={`px-3 py-1.5 text-xs rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${TOOL_BUTTON_STYLES['claude-ollama']}`}
          >
            {openBusy === 'claude-ollama' ? 'Opening...' : (
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Ollama
              </span>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={() => handleOpen('terminal')}
          disabled={!!openBusy}
          className={`px-3 py-1.5 text-xs rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${TOOL_BUTTON_STYLES.terminal}`}
        >
          {openBusy === 'terminal' ? 'Opening...' : (
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Terminal
            </span>
          )}
        </button>
        {!settings?.enableCursor && !settings?.enableClaude && !settings?.enableClaudeOllama && (
          <span className="text-xs text-slate-400 dark:text-slate-600 italic">Enable tools in Settings</span>
        )}
      </div>
    </div>
  )
}
