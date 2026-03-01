/**
 * Prompts management panel — wide slide-out with prompt list + editor.
 * Reads/writes prompt files directly to Cursor (.mdc) and Claude CLI (.md) native paths.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { PromptTool, PromptScope, PromptEntry } from '@shared/types'

interface PromptsPanelProps {
  onClose: () => void
}

// ---- Grouping logic ----

interface PromptGroup {
  key: string
  baseName: string
  scope: PromptScope
  tools: PromptTool[]
  primary: PromptEntry
  entries: Partial<Record<PromptTool, PromptEntry>>
}

function groupPrompts(prompts: PromptEntry[]): PromptGroup[] {
  const map = new Map<string, PromptGroup>()
  for (const p of prompts) {
    const baseName = p.fileName.replace(/\.(mdc|md)$/, '')
    const key = `${baseName}:${p.scope}`
    const existing = map.get(key)
    if (existing) {
      existing.tools.push(p.tool)
      existing.entries[p.tool] = p
    } else {
      map.set(key, { key, baseName, scope: p.scope, tools: [p.tool], primary: p, entries: { [p.tool]: p } })
    }
  }
  return Array.from(map.values())
}

function isGroupSelected(group: PromptGroup, selectedId: string | null): boolean {
  if (!selectedId) return false
  return Object.values(group.entries).some((e) => e?.id === selectedId)
}

// ---- Sidebar delete confirmation ----

function SidebarDeleteDialog({
  groupName,
  onConfirm,
  onCancel,
}: {
  groupName: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleConfirm() {
    setDeleting(true)
    await onConfirm()
    setDeleting(false)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/60 animate-fade-in" onClick={onCancel} />
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-elevated border border-slate-200/80 dark:border-white/[0.08] max-w-xs mx-4 p-5 animate-scale-in">
        <h3 className="font-bold text-slate-900 dark:text-white mb-2 text-sm">Delete prompt</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Delete <span className="font-semibold text-slate-900 dark:text-white">{groupName}</span> and all its tool variants? This removes files from disk.
        </p>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} disabled={deleting} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 font-medium disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} disabled={deleting} className="px-3 py-1.5 text-xs rounded-lg bg-red-600 dark:bg-red-500 text-white font-semibold hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50">
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Main panel ----

export function PromptsPanel({ onClose }: PromptsPanelProps) {
  const {
    prompts,
    promptsLoading,
    selectedPromptId,
    loadPrompts,
    selectPrompt,
    addPromptToList,
    updatePromptInList,
    removePromptFromList,
    hasRepo,
    addToast,
  } = useAppStore()

  const [toolFilter, setToolFilter] = useState<'all' | PromptTool>('all')
  const [creatingNew, setCreatingNew] = useState(false)
  const [deleteGroupKey, setDeleteGroupKey] = useState<string | null>(null)

  useEffect(() => {
    loadPrompts()
  }, [loadPrompts])

  const selectedPrompt = prompts.find((p) => p.id === selectedPromptId) ?? null
  const filtered = toolFilter === 'all' ? prompts : prompts.filter((p) => p.tool === toolFilter)
  const groups = useMemo(() => groupPrompts(filtered), [filtered])
  const globalGroups = groups.filter((g) => g.scope === 'global')
  const projectGroups = groups.filter((g) => g.scope === 'project')

  const groupToDelete = deleteGroupKey ? groups.find((g) => g.key === deleteGroupKey) : null

  function handleCreated(prompt: PromptEntry) {
    addPromptToList(prompt)
    setCreatingNew(false)
  }

  function handleGroupSelect(group: PromptGroup) {
    selectPrompt(group.primary.id)
  }

  async function handleDeleteGroup() {
    if (!groupToDelete) return
    const api = window.agentForge
    if (!api) return
    // Delete all entries in the group
    for (const entry of Object.values(groupToDelete.entries)) {
      if (!entry) continue
      try {
        const result = await api.deletePrompt({ tool: entry.tool, scope: entry.scope, fileName: entry.fileName })
        if (result.ok) {
          removePromptFromList(entry.id)
        } else {
          addToast(`Failed to delete ${entry.fileName}: ${result.message}`, 'error')
        }
      } catch (e) {
        addToast(e instanceof Error ? e.message : 'Delete failed', 'error')
      }
    }
    addToast(`Deleted ${groupToDelete.baseName}`, 'info')
    setDeleteGroupKey(null)
  }

  const isEmpty = prompts.length === 0 && !promptsLoading

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-black/20 dark:bg-black/50 animate-fade-in" onClick={onClose} />

      <div className="relative w-[56rem] max-w-[90vw] h-full glass-heavy border-l border-slate-200/60 dark:border-white/[0.06] shadow-elevated flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200/60 dark:border-white/[0.06] shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 dark:text-white text-lg">Prompts</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close prompts"
              className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Manage instruction files for Cursor (.mdc) and Claude CLI (.md).
          </p>
        </div>

        {/* Body: sidebar + editor */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar */}
          <div className="w-60 shrink-0 border-r border-slate-200/60 dark:border-white/[0.06] flex flex-col overflow-hidden">
            {/* Tool filter tabs */}
            <div className="flex gap-1 px-3 py-2.5 border-b border-slate-100 dark:border-white/[0.04]">
              {(['all', 'cursor', 'claude'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setToolFilter(t)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-semibold capitalize transition-colors ${
                    toolFilter === t
                      ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/25'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Prompt list */}
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {promptsLoading ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 px-2 py-4 text-center">Loading...</p>
              ) : (
                <>
                  {creatingNew && (
                    <NewPromptForm hasRepo={hasRepo()} onCreated={handleCreated} onCancel={() => setCreatingNew(false)} />
                  )}
                  {isEmpty && !creatingNew && <SampleSuggestions onCreate={() => setCreatingNew(true)} />}

                  <SectionHeader label="Global" />
                  {globalGroups.length === 0 && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 px-2 py-1">No global prompts</p>
                  )}
                  {globalGroups.map((g) => (
                    <PromptGroupItem
                      key={g.key}
                      group={g}
                      selected={isGroupSelected(g, selectedPromptId)}
                      onSelect={() => handleGroupSelect(g)}
                      onDelete={() => setDeleteGroupKey(g.key)}
                    />
                  ))}

                  <SectionHeader label="Project" />
                  {!hasRepo() ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 px-2 py-1 italic">No repo selected</p>
                  ) : projectGroups.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 px-2 py-1">No project prompts</p>
                  ) : (
                    projectGroups.map((g) => (
                      <PromptGroupItem
                        key={g.key}
                        group={g}
                        selected={isGroupSelected(g, selectedPromptId)}
                        onSelect={() => handleGroupSelect(g)}
                        onDelete={() => setDeleteGroupKey(g.key)}
                      />
                    ))
                  )}
                </>
              )}
            </div>

            <div className="px-3 py-2.5 border-t border-slate-100 dark:border-white/[0.04] shrink-0">
              <button
                type="button"
                onClick={() => setCreatingNew(true)}
                disabled={creatingNew}
                className="w-full px-3 py-2 text-sm rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 shadow-sm shadow-indigo-500/25"
              >
                + New Prompt
              </button>
            </div>
          </div>

          {/* Right: editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedPrompt ? (
              <PromptEditor
                prompt={selectedPrompt}
                hasRepo={hasRepo()}
                onUpdated={updatePromptInList}
                onDeleted={removePromptFromList}
                onScopeChanged={(oldId, newPrompt) => {
                  removePromptFromList(oldId)
                  addPromptToList(newPrompt)
                }}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-slate-600">
                Select a prompt or create a new one
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar delete confirmation */}
      {groupToDelete && (
        <SidebarDeleteDialog
          groupName={groupToDelete.baseName}
          onConfirm={handleDeleteGroup}
          onCancel={() => setDeleteGroupKey(null)}
        />
      )}
    </div>
  )
}

