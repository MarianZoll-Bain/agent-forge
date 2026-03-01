/**
 * IPC handlers with validation.
 * Simplified: worktree management + native opener. No embedded agent execution.
 */

import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import { z } from 'zod'
import { validateRepoPath } from './services/repoValidator'
import { ensureWorktreesDirectory } from './services/worktreeManager'
import { readAgentsMd } from './services/agentsMdReader'
import { loadState, saveState } from './services/stateManager'
import { validateBranchName } from './services/gitValidator'
import { createWorktreeForAgent, discoverExistingWorktrees } from './services/agentService'
import { getGitStatus } from './services/gitStatusService'
import { removeWorktree } from './services/gitOperations'
import { openAgent } from './services/agentOpener'
import * as promptManager from './services/promptManager'
import { verifyTool } from './services/toolVerifier'
import { getPRStatus } from './services/prStatusService'
import type {
  RepoSelectResponse,
  RepoSelectResult,
  StateGetResponse,
  AgentValidateBranchResponse,
  AgentCreateResponse,
  SettingsUpdateResponse,
  AgentGitStatusResponse,
  AgentOpenResponse,
  AgentRemoveResponse,
  PromptsListResponse,
  PromptsSaveResponse,
  PromptsDeleteResponse,
  PromptsChangeScopeResponse,
  ToolsVerifyResponse,
  AppResetResponse,
  AgentPRStatusResponse,
} from '../shared/ipc-channels'
import type { AppState } from '../shared/types'
import { defaultState } from './services/stateManager'
import { logger } from './logger'

let mainWindowRef: BrowserWindow | null = null

export function setMainWindow(win: BrowserWindow | null) {
  mainWindowRef = win
}

function isSenderAllowed(event: Electron.IpcMainInvokeEvent): boolean {
  if (!mainWindowRef || mainWindowRef.webContents.isDestroyed()) return false
  return event.sender === mainWindowRef.webContents
}

async function handleSelectRepository(event: Electron.IpcMainInvokeEvent): Promise<RepoSelectResponse> {
  logger.info('repo:select invoked')
  if (!isSenderAllowed(event)) {
    logger.warn('repo:select rejected: invalid sender')
    return { ok: false, code: 'FORBIDDEN', message: 'Invalid sender' }
  }
  const { dialog } = await import('electron')
  logger.debug('Opening folder dialog')
  const result = await dialog.showOpenDialog(mainWindowRef!, {
    properties: ['openDirectory'],
    title: 'Select Repository',
  })
  if (result.canceled || result.filePaths.length === 0) {
    logger.info('repo:select canceled or no path')
    return { ok: false, code: 'CANCELED', message: 'No folder selected' }
  }
  const candidatePath = result.filePaths[0]
  logger.info('Selected path:', candidatePath)
  const validation = await validateRepoPath(candidatePath)
  if (!validation.valid) {
    logger.warn('Validation failed:', validation.code, validation.error)
    return {
      ok: false,
      code: validation.code ?? 'VALIDATION_FAILED',
      message: validation.error ?? 'Validation failed',
    }
  }
  const repoPath = validation.repoPath!
  const repoName = validation.repoName!
  logger.info('Valid repo:', repoPath, repoName)
  const worktreesResult = ensureWorktreesDirectory(repoPath)
  if (!worktreesResult.ok) {
    logger.error('Worktrees dir failed:', worktreesResult.code, worktreesResult.message)
    return { ok: false, code: worktreesResult.code, message: worktreesResult.message }
  }
  const worktreesRootPath = worktreesResult.worktreesRootPath
  const agentsMdResult = await readAgentsMd(repoPath)
  let agentsMdPath: string | null = null
  let agentsMdContents: string | null = null
  if (agentsMdResult.ok) {
    agentsMdPath = agentsMdResult.agentsMdPath
    agentsMdContents = agentsMdResult.contents
    logger.debug('Agents.MD loaded')
  } else if (agentsMdResult.code !== 'NOT_FOUND') {
    logger.warn('Agents.MD read error:', agentsMdResult.code, agentsMdResult.message)
    return { ok: false, code: agentsMdResult.code, message: agentsMdResult.message }
  }
  const state = loadState()
  const currentState: AppState = state.ok ? state.state : defaultState()

  // Discover existing worktrees in the .worktrees directory and create agent entries
  const existingAgents = currentState.agents.filter((a) => a.worktreePath.startsWith(worktreesRootPath))
  let discoveredAgents: typeof currentState.agents = []
  try {
    discoveredAgents = await discoverExistingWorktrees(repoPath, worktreesRootPath, existingAgents)
    if (discoveredAgents.length > 0) {
      logger.info(`Discovered ${discoveredAgents.length} existing worktree(s)`)
    }
  } catch (e) {
    logger.warn('Worktree discovery failed (non-fatal):', e instanceof Error ? e.message : e)
  }

  const newState: AppState = {
    ...currentState,
    repoPath,
    worktreesRootPath,
    agentsMdPath,
    agentsMdContents,
    agents: [...existingAgents, ...discoveredAgents],
  }
  const saveResult = saveState(newState)
  if (!saveResult.ok) {
    logger.error('Save state failed:', saveResult.code, saveResult.message)
    return { ok: false, code: saveResult.code, message: saveResult.message }
  }
  logger.info('repo:select success:', repoPath)
  return {
    ok: true,
    repoPath,
    repoName,
    worktreesRootPath,
    agentsMdPath,
    agentsMdContents,
  } satisfies RepoSelectResult
}

