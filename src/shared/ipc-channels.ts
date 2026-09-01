/**
 * IPC channel names and preload API surface.
 * Simplified: worktree management + native opener. No embedded agent execution.
 */

// ---- Request/response (invoke/handle) ----

/** Select repository: open folder picker, validate git + origin, return repo info or error */
export const REPO_SELECT = 'repo:select' as const

/** Pull latest changes on the root repo's main branch */
export const REPO_PULL = 'repo:pull' as const

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

export interface RepoPullPayload {
  branch: string
}

export interface RepoPullResult {
  ok: true
  updatedSha: string
  summary: string
}

export interface RepoPullError {
  ok: false
  code: string
  message: string
}

export type RepoPullResponse = RepoPullResult | RepoPullError

export interface StateGetResponse {
  state: import('./types').AppState
  warning?: { code: string; message: string }
}

// ---- Agent channels ----

/** Validate a git branch name using git check-ref-format */
export const AGENT_VALIDATE_BRANCH = 'agent:validateBranch' as const

/** Create a new agent: validates, git fetch, creates worktree, persists state */
export const AGENT_CREATE = 'agent:create' as const

/** Open an external tool in the agent's worktree */
export const AGENT_OPEN = 'agent:open' as const

/** Open an external tool in the root repo directory */
export const REPO_OPEN = 'repo:open' as const

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
  /** Copy .env from repo root into the new worktree. Default: true. */
  copyEnv?: boolean
  /** Copy .claude/ directory from repo root into the new worktree. Default: true. */
  copyClaudeConfig?: boolean
  /** Copy .cursor/ directory from repo root into the new worktree. Default: true. */
  copyCursorConfig?: boolean
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
  tool: 'cursor' | 'claude' | 'claude-ollama' | 'terminal'
}

export interface RepoOpenPayload {
  tool: 'cursor' | 'claude' | 'claude-ollama' | 'terminal'
}

export type RepoOpenResponse = AgentOpenResult | AgentOpenError

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

// ---- Git channels ----

/** List all branches (local + remote) for the current repo */
export const GIT_LIST_BRANCHES = 'git:listBranches' as const

/** List open PRs/MRs for the current repo via GitHub CLI or GitLab CLI */
export const GIT_LIST_PRS = 'git:listPRs' as const

export interface BranchEntry {
  name: string
  isLocal: boolean
  isRemote: boolean
}

export interface GitListBranchesResult {
  ok: true
  branches: BranchEntry[]
}

export interface GitListBranchesError {
  ok: false
  code: string
  message: string
}

export type GitListBranchesResponse = GitListBranchesResult | GitListBranchesError

export interface PREntry {
  number: number
  title: string
  branchName: string
  author: string
  url: string
  isDraft: boolean
}

export interface GitListPRsResult {
  ok: true
  prs: PREntry[]
}

export interface GitListPRsError {
  ok: false
  code: string
  message: string
}

export type GitListPRsResponse = GitListPRsResult | GitListPRsError

// ---- Agent pull channel ----

/** Pull latest changes into an agent's worktree (ff-only) */
export const AGENT_PULL = 'agent:pull' as const

export interface AgentPullPayload {
  agentId: string
}

export interface AgentPullResult {
  ok: true
  updatedSha: string
  summary: string
}

export interface AgentPullError {
  ok: false
  code: string
  message: string
}

export type AgentPullResponse = AgentPullResult | AgentPullError

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
  lastCommitDate?: string
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

// ---- Project management channels ----

/** Add a new project (open folder dialog, validate, add tab) */
export const PROJECT_ADD = 'project:add' as const
/** Remove a project tab by ID */
export const PROJECT_REMOVE = 'project:remove' as const
/** Switch to a different project tab */
export const PROJECT_SWITCH = 'project:switch' as const

export interface ProjectRemovePayload {
  projectId: string
}

export interface ProjectSwitchPayload {
  projectId: string
}

export interface ProjectAddResult {
  ok: true
  state: import('./types').AppState
}

export interface ProjectAddError {
  ok: false
  code: string
  message: string
}

export type ProjectAddResponse = ProjectAddResult | ProjectAddError

export interface ProjectRemoveResult {
  ok: true
  state: import('./types').AppState
}

export interface ProjectRemoveError {
  ok: false
  code: string
  message: string
}

export type ProjectRemoveResponse = ProjectRemoveResult | ProjectRemoveError

export interface ProjectSwitchResult {
  ok: true
  state: import('./types').AppState
}

export interface ProjectSwitchError {
  ok: false
  code: string
  message: string
}

export type ProjectSwitchResponse = ProjectSwitchResult | ProjectSwitchError

/** Reorder project tabs */
export const PROJECT_REORDER = 'project:reorder' as const

