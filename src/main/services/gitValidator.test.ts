/**
 * Unit tests for gitValidator (US-009 automation hint).
 * Tests valid/invalid branch names using git check-ref-format.
 */

import { describe, it, expect } from 'vitest'
import { validateBranchName } from './gitValidator'

describe('validateBranchName', () => {
  it('returns invalid for empty string', async () => {
    const result = await validateBranchName('')
    expect(result.valid).toBe(false)
    expect(result.message).toBeTruthy()
  })

  it('accepts valid branch names', async () => {
    const valid = ['feature/PROJ-123-add-foo', 'main', 'fix/ABC-1-bug', 'release/1.0']
    for (const name of valid) {
      const result = await validateBranchName(name)
      expect(result.valid, `expected "${name}" to be valid`).toBe(true)
    }
  })

  it('rejects invalid branch names', async () => {
    const invalid = ['branch..name', '.hidden', 'has space', 'ends-with.', 'double//slash']
    for (const name of invalid) {
      const result = await validateBranchName(name)
      expect(result.valid, `expected "${name}" to be invalid`).toBe(false)
      expect(result.message).toBeTruthy()
    }
  })
})
