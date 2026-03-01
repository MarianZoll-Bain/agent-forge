/**
 * Add Worktree card (setup state).
 * Accepts a name, branch name, and base branch.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'

interface Props {
  draftId: string
}

function suggestBranch(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return slug ? `feature/${slug}` : ''
}

export function AgentSetupCard({ draftId }: Props) {
  const { removeDraftAgent, refreshState } = useAppStore()

  const [nameInput, setNameInput] = useState('')
  const [resolvedName, setResolvedName] = useState('')
  const [branchName, setBranchName] = useState('')
  const [baseBranch, setBaseBranch] = useState('main')
  const [nameError, setNameError] = useState<string | null>(null)
  const [branchError, setBranchError] = useState<string | null>(null)
  const [branchValidating, setBranchValidating] = useState(false)
  const [branchAutoFilled, setBranchAutoFilled] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const branchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function resolveNameInput(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) {
      setResolvedName('')
      setNameError('Name is required')
      return
    }
    setResolvedName(trimmed)
    setNameError(null)
    if (!branchName || branchAutoFilled) {
      const suggested = suggestBranch(trimmed)
      if (suggested) {
        setBranchName(suggested)
        setBranchAutoFilled(true)
        validateBranch(suggested)
      }
    }
  }

  function handleNameInputChange(value: string) {
    setNameInput(value)
    resolveNameInput(value)
  }

  function handleNameInputBlur() {
    resolveNameInput(nameInput)
  }

  const validateBranch = useCallback((name: string) => {
    if (!name) {
      setBranchError('Branch name is required')
      setBranchValidating(false)
      return
    }
    setBranchValidating(true)
    setBranchError(null)
    if (branchDebounceRef.current) clearTimeout(branchDebounceRef.current)
    branchDebounceRef.current = setTimeout(async () => {
      const api = window.agentForge
      if (!api) {
        setBranchError('App API not available')
        setBranchValidating(false)
        return
      }
      try {
        const result = await api.validateBranchName({ branchName: name })
        setBranchError(result.valid ? null : (result.message ?? 'Invalid branch name'))
      } catch {
        setBranchError('Failed to validate branch name')
      } finally {
        setBranchValidating(false)
      }
    }, 350)
  }, [])

  function handleBranchChange(value: string) {
    setBranchName(value)
    setBranchAutoFilled(false)
    validateBranch(value)
  }

  function handleBranchBlur() {
    if (branchDebounceRef.current) clearTimeout(branchDebounceRef.current)
    validateBranch(branchName)
  }

  useEffect(() => {
    return () => {
      if (branchDebounceRef.current) clearTimeout(branchDebounceRef.current)
    }
  }, [])

  const nameValid = !!resolvedName && !nameError
  const branchValid = !!branchName && !branchError && !branchValidating
  const canInitialize = nameValid && branchValid && !submitting

  async function handleInitialize() {
    if (!canInitialize) return
    const api = window.agentForge
    if (!api) {
      setSubmitError('App API not available')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await api.createAgent({
        name: resolvedName,
        branchName,
        baseBranch: baseBranch || 'main',
      })
      if (!result.ok) {
        setSubmitError(result.message)
        return
      }
      await refreshState()
      removeDraftAgent(draftId)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to create worktree')
    } finally {
      setSubmitting(false)
    }
  }

  const inputBase = 'w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-white/[0.04] dark:text-slate-100 focus-ring font-mono'

  return (
    <div className="rounded-2xl border-2 border-dashed border-indigo-300/50 dark:border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-500/[0.03] p-5 flex flex-col gap-3 animate-scale-in">
      <div className="text-sm font-bold text-slate-800 dark:text-white">New worktree</div>

      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1" htmlFor={`name-input-${draftId}`}>
          Name <span className="text-red-400">*</span>
        </label>
        <input
          id={`name-input-${draftId}`}
          type="text"
          value={nameInput}
          onChange={(e) => handleNameInputChange(e.target.value)}
          onBlur={handleNameInputBlur}
          placeholder="Feature name or description"
          autoComplete="off"
          spellCheck={false}
          className={`${inputBase} ${
            nameError ? 'border-red-400 dark:border-red-500 focus:ring-red-500/40' : 'border-slate-300 dark:border-white/[0.08]'
          }`}
        />
        {nameError && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{nameError}</p>}
      </div>

      {/* Branch name */}
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1" htmlFor={`branch-${draftId}`}>
          Branch <span className="text-red-400">*</span>
        </label>
        <input
          id={`branch-${draftId}`}
          type="text"
          value={branchName}
          onChange={(e) => handleBranchChange(e.target.value)}
          onBlur={handleBranchBlur}
          placeholder="feature/my-feature"
          autoComplete="off"
          spellCheck={false}
          className={`${inputBase} ${
            branchError ? 'border-red-400 dark:border-red-500 focus:ring-red-500/40' : 'border-slate-300 dark:border-white/[0.08]'
          }`}
        />
        {branchAutoFilled && !branchError && !branchValidating && (
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Auto-suggested</p>
        )}
        {branchValidating && <p className="mt-1 text-xs text-indigo-500 dark:text-indigo-400">Validating...</p>}
        {branchError && !branchValidating && (
          <p className="mt-1 text-xs text-red-500 dark:text-red-400">{branchError}</p>
        )}
      </div>

      {/* Base branch */}
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1" htmlFor={`base-${draftId}`}>
          Base branch
        </label>
        <input
          id={`base-${draftId}`}
          type="text"
          value={baseBranch}
          onChange={(e) => setBaseBranch(e.target.value)}
          placeholder="main"
          autoComplete="off"
          spellCheck={false}
          className={`${inputBase} border-slate-300 dark:border-white/[0.08]`}
        />
      </div>

      {/* Submit error */}
      {submitError && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2">
          {submitError}
        </p>
      )}

      {/* Buttons */}
      <div className="flex gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={() => removeDraftAgent(draftId)}
          disabled={submitting}
          className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-700 font-medium disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleInitialize}
          disabled={!canInitialize}
          className="px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 text-white font-semibold hover:from-indigo-600 hover:via-indigo-700 hover:to-violet-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25"
        >
          {submitting ? 'Creating...' : 'Create Worktree'}
        </button>
      </div>
    </div>
  )
}
