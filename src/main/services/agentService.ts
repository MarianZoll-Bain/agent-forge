/**
 * Create git worktrees for agents.
 * Simplified: no provider/status/process fields. Just worktree + metadata.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as crypto from 'node:crypto'
import type { Agent } from '../../shared/types'
import type { BranchEntry, PREntry } from '../../shared/ipc-channels'

// ---- Directory copy helper ----

/**
 * Check if a path is git-ignored in the given repo.
 * Returns true if ignored, false if tracked/untracked-but-not-ignored.
 * Falls back to true (assume ignored) on error so we copy rather than skip.
 */
async function isGitIgnored(repoPath: string, relativePath: string): Promise<boolean> {
  try {
    const { execa } = await import('execa')
    // git check-ignore exits 0 if ignored, 1 if not ignored
    const result = await execa('git', ['check-ignore', '-q', relativePath], { cwd: repoPath, reject: false })
    return result.exitCode === 0
  } catch {
    return true // assume ignored → safe to copy
  }
}

/**
 * Recursively copy a directory from repo root to worktree, but only if it's
 * git-ignored (tracked files are already present in worktrees via git).
 */
async function copyDirToWorktreeIfIgnored(
  repoPath: string,
  worktreePath: string,
  dirName: string,
): Promise<void> {
  const srcDir = path.join(repoPath, dirName)
  if (!fs.existsSync(srcDir)) return

  const ignored = await isGitIgnored(repoPath, dirName)
  if (!ignored) return // tracked by git → already in worktree

  const destDir = path.join(worktreePath, dirName)
  fs.cpSync(srcDir, destDir, { recursive: true })
}

// ---- Path helpers ----

function sanitizeForPath(key: string): string {
  return key.replace(/[^A-Za-z0-9\-_.]/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '')
}

function branchSlug(branchName: string): string {
  return crypto.createHash('sha256').update(branchName).digest('hex').slice(0, 6)
}

// ---- Git helpers ----

interface WorktreeEntry {
  worktree: string
  branch?: string
}

async function listWorktrees(repoPath: string): Promise<WorktreeEntry[]> {
  const { execa } = await import('execa')
  const { stdout } = await execa('git', ['worktree', 'list', '--porcelain'], { cwd: repoPath })
  const entries: WorktreeEntry[] = []
  let current: Partial<WorktreeEntry> = {}
  for (const line of stdout.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current.worktree) entries.push(current as WorktreeEntry)
      current = { worktree: line.slice('worktree '.length).trim() }
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice('branch '.length).trim().replace('refs/heads/', '')
    } else if (line === '') {
      if (current.worktree) {
        entries.push(current as WorktreeEntry)
        current = {}
      }
    }
  }
  if (current.worktree) entries.push(current as WorktreeEntry)
  return entries
}

async function branchExistsLocally(repoPath: string, branchName: string): Promise<boolean> {
  try {
    const { execa } = await import('execa')
    const { stdout } = await execa('git', ['branch', '--list', branchName], { cwd: repoPath })
    return stdout.trim().length > 0
  } catch {
    return false
  }
}

async function remoteBranchExists(repoPath: string, baseBranch: string): Promise<boolean> {
  try {
    const { execa } = await import('execa')
    await execa('git', ['rev-parse', '--verify', `origin/${baseBranch}`], { cwd: repoPath })
    return true
  } catch {
    return false
  }
}

async function doCreateGitWorktree(
  repoPath: string,
  worktreePath: string,
  branchName: string,
  baseBranch: string,
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const { execa } = await import('execa')
  const localExists = await branchExistsLocally(repoPath, branchName)
  try {
    if (localExists) {
      await execa('git', ['worktree', 'add', worktreePath, branchName], { cwd: repoPath })
    } else {
      // Check if the branch itself exists on remote (existing remote branch scenario)
      const remoteBranchSameName = await remoteBranchExists(repoPath, branchName)
      if (remoteBranchSameName) {
        // Create worktree tracking the remote branch with the same name
        await execa(
          'git',
          ['worktree', 'add', '-b', branchName, worktreePath, `origin/${branchName}`],
          { cwd: repoPath },
        )
      } else {
        // New branch: create from base branch
        const remoteExists = await remoteBranchExists(repoPath, baseBranch)
        if (!remoteExists) {
          return {
            ok: false,
            code: 'NO_REMOTE_BRANCH',
            message: `Remote branch origin/${baseBranch} not found. Check the base branch name.`,
          }
        }
        await execa(
          'git',
          ['worktree', 'add', '-b', branchName, worktreePath, `origin/${baseBranch}`],
          { cwd: repoPath },
        )
      }
    }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, code: 'WORKTREE_CREATE_FAILED', message: `Failed to create worktree: ${msg}` }
  }
}

