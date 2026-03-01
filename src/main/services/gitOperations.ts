/**
 * US-012: Remove worktree.
 *
 * All git commands use argument arrays; never string-concatenate user input
 * into shell commands.
 */

import * as fs from 'node:fs'

// ---- Remove worktree ----

export interface RemoveWorktreeSuccess {
  ok: true
}

export interface RemoveWorktreeError {
  ok: false
  code: string
  message: string
}

export type RemoveWorktreeResponse = RemoveWorktreeSuccess | RemoveWorktreeError

export async function removeWorktree(
  repoPath: string,
  worktreePath: string,
): Promise<RemoveWorktreeResponse> {
  try {
    const { execa } = await import('execa')
    // Try clean removal first
    try {
      await execa('git', ['worktree', 'remove', worktreePath], { cwd: repoPath })
      return { ok: true }
    } catch {
      // Force-remove if clean removal fails (e.g. dirty working tree)
      await execa('git', ['worktree', 'remove', '--force', worktreePath], { cwd: repoPath })
      return { ok: true }
    }
  } catch (gitErr) {
    // Fallback: remove directory with fs — still succeed so agent is cleaned up
    try {
      fs.rmSync(worktreePath, { recursive: true, force: true })
      return { ok: true }
    } catch {
      const msg = gitErr instanceof Error ? gitErr.message : String(gitErr)
      return { ok: false, code: 'REMOVE_WORKTREE_FAILED', message: msg }
    }
  }
}