export interface ProjectReorderPayload {
  projectIds: string[]
}

export interface ProjectReorderResult {
  ok: true
  state: import('./types').AppState
}

export interface ProjectReorderError {
  ok: false
  code: string
  message: string
}

export type ProjectReorderResponse = ProjectReorderResult | ProjectReorderError

// ---- Tool verification + App reset ----

/** Verify a tool binary is available and return its version */
export const TOOLS_VERIFY = 'tools:verify' as const

/** Reset app to default state */
export const APP_RESET = 'app:reset' as const

export interface ToolsVerifyPayload {
  tool: 'cursor' | 'claude' | 'claude-ollama' | 'gh' | 'glab' | 'tmux'
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

/** Get PR/MR status for an agent's branch via GitHub CLI or GitLab CLI */
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
  isDraft?: boolean
  reviewDecision?: string
}

export interface AgentPRStatusError {
  ok: false
  code: string
  message: string
}

export type AgentPRStatusResponse = AgentPRStatusResult | AgentPRStatusError

// ---- Window management channels ----

/** Tile all AgentForge Terminal windows side-by-side */
export const WINDOW_TILE = 'window:tile' as const

export interface WindowTileResult {
  ok: true
  tiledCount: number
}

export interface WindowTileError {
  ok: false
  code: string
  message: string
}

export type WindowTileResponse = WindowTileResult | WindowTileError

// ---- Shell channels ----

/** Open a URL in the user's default browser */
export const SHELL_OPEN_EXTERNAL = 'shell:openExternal' as const

// ---- App version + auto-update channels ----

/** Get the running app version */
export const APP_VERSION = 'app:version' as const
/** Get current update status (invoke) + push events (on) */
export const UPDATER_STATUS = 'updater:status' as const
/** Manually trigger an update check */
export const UPDATER_CHECK = 'updater:check' as const
/** Download an available update */
export const UPDATER_DOWNLOAD = 'updater:download' as const
/** Quit and install a downloaded update */
export const UPDATER_INSTALL = 'updater:install' as const

export interface AppVersionResponse {
  version: string
}

// ---- Preload API (allowlisted only) ----

export type PreloadAPI = {
  selectRepository: () => Promise<RepoSelectResponse>
  addProject: () => Promise<ProjectAddResponse>
  removeProject: (payload: ProjectRemovePayload) => Promise<ProjectRemoveResponse>
  switchProject: (payload: ProjectSwitchPayload) => Promise<ProjectSwitchResponse>
  reorderProjects: (payload: ProjectReorderPayload) => Promise<ProjectReorderResponse>
  pullRepo: (payload: RepoPullPayload) => Promise<RepoPullResponse>
  pullAgent: (payload: AgentPullPayload) => Promise<AgentPullResponse>
  getState: () => Promise<StateGetResponse>
  validateBranchName: (payload: AgentValidateBranchPayload) => Promise<AgentValidateBranchResponse>
  createAgent: (payload: AgentCreatePayload) => Promise<AgentCreateResponse>
  updateSettings: (payload: SettingsUpdatePayload) => Promise<SettingsUpdateResponse>
  openAgent: (payload: AgentOpenPayload) => Promise<AgentOpenResponse>
  openRepo: (payload: RepoOpenPayload) => Promise<RepoOpenResponse>
  getAgentGitStatus: (payload: AgentGitStatusPayload) => Promise<AgentGitStatusResponse>
  removeAgent: (payload: AgentRemovePayload) => Promise<AgentRemoveResponse>
  listPrompts: () => Promise<PromptsListResponse>
  savePrompt: (payload: PromptsSavePayload) => Promise<PromptsSaveResponse>
  deletePrompt: (payload: PromptsDeletePayload) => Promise<PromptsDeleteResponse>
  changePromptScope: (payload: PromptsChangeScopePayload) => Promise<PromptsChangeScopeResponse>
  listBranches: () => Promise<GitListBranchesResponse>
  listPRs: () => Promise<GitListPRsResponse>
  verifyTool: (payload: ToolsVerifyPayload) => Promise<ToolsVerifyResponse>
  resetApp: () => Promise<AppResetResponse>
  getAgentPRStatus: (payload: AgentPRStatusPayload) => Promise<AgentPRStatusResponse>
  openExternal: (url: string) => Promise<void>
  tileTerminals: () => Promise<WindowTileResponse>
  // Auto-update
  getAppVersion: () => Promise<AppVersionResponse>
  getUpdateStatus: () => Promise<import('./types').UpdateStatus>
  checkForUpdates: () => Promise<void>
  downloadUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
  onUpdateStatus: (callback: (status: import('./types').UpdateStatus) => void) => () => void
}

declare global {
  interface Window {
    agentForge?: PreloadAPI
  }
}
