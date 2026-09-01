/**
 * Detect hosting platform (GitHub vs GitLab) from the git remote URL.
 * For self-hosted instances where the hostname doesn't contain "github" or "gitlab",
 * falls back to probing the `glab` and `gh` CLIs.
 */

import type { HostingType } from '../../shared/types'

/**
 * Parse a git remote URL and determine the hosting platform.
 * Supports HTTPS (`https://github.com/...`) and SSH (`git@gitlab.com:...`) formats.
 * Returns 'unknown' for self-hosted instances with non-obvious hostnames.
 */
export function parseHostingType(remoteUrl: string): HostingType {
  const lower = remoteUrl.toLowerCase()

  // Extract hostname from HTTPS or SSH URL
  // HTTPS: https://github.com/user/repo.git
  // SSH:   git@gitlab.com:user/repo.git
  let hostname = ''

  const httpsMatch = lower.match(/^https?:\/\/([^/:]+)/)
  if (httpsMatch) {
    hostname = httpsMatch[1]
  } else {
    const sshMatch = lower.match(/@([^:]+):/)
    if (sshMatch) {
      hostname = sshMatch[1]
    }
  }

  if (!hostname) return 'unknown'

  if (hostname.includes('github')) return 'github'
  if (hostname.includes('gitlab')) return 'gitlab'

  return 'unknown'
}

/**
 * Probe CLIs to detect hosting type for self-hosted instances.
 * Tries `glab repo view` then `gh repo view` — whichever succeeds first wins.
 */
async function probeHostingType(repoPath: string): Promise<HostingType> {
  const { execa } = await import('execa')
  const TIMEOUT_MS = 8_000

  // Try glab first (self-hosted GitLab is the common case for 'unknown')
  try {
    await execa('glab', ['repo', 'view'], { cwd: repoPath, timeout: TIMEOUT_MS, reject: true })
    return 'gitlab'
  } catch {
    // glab didn't recognize it
  }

  // Try gh
  try {
    await execa('gh', ['repo', 'view', '--json', 'name'], { cwd: repoPath, timeout: TIMEOUT_MS, reject: true })
    return 'github'
  } catch {
    // gh didn't recognize it either
  }

  return 'unknown'
}

/**
 * Detect the hosting type for a repository by reading its `origin` remote URL.
 * If the hostname doesn't match a known pattern, probes `glab`/`gh` CLIs as fallback.
 */
export async function detectHostingType(repoPath: string): Promise<HostingType> {
  try {
    const { execa } = await import('execa')
    const { stdout } = await execa('git', ['remote', 'get-url', 'origin'], {
      cwd: repoPath,
      timeout: 5_000,
    })
    const fromUrl = parseHostingType(stdout.trim())
    if (fromUrl !== 'unknown') return fromUrl

    // Hostname didn't match — probe CLIs for self-hosted instances
    return probeHostingType(repoPath)
  } catch {
    return 'unknown'
  }
}
