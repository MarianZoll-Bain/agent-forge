/**
 * App state persistence.
 * Single source of truth: ~/.agent-forge/state.json
 * - State version and migrations
 * - Restrictive file permissions (chmod 600) after write
 * - Atomic write (temp file then rename)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { homedir } from 'node:os'
import type { Agent, AppState, Settings } from '../../shared/types'
import { CURRENT_STATE_VERSION, DEFAULT_SETTINGS } from '../../shared/types'

const STATE_DIR = '.agent-forge'
const OLD_STATE_DIR = '.mono-agent-orchestrator'
const STATE_FILE = 'state.json'

function getStatePath(): string {
  return path.join(homedir(), STATE_DIR, STATE_FILE)
}

function getStateDir(): string {
  return path.join(homedir(), STATE_DIR)
}

/**
 * If the old ~/.mono-agent-orchestrator/ directory exists and
 * ~/.agent-forge/ does not, rename it.
 */
function migrateDirectory(): void {
  const oldDir = path.join(homedir(), OLD_STATE_DIR)
  const newDir = path.join(homedir(), STATE_DIR)
  try {
    if (fs.existsSync(oldDir) && !fs.existsSync(newDir)) {
      fs.renameSync(oldDir, newDir)
    }
  } catch {
    // Non-fatal: if rename fails, we'll just start fresh
  }
}

export interface LoadStateResult {
  ok: true
  state: AppState
}

export interface LoadStateError {
  ok: false
  code: string
  message: string
}

export type LoadStateResponse = LoadStateResult | LoadStateError

export function defaultState(repoPath?: string, worktreesRootPath?: string): AppState {
  return {
    version: CURRENT_STATE_VERSION,
    repoPath: repoPath ?? '',
    worktreesRootPath: worktreesRootPath ?? '',
    agentsMdPath: null,
    agentsMdContents: null,
    agents: [],
    settings: { ...DEFAULT_SETTINGS },
    lastUpdated: new Date().toISOString(),
  }
}

/**
 * Migrate old state to current schema.
 * v0→v1: ensure base fields
 * v1→v2: strip execution fields from agents and settings
 */
function migrate(state: Record<string, unknown>): AppState {
  const version = typeof state.version === 'number' ? state.version : 0
  if (version > CURRENT_STATE_VERSION) {
    throw new Error(`Unknown state version: ${version}`)
  }

  // Build base state from disk
  const rawAgents = Array.isArray(state.agents) ? state.agents : []
  const rawSettings = state.settings && typeof state.settings === 'object'
    ? (state.settings as Record<string, unknown>)
    : {}

  // v1→v2: Strip execution fields from agents; v2→v3: jiraKey→name
  const agents: Agent[] = rawAgents.map((a: Record<string, unknown>) => ({
    id: typeof a.id === 'string' ? a.id : '',
    name: typeof a.name === 'string' ? a.name : (typeof a.jiraKey === 'string' ? a.jiraKey : ''),
    branchName: typeof a.branchName === 'string' ? a.branchName : '',
    baseBranch: typeof a.baseBranch === 'string' ? a.baseBranch : 'main',
    worktreePath: typeof a.worktreePath === 'string' ? a.worktreePath : '',
    createdAt: typeof a.createdAt === 'string' ? a.createdAt : new Date().toISOString(),
  }))

  // v1→v2: Strip execution settings; v2→v3: remove jiraBaseUrl, add tool enablement
  const settings: Settings = {
    ...(typeof rawSettings.baseBranch === 'string' ? { baseBranch: rawSettings.baseBranch } : {}),
    ...(typeof rawSettings.worktreesDirName === 'string' ? { worktreesDirName: rawSettings.worktreesDirName } : {}),
    ...(typeof rawSettings.ollamaModel === 'string' ? { ollamaModel: rawSettings.ollamaModel } : {}),
    ...(typeof rawSettings.ollamaBaseUrl === 'string' ? { ollamaBaseUrl: rawSettings.ollamaBaseUrl } : {}),
    ...(typeof rawSettings.darkMode === 'boolean' ? { darkMode: rawSettings.darkMode } : {}),
    ...(typeof rawSettings.enableCursor === 'boolean' ? { enableCursor: rawSettings.enableCursor } : {}),
    ...(typeof rawSettings.enableClaude === 'boolean' ? { enableClaude: rawSettings.enableClaude } : {}),
    ...(typeof rawSettings.enableClaudeOllama === 'boolean' ? { enableClaudeOllama: rawSettings.enableClaudeOllama } : {}),
    ...(typeof rawSettings.onboardingComplete === 'boolean' ? { onboardingComplete: rawSettings.onboardingComplete } : {}),
    ...(typeof rawSettings.enableGitMode === 'boolean' ? { enableGitMode: rawSettings.enableGitMode } : {}),
  }

  return {
    version: CURRENT_STATE_VERSION,
    repoPath: typeof state.repoPath === 'string' ? state.repoPath : '',
    worktreesRootPath: typeof state.worktreesRootPath === 'string' ? state.worktreesRootPath : '',
    agentsMdPath: state.agentsMdPath != null ? String(state.agentsMdPath) : null,
    agentsMdContents: state.agentsMdContents != null ? String(state.agentsMdContents) : null,
    agents,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    lastUpdated: typeof state.lastUpdated === 'string' ? state.lastUpdated : new Date().toISOString(),
  }
}

