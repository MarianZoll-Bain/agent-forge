/**
 * Add Worktree card (setup state).
 * Accepts a name, branch name, and base branch.
 * Supports both "New branch" (default) and "Existing branch" modes.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { BranchEntry, PREntry } from '../../shared/ipc-channels'

type BranchMode = 'new' | 'existing' | 'pr'

interface Props {
  draftId: string
}

function suggestBranch(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return slug ? `feature/${slug}` : ''
}

export function AgentSetupCard({ draftId }: Props) {
  const { removeDraftAgent, refreshState } = useAppStore()
  const hasRootEnvFile = useAppStore((s) => s.currentProject()?.hasRootEnvFile ?? false)

  const [branchMode, setBranchMode] = useState<BranchMode>('new')
  const [nameInput, setNameInput] = useState('')
  const [resolvedName, setResolvedName] = useState('')
  const [branchName, setBranchName] = useState('')
  const [baseBranch, setBaseBranch] = useState('main')
  const [nameError, setNameError] = useState<string | null>(null)
  const [branchError, setBranchError] = useState<string | null>(null)
  const [branchValidating, setBranchValidating] = useState(false)
  const [branchAutoFilled, setBranchAutoFilled] = useState(false)

  // Existing branch picker state
  const [branches, setBranches] = useState<BranchEntry[]>([])
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [branchSearch, setBranchSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // PR picker state
  const [prs, setPrs] = useState<PREntry[]>([])
  const [prsLoading, setPrsLoading] = useState(false)
  const [prSearch, setPrSearch] = useState('')
  const [prDropdownOpen, setPrDropdownOpen] = useState(false)
  const [selectedPr, setSelectedPr] = useState<PREntry | null>(null)
  const prDropdownRef = useRef<HTMLDivElement>(null)
  const prSearchInputRef = useRef<HTMLInputElement>(null)

  const [copyEnv, setCopyEnv] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const branchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Validate a branch name immediately (no debounce). Returns true if valid. */
  const validateBranchNow = useCallback(async (name: string): Promise<boolean> => {
    if (!name) {
      setBranchError('Branch name is required')
      setBranchValidating(false)
      return false
    }
    setBranchValidating(true)
    setBranchError(null)
    const api = window.agentForge
    if (!api) {
      setBranchError('App API not available')
      setBranchValidating(false)
      return false
    }
    try {
      const result = await api.validateBranchName({ branchName: name })
      const errMsg = result.valid ? null : (result.message ?? 'Invalid branch name')
      setBranchError(errMsg)
      return result.valid
    } catch {
      setBranchError('Failed to validate branch name')
      return false
    } finally {
      setBranchValidating(false)
    }
  }, [])

  /** Validate with 350 ms debounce (used while typing). */
  const validateBranch = useCallback((name: string) => {
    if (!name) {
      setBranchError('Branch name is required')
      setBranchValidating(false)
      return
    }
    setBranchValidating(true)
    setBranchError(null)
    if (branchDebounceRef.current) clearTimeout(branchDebounceRef.current)
    branchDebounceRef.current = setTimeout(() => {
      branchDebounceRef.current = null
      validateBranchNow(name)
    }, 350)
  }, [validateBranchNow])

  function resolveNameInput(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) {
      setResolvedName('')
      setNameError('Name is required')
      return
    }
    setResolvedName(trimmed)
    setNameError(null)
    if (branchMode === 'new' && (!branchName || branchAutoFilled)) {
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

  function handleBranchChange(value: string) {
    setBranchName(value)
    setBranchAutoFilled(false)
    validateBranch(value)
  }

  function handleBranchBlur() {
    // Flush pending debounce immediately; skip if validation already completed
    if (branchDebounceRef.current) {
      clearTimeout(branchDebounceRef.current)
      branchDebounceRef.current = null
      validateBranchNow(branchName)
    }
  }

  // Fetch branches when switching to existing mode
  const fetchBranches = useCallback(async () => {
    const api = window.agentForge
    if (!api) return
    setBranchesLoading(true)
    try {
      const result = await api.listBranches()
      if (result.ok) {
        setBranches(result.branches)
      }
    } catch {
      // Non-fatal
    } finally {
      setBranchesLoading(false)
    }
  }, [])

  const fetchPRs = useCallback(async () => {
    const api = window.agentForge
    if (!api) return
    setPrsLoading(true)
    try {
      const result = await api.listPRs()
      if (result.ok) {
        setPrs(result.prs)
      }
    } catch {
      // Non-fatal
    } finally {
      setPrsLoading(false)
    }
  }, [])

  function handleModeSwitch(mode: BranchMode) {
    setBranchMode(mode)
    setBranchName('')
    setBranchError(null)
    setBranchAutoFilled(false)
    setBranchSearch('')
    setPrSearch('')
    setSelectedPr(null)
    setSubmitError(null)
    if (mode === 'existing') {
      fetchBranches()
    } else if (mode === 'pr') {
      fetchPRs()
    }
  }

  function handleSelectPR(pr: PREntry) {
    setSelectedPr(pr)
    setBranchName(pr.branchName)
    setBranchError(null)
    setPrSearch('')
    setPrDropdownOpen(false)
  }

  function handleSelectBranch(entry: BranchEntry) {
    setBranchName(entry.name)
    setBranchError(null)
    setBranchSearch('')
    setDropdownOpen(false)
  }

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
      if (prDropdownRef.current && !prDropdownRef.current.contains(e.target as Node)) {
        setPrDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    return () => {
      if (branchDebounceRef.current) clearTimeout(branchDebounceRef.current)
    }
  }, [])

  const filteredBranches = branches.filter((b) =>
    b.name.toLowerCase().includes(branchSearch.toLowerCase()),
  )

  const filteredPRs = prs.filter((pr) => {
    const q = prSearch.toLowerCase()
    return (
      pr.title.toLowerCase().includes(q) ||
      pr.branchName.toLowerCase().includes(q) ||
      String(pr.number).includes(q)
    )
  })

  const nameValid = !!resolvedName && !nameError
  const branchSelected = branchMode === 'new' ? (!!branchName && !branchError) : !!branchName
  const canInitialize = nameValid && branchSelected && !submitting

  async function handleInitialize() {
    if (submitting) return

    if (!resolvedName || nameError) {
      setSubmitError(nameError || 'Name is required')
      return
    }
    if (!branchName) {
      setSubmitError('Branch name is required')
      return
    }

    // For new branch mode, validate branch name format
    if (branchMode === 'new') {
      if (branchDebounceRef.current) {
        clearTimeout(branchDebounceRef.current)
        branchDebounceRef.current = null
      }
      const branchOk = await validateBranchNow(branchName)
      if (!branchOk) return
    }

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
        baseBranch: branchMode === 'new' ? (baseBranch || 'main') : 'main',
        copyEnv: hasRootEnvFile ? copyEnv : undefined,
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
  const tabBase = 'px-3 py-1.5 text-xs font-medium rounded-md transition-colors'
  const tabActive = 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
  const tabInactive = 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.04]'

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

      {/* Branch mode toggle */}
      <div className="flex gap-1 bg-slate-100 dark:bg-white/[0.04] rounded-lg p-0.5 w-fit">
        <button
          type="button"
          onClick={() => handleModeSwitch('new')}
          className={`${tabBase} ${branchMode === 'new' ? tabActive : tabInactive}`}
        >
          New branch
        </button>
        <button
          type="button"
          onClick={() => handleModeSwitch('existing')}
          className={`${tabBase} ${branchMode === 'existing' ? tabActive : tabInactive}`}
        >
          Existing branch
        </button>
        <button
          type="button"
          onClick={() => handleModeSwitch('pr')}
          className={`${tabBase} ${branchMode === 'pr' ? tabActive : tabInactive}`}
        >
          From PR
        </button>
      </div>

      {/* Branch name — new mode */}
      {branchMode === 'new' && (
        <>
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
        </>
      )}

      {/* Branch picker — existing mode */}
      {branchMode === 'existing' && (
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
            Branch <span className="text-red-400">*</span>
          </label>
          <div className="relative" ref={dropdownRef}>
            {/* Selected branch display / search input */}
            <input
              ref={searchInputRef}
              type="text"
              value={dropdownOpen ? branchSearch : branchName}
              onChange={(e) => {
                setBranchSearch(e.target.value)
                if (!dropdownOpen) setDropdownOpen(true)
              }}
              onFocus={() => {
                setDropdownOpen(true)
                setBranchSearch('')
                if (!branches.length && !branchesLoading) fetchBranches()
              }}
              placeholder={branchesLoading ? 'Loading branches...' : 'Search branches...'}
              autoComplete="off"
              spellCheck={false}
              className={`${inputBase} border-slate-300 dark:border-white/[0.08] pr-8`}
            />
            {/* Dropdown chevron */}
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                setDropdownOpen(!dropdownOpen)
                if (!dropdownOpen) {
                  setBranchSearch('')
                  searchInputRef.current?.focus()
                  if (!branches.length && !branchesLoading) fetchBranches()
                }
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={dropdownOpen ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
              </svg>
            </button>

            {/* Dropdown list */}
            {dropdownOpen && (
              <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-800 shadow-lg">
                {branchesLoading ? (
                  <div className="px-3 py-2 text-xs text-slate-400">Loading...</div>
                ) : filteredBranches.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-400">No branches found</div>
                ) : (
                  filteredBranches.map((b) => (
                    <button
                      key={b.name}
                      type="button"
                      onClick={() => handleSelectBranch(b)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-500/10 flex items-center gap-2 ${
                        b.name === branchName ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="font-mono truncate flex-1">{b.name}</span>
                      <span className="text-[10px] font-medium shrink-0">
                        {b.isLocal && b.isRemote ? (
                          <span className="text-emerald-600 dark:text-emerald-400">local+remote</span>
                        ) : b.isLocal ? (
                          <span className="text-blue-600 dark:text-blue-400">local</span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">remote</span>
                        )}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {branchName && (
            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
              Selected: <span className="font-mono">{branchName}</span>
            </p>
          )}
        </div>
      )}

      {/* PR picker — pr mode */}
      {branchMode === 'pr' && (
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
            Pull Request <span className="text-red-400">*</span>
          </label>
          <div className="relative" ref={prDropdownRef}>
            <input
              ref={prSearchInputRef}
              type="text"
              value={prDropdownOpen ? prSearch : (selectedPr ? `#${selectedPr.number} · ${selectedPr.title}` : '')}
              onChange={(e) => {
                setPrSearch(e.target.value)
                if (!prDropdownOpen) setPrDropdownOpen(true)
              }}
              onFocus={() => {
                setPrDropdownOpen(true)
                setPrSearch('')
                if (!prs.length && !prsLoading) fetchPRs()
              }}
              placeholder={prsLoading ? 'Loading PRs...' : 'Search PRs by title, number, or branch...'}
              autoComplete="off"
              spellCheck={false}
              className={`${inputBase} border-slate-300 dark:border-white/[0.08] pr-8`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                setPrDropdownOpen(!prDropdownOpen)
                if (!prDropdownOpen) {
                  setPrSearch('')
                  prSearchInputRef.current?.focus()
                  if (!prs.length && !prsLoading) fetchPRs()
                }
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={prDropdownOpen ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
              </svg>
            </button>

            {prDropdownOpen && (
              <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-800 shadow-lg">
                {prsLoading ? (
                  <div className="px-3 py-2 text-xs text-slate-400">Loading...</div>
                ) : filteredPRs.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-400">No PRs found</div>
                ) : (
                  filteredPRs.map((pr) => (
                    <button
                      key={pr.number}
                      type="button"
                      onClick={() => handleSelectPR(pr)}
                      className={`w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 ${
                        selectedPr?.number === pr.number ? 'bg-indigo-50 dark:bg-indigo-500/10' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-400 shrink-0">#{pr.number}</span>
                        <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{pr.title}</span>
                        {pr.isDraft && (
                          <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 shrink-0">draft</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate">{pr.branchName}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">by {pr.author}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {selectedPr && (
            <div className="mt-1 flex items-center gap-2">
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Branch: <span className="font-mono">{selectedPr.branchName}</span>
              </p>
              <button
                type="button"
                onClick={() => {
                  const api = window.agentForge
                  if (api) api.openExternal(selectedPr.url)
                }}
                className="text-[10px] text-indigo-500 dark:text-indigo-400 hover:underline"
              >
                View on GitHub
              </button>
            </div>
          )}
        </div>
      )}

      {/* Copy .env option — only when repo has a .env */}
      {hasRootEnvFile && (
        <label className="flex items-center gap-2 cursor-pointer pt-1" htmlFor={`copy-env-${draftId}`}>
          <input
            id={`copy-env-${draftId}`}
            type="checkbox"
            checked={copyEnv}
            onChange={(e) => setCopyEnv(e.target.checked)}
            className="rounded border-slate-300 dark:border-white/20 text-indigo-500 focus:ring-indigo-500/30"
          />
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Copy .env to worktree</span>
        </label>
      )}

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
