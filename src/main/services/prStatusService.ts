/**
 * PR status detection via GitHub CLI (`gh pr view`).
 * Returns PR info for a branch, or hasPR: false if no PR exists.
 */

export interface PRStatus {
  hasPR: boolean
  prUrl?: string
  prNumber?: number
  prState?: string // 'OPEN' | 'CLOSED' | 'MERGED'
  isDraft?: boolean
}

export type PRStatusResult = { ok: true } & PRStatus
export type PRStatusError = { ok: false; code: string; message: string }
export type PRStatusResponse = PRStatusResult | PRStatusError

const TIMEOUT_MS = 10_000

export async function getPRStatus(worktreePath: string, branchName: string): Promise<PRStatusResponse> {
  try {
    const { execa } = await import('execa')
    const { stdout } = await execa(
      'gh',
      ['pr', 'view', branchName, '--json', 'url,state,number,isDraft'],
      { cwd: worktreePath, timeout: TIMEOUT_MS },
    )
    const parsed = JSON.parse(stdout) as { url?: string; state?: string; number?: number; isDraft?: boolean }
    return {
      ok: true,
      hasPR: true,
      prUrl: typeof parsed.url === 'string' ? parsed.url : undefined,
      prNumber: typeof parsed.number === 'number' ? parsed.number : undefined,
      prState: typeof parsed.state === 'string' ? parsed.state : undefined,
      isDraft: typeof parsed.isDraft === 'boolean' ? parsed.isDraft : undefined,
    }
  } catch (e: unknown) {
    // gh exits non-zero when no PR exists for the branch
    if (e && typeof e === 'object' && 'exitCode' in e && (e as { exitCode: number }).exitCode !== 0) {
      return { ok: true, hasPR: false }
    }
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, code: 'PR_STATUS_FAILED', message: msg }
  }
}
