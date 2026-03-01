/**
 * Shared types for main and renderer.
 * Simplified: worktree management + native opener. No embedded agent execution.
 */

export interface AppState {
  version: number
  repoPath: string
  worktreesRootPath: string
  agentsMdPath: string | null
  agentsMdContents: string | null
  agents: Agent[]
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

export const CURRENT_STATE_VERSION = 3

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