// ---- Branch listing ----

export async function listRepoBranches(repoPath: string): Promise<BranchEntry[]> {
  const { execa } = await import('execa')

  // Fetch latest remote refs
  try {
    await execa('git', ['fetch', 'origin'], { cwd: repoPath })
  } catch {
    // Non-fatal: we can still list local + cached remote branches
  }

  const { stdout } = await execa('git', ['branch', '-a', '--no-color'], { cwd: repoPath })

  const localBranches = new Set<string>()
  const remoteBranches = new Set<string>()

  for (const line of stdout.split('\n')) {
    const trimmed = line.replace(/^\*?\s+/, '').trim()
    if (!trimmed) continue
    // Skip detached HEAD entries like "remotes/origin/HEAD -> origin/main"
    if (trimmed.includes('->')) continue

    if (trimmed.startsWith('remotes/origin/')) {
      const name = trimmed.replace('remotes/origin/', '')
      if (name) remoteBranches.add(name)
    } else {
      localBranches.add(trimmed)
    }
  }

  // Merge: deduplicate where local + remote exist
  const allNames = new Set([...localBranches, ...remoteBranches])
  const entries: BranchEntry[] = []
  for (const name of allNames) {
    entries.push({
      name,
      isLocal: localBranches.has(name),
      isRemote: remoteBranches.has(name),
    })
  }

  entries.sort((a, b) => a.name.localeCompare(b.name))
  return entries
}

// ---- PR listing ----

export async function listRepoPRs(repoPath: string): Promise<PREntry[]> {
  const { execa } = await import('execa')
  const { stdout } = await execa(
    'gh',
    ['pr', 'list', '--json', 'number,title,headRefName,author,url,isDraft', '--limit', '50', '--state', 'open'],
    { cwd: repoPath, timeout: 10_000 },
  )
  const raw: Array<{
    number: number
    title: string
    headRefName: string
    author: { login: string }
    url: string
    isDraft: boolean
  }> = JSON.parse(stdout)

  return raw
    .map((pr) => ({
      number: pr.number,
      title: pr.title,
      branchName: pr.headRefName,
      author: pr.author.login,
      url: pr.url,
      isDraft: pr.isDraft,
    }))
    .sort((a, b) => b.number - a.number)
}

// ---- Public API ----

export interface CreateAgentParams {
  name: string
  branchName: string
  baseBranch: string
  worktreesRootPath: string
  repoPath: string
  /** Copy .env from repo root to the new worktree. Default: true. */
  copyEnvToWorktree?: boolean
  /** Copy .claude/ directory from repo root to the new worktree. Default: true. */
  copyClaudeConfig?: boolean
  /** Copy .cursor/ directory from repo root to the new worktree. Default: true. */
  copyCursorConfig?: boolean
}

export interface CreateAgentResult {
  ok: true
  agent: Agent
}

export interface CreateAgentError {
  ok: false
  code: string
  message: string
}

export type CreateAgentResponse = CreateAgentResult | CreateAgentError

