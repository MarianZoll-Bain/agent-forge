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

// ---- Pull main branch (ff-only) ----

export interface PullMainBranchSuccess {
  ok: true
  updatedSha: string
  summary: string
}

export interface PullMainBranchError {
  ok: false
  code: string
  message: string
}

export type PullMainBranchResponse = PullMainBranchSuccess | PullMainBranchError

export async function pullMainBranch(
  repoPath: string,
  branch: string,
): Promise<PullMainBranchResponse> {
  try {
    const { execa } = await import('execa')

    // Fetch latest from origin
    await execa('git', ['fetch', 'origin'], { cwd: repoPath })

    // Fast-forward only pull — fails cleanly if local has diverged
    const pullResult = await execa('git', ['pull', '--ff-only', 'origin', branch], { cwd: repoPath })

    // Get the updated HEAD sha
    const shaResult = await execa('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoPath })
    const updatedSha = shaResult.stdout.trim()

    const summary = pullResult.stdout.trim() || 'Already up to date.'
    return { ok: true, updatedSha, summary }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Not possible to fast-forward') || msg.includes('fatal: Not possible')) {
      return { ok: false, code: 'FF_ONLY_FAILED', message: `Cannot fast-forward ${branch}. Local branch has diverged from origin.` }
    }
    return { ok: false, code: 'PULL_FAILED', message: msg }
  }
}

// ---- Pull worktree (ff-only) ----

export interface PullWorktreeSuccess {
  ok: true
  updatedSha: string
  summary: string
}

export interface PullWorktreeError {
  ok: false
  code: string
  message: string
}

export type PullWorktreeResponse = PullWorktreeSuccess | PullWorktreeError

export async function pullWorktree(
  worktreePath: string,
  branch: string,
): Promise<PullWorktreeResponse> {
  try {
    const { execa } = await import('execa')

    await execa('git', ['fetch', 'origin'], { cwd: worktreePath })

    const pullResult = await execa('git', ['pull', '--ff-only', 'origin', branch], { cwd: worktreePath })

    const shaResult = await execa('git', ['rev-parse', '--short', 'HEAD'], { cwd: worktreePath })
    const updatedSha = shaResult.stdout.trim()

    const summary = pullResult.stdout.trim() || 'Already up to date.'
    return { ok: true, updatedSha, summary }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Not possible to fast-forward') || msg.includes('fatal: Not possible')) {
      return { ok: false, code: 'FF_ONLY_FAILED', message: `Cannot fast-forward ${branch}. Local branch has diverged from origin.` }
    }
    return { ok: false, code: 'PULL_FAILED', message: msg }
  }
}

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
