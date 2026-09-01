/**
 * PR/MR status detection via GitHub CLI (`gh`) or GitLab CLI (`glab`).
 * Returns PR/MR info for a branch, or hasPR: false if none exists.
 */

import type { HostingType } from '../../shared/types'

export interface PRStatus {
  hasPR: boolean
  prUrl?: string
  prNumber?: number
  prState?: string // 'OPEN' | 'CLOSED' | 'MERGED'
  isDraft?: boolean
  reviewDecision?: string // 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | ''
}

export type PRStatusResult = { ok: true } & PRStatus
export type PRStatusError = { ok: false; code: string; message: string }
export type PRStatusResponse = PRStatusResult | PRStatusError

const TIMEOUT_MS = 10_000

async function getGitHubPRStatus(worktreePath: string, branchName: string): Promise<PRStatusResponse> {
  try {
    const { execa } = await import('execa')
    const { stdout } = await execa(
      'gh',
      ['pr', 'view', branchName, '--json', 'url,state,number,isDraft,reviewDecision'],
      { cwd: worktreePath, timeout: TIMEOUT_MS },
    )
    const parsed = JSON.parse(stdout) as { url?: string; state?: string; number?: number; isDraft?: boolean; reviewDecision?: string }
    return {
      ok: true,
      hasPR: true,
      prUrl: typeof parsed.url === 'string' ? parsed.url : undefined,
      prNumber: typeof parsed.number === 'number' ? parsed.number : undefined,
      prState: typeof parsed.state === 'string' ? parsed.state : undefined,
      isDraft: typeof parsed.isDraft === 'boolean' ? parsed.isDraft : undefined,
      reviewDecision: typeof parsed.reviewDecision === 'string' ? parsed.reviewDecision : undefined,
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

/** Map glab MR state to our unified prState values. */
function mapGitLabState(state: string): string {
  switch (state) {
    case 'opened': return 'OPEN'
    case 'closed': return 'CLOSED'
    case 'merged': return 'MERGED'
    default: return state.toUpperCase()
  }
}

async function getGitLabMRStatus(worktreePath: string, branchName: string): Promise<PRStatusResponse> {
  try {
    const { execa } = await import('execa')
    const { stdout } = await execa(
      'glab',
      ['mr', 'list', '--source-branch', branchName, '--all', '-F', 'json'],
      { cwd: worktreePath, timeout: TIMEOUT_MS },
    )
    const parsed = JSON.parse(stdout) as Array<{
      iid?: number
      web_url?: string
      state?: string
      draft?: boolean
    }>
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { ok: true, hasPR: false }
    }
    const mr = parsed[0]
    return {
      ok: true,
      hasPR: true,
      prUrl: typeof mr.web_url === 'string' ? mr.web_url : undefined,
      prNumber: typeof mr.iid === 'number' ? mr.iid : undefined,
      prState: typeof mr.state === 'string' ? mapGitLabState(mr.state) : undefined,
      isDraft: typeof mr.draft === 'boolean' ? mr.draft : undefined,
      reviewDecision: undefined, // glab mr list doesn't provide review decision
    }
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'exitCode' in e && (e as { exitCode: number }).exitCode !== 0) {
      return { ok: true, hasPR: false }
    }
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, code: 'MR_STATUS_FAILED', message: msg }
  }
}

export async function getPRStatus(
  hostingType: HostingType,
  worktreePath: string,
  branchName: string,
): Promise<PRStatusResponse> {
  if (hostingType === 'gitlab') return getGitLabMRStatus(worktreePath, branchName)
  if (hostingType === 'github') return getGitHubPRStatus(worktreePath, branchName)
  return { ok: true, hasPR: false }
}
