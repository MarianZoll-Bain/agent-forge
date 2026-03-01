/**
 * IPC channel names and preload API surface.
 * Simplified: worktree management + native opener. No embedded agent execution.
 */

// ---- Request/response (invoke/handle) ----

/** Select repository: open folder picker, validate git + origin, return repo info or error */
export const REPO_SELECT = 'repo:select' as const

/** Get current app state (after load or after any mutation) */
export const STATE_GET = 'state:get' as const

// ---- Payload types (for validation in main) ----

export interface RepoSelectResult {
  ok: true
  repoPath: string
  repoName: string
  worktreesRootPath: string
  agentsMdPath: string | null
  agentsMdContents: string | null
}

export interface RepoSelectError {
  ok: false
  code: string
  message: string
}

export type RepoSelectResponse = RepoSelectResult | RepoSelectError

export interface StateGetResponse {
  state: import('./types').AppState
}

// ---- Agent channels ----

/** Validate a git branch name using git check-ref-format */
export const AGENT_VALIDATE_BRANCH = 'agent:validateBranch' as const

/** Create a new agent: validates, git fetch, creates worktree, persists state */
export const AGENT_CREATE = 'agent:create' as const

/** Open an external tool in the agent's worktree */
export const AGENT_OPEN = 'agent:open' as const

/** Update app settings */
export const SETTINGS_UPDATE = 'settings:update' as const

export interface AgentValidateBranchPayload {
  branchName: string
}

export interface AgentValidateBranchResponse {
  valid: boolean
  message?: string
}

export interface AgentCreatePayload {
  name: string
  branchName: string
  /** Default: "main" */
  baseBranch: string
}

export interface AgentCreateResult {
  ok: true
  state: import('./types').AppState
}

export interface AgentCreateError {
  ok: false
  code: string
  message: string
}

export type AgentCreateResponse = AgentCreateResult | AgentCreateError

export interface AgentOpenPayload {
  agentId: string
  tool: 'cursor' | 'claude' | 'claude-ollama'
}

export interface AgentOpenResult {
  ok: true
}

export interface AgentOpenError {
  ok: false
  code: string
  message: string
}

export type AgentOpenResponse = AgentOpenResult | AgentOpenError

export interface SettingsUpdatePayload {
  settings: Partial<import('./types').Settings>
}

export interface SettingsUpdateResult {
  ok: true
  state: import('./types').AppState
}

export interface SettingsUpdateError {
  ok: false
  code: string
  message: string
}

export type SettingsUpdateResponse = SettingsUpdateResult | SettingsUpdateError

// ---- Sprint 3 channels ----

/** Get git status for an agent's worktree (dirty, branch, SHA, ahead/behind) */
export const AGENT_GIT_STATUS = 'agent:gitStatus' as const
/** Remove an agent from state, optionally deleting its worktree */
export const AGENT_REMOVE = 'agent:remove' as const
export interface AgentGitStatusPayload {
  agentId: string
}

export interface AgentGitStatusResult {
  ok: true
  dirty: boolean
  branch: string
  lastCommitSha: string
  aheadBehind?: { ahead: number; behind: number }
}

export interface AgentGitStatusError {
  ok: false
  code: string
  message: string
}

export type AgentGitStatusResponse = AgentGitStatusResult | AgentGitStatusError

export interface AgentRemovePayload {
  agentId: string
  deleteWorktree?: boolean
}

export interface AgentRemoveResult {
  ok: true
  state: import('./types').AppState
  worktreeRemoveError?: string
}

export interface AgentRemoveError {
  ok: false
  code: string
  message: string
}

export type AgentRemoveResponse = AgentRemoveResult | AgentRemoveError

// ---- Prompts channels ----

/** List all prompt files from disk (global + project) */
export const PROMPTS_LIST = 'prompts:list' as const
/** Create or update a prompt file on disk */
export const PROMPTS_SAVE = 'prompts:save' as const
/** Delete a prompt file from disk */
export const PROMPTS_DELETE = 'prompts:delete' as const
/** Move a prompt between global and project scope */
export const PROMPTS_CHANGE_SCOPE = 'prompts:changeScope' as const

export interface PromptsListResult {
  ok: true
  prompts: import('./types').PromptEntry[]
}

