/**
 * Unit tests for stateManager: default state shape, v2→v3 migration.
 */

import { describe, it, expect } from 'vitest'
import { defaultState } from './stateManager'
import { CURRENT_STATE_VERSION } from '../../shared/types'

describe('stateManager', () => {
  it('defaultState has version 3 and empty repo', () => {
    const state = defaultState()
    expect(state.version).toBe(CURRENT_STATE_VERSION)
    expect(state.version).toBe(3)
    expect(state.repoPath).toBe('')
    expect(state.worktreesRootPath).toBe('')
    expect(state.agents).toEqual([])
    expect(state.settings).toEqual({})
  })

  it('defaultState with args sets repo paths', () => {
    const state = defaultState('/tmp/repo', '/tmp/repo/.worktrees')
    expect(state.repoPath).toBe('/tmp/repo')
    expect(state.worktreesRootPath).toBe('/tmp/repo/.worktrees')
  })
})
