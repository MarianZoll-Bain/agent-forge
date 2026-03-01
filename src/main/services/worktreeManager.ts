/**
 * US-004: Create and manage .worktrees directory structure.
 * After repo selection, ensures <repoPath>/.worktrees/ exists.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const WORKTREES_DIR = '.worktrees'

export interface EnsureWorktreesResult {
  ok: true
  worktreesRootPath: string
}

export interface EnsureWorktreesError {
  ok: false
  code: string
  message: string
}

export type EnsureWorktreesResponse = EnsureWorktreesResult | EnsureWorktreesError

/**
 * Ensures <repoPath>/.worktrees/ exists. Creates it (and parents) if missing.
 * Does not fail if directory already exists.
 */
export function ensureWorktreesDirectory(repoPath: string): EnsureWorktreesResponse {
  const resolvedRepo = path.resolve(repoPath)
  const worktreesRootPath = path.join(resolvedRepo, WORKTREES_DIR)
  try {
    fs.mkdirSync(worktreesRootPath, { recursive: true })
    return { ok: true, worktreesRootPath }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      code: 'WORKTREES_MKDIR_FAILED',
      message: `Could not create worktrees directory: ${message}`,
    }
  }
}
