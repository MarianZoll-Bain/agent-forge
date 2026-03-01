/**
 * Settings panel.
 * Appearance, tool toggles, general settings, Ollama config, and danger zone.
 */

import { useState, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { ToolToggle } from './ToolToggle'
import type { Settings } from '@shared/types'

const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434'

interface SettingsPanelProps {
  onClose: () => void
  onOpenOnboarding: () => void
}

export function SettingsPanel({ onClose, onOpenOnboarding }: SettingsPanelProps) {
  const { state, setState, refreshState } = useAppStore()
  const darkMode = useAppStore((s) => s.state?.settings.darkMode)
  const [baseBranch, setBaseBranch] = useState(state?.settings.baseBranch ?? 'main')
  const [worktreesDirName, setWorktreesDirName] = useState(
    state?.settings.worktreesDirName ?? '.worktrees',
  )
  const [ollamaModel, setOllamaModel] = useState(state?.settings.ollamaModel ?? '')
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState(
    state?.settings.ollamaBaseUrl ?? DEFAULT_OLLAMA_BASE_URL,
  )
  const [enableCursor, setEnableCursor] = useState(state?.settings.enableCursor ?? false)
  const [enableClaude, setEnableClaude] = useState(state?.settings.enableClaude ?? false)
  const [enableClaudeOllama, setEnableClaudeOllama] = useState(state?.settings.enableClaudeOllama ?? false)
  const [enableGitMode, setEnableGitMode] = useState(state?.settings.enableGitMode ?? false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    setBaseBranch(state?.settings.baseBranch ?? 'main')
    setWorktreesDirName(state?.settings.worktreesDirName ?? '.worktrees')
    setOllamaModel(state?.settings.ollamaModel ?? '')
    setOllamaBaseUrl(state?.settings.ollamaBaseUrl ?? DEFAULT_OLLAMA_BASE_URL)
    setEnableCursor(state?.settings.enableCursor ?? false)
    setEnableClaude(state?.settings.enableClaude ?? false)
    setEnableClaudeOllama(state?.settings.enableClaudeOllama ?? false)
    setEnableGitMode(state?.settings.enableGitMode ?? false)
  }, [state?.settings])

  async function handleSave() {
    const api = window.agentForge
    if (!api) {
      setSaveError('App API not available')
      return
    }
    setValidationError(null)
    if (!baseBranch.trim()) {
      setValidationError('Base branch cannot be empty')
      return
    }
    if (!worktreesDirName.trim() || /[/\\:*?"<>|]/.test(worktreesDirName)) {
      setValidationError('Worktrees directory name contains invalid characters')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const updatedSettings: Partial<Settings> = {
        baseBranch: baseBranch.trim(),
        worktreesDirName: worktreesDirName.trim(),
        ollamaModel: ollamaModel.trim() || undefined,
        ollamaBaseUrl: ollamaBaseUrl.trim() || DEFAULT_OLLAMA_BASE_URL,
        enableCursor,
        enableClaude,
        enableClaudeOllama,
        enableGitMode,
      }
      const result = await api.updateSettings({ settings: updatedSettings })
      if (!result.ok) {
        setSaveError(result.message)
        return
      }
      setState(result.state)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    const api = window.agentForge
    if (!api) return
    setResetting(true)
    try {
      const result = await api.resetApp()
      if (result.ok) {
        await refreshState()
        onClose()
      }
    } finally {
      setResetting(false)
      setShowResetConfirm(false)
    }
  }

  const appearanceValue: 'light' | 'system' | 'dark' =
    darkMode === true ? 'dark' : darkMode === false ? 'light' : 'system'

  function handleAppearanceChange(value: 'light' | 'system' | 'dark') {
    const api = window.agentForge
    if (!api) return
    const next = value === 'dark' ? true : value === 'light' ? false : undefined
    api.updateSettings({ settings: { darkMode: next } }).then((result) => {
      if (result.ok) {
        setState(result.state)
      }
    })
    // Apply immediately
    const resolved = next === true ? 'dark' : next === false ? 'light' :
      (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    if (resolved === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    if (next === true) {
      localStorage.setItem('agentforge-theme', 'dark')
    } else if (next === false) {
      localStorage.setItem('agentforge-theme', 'light')
    } else {
      localStorage.removeItem('agentforge-theme')
    }
  }

  const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] dark:text-slate-100 focus-ring font-mono'

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="absolute inset-0 bg-black/20 dark:bg-black/50 animate-fade-in" onClick={onClose} />

      <div className="relative w-80 h-full glass-heavy border-l border-slate-200/60 dark:border-white/[0.06] shadow-elevated flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200/60 dark:border-white/[0.06] shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 dark:text-white text-lg">Settings</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close settings"
              className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-7">
          {/* Appearance */}
          <section>
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Appearance
            </h3>
            <div className="flex rounded-xl border border-slate-200/80 dark:border-white/[0.08] overflow-hidden">
              {(['light', 'system', 'dark'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleAppearanceChange(opt)}
                  className={`flex-1 px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                    appearanceValue === opt
                      ? 'bg-indigo-500 text-white shadow-sm'
                      : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-700'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </section>

          {/* Tools */}
          <section>
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Tools
            </h3>
            <div className="flex flex-col">
              <ToolToggle tool="cursor" label="Cursor" enabled={enableCursor} onToggle={setEnableCursor} />
              <ToolToggle tool="claude" label="Claude CLI" enabled={enableClaude} onToggle={setEnableClaude} />
              <ToolToggle tool="claude-ollama" label="Claude + Ollama" enabled={enableClaudeOllama} onToggle={setEnableClaudeOllama} />
              <div className="border-t border-slate-200/60 dark:border-white/[0.06] mt-1 pt-1">
                <ToolToggle tool="gh" label="Git Mode (GitHub CLI)" enabled={enableGitMode} onToggle={setEnableGitMode} />
              </div>
            </div>
          </section>

          {/* General */}
          <section>
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              General
            </h3>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5" htmlFor="base-branch">
                  Default base branch
                </label>
                <input id="base-branch" type="text" value={baseBranch} onChange={(e) => setBaseBranch(e.target.value)} placeholder="main" autoComplete="off" spellCheck={false} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5" htmlFor="worktrees-dir">
                  Worktrees directory
                </label>
                <input id="worktrees-dir" type="text" value={worktreesDirName} onChange={(e) => setWorktreesDirName(e.target.value)} placeholder=".worktrees" autoComplete="off" spellCheck={false} className={inputClass} />
              </div>
            </div>
          </section>

          {/* Ollama */}
          {enableClaudeOllama && (
            <section>
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Ollama
              </h3>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5" htmlFor="ollama-base-url">Server URL</label>
                  <input id="ollama-base-url" type="text" value={ollamaBaseUrl} onChange={(e) => setOllamaBaseUrl(e.target.value)} placeholder={DEFAULT_OLLAMA_BASE_URL} autoComplete="off" spellCheck={false} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5" htmlFor="ollama-model">Default Model</label>
                  <input id="ollama-model" type="text" value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} placeholder="e.g. qwen3-coder" autoComplete="off" spellCheck={false} className={inputClass} />
                </div>
              </div>
            </section>
          )}

          {/* Danger Zone */}
          <section>
            <h3 className="text-xs font-bold text-red-500 dark:text-red-400 uppercase tracking-wider mb-3">
              Danger Zone
            </h3>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onOpenOnboarding}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] text-left font-medium"
              >
                Run Setup Wizard
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-left font-semibold"
              >
                Reset App
              </button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200/60 dark:border-white/[0.06] shrink-0 flex flex-col gap-2">
          {(validationError || saveError) && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2">
              {validationError ?? saveError}
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 font-medium">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50 shadow-sm shadow-indigo-500/25"
            >
              {saved ? 'Saved!' : saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Reset confirmation */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 dark:bg-black/60 animate-fade-in" onClick={() => !resetting && setShowResetConfirm(false)} />
          <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-elevated border border-slate-200/80 dark:border-white/[0.08] max-w-sm mx-4 p-6 animate-scale-in">
            <h3 className="font-bold text-slate-900 dark:text-white mb-2">Reset App</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">
              This will clear all settings and agent data. Worktrees on disk will not be deleted.
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowResetConfirm(false)} disabled={resetting} className="px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 font-medium disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={handleReset} disabled={resetting} className="px-4 py-2 text-sm rounded-xl bg-red-600 dark:bg-red-500 text-white font-semibold hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50">
                {resetting ? 'Resetting...' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
