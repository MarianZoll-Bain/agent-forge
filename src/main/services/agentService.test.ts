/**
 * Tests for agentService (US-010 automation hint).
 * Integration tests using a real git repo fixture.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { execSync } from 'node:child_process'
import { createWorktreeForAgent } from './agentService'

const fixturesDir = path.resolve(__dirname, '../../__fixtures__')

/**
 * Create a minimal bare-like git repo with one commit and a remote 'origin' pointing to itself.
 * This avoids needing network access in tests.
 */
function makeTestRepo(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
  execSync('git init -b main', { cwd: dir })
  execSync('git config user.email "test@test.com"', { cwd: dir })
  execSync('git config user.name "Test"', { cwd: dir })
  fs.writeFileSync(path.join(dir, 'README.md'), '# test')
  execSync('git add .', { cwd: dir })
  execSync('git commit -m "init"', { cwd: dir })
  // Set remote origin to self so git fetch origin works
  execSync(`git remote add origin ${dir}`, { cwd: dir })
  execSync('git fetch origin', { cwd: dir })
}

describe('createWorktreeForAgent', () => {
  let repoDir: string
  let worktreesRoot: string

  beforeAll(() => {
    repoDir = path.join(fixturesDir, `agent-svc-repo-${Date.now()}`)
    worktreesRoot = path.join(repoDir, '.worktrees')
    makeTestRepo(repoDir)
    fs.mkdirSync(worktreesRoot, { recursive: true })
  })

  afterAll(() => {
    // Remove worktrees via git so the repo is clean for removal
    try {
      const { stdout } = require('child_process').spawnSync(
        'git',
        ['worktree', 'list', '--porcelain'],
        { cwd: repoDir, encoding: 'utf-8' },
      )
      const worktreeLines = (stdout as string)
        .split('\n')
        .filter((l: string) => l.startsWith('worktree ') && !l.endsWith(repoDir))
        .map((l: string) => l.slice('worktree '.length).trim())
      for (const wt of worktreeLines) {
        try {
          execSync(`git worktree remove --force "${wt}"`, { cwd: repoDir })
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    try {
      fs.rmSync(repoDir, { recursive: true, force: true })
    } catch { /* ignore */ }
  })

  it('creates a worktree at <worktreesRoot>/<name>', async () => {
    const result = await createWorktreeForAgent({
      name: 'ABC-1',
      branchName: 'feature/ABC-1-test',
      baseBranch: 'main',
      worktreesRootPath: worktreesRoot,
      repoPath: repoDir,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.agent.name).toBe('ABC-1')
    expect(result.agent.branchName).toBe('feature/ABC-1-test')
    expect(result.agent.createdAt).toBeTruthy()
    expect(result.agent.worktreePath).toBe(path.join(worktreesRoot, 'ABC-1'))
    expect(fs.existsSync(result.agent.worktreePath)).toBe(true)
  })

  it('reuses existing worktree with matching branch', async () => {
    // Second call for the same name + branchName should succeed (reuse)
    const result = await createWorktreeForAgent({
      name: 'ABC-1',
      branchName: 'feature/ABC-1-test',
      baseBranch: 'main',
      worktreesRootPath: worktreesRoot,
      repoPath: repoDir,
    })
    expect(result.ok).toBe(true)
  })

  it('returns BRANCH_MISMATCH when worktree exists on different branch', async () => {
    const result = await createWorktreeForAgent({
      name: 'ABC-1',
      branchName: 'feature/ABC-1-other-branch',
      baseBranch: 'main',
      worktreesRootPath: worktreesRoot,
      repoPath: repoDir,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('BRANCH_MISMATCH')
    expect(result.message).toMatch(/branch/)
  })

  it('returns NO_REMOTE_BRANCH for nonexistent base branch', async () => {
    const result = await createWorktreeForAgent({
      name: 'ABC-99',
      branchName: 'feature/ABC-99-new',
      baseBranch: 'nonexistent-base',
      worktreesRootPath: worktreesRoot,
      repoPath: repoDir,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('NO_REMOTE_BRANCH')
  })
})