/**
 * Validate agent worktree paths after loading.
 * Agents whose worktreePath is missing are filtered out.
 */
function validateAgentWorktrees(state: AppState): AppState {
  const agents = state.agents.filter((agent) => {
    if (!agent.worktreePath) return false
    try {
      return fs.existsSync(agent.worktreePath) && fs.statSync(agent.worktreePath).isDirectory()
    } catch {
      return false
    }
  })
  return { ...state, agents }
}

/**
 * Load state from disk. Runs migrations. Returns error if file is corrupt or unknown version.
 */
export function loadState(): LoadStateResponse {
  migrateDirectory()
  const statePath = getStatePath()
  try {
    const raw = fs.readFileSync(statePath, 'utf-8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    let state = migrate(parsed)
    if (state.repoPath) {
      try {
        if (!fs.existsSync(state.repoPath) || !fs.statSync(state.repoPath).isDirectory()) {
          state = defaultState()
          saveState(state)
        }
      } catch {
        state = defaultState()
        saveState(state)
      }
    }
    state = validateAgentWorktrees(state)
    return { ok: true, state }
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException
    if (err.code === 'ENOENT') {
      return { ok: true, state: defaultState() }
    }
    const message = err instanceof Error ? err.message : String(e)
    return {
      ok: false,
      code: 'LOAD_FAILED',
      message: `Failed to load state: ${message}`,
    }
  }
}

const RESTRICTIVE_MODE = 0o600

/**
 * Save state to disk. Ensures directory exists, writes to temp then renames, then chmod 600.
 */
export function saveState(state: AppState): { ok: true } | { ok: false; code: string; message: string } {
  const dir = getStateDir()
  const statePath = getStatePath()
  const tempPath = `${statePath}.${process.pid}.${Date.now()}.tmp`
  const toWrite: AppState = {
    ...state,
    lastUpdated: new Date().toISOString(),
  }
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(tempPath, JSON.stringify(toWrite, null, 2), 'utf-8')
    fs.chmodSync(tempPath, RESTRICTIVE_MODE)
    fs.renameSync(tempPath, statePath)
    fs.chmodSync(statePath, RESTRICTIVE_MODE)
    return { ok: true }
  } catch (e) {
    try { fs.unlinkSync(tempPath) } catch { /* ignore */ }
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, code: 'SAVE_FAILED', message: `Failed to save state: ${message}` }
  }
}
