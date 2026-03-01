/**
 * Unit tests for repoValidator (US-001 automation hint).
 */

import { describe, it, expect } from 'vitest'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { validateRepoPath } from './repoValidator'

const realPath = path.resolve(__dirname, '../../..')

describe('repoValidator', () => {
  it('returns NOT_DIRECTORY when path is a file', async () => {
    const f = path.join(realPath, 'package.json')
    const result = await validateRepoPath(f)
    expect(result.valid).toBe(false)
    expect(result.code).toBe('NOT_DIRECTORY')
  })

  it('returns INVALID_PATH when path does not exist', async () => {
    const result = await validateRepoPath(path.join(realPath, 'nonexistent-dir-xyz'))
    expect(result.valid).toBe(false)
    expect(result.code).toBe('INVALID_PATH')
  })

  it('returns valid with repoPath and repoName when given a git repo with origin', async () => {
    // This repo (dev-agents) is a git repo; may or may not have origin in CI
    const result = await validateRepoPath(realPath)
    if (result.valid) {
      expect(result.repoPath).toBeTruthy()
      expect(result.repoName).toBeTruthy()
      expect(path.basename(result.repoPath!)).toBe(result.repoName)
    } else {
      expect(result.code === 'NOT_GIT' || result.code === 'NO_ORIGIN').toBe(true)
    }
  })
})