// ---- Sub-components ----

function SectionHeader({ label }: { label: string }) {
  return (
    <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest px-2 pt-3 pb-1">
      {label}
    </h4>
  )
}

function PromptGroupItem({
  group,
  selected,
  onSelect,
  onDelete,
}: {
  group: PromptGroup
  selected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const hasAllTools = group.tools.length === 2
  return (
    <div className={`group/item flex items-center rounded-lg transition-colors ${
      selected
        ? 'bg-indigo-50 dark:bg-indigo-500/10 border-l-2 border-indigo-500'
        : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
    }`}>
      <button
        type="button"
        onClick={onSelect}
        className={`flex-1 text-left px-2 py-1.5 text-sm flex items-center gap-1.5 min-w-0 ${
          selected ? 'pl-1.5 font-medium text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'
        }`}
      >
        <span className="truncate flex-1">{group.baseName}</span>
        {hasAllTools ? (
          <>
            <ToolPill tool="cursor" />
            <ToolPill tool="claude" />
          </>
        ) : (
          <ToolPill tool={group.tools[0]} />
        )}
      </button>
      {/* Delete button — appears on hover */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        title="Delete prompt"
        aria-label="Delete prompt"
        className="shrink-0 p-1 mr-1 rounded opacity-0 group-hover/item:opacity-100 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  )
}

function ToolPill({ tool }: { tool: PromptTool }) {
  const styles = tool === 'cursor'
    ? 'bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-400'
    : 'bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400'
  return (
    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${styles}`}>
      {tool}
    </span>
  )
}

// ---- Sample suggestions ----

function SampleSuggestions({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="px-2 py-3 flex flex-col gap-2.5">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Prompts guide how AI tools behave in your codebase. Try creating one:
      </p>
      <div className="flex flex-col gap-1.5">
        <SampleCard name="code-review" description="Review code for bugs, security issues, and style" />
        <SampleCard name="commit-message" description="Generate conventional-commit messages" />
        <SampleCard name="refactor-guide" description="Apply project conventions when refactoring" />
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="self-start text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 underline underline-offset-2"
      >
        Create your first prompt
      </button>
    </div>
  )
}

function SampleCard({ name, description }: { name: string; description: string }) {
  return (
    <div className="px-3 py-2 rounded-lg border border-dashed border-slate-200 dark:border-white/[0.06] bg-slate-50/60 dark:bg-white/[0.02]">
      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">{name}</span>
      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug">{description}</p>
    </div>
  )
}

// ---- Tool badge for multi-select ----

const TOOL_STYLES: Record<PromptTool, { active: string; inactive: string; label: string; tooltip: string }> = {
  cursor: {
    active: 'bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-300 dark:border-violet-500/30',
    inactive: 'bg-violet-50/50 dark:bg-violet-500/5 text-violet-300 dark:text-violet-600 border-violet-200/60 dark:border-violet-500/10',
    label: 'Cursor',
    tooltip: 'Cursor IDE (.mdc files)',
  },
  claude: {
    active: 'bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-500/30',
    inactive: 'bg-orange-50/50 dark:bg-orange-500/5 text-orange-300 dark:text-orange-600 border-orange-200/60 dark:border-orange-500/10',
    label: 'Claude',
    tooltip: 'Claude CLI (.md files)',
  },
}

function ToolBadge({ tool, selected, onClick, disabled }: { tool: PromptTool; selected: boolean; onClick: () => void; disabled?: boolean }) {
  const style = TOOL_STYLES[tool]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={style.tooltip}
      className={`px-2 py-0.5 text-xs rounded border font-semibold transition-colors ${
        selected ? style.active : style.inactive
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:opacity-80'}`}
    >
      {style.label}
    </button>
  )
}

// ---- New prompt form ----

function NewPromptForm({ hasRepo, onCreated, onCancel }: { hasRepo: boolean; onCreated: (prompt: PromptEntry) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [tools, setTools] = useState<Set<PromptTool>>(new Set(['cursor']))
  const [scope, setScope] = useState<PromptScope>('global')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleTool(tool: PromptTool) {
    setTools((prev) => {
      const next = new Set(prev)
      if (next.has(tool)) { if (next.size > 1) next.delete(tool) } else { next.add(tool) }
      return next
    })
  }

  async function handleCreate() {
    if (!name.trim()) { setError('Name is required'); return }
    const api = window.agentForge
    if (!api) return
    setCreating(true)
    setError(null)
    try {
      const toolList = Array.from(tools)
      let lastPrompt: PromptEntry | null = null
      for (const tool of toolList) {
        const result = await api.savePrompt({ tool, scope, fileName: name.trim(), content: '' })
        if (!result.ok) { setError(result.message); return }
        lastPrompt = result.prompt
        if (tool !== toolList[toolList.length - 1]) {
          useAppStore.getState().addPromptToList(result.prompt)
        }
      }
      if (lastPrompt) onCreated(lastPrompt)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create prompt')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mb-3 p-3 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] flex flex-col gap-2.5 animate-scale-in">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Prompt name"
        autoFocus
        autoComplete="off"
        spellCheck={false}
        className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] dark:text-slate-100 focus-ring"
      />
      <div className="flex gap-2">
        <fieldset className="flex gap-1">
          <ToolBadge tool="cursor" selected={tools.has('cursor')} onClick={() => toggleTool('cursor')} />
          <ToolBadge tool="claude" selected={tools.has('claude')} onClick={() => toggleTool('claude')} />
        </fieldset>
        <fieldset className="flex gap-1">
          {(['global', 'project'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              disabled={s === 'project' && !hasRepo}
              className={`px-2 py-0.5 text-xs rounded font-semibold capitalize ${
                scope === s
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-slate-400'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {s}
            </button>
          ))}
        </fieldset>
      </div>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-2 py-1">{error}</p>
      )}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-700 font-medium">
          Cancel
        </button>
        <button type="button" onClick={handleCreate} disabled={creating} className="px-2.5 py-1 text-xs rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50">
          {creating ? 'Creating...' : 'Create'}
        </button>
      </div>
    </div>
  )
}

// ---- Prompt editor ----

function PromptEditor({ prompt, hasRepo, onUpdated, onDeleted, onScopeChanged }: {
  prompt: PromptEntry; hasRepo: boolean; onUpdated: (prompt: PromptEntry) => void; onDeleted: (id: string) => void; onScopeChanged: (oldId: string, newPrompt: PromptEntry) => void
}) {
  const { addToast, addPromptToList, prompts } = useAppStore()
  const [content, setContent] = useState(prompt.content)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [scopeError, setScopeError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const prevIdRef = useRef(prompt.id)

  const baseName = prompt.fileName.replace(/\.(mdc|md)$/, '')
  const otherTool: PromptTool = prompt.tool === 'cursor' ? 'claude' : 'cursor'
  const hasOtherTool = prompts.some(
    (p) => p.tool === otherTool && p.scope === prompt.scope && p.fileName.replace(/\.(mdc|md)$/, '') === baseName,
  )

  useEffect(() => {
    if (prevIdRef.current !== prompt.id) {
      setContent(prompt.content)
      setDirty(false)
      setError(null)
      setScopeError(null)
      setSaved(false)
      prevIdRef.current = prompt.id
    }
  }, [prompt.id, prompt.content])

  useEffect(() => {
    if (!dirty) setContent(prompt.content)
  }, [prompt.content, dirty])

  function handleContentChange(value: string) {
    setContent(value)
    setDirty(true)
    setSaved(false)
  }

  const handleSave = useCallback(async () => {
    const api = window.agentForge
    if (!api) return
    setSaving(true)
    setError(null)
    try {
      const result = await api.savePrompt({ tool: prompt.tool, scope: prompt.scope, fileName: prompt.fileName, content })
      if (!result.ok) { setError(result.message); return }
      onUpdated(result.prompt)
      setDirty(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }, [prompt, content, onUpdated])

  async function handleDelete() {
    const api = window.agentForge
    if (!api) return
    try {
      const result = await api.deletePrompt({ tool: prompt.tool, scope: prompt.scope, fileName: prompt.fileName })
      if (!result.ok) { addToast(result.message, 'error'); return }
      onDeleted(prompt.id)
      setShowDeleteConfirm(false)
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to delete', 'error')
    }
  }

  async function handleChangeScope() {
    const api = window.agentForge
    if (!api) return
    setScopeError(null)
    try {
      const result = await api.changePromptScope({ tool: prompt.tool, currentScope: prompt.scope, fileName: prompt.fileName })
      if (!result.ok) { setScopeError(result.message); return }
      onScopeChanged(prompt.id, result.prompt)
    } catch (e) {
      setScopeError(e instanceof Error ? e.message : 'Failed to change scope')
    }
  }

  async function handleToggleOtherTool() {
    const api = window.agentForge
    if (!api) return
    setSyncing(true)
    try {
      if (hasOtherTool) {
        const otherPrompt = prompts.find(
          (p) => p.tool === otherTool && p.scope === prompt.scope && p.fileName.replace(/\.(mdc|md)$/, '') === baseName,
        )
        if (otherPrompt) {
          const result = await api.deletePrompt({ tool: otherPrompt.tool, scope: otherPrompt.scope, fileName: otherPrompt.fileName })
          if (result.ok) {
            useAppStore.getState().removePromptFromList(otherPrompt.id)
            addToast(`Removed ${otherTool} copy`, 'info')
          } else { addToast(result.message, 'error') }
        }
      } else {
        const result = await api.savePrompt({ tool: otherTool, scope: prompt.scope, fileName: baseName, content: dirty ? content : prompt.content })
        if (result.ok) {
          addPromptToList(result.prompt)
          addToast(`Created ${otherTool} copy`, 'success')
        } else { addToast(result.message, 'error') }
      }
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const canToggleScope = prompt.scope === 'project' || hasRepo
  const targetScope = prompt.scope === 'global' ? 'project' : 'global'
  const nameWithoutExt = prompt.fileName.replace(/\.(mdc|md)$/, '')

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200/60 dark:border-white/[0.06] shrink-0">
        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">{nameWithoutExt}</span>
        <div className="flex gap-1">
          <ToolBadge tool={prompt.tool} selected={true} onClick={() => {}} disabled={true} />
          <ToolBadge tool={otherTool} selected={hasOtherTool} onClick={handleToggleOtherTool} disabled={syncing} />
        </div>
        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 capitalize">
          {prompt.scope}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleChangeScope}
            disabled={!canToggleScope}
            className="shrink-0 px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            {targetScope}
          </button>
        </div>
      </div>

      {scopeError && (
        <div className="px-4 py-1.5">
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-1.5">{scopeError}</p>
        </div>
      )}

      {/* Textarea */}
      <div className="flex-1 overflow-hidden p-4">
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          spellCheck={false}
          className="w-full h-full resize-none font-mono text-sm px-4 py-3 rounded-xl border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] dark:text-slate-100 focus-ring"
          placeholder="Enter prompt content..."
        />
      </div>

      {/* Bottom bar */}
      <div className="px-4 py-3 border-t border-slate-200/60 dark:border-white/[0.06] shrink-0 flex items-center gap-2">
        <span className="text-xs text-slate-400 dark:text-slate-500 flex-1 truncate">
          {dirty ? 'Unsaved changes' : saved ? 'Saved' : prompt.filePath}
        </span>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <button type="button" onClick={() => setShowDeleteConfirm(true)} className="px-3 py-1.5 text-sm rounded-xl border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 font-medium">
          Delete
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="px-4 py-1.5 text-sm rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 shadow-sm shadow-indigo-500/25"
        >
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {showDeleteConfirm && (
        <DeleteConfirmDialog fileName={prompt.fileName} onConfirm={handleDelete} onCancel={() => setShowDeleteConfirm(false)} />
      )}
    </div>
  )
}

// ---- Delete confirmation dialog ----

function DeleteConfirmDialog({ fileName, onConfirm, onCancel }: { fileName: string; onConfirm: () => void; onCancel: () => void }) {
  const [deleting, setDeleting] = useState(false)

  async function handleConfirm() {
    setDeleting(true)
    await onConfirm()
    setDeleting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/60 animate-fade-in" onClick={onCancel} />
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-elevated border border-slate-200/80 dark:border-white/[0.08] max-w-sm mx-4 p-6 animate-scale-in">
        <h3 className="font-bold text-slate-900 dark:text-white mb-2">Delete prompt</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Delete <span className="font-semibold text-slate-900 dark:text-white">{fileName}</span>? This removes the file from disk.
        </p>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} disabled={deleting} className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 font-medium disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} disabled={deleting} className="px-4 py-2 text-sm rounded-xl bg-red-600 dark:bg-red-500 text-white font-semibold hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50">
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
