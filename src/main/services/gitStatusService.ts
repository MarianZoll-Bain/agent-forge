/**
 * US-013: Git status service.
 * Fetches dirty/clean, branch name, last commit SHA, and ahead/behind for a worktree.
 * All commands use argument arrays (no shell concatenation).
 */

export interface GitStatus {
  dirty: boolean
  branch: string
  lastCommitSha: string
  aheadBehind?: { ahead: number; behind: number }
}

export interface GitStatusSuccess {
  ok: true
  status: GitStatus
}

export interface GitStatusError {
  ok: false
  code: string
  message: string
}

export type GitStatusResponse = GitStatusSuccess | GitStatusError

export async function getGitStatus(
  worktreePath: string,
  fallbackBranch: string,
): Promise<GitStatusResponse> {
  try {
    const { execa } = await import('execa')

    // Branch name
    const branchResult = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: worktreePath,
    })
    const branch = branchResult.stdout.trim() || fallbackBranch

    // Dirty check — any output means modified/staged/untracked files
    const statusResult = await execa('git', ['status', '--porcelain'], { cwd: worktreePath })
    const dirty = statusResult.stdout.trim().length > 0

    // Last commit SHA (short, 7 chars) — may fail on a brand-new empty branch
    let lastCommitSha = ''
    try {
      const shaResult = await execa('git', ['rev-parse', '--short', 'HEAD'], {
        cwd: worktreePath,
      })
      lastCommitSha = shaResult.stdout.trim()
    } catch {
      // No commits yet; keep empty string
    }

    // Ahead/behind — may fail if remote tracking branch does not exist yet
    let aheadBehind: { ahead: number; behind: number } | undefined
    try {
      const abResult = await execa(
        'git',
        ['rev-list', '--left-right', '--count', `origin/${branch}...HEAD`],
        { cwd: worktreePath },
      )
      const parts = abResult.stdout.trim().split('\t')
      if (parts.length === 2) {
        const behind = parseInt(parts[0], 10)
        const ahead = parseInt(parts[1], 10)
        if (!isNaN(ahead) && !isNaN(behind)) {
          aheadBehind = { ahead, behind }
        }
      }
    } catch {
      // Remote tracking branch may not exist; silently omit ahead/behind
    }

    return { ok: true, status: { dirty, branch, lastCommitSha, aheadBehind } }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, code: 'GIT_STATUS_FAILED', message: msg }
  }
}
