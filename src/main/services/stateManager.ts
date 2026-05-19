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
import type { Agent, AppState, Project, Settings } from '../../shared/types'
import { CURRENT_STATE_VERSION, DEFAULT_SETTINGS } from '../../shared/types'
import { randomUUID } from 'node:crypto'
import { isPermissionError, getPermissionGuidance } from './permissionCheck'

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

export interface StateWarning {
  code: string
  message: string
}

export interface LoadStateResult {
  ok: true
  state: AppState
  warning?: StateWarning
}

export interface LoadStateError {
  ok: false
  code: string
  message: string
}

export type LoadStateResponse = LoadStateResult | LoadStateError

export function defaultState(): AppState {
  return {
    version: CURRENT_STATE_VERSION,
    projects: [],
    currentProjectId: null,
    settings: { ...DEFAULT_SETTINGS },
    lastUpdated: new Date().toISOString(),
  }
}

/** Get the active project from state. */
export function getActiveProject(state: AppState): Project | undefined {
  if (!state.currentProjectId) return undefined
  return state.projects.find((p) => p.id === state.currentProjectId)
}

/** Find which project an agent belongs to (searches all projects). */
export function findAgentProject(state: AppState, agentId: string): { project: Project; agent: Agent } | undefined {
  for (const project of state.projects) {
    const agent = project.agents.find((a) => a.id === agentId)
    if (agent) return { project, agent }
  }
  return undefined
}

/** Update a specific project within the state. */
export function updateProject(state: AppState, projectId: string, updater: (p: Project) => Project): AppState {
  return {
    ...state,
    projects: state.projects.map((p) => (p.id === projectId ? updater(p) : p)),
  }
}