async function handleGetState(event: Electron.IpcMainInvokeEvent): Promise<StateGetResponse> {
  if (!isSenderAllowed(event)) {
    throw Object.assign(new Error('Invalid sender'), { code: 'FORBIDDEN' })
  }
  const result = loadState()
  if (!result.ok) {
    throw Object.assign(new Error(result.message), { code: result.code })
  }
  const state = result.state

  // Discover any new worktrees that appeared on disk since last save
  if (state.repoPath && state.worktreesRootPath) {
    try {
      const discovered = await discoverExistingWorktrees(state.repoPath, state.worktreesRootPath, state.agents)
      if (discovered.length > 0) {
        logger.info(`Discovered ${discovered.length} new worktree(s) on startup`)
        const updated: AppState = { ...state, agents: [...state.agents, ...discovered] }
        saveState(updated)
        return { state: updated }
      }
    } catch (e) {
      logger.warn('Worktree discovery on getState failed (non-fatal):', e instanceof Error ? e.message : e)
    }
  }

  return { state }
}

// ---- Zod schemas ----

const AgentValidateBranchSchema = z.object({
  branchName: z.string().min(1),
})

const AgentCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  branchName: z.string().min(1),
  baseBranch: z.string().min(1),
})

const AgentOpenSchema = z.object({
  agentId: z.string().min(1),
  tool: z.enum(['cursor', 'claude', 'claude-ollama']),
})

