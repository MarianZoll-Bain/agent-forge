/**
 * App state store (Zustand). Single source of truth for renderer.
 * Simplified: no agent logs, terminal buffers, providers, reviews, or quick actions.
 */

import { create } from 'zustand'
import type { AppState, PromptEntry } from '@shared/types'
import type { AgentGitStatusResult, AgentPRStatusResult } from '@shared/ipc-channels'

/** Toast auto-dismiss delay in ms. */
const TOAST_AUTO_DISMISS_MS = 4_000

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
}

/** A draft agent exists only in the renderer until the user clicks "Initialize". */
export interface DraftAgent {
  id: string
}

interface AppStoreState {
  state: AppState | null
  loadError: string | null
  draftAgents: DraftAgent[]
  /** Git status per agentId (renderer-only, from polling). */
  agentGitStatuses: Record<string, AgentGitStatusResult>
  /** PR status per agentId (renderer-only, on-demand). */
  agentPRStatuses: Record<string, AgentPRStatusResult>
  /** Active toast notifications. */
  toasts: Toast[]
  /** Prompt entries loaded from disk. */
  prompts: PromptEntry[]
  promptsLoading: boolean
  selectedPromptId: string | null
  /** Whether to show the onboarding wizard (re-trigger from settings). */
  showOnboarding: boolean
  /** Resolved theme after considering system preference. */
  resolvedTheme: 'light' | 'dark'

  setState: (state: AppState) => void
  setLoadError: (error: string | null) => void
  setShowOnboarding: (show: boolean) => void
  refreshState: () => Promise<void>
  /** Show a toast notification; auto-dismissed after 4 s. */
  addToast: (message: string, type: ToastType) => void
  /** Remove a toast by ID. */
  removeToast: (id: string) => void

  addDraftAgent: () => string
  removeDraftAgent: (id: string) => void

  /** Update git status for an agent (from polling). */
  setAgentGitStatus: (agentId: string, status: AgentGitStatusResult) => void
  /** Update PR status for an agent. */
  setAgentPRStatus: (agentId: string, status: AgentPRStatusResult) => void

  /** Load all prompts from disk via IPC. */
  loadPrompts: () => Promise<void>
  selectPrompt: (id: string | null) => void
  updatePromptInList: (prompt: PromptEntry) => void
  removePromptFromList: (id: string) => void
  addPromptToList: (prompt: PromptEntry) => void

  /** Apply theme based on settings.darkMode + system preference. */
  applyTheme: () => void
  /** Cycle dark mode: undefined→true→false→undefined (system→dark→light→system). */
  toggleDarkMode: () => void

  hasRepo: () => boolean
  repoName: () => string
  repoPath: () => string
}

