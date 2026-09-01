import { describe, it, expect } from 'vitest'
import { parseHostingType } from './hostingDetector'

describe('parseHostingType', () => {
  it('detects GitHub HTTPS URLs', () => {
    expect(parseHostingType('https://github.com/user/repo.git')).toBe('github')
    expect(parseHostingType('https://github.com/user/repo')).toBe('github')
  })

  it('detects GitHub SSH URLs', () => {
    expect(parseHostingType('git@github.com:user/repo.git')).toBe('github')
    expect(parseHostingType('git@github.com:org/repo')).toBe('github')
  })

  it('detects GitLab HTTPS URLs', () => {
    expect(parseHostingType('https://gitlab.com/user/repo.git')).toBe('gitlab')
    expect(parseHostingType('https://gitlab.com/group/subgroup/repo')).toBe('gitlab')
  })

  it('detects GitLab SSH URLs', () => {
    expect(parseHostingType('git@gitlab.com:user/repo.git')).toBe('gitlab')
    expect(parseHostingType('git@gitlab.com:group/subgroup/repo.git')).toBe('gitlab')
  })

  it('detects self-hosted GitLab instances', () => {
    expect(parseHostingType('https://gitlab.example.com/user/repo.git')).toBe('gitlab')
    expect(parseHostingType('git@gitlab.corp.net:team/repo.git')).toBe('gitlab')
  })

  it('detects GitHub Enterprise', () => {
    expect(parseHostingType('https://github.enterprise.com/org/repo.git')).toBe('github')
    expect(parseHostingType('git@github.corp.net:team/repo.git')).toBe('github')
  })

  it('returns unknown for other hosts (probing needed)', () => {
    expect(parseHostingType('https://bitbucket.org/user/repo.git')).toBe('unknown')
    expect(parseHostingType('git@bitbucket.org:user/repo.git')).toBe('unknown')
    // Self-hosted GitLab without "gitlab" in hostname — requires CLI probe
    expect(parseHostingType('git@code.siemens.com:team/repo.git')).toBe('unknown')
    expect(parseHostingType('https://code.corp.net/team/repo.git')).toBe('unknown')
  })

  it('returns unknown for empty or malformed URLs', () => {
    expect(parseHostingType('')).toBe('unknown')
    expect(parseHostingType('not-a-url')).toBe('unknown')
  })
})