const SettingsUpdateSchema = z.object({
  settings: z.object({
    baseBranch: z.string().min(1).optional(),
    worktreesDirName: z
      .string()
      .regex(/^[^/\\:*?"<>|]+$/, 'Invalid directory name')
      .optional(),
    ollamaModel: z.string().optional(),
    ollamaBaseUrl: z.string().url().optional(),
    darkMode: z.boolean().optional(),
    enableCursor: z.boolean().optional(),
    enableClaude: z.boolean().optional(),
    enableClaudeOllama: z.boolean().optional(),
    onboardingComplete: z.boolean().optional(),
    enableGitMode: z.boolean().optional(),
  }),
})

const AgentGitStatusSchema = z.object({ agentId: z.string().min(1) })
const AgentRemoveSchema = z.object({
  agentId: z.string().min(1),
  deleteWorktree: z.boolean().optional(),
})

const PromptsSaveSchema = z.object({
  tool: z.enum(['cursor', 'claude']),
  scope: z.enum(['global', 'project']),
  fileName: z.string().min(1),
  content: z.string(),
})

const PromptsDeleteSchema = z.object({
  tool: z.enum(['cursor', 'claude']),
  scope: z.enum(['global', 'project']),
  fileName: z.string().min(1),
})

const PromptsChangeScopeSchema = z.object({
  tool: z.enum(['cursor', 'claude']),
  currentScope: z.enum(['global', 'project']),
  fileName: z.string().min(1),
})

// ---- Handlers ----

async function handleAgentValidateBranch(
  event: Electron.IpcMainInvokeEvent,
  payload: unknown,
): Promise<AgentValidateBranchResponse> {
  if (!isSenderAllowed(event)) {
    return { valid: false, message: 'Invalid sender' }
  }
  const parsed = AgentValidateBranchSchema.safeParse(payload)
  if (!parsed.success) {
    return { valid: false, message: 'Missing or invalid branchName' }
  }
  return validateBranchName(parsed.data.branchName)
}

async function handleAgentCreate(
  event: Electron.IpcMainInvokeEvent,
  payload: unknown,
): Promise<AgentCreateResponse> {
  if (!isSenderAllowed(event)) {
    return { ok: false, code: 'FORBIDDEN', message: 'Invalid sender' }
  }
  const parsed = AgentCreateSchema.safeParse(payload)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ')
    return { ok: false, code: 'VALIDATION_FAILED', message: msg }
  }
  const { name, branchName, baseBranch } = parsed.data

  const stateResult = loadState()
  if (!stateResult.ok) {
    return { ok: false, code: stateResult.code, message: stateResult.message }
  }
  const state = stateResult.state
  if (!state.repoPath || !state.worktreesRootPath) {
    return { ok: false, code: 'NO_REPO', message: 'No repository selected' }
  }

  logger.info('agent:create', name, branchName, baseBranch)
  const result = await createWorktreeForAgent({
    name,
    branchName,
    baseBranch,
    worktreesRootPath: state.worktreesRootPath,
    repoPath: state.repoPath,
  })
  if (!result.ok) {
    logger.warn('agent:create failed:', result.code, result.message)
    return result
  }

  const newState: AppState = {
    ...state,
    agents: [...state.agents, result.agent],
  }
  const saveResult = saveState(newState)
  if (!saveResult.ok) {
    logger.error('agent:create save failed:', saveResult.code, saveResult.message)
    return { ok: false, code: saveResult.code, message: saveResult.message }
  }
  logger.info('agent:create success:', result.agent.id)
  return { ok: true, state: newState }
}

async function handleAgentOpen(
  event: Electron.IpcMainInvokeEvent,
  payload: unknown,
): Promise<AgentOpenResponse> {
  if (!isSenderAllowed(event)) {
    return { ok: false, code: 'FORBIDDEN', message: 'Invalid sender' }
  }
  const parsed = AgentOpenSchema.safeParse(payload)
  if (!parsed.success) {
    return { ok: false, code: 'VALIDATION_FAILED', message: 'agentId and tool are required' }
  }
  const { agentId, tool } = parsed.data

  const stateResult = loadState()
  if (!stateResult.ok) return { ok: false, code: stateResult.code, message: stateResult.message }
  const state = stateResult.state

  const agent = state.agents.find((a) => a.id === agentId)
  if (!agent) return { ok: false, code: 'AGENT_NOT_FOUND', message: `Agent ${agentId} not found` }

  logger.info(`agent:open agentId=${agentId} tool=${tool}`)
  return openAgent(tool, agent.worktreePath, {
    ollamaModel: state.settings.ollamaModel,
    ollamaBaseUrl: state.settings.ollamaBaseUrl,
  })
}

async function handleSettingsUpdate(
  event: Electron.IpcMainInvokeEvent,
  payload: unknown,
): Promise<SettingsUpdateResponse> {
  if (!isSenderAllowed(event)) {
    return { ok: false, code: 'FORBIDDEN', message: 'Invalid sender' }
  }
  const parsed = SettingsUpdateSchema.safeParse(payload)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ')
    return { ok: false, code: 'VALIDATION_FAILED', message: msg }
  }
  const stateResult = loadState()
  if (!stateResult.ok) return { ok: false, code: stateResult.code, message: stateResult.message }
  const state = stateResult.state
  const newState: AppState = {
    ...state,
    settings: { ...state.settings, ...parsed.data.settings },
  }
  const saveResult = saveState(newState)
  if (!saveResult.ok) return { ok: false, code: saveResult.code, message: saveResult.message }
  logger.info('settings:update success')
  return { ok: true, state: newState }
}