export interface PromptsListError {
  ok: false
  code: string
  message: string
}

export type PromptsListResponse = PromptsListResult | PromptsListError

export interface PromptsSavePayload {
  tool: import('./types').PromptTool
  scope: import('./types').PromptScope
  fileName: string
  content: string
}

export interface PromptsSaveResult {
  ok: true
  prompt: import('./types').PromptEntry
}

export interface PromptsSaveError {
  ok: false
  code: string
  message: string
}

export type PromptsSaveResponse = PromptsSaveResult | PromptsSaveError

export interface PromptsDeletePayload {
  tool: import('./types').PromptTool
  scope: import('./types').PromptScope
  fileName: string
}

export interface PromptsDeleteResult {
  ok: true
}

export interface PromptsDeleteError {
  ok: false
  code: string
  message: string
}

export type PromptsDeleteResponse = PromptsDeleteResult | PromptsDeleteError

export interface PromptsChangeScopePayload {
  tool: import('./types').PromptTool
  currentScope: import('./types').PromptScope
  fileName: string
}

export interface PromptsChangeScopeResult {
  ok: true
  prompt: import('./types').PromptEntry
}

export interface PromptsChangeScopeError {
  ok: false
  code: string
  message: string
}

export type PromptsChangeScopeResponse = PromptsChangeScopeResult | PromptsChangeScopeError

// ---- Tool verification + App reset ----

/** Verify a tool binary is available and return its version */
export const TOOLS_VERIFY = 'tools:verify' as const

/** Reset app to default state */
export const APP_RESET = 'app:reset' as const

export interface ToolsVerifyPayload {
  tool: 'cursor' | 'claude' | 'claude-ollama' | 'gh'
}

export interface ToolsVerifyResult {
  ok: true
  version: string
}

export interface ToolsVerifyError {
  ok: false
  message: string
}

export type ToolsVerifyResponse = ToolsVerifyResult | ToolsVerifyError

export interface AppResetResult {
  ok: true
  state: import('./types').AppState
}

export interface AppResetError {
  ok: false
  code: string
  message: string
}

export type AppResetResponse = AppResetResult | AppResetError

// ---- PR status channel ----

/** Get PR status for an agent's branch via GitHub CLI */
export const AGENT_PR_STATUS = 'agent:prStatus' as const

export interface AgentPRStatusPayload {
  agentId: string
}

export interface AgentPRStatusResult {
  ok: true
  hasPR: boolean
  prUrl?: string
  prNumber?: number
  prState?: string
}

export interface AgentPRStatusError {
  ok: false
  code: string
  message: string
}

export type AgentPRStatusResponse = AgentPRStatusResult | AgentPRStatusError

// ---- Preload API (allowlisted only) ----

export type PreloadAPI = {
  selectRepository: () => Promise<RepoSelectResponse>
  getState: () => Promise<StateGetResponse>
  validateBranchName: (payload: AgentValidateBranchPayload) => Promise<AgentValidateBranchResponse>
  createAgent: (payload: AgentCreatePayload) => Promise<AgentCreateResponse>
  updateSettings: (payload: SettingsUpdatePayload) => Promise<SettingsUpdateResponse>
  openAgent: (payload: AgentOpenPayload) => Promise<AgentOpenResponse>
  getAgentGitStatus: (payload: AgentGitStatusPayload) => Promise<AgentGitStatusResponse>
  removeAgent: (payload: AgentRemovePayload) => Promise<AgentRemoveResponse>
  listPrompts: () => Promise<PromptsListResponse>
  savePrompt: (payload: PromptsSavePayload) => Promise<PromptsSaveResponse>
  deletePrompt: (payload: PromptsDeletePayload) => Promise<PromptsDeleteResponse>
  changePromptScope: (payload: PromptsChangeScopePayload) => Promise<PromptsChangeScopeResponse>
  verifyTool: (payload: ToolsVerifyPayload) => Promise<ToolsVerifyResponse>
  resetApp: () => Promise<AppResetResponse>
  getAgentPRStatus: (payload: AgentPRStatusPayload) => Promise<AgentPRStatusResponse>
}

declare global {
  interface Window {
    agentForge?: PreloadAPI
  }
}