/** Resolve the effective theme from a darkMode setting value. */
function resolveTheme(darkMode: boolean | undefined): 'light' | 'dark' {
  if (darkMode === true) return 'dark'
  if (darkMode === false) return 'light'
  // undefined = system preference
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Apply the resolved theme to the DOM and localStorage. */
function applyThemeToDOM(theme: 'light' | 'dark', darkMode: boolean | undefined): void {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  // Store for theme-init.js flash prevention
  if (darkMode === true) {
    localStorage.setItem('agentforge-theme', 'dark')
  } else if (darkMode === false) {
    localStorage.setItem('agentforge-theme', 'light')
  } else {
    localStorage.removeItem('agentforge-theme')
  }
}

export const useAppStore = create<AppStoreState>((set, get) => ({
  state: null,
  loadError: null,
  draftAgents: [],
  agentGitStatuses: {},
  agentPRStatuses: {},
  toasts: [],
  prompts: [],
  promptsLoading: false,
  selectedPromptId: null,
  showOnboarding: false,
  resolvedTheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',

  setState: (state) => {
    set({ state, loadError: null })
    // Keep theme in sync whenever state is set
    const darkMode = state.settings.darkMode
    const resolved = resolveTheme(darkMode)
    applyThemeToDOM(resolved, darkMode)
    set({ resolvedTheme: resolved })
  },
  setLoadError: (loadError) => set({ loadError }),
  setShowOnboarding: (showOnboarding) => set({ showOnboarding }),

  addToast: (message, type) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, TOAST_AUTO_DISMISS_MS)
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  refreshState: async () => {
    const api = window.agentForge
    if (!api) return
    try {
      const { state } = await api.getState()
      set({ state, loadError: null })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to refresh state'
      set({ loadError: msg })
    }
  },

  addDraftAgent: () => {
    const id = crypto.randomUUID()
    set((s) => ({ draftAgents: [...s.draftAgents, { id }] }))
    return id
  },

  removeDraftAgent: (id: string) => {
    set((s) => ({ draftAgents: s.draftAgents.filter((d) => d.id !== id) }))
  },

  setAgentGitStatus: (agentId: string, status: AgentGitStatusResult) => {
    set((s) => ({ agentGitStatuses: { ...s.agentGitStatuses, [agentId]: status } }))
  },

  setAgentPRStatus: (agentId: string, status: AgentPRStatusResult) => {
    set((s) => ({ agentPRStatuses: { ...s.agentPRStatuses, [agentId]: status } }))
  },

  loadPrompts: async () => {
    const api = window.agentForge
    if (!api) return
    set({ promptsLoading: true })
    try {
      const result = await api.listPrompts()
      if (result.ok) {
        set({ prompts: result.prompts, promptsLoading: false })
      } else {
        set({ promptsLoading: false })
      }
    } catch {
      set({ promptsLoading: false })
    }
  },

  selectPrompt: (id) => set({ selectedPromptId: id }),

  updatePromptInList: (prompt) =>
    set((s) => ({
      prompts: s.prompts.map((p) => (p.id === prompt.id ? prompt : p)),
    })),

  removePromptFromList: (id) =>
    set((s) => ({
      prompts: s.prompts.filter((p) => p.id !== id),
      selectedPromptId: s.selectedPromptId === id ? null : s.selectedPromptId,
    })),

  addPromptToList: (prompt) =>
    set((s) => ({
      prompts: [...s.prompts, prompt],
      selectedPromptId: prompt.id,
    })),

  applyTheme: () => {
    const darkMode = get().state?.settings.darkMode
    const resolved = resolveTheme(darkMode)
    applyThemeToDOM(resolved, darkMode)
    set({ resolvedTheme: resolved })
  },

  toggleDarkMode: () => {
    const current = get().state?.settings.darkMode
    // Cycle: undefined (system) → true (dark) → false (light) → undefined (system)
    let next: boolean | undefined
    if (current === undefined || current === null) {
      next = true
    } else if (current === true) {
      next = false
    } else {
      next = undefined
    }
    // Persist via IPC
    const api = window.agentForge
    if (api) {
      api.updateSettings({ settings: { darkMode: next } }).then((result) => {
        if (result.ok) {
          set({ state: result.state, loadError: null })
          const resolved = resolveTheme(next)
          applyThemeToDOM(resolved, next)
          set({ resolvedTheme: resolved })
        }
      })
    }
    // Apply immediately for responsiveness
    const resolved = resolveTheme(next)
    applyThemeToDOM(resolved, next)
    set({ resolvedTheme: resolved })
  },

  hasRepo: () => !!(get().state?.repoPath),

  repoName: () => {
    const s = get().state
    if (!s?.repoPath) return ''
    const parts = s.repoPath.replace(/\/$/, '').split('/')
    return parts[parts.length - 1] ?? ''
  },

  repoPath: () => get().state?.repoPath ?? '',
}))

// Listen for OS theme changes — update when darkMode is undefined (system)
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { state } = useAppStore.getState()
    const darkMode = state?.settings.darkMode
    if (darkMode === undefined || darkMode === null) {
      useAppStore.getState().applyTheme()
    }
  })
}