async function handleAgentGitStatus(
  event: Electron.IpcMainInvokeEvent,
  payload: unknown,
): Promise<AgentGitStatusResponse> {
  if (!isSenderAllowed(event)) {
    return { ok: false, code: 'FORBIDDEN', message: 'Invalid sender' }
  }
  const parsed = AgentGitStatusSchema.safeParse(payload)
  if (!parsed.success) {
    return { ok: false, code: 'VALIDATION_FAILED', message: 'agentId is required' }
  }
  const stateResult = loadState()
  if (!stateResult.ok) return { ok: false, code: stateResult.code, message: stateResult.message }
  const agent = stateResult.state.agents.find((a) => a.id === parsed.data.agentId)
  if (!agent) return { ok: false, code: 'AGENT_NOT_FOUND', message: 'Agent not found' }

  const result = await getGitStatus(agent.worktreePath, agent.branchName)
  if (!result.ok) return result
  return { ok: true, ...result.status }
}

async function handleAgentRemove(
  event: Electron.IpcMainInvokeEvent,
  payload: unknown,
): Promise<AgentRemoveResponse> {
  if (!isSenderAllowed(event)) {
    return { ok: false, code: 'FORBIDDEN', message: 'Invalid sender' }
  }
  const parsed = AgentRemoveSchema.safeParse(payload)
  if (!parsed.success) {
    return { ok: false, code: 'VALIDATION_FAILED', message: 'agentId is required' }
  }
  const { agentId, deleteWorktree } = parsed.data

  const stateResult = loadState()
  if (!stateResult.ok) return { ok: false, code: stateResult.code, message: stateResult.message }
  const state = stateResult.state
  const agent = state.agents.find((a) => a.id === agentId)
  if (!agent) return { ok: false, code: 'AGENT_NOT_FOUND', message: 'Agent not found' }

  let worktreeRemoveError: string | undefined
  if (deleteWorktree && agent.worktreePath && state.repoPath) {
    logger.info(`agent:remove deleting worktree ${agent.worktreePath}`)
    const removeResult = await removeWorktree(state.repoPath, agent.worktreePath)
    if (!removeResult.ok) {
      worktreeRemoveError = removeResult.message
      logger.warn(`agent:remove worktree removal failed: ${removeResult.message}`)
    }
  }

  const newState: AppState = {
    ...state,
    agents: state.agents.filter((a) => a.id !== agentId),
  }
  const saveResult = saveState(newState)
  if (!saveResult.ok) return { ok: false, code: saveResult.code, message: saveResult.message }

  logger.info(`agent:remove success agentId=${agentId}`)
  return { ok: true, state: newState, worktreeRemoveError }
}

// ---- Prompts handlers ----

function getRepoPathFromState(): string | null {
  const stateResult = loadState()
  if (!stateResult.ok) return null
  return stateResult.state.repoPath || null
}

async function handlePromptsList(
  event: Electron.IpcMainInvokeEvent,
): Promise<PromptsListResponse> {
  if (!isSenderAllowed(event)) {
    return { ok: false, code: 'FORBIDDEN', message: 'Invalid sender' }
  }
  const repoPath = getRepoPathFromState()
  return promptManager.listPrompts(repoPath)
}

async function handlePromptsSave(
  event: Electron.IpcMainInvokeEvent,
  payload: unknown,
): Promise<PromptsSaveResponse> {
  if (!isSenderAllowed(event)) {
    return { ok: false, code: 'FORBIDDEN', message: 'Invalid sender' }
  }
  const parsed = PromptsSaveSchema.safeParse(payload)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ')
    return { ok: false, code: 'VALIDATION_FAILED', message: msg }
  }
  const { tool, scope, fileName, content } = parsed.data
  const repoPath = getRepoPathFromState()
  return promptManager.savePrompt(tool, scope, fileName, content, repoPath)
}

async function handlePromptsDelete(
  event: Electron.IpcMainInvokeEvent,
  payload: unknown,
): Promise<PromptsDeleteResponse> {
  if (!isSenderAllowed(event)) {
    return { ok: false, code: 'FORBIDDEN', message: 'Invalid sender' }
  }
  const parsed = PromptsDeleteSchema.safeParse(payload)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ')
    return { ok: false, code: 'VALIDATION_FAILED', message: msg }
  }
  const { tool, scope, fileName } = parsed.data
  const repoPath = getRepoPathFromState()
  return promptManager.deletePrompt(tool, scope, fileName, repoPath)
}

