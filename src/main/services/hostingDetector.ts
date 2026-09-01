/**
 * Detect hosting platform (GitHub vs GitLab) from the git remote URL.
 */

import type { HostingType } from '../../shared/types'

/**
 * Parse a git remote URL and determine the hosting platform.
 * Supports HTTPS (`https://github.com/...`) and SSH (`git@gitlab.com:...`) formats.
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
 * Detect the hosting type for a repository by reading its `origin` remote URL.
 */
export async function detectHostingType(repoPath: string): Promise<HostingType> {
  try {
    const { execa } = await import('execa')
    const { stdout } = await execa('git', ['remote', 'get-url', 'origin'], {
      cwd: repoPath,
      timeout: 5_000,
    })
    return parseHostingType(stdout.trim())
  } catch {
    return 'unknown'
  }
}
