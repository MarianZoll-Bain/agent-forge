/**
 * US-001: Validates that a path is a git repository with a remote origin.
 * Uses argument arrays (execa) for all git commands; no shell concatenation.
 * Dynamic import for execa (ESM-only) when main process is built as CJS.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

export interface ValidationResult {
  valid: boolean
  repoPath?: string
  repoName?: string
  error?: string
  code?: string
}

/**
 * Resolve toplevel path. Returns null if not a git repo.
 */
async function getToplevel(dir: string): Promise<string | null> {
  try {
    const { execa } = await import('execa')
    const { stdout } = await execa('git', ['rev-parse', '--show-toplevel'], {
      cwd: dir,
    })
    const toplevel = stdout.trim()
    if (!toplevel) return null
    return toplevel
  } catch {
    return null
  }
}

/**
 * Check that remote "origin" exists.
 */
async function hasOrigin(cwd: string): Promise<boolean> {
  try {
    const { execa } = await import('execa')
    await execa('git', ['remote', 'get-url', 'origin'], { cwd })
    return true
  } catch {
    return false
  }
}

/**
 * Validate that the given path is a git repository with remote origin.
 * - Ensures path exists and is a directory
 * - Runs git rev-parse --show-toplevel
 * - Runs git remote get-url origin
 */
export async function validateRepoPath(candidatePath: string): Promise<ValidationResult> {
  const normalized = path.resolve(candidatePath)
  try {
    const stat = fs.statSync(normalized)
    if (!stat.isDirectory()) {
      return { valid: false, error: 'Path is not a directory', code: 'NOT_DIRECTORY' }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { valid: false, error: `Path does not exist or is not accessible: ${message}`, code: 'INVALID_PATH' }
  }

  const toplevel = await getToplevel(normalized)
  if (!toplevel) {
    return { valid: false, error: 'Not a git repository (no .git or invalid repo)', code: 'NOT_GIT' }
  }

  const hasOriginRemote = await hasOrigin(toplevel)
  if (!hasOriginRemote) {
    return { valid: false, error: 'Repository has no remote "origin" configured', code: 'NO_ORIGIN' }
  }

  const repoName = path.basename(toplevel)
  return {
    valid: true,
    repoPath: toplevel,
    repoName,
  }
}