async function handlePromptsChangeScope(
  event: Electron.IpcMainInvokeEvent,
  payload: unknown,
): Promise<PromptsChangeScopeResponse> {
  if (!isSenderAllowed(event)) {
    return { ok: false, code: 'FORBIDDEN', message: 'Invalid sender' }
  }
  const parsed = PromptsChangeScopeSchema.safeParse(payload)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ')
    return { ok: false, code: 'VALIDATION_FAILED', message: msg }
  }
  const { tool, currentScope, fileName } = parsed.data
  const repoPath = getRepoPathFromState()
  return promptManager.changeScope(tool, currentScope, fileName, repoPath)
}

// ---- Tool verification + App reset ----

const ToolsVerifySchema = z.object({
  tool: z.enum(['cursor', 'claude', 'claude-ollama', 'gh']),
})

async function handleToolsVerify(
  event: Electron.IpcMainInvokeEvent,
  payload: unknown,
): Promise<ToolsVerifyResponse> {
  if (!isSenderAllowed(event)) {
    return { ok: false, message: 'Invalid sender' }
  }
  const parsed = ToolsVerifySchema.safeParse(payload)
  if (!parsed.success) {
    return { ok: false, message: 'Invalid tool' }
  }
  return verifyTool(parsed.data.tool)
}

const AgentPRStatusSchema = z.object({ agentId: z.string().min(1) })

async function handleAgentPRStatus(
  event: Electron.IpcMainInvokeEvent,
  payload: unknown,
): Promise<AgentPRStatusResponse> {
  if (!isSenderAllowed(event)) {
    return { ok: false, code: 'FORBIDDEN', message: 'Invalid sender' }
  }
  const parsed = AgentPRStatusSchema.safeParse(payload)
  if (!parsed.success) {
    return { ok: false, code: 'VALIDATION_FAILED', message: 'agentId is required' }
  }
  const stateResult = loadState()
  if (!stateResult.ok) return { ok: false, code: stateResult.code, message: stateResult.message }
  const agent = stateResult.state.agents.find((a) => a.id === parsed.data.agentId)
  if (!agent) return { ok: false, code: 'AGENT_NOT_FOUND', message: 'Agent not found' }

  return getPRStatus(agent.worktreePath, agent.branchName)
}

async function handleAppReset(
  event: Electron.IpcMainInvokeEvent,
): Promise<AppResetResponse> {
  if (!isSenderAllowed(event)) {
    return { ok: false, code: 'FORBIDDEN', message: 'Invalid sender' }
  }
  const state = defaultState()
  const saveResult = saveState(state)
  if (!saveResult.ok) {
    return { ok: false, code: saveResult.code, message: saveResult.message }
  }
  logger.info('app:reset — state cleared')
  return { ok: true, state }
}

export function registerIpcHandlers(): void {
  ipcMain.handle('repo:select', (event) => {
    return handleSelectRepository(event)
  })

  ipcMain.handle('state:get', (event) => {
    return handleGetState(event)
  })

  ipcMain.handle('agent:validateBranch', (event, payload: unknown) => {
    return handleAgentValidateBranch(event, payload)
  })

  ipcMain.handle('agent:create', (event, payload: unknown) => {
    return handleAgentCreate(event, payload)
  })

  ipcMain.handle('agent:open', (event, payload: unknown) => {
    return handleAgentOpen(event, payload)
  })

  ipcMain.handle('settings:update', (event, payload: unknown) => {
    return handleSettingsUpdate(event, payload)
  })

  ipcMain.handle('agent:gitStatus', (event, payload: unknown) => {
    return handleAgentGitStatus(event, payload)
  })

  ipcMain.handle('agent:remove', (event, payload: unknown) => {
    return handleAgentRemove(event, payload)
  })

  ipcMain.handle('prompts:list', (event) => {
    return handlePromptsList(event)
  })

  ipcMain.handle('prompts:save', (event, payload: unknown) => {
    return handlePromptsSave(event, payload)
  })

  ipcMain.handle('prompts:delete', (event, payload: unknown) => {
    return handlePromptsDelete(event, payload)
  })

  ipcMain.handle('prompts:changeScope', (event, payload: unknown) => {
    return handlePromptsChangeScope(event, payload)
  })

  ipcMain.handle('tools:verify', (event, payload: unknown) => {
    return handleToolsVerify(event, payload)
  })

  ipcMain.handle('agent:prStatus', (event, payload: unknown) => {
    return handleAgentPRStatus(event, payload)
  })

  ipcMain.handle('app:reset', (event) => {
    return handleAppReset(event)
  })
}