/** Parse raw settings from any version into a clean Settings object. */
function migrateSettings(rawSettings: Record<string, unknown>): Settings {
  return {
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
}

/** Parse raw agents array from any version into clean Agent[]. */
function migrateAgents(rawAgents: unknown[]): Agent[] {
  return rawAgents.map((a: Record<string, unknown>) => ({
    id: typeof a.id === 'string' ? a.id : '',
    name: typeof a.name === 'string' ? a.name : (typeof a.jiraKey === 'string' ? a.jiraKey : ''),
    branchName: typeof a.branchName === 'string' ? a.branchName : '',
    baseBranch: typeof a.baseBranch === 'string' ? a.baseBranch : 'main',
    worktreePath: typeof a.worktreePath === 'string' ? a.worktreePath : '',
    createdAt: typeof a.createdAt === 'string' ? a.createdAt : new Date().toISOString(),
  }))
}

/**
 * Migrate old state to current schema.
 * v0→v1: ensure base fields
 * v1→v2: strip execution fields from agents and settings
 * v2→v3: jiraKey→name
 * v3→v4: single-repo → multi-project
 */
function migrate(state: Record<string, unknown>): AppState {
  const version = typeof state.version === 'number' ? state.version : 0
  if (version > CURRENT_STATE_VERSION) {
    throw new Error(`Unknown state version: ${version}`)
  }

  const rawSettings = state.settings && typeof state.settings === 'object'
    ? (state.settings as Record<string, unknown>)
    : {}
  const settings: Settings = { ...DEFAULT_SETTINGS, ...migrateSettings(rawSettings) }
  const lastUpdated = typeof state.lastUpdated === 'string' ? state.lastUpdated : new Date().toISOString()

  // v4+: already multi-project format
  if (version >= 4 && Array.isArray(state.projects)) {
    const projects: Project[] = (state.projects as Record<string, unknown>[]).map((p) => ({
      id: typeof p.id === 'string' ? p.id : randomUUID(),
      repoPath: typeof p.repoPath === 'string' ? p.repoPath : '',
      worktreesRootPath: typeof p.worktreesRootPath === 'string' ? p.worktreesRootPath : '',
      agentsMdPath: p.agentsMdPath != null ? String(p.agentsMdPath) : null,
      agentsMdContents: p.agentsMdContents != null ? String(p.agentsMdContents) : null,
      agents: Array.isArray(p.agents) ? migrateAgents(p.agents as unknown[]) : [],
      hasRootEnvFile: typeof p.hasRootEnvFile === 'boolean' ? p.hasRootEnvFile : undefined,
      colorIndex: typeof p.colorIndex === 'number' ? p.colorIndex : undefined,
    }))
    // Backfill missing colorIndex values with sequential indices
    const usedColors = new Set(projects.filter((p) => p.colorIndex != null).map((p) => p.colorIndex!))
    for (const p of projects) {
      if (p.colorIndex == null) {
        let idx = 0
        while (usedColors.has(idx)) idx++
        p.colorIndex = idx
        usedColors.add(idx)
      }
    }
    return {
      version: CURRENT_STATE_VERSION,
      projects,
      currentProjectId: typeof state.currentProjectId === 'string' ? state.currentProjectId : null,
      settings,
      lastUpdated,
    }
  }

  // v0–v3: single-repo format → wrap into a project
  const rawAgents = Array.isArray(state.agents) ? state.agents : []
  const agents = migrateAgents(rawAgents)
  const repoPath = typeof state.repoPath === 'string' ? state.repoPath : ''

  const projects: Project[] = []
  let currentProjectId: string | null = null

  if (repoPath) {
    const projectId = randomUUID()
    projects.push({
      id: projectId,
      repoPath,
      worktreesRootPath: typeof state.worktreesRootPath === 'string' ? state.worktreesRootPath : '',
      agentsMdPath: state.agentsMdPath != null ? String(state.agentsMdPath) : null,
      agentsMdContents: state.agentsMdContents != null ? String(state.agentsMdContents) : null,
      agents,
      colorIndex: 0,
    })
    currentProjectId = projectId
  }

  return {
    version: CURRENT_STATE_VERSION,
    projects,
    currentProjectId,
    settings,
    lastUpdated,
  }
}

/** Filter out agents whose worktreePath no longer exists on disk. */
function filterValidAgents(agents: Agent[]): Agent[] {
  return agents.filter((agent) => {
    if (!agent.worktreePath) return false
    try {
      return fs.existsSync(agent.worktreePath) && fs.statSync(agent.worktreePath).isDirectory()
    } catch (e: unknown) {
      if (isPermissionError(e)) return true
      return false
    }
  })
}

/**
 * Validate agent worktree paths for all projects after loading.
 * Agents whose worktreePath is missing are filtered out.
 */
function validateAgentWorktrees(state: AppState): AppState {
  return {
    ...state,
    projects: state.projects.map((p) => ({
      ...p,
      agents: filterValidAgents(p.agents),
    })),
  }
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
    let warning: StateWarning | undefined

    // Validate each project's repoPath; remove projects whose repos no longer exist
    const validProjects: Project[] = []
    for (const project of state.projects) {
      if (!project.repoPath) continue
      try {
        if (fs.existsSync(project.repoPath) && fs.statSync(project.repoPath).isDirectory()) {
          validProjects.push(project)
        }
      } catch (e: unknown) {
        if (isPermissionError(e)) {
          // Keep — likely still exists but macOS TCC is blocking
          validProjects.push(project)
          const guidance = getPermissionGuidance(project.repoPath)
          warning = {
            code: 'PERMISSION_DENIED',
            message: guidance ?? (
              'Permission denied when accessing a repository folder. ' +
              'Check System Settings > Privacy & Security > Files and Folders.'
            ),
          }
        }
        // else: skip this project (repo gone)
      }
    }
    state = { ...state, projects: validProjects }

    // Fix currentProjectId if it no longer points to a valid project
    if (state.currentProjectId && !state.projects.find((p) => p.id === state.currentProjectId)) {
      state = { ...state, currentProjectId: state.projects[0]?.id ?? null }
    }

    state = validateAgentWorktrees(state)
    return { ok: true, state, warning }
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
