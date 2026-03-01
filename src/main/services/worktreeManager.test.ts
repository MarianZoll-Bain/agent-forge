/**
 * Unit tests for worktreeManager (US-004 automation hint).
 */

import { describe, it, expect } from 'vitest'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { ensureWorktreesDirectory } from './worktreeManager'

const fixturesDir = path.resolve(__dirname, '../../__fixtures__')

describe('worktreeManager', () => {
  it('creates .worktrees when missing', () => {
    const repo = path.join(fixturesDir, 'worktree-test-' + Date.now())
    fs.mkdirSync(repo, { recursive: true })
    try {
      const result = ensureWorktreesDirectory(repo)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.worktreesRootPath).toBe(path.join(repo, '.worktrees'))
        expect(fs.existsSync(result.worktreesRootPath)).toBe(true)
      }
    } finally {
      fs.rmSync(repo, { recursive: true, force: true })
    }
  })

  it('succeeds when .worktrees already exists', () => {
    const repo = path.join(fixturesDir, 'worktree-exists-' + Date.now())
    const worktreesPath = path.join(repo, '.worktrees')
    fs.mkdirSync(worktreesPath, { recursive: true })
    try {
      const result = ensureWorktreesDirectory(repo)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.worktreesRootPath).toBe(worktreesPath)
      }
    } finally {
      fs.rmSync(repo, { recursive: true, force: true })
    }
  })
})