export async function createWorktreeForAgent(params: CreateAgentParams): Promise<CreateAgentResponse> {
  const { name, branchName, baseBranch, worktreesRootPath, repoPath } = params

  const resolvedRoot = path.resolve(worktreesRootPath)
  const sanitizedKey = sanitizeForPath(name)

  if (!sanitizedKey) {
    return { ok: false, code: 'INVALID_NAME', message: 'Cannot derive a safe directory name from the given name' }
  }

  // git fetch origin
  try {
    const { execa } = await import('execa')
    await execa('git', ['fetch', 'origin'], { cwd: repoPath })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, code: 'FETCH_FAILED', message: `git fetch origin failed: ${msg}` }
  }

  // List existing worktrees
  let worktrees: WorktreeEntry[]
  try {
    worktrees = await listWorktrees(repoPath)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, code: 'WORKTREE_LIST_FAILED', message: `Failed to list worktrees: ${msg}` }
  }

  // Determine and validate worktree path
  const defaultWorktreePath = path.join(resolvedRoot, sanitizedKey)

  if (!isUnderRoot(defaultWorktreePath, resolvedRoot)) {
    return { ok: false, code: 'PATH_TRAVERSAL', message: 'Derived worktree path is outside the worktrees root' }
  }

  let finalWorktreePath: string

  const existingAtDefault = worktrees.find(
    (w) => path.resolve(w.worktree) === path.resolve(defaultWorktreePath),
  )

  if (existingAtDefault) {
    const check = checkBranchMatch(existingAtDefault, branchName)
    if (!check.ok) return check
    finalWorktreePath = path.resolve(defaultWorktreePath)
  } else if (fs.existsSync(defaultWorktreePath)) {
    const collisionPath = path.join(resolvedRoot, `${sanitizedKey}-${branchSlug(branchName)}`)
    if (!isUnderRoot(collisionPath, resolvedRoot)) {
      return { ok: false, code: 'PATH_TRAVERSAL', message: 'Collision path is outside the worktrees root' }
    }
    finalWorktreePath = collisionPath

    const existingAtCollision = worktrees.find(
      (w) => path.resolve(w.worktree) === path.resolve(collisionPath),
    )
    if (existingAtCollision) {
      const check = checkBranchMatch(existingAtCollision, branchName)
      if (!check.ok) return check
    } else {
      const result = await doCreateGitWorktree(repoPath, finalWorktreePath, branchName, baseBranch)
      if (!result.ok) return result
    }
  } else {
    finalWorktreePath = defaultWorktreePath
    const result = await doCreateGitWorktree(repoPath, finalWorktreePath, branchName, baseBranch)
    if (!result.ok) return result
  }

  // Copy .env from repo root to the new worktree if enabled
  if (params.copyEnvToWorktree !== false) {
    const envSource = path.join(repoPath, '.env')
    const envDest = path.join(finalWorktreePath, '.env')
    try {
      if (fs.existsSync(envSource)) {
        fs.copyFileSync(envSource, envDest)
      }
    } catch {
      // Non-fatal: warn but don't fail worktree creation
    }
  }

  // Copy .claude/ directory if enabled (only when gitignored — tracked files are already in worktree)
  if (params.copyClaudeConfig !== false) {
    try {
      await copyDirToWorktreeIfIgnored(repoPath, finalWorktreePath, '.claude')
    } catch {
      // Non-fatal
    }
  }

  // Copy .cursor/ directory if enabled (only when gitignored — tracked files are already in worktree)
  if (params.copyCursorConfig !== false) {
    try {
      await copyDirToWorktreeIfIgnored(repoPath, finalWorktreePath, '.cursor')
    } catch {
      // Non-fatal
    }
  }

  const agent: Agent = {
    id: crypto.randomUUID(),
    name,
    branchName,
    baseBranch,
    worktreePath: finalWorktreePath,
    createdAt: new Date().toISOString(),
  }

  return { ok: true, agent }
}

/**
 * Discover existing worktrees inside the worktreesRoot directory.
 * For each subdirectory that is a registered git worktree, creates an Agent entry.
 * Skips directories already tracked in `existingAgents` (matched by worktreePath).
 * Uses the directory name as the agent name and the git branch as branchName.
 */
export async function discoverExistingWorktrees(
  repoPath: string,
  worktreesRootPath: string,
  existingAgents: Agent[],
): Promise<Agent[]> {
  const resolvedRoot = path.resolve(worktreesRootPath)
  if (!fs.existsSync(resolvedRoot)) return []

  const existingPaths = new Set(existingAgents.map((a) => path.resolve(a.worktreePath)))

  let worktrees: WorktreeEntry[]
  try {
    worktrees = await listWorktrees(repoPath)
  } catch {
    return []
  }

  // Build a lookup from resolved worktree path → entry
  const worktreeMap = new Map<string, WorktreeEntry>()
  for (const entry of worktrees) {
    worktreeMap.set(path.resolve(entry.worktree), entry)
  }

  const discovered: Agent[] = []

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(resolvedRoot, { withFileTypes: true })
  } catch {
    return []
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const worktreePath = path.resolve(path.join(resolvedRoot, entry.name))

    // Skip if already tracked
    if (existingPaths.has(worktreePath)) continue

    // Must be a registered git worktree
    const wtEntry = worktreeMap.get(worktreePath)
    if (!wtEntry) continue

    const dirName = entry.name
    const branchName = wtEntry.branch ?? dirName

    discovered.push({
      id: crypto.randomUUID(),
      name: dirName,
      branchName,
      baseBranch: 'main',
      worktreePath,
      createdAt: new Date().toISOString(),
    })
  }

  return discovered
}

// ---- Helpers ----

function isUnderRoot(targetPath: string, root: string): boolean {
  const resolved = path.resolve(targetPath)
  const resolvedRoot = path.resolve(root)
  return resolved.startsWith(resolvedRoot + path.sep) || resolved === resolvedRoot
}

function checkBranchMatch(
  entry: WorktreeEntry,
  expectedBranch: string,
): { ok: true } | { ok: false; code: string; message: string } {
  if (entry.branch && entry.branch !== expectedBranch) {
    return {
      ok: false,
      code: 'BRANCH_MISMATCH',
      message: `Worktree exists but is on branch ${entry.branch}, expected ${expectedBranch}`,
    }
  }
  return { ok: true }
}
