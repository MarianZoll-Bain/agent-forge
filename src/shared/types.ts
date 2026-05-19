/**
 * Shared types for main and renderer.
 * Simplified: worktree management + native opener. No embedded agent execution.
 */

export type ProjectId = string

/** Project color palette — indices map to tmux and UI colors. */
export const PROJECT_COLORS = [
  { name: 'Indigo',  tmux: 'colour63',  css: '#6366f1', bg: '#151520' },
  { name: 'Emerald', tmux: 'colour35',  css: '#10b981', bg: '#131e16' },
  { name: 'Amber',   tmux: 'colour172', css: '#f59e0b', bg: '#1a1813' },
  { name: 'Rose',    tmux: 'colour161', css: '#f43f5e', bg: '#1a1316' },
  { name: 'Cyan',    tmux: 'colour37',  css: '#06b6d4', bg: '#13191c' },
  { name: 'Violet',  tmux: 'colour128', css: '#8b5cf6', bg: '#18131f' },
  { name: 'Orange',  tmux: 'colour208', css: '#f97316', bg: '#1a1613' },
  { name: 'Teal',    tmux: 'colour30',  css: '#14b8a6', bg: '#131c1a' },
  { name: 'Pink',    tmux: 'colour198', css: '#ec4899', bg: '#1a1318' },
  { name: 'Blue',    tmux: 'colour33',  css: '#3b82f6', bg: '#13161e' },
] as const

/** Per-project state: repo info + its agents. */
export interface Project {
  id: ProjectId
  repoPath: string
  worktreesRootPath: string
  agentsMdPath: string | null
  agentsMdContents: string | null
  agents: Agent[]
  /** Whether this project's repo has a .env file at its root. */
  hasRootEnvFile?: boolean
  /** Index into PROJECT_COLORS palette (0–9). Auto-assigned on creation. */
  colorIndex?: number
}

export interface AppState {
  version: number
  projects: Project[]
  currentProjectId: ProjectId | null
  settings: Settings
  lastUpdated?: string
}

export interface Agent {
  id: string
  name: string
  branchName: string
  baseBranch: string
  worktreePath: string
  createdAt: string
}

export interface Settings {
  /** Default base branch for new agents. Default: 'main'. */
  baseBranch?: string
  /** Custom worktrees sub-directory name inside the repo. Default: '.worktrees'. */
  worktreesDirName?: string
  /** Default Ollama model for claude-ollama opener. */
  ollamaModel?: string
  /** Ollama server URL. Default: 'http://localhost:11434'. */
  ollamaBaseUrl?: string
  /** UI colour theme: true = dark, false = light, undefined = follow system. */
  darkMode?: boolean
  /** Tool enablement flags. */
  enableCursor?: boolean
  enableClaude?: boolean
  enableClaudeOllama?: boolean
  /** Whether the first-launch onboarding wizard has been completed. */
  onboardingComplete?: boolean
  /** Enable GitHub CLI integration (PR detection on agent cards). */
  enableGitMode?: boolean
}

export const CURRENT_STATE_VERSION = 4

export const DEFAULT_SETTINGS: Settings = {}

// ---- Auto-update status ----

export interface UpdateStatus {
  /** Whether a new version is available for download */
  available: boolean
  /** The latest available version string (e.g. "1.2.0") */
  latestVersion: string | null
  /** Release notes (markdown) */
  releaseNotes: string | null
  /** URL to the release page on GitHub */
  releaseUrl: string | null
  /** Whether the update has been downloaded and is ready to install */
  downloaded: boolean
  /** Whether a download is currently in progress */
  downloading: boolean
  /** Download progress percentage (0–100) */
  downloadProgress: number
  /** Whether a check is currently in progress */
  checking: boolean
  /** Error message from last check/download attempt */
  error: string | null
}

// ---- Prompts management ----

export type PromptTool = 'cursor' | 'claude'
export type PromptScope = 'global' | 'project'

export interface PromptEntry {
  /** Deterministic ID: `${tool}:${scope}:${fileName}` */
  id: string
  tool: PromptTool
  scope: PromptScope
  /** File name with extension, e.g. "code-review.mdc" */
  fileName: string
  /** Full absolute path on disk */
  filePath: string
  content: string
}
