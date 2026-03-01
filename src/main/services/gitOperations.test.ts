/**
 * Tests for gitOperations (US-012).
 * Integration test for removeWorktree using a real git fixture.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { execSync } from 'node:child_process'
import { removeWorktree } from './gitOperations'

const fixturesDir = path.resolve(__dirname, '../../__fixtures__')

function makeTestRepo(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
  execSync('git init', { cwd: dir })
  execSync('git config user.email "test@test.com"', { cwd: dir })
  execSync('git config user.name "Test"', { cwd: dir })
  fs.writeFileSync(path.join(dir, 'README.md'), '# test')
  execSync('git add .', { cwd: dir })
  execSync('git commit -m "init"', { cwd: dir })
  execSync(`git remote add origin ${dir}`, { cwd: dir })
  execSync('git fetch origin', { cwd: dir })
}

describe('removeWorktree', () => {
  let repoDir: string
  let worktreePath: string

  beforeAll(() => {
    repoDir = path.join(fixturesDir, `git-remove-wt-${Date.now()}`)
    makeTestRepo(repoDir)
    worktreePath = path.join(repoDir, 'wt-test')
    execSync(`git worktree add ${worktreePath} -b wt-branch`, { cwd: repoDir })
  })

  afterAll(() => {
    try { fs.rmSync(repoDir, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  it('removes the worktree directory', async () => {
    expect(fs.existsSync(worktreePath)).toBe(true)
    const result = await removeWorktree(repoDir, worktreePath)
    expect(result.ok).toBe(true)
    expect(fs.existsSync(worktreePath)).toBe(false)
  })
})
