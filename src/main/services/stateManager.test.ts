/**
 * Unit tests for stateManager: default state shape, v3→v4 migration.
 */

import { describe, it, expect } from 'vitest'
import { defaultState, getActiveProject, findAgentProject, updateProject } from './stateManager'
import { CURRENT_STATE_VERSION } from '../../shared/types'
import type { AppState, Project } from '../../shared/types'

describe('stateManager', () => {
  it('defaultState has version 4 and empty projects', () => {
    const state = defaultState()
    expect(state.version).toBe(CURRENT_STATE_VERSION)
    expect(state.version).toBe(4)
    expect(state.projects).toEqual([])
    expect(state.currentProjectId).toBeNull()
    expect(state.settings).toEqual({})
  })

  it('getActiveProject returns the current project', () => {
    const project: Project = {
      id: 'p1',
      repoPath: '/tmp/repo',
      worktreesRootPath: '/tmp/repo/.worktrees',
      agentsMdPath: null,
      agentsMdContents: null,
      agents: [],
    }
    const state: AppState = {
      ...defaultState(),
      projects: [project],
      currentProjectId: 'p1',
    }
    expect(getActiveProject(state)).toEqual(project)
    expect(getActiveProject({ ...state, currentProjectId: null })).toBeUndefined()
    expect(getActiveProject({ ...state, currentProjectId: 'nonexistent' })).toBeUndefined()
  })

  it('findAgentProject searches all projects', () => {
    const agent = { id: 'a1', name: 'Test', branchName: 'feature/test', baseBranch: 'main', worktreePath: '/tmp/wt', createdAt: '2024-01-01' }
    const p1: Project = { id: 'p1', repoPath: '/r1', worktreesRootPath: '', agentsMdPath: null, agentsMdContents: null, agents: [] }
    const p2: Project = { id: 'p2', repoPath: '/r2', worktreesRootPath: '', agentsMdPath: null, agentsMdContents: null, agents: [agent] }
    const state: AppState = { ...defaultState(), projects: [p1, p2], currentProjectId: 'p1' }
    const found = findAgentProject(state, 'a1')
    expect(found?.project.id).toBe('p2')
    expect(found?.agent.id).toBe('a1')
    expect(findAgentProject(state, 'nonexistent')).toBeUndefined()
  })

  it('updateProject updates a specific project', () => {
    const p1: Project = { id: 'p1', repoPath: '/r1', worktreesRootPath: '', agentsMdPath: null, agentsMdContents: null, agents: [] }
    const p2: Project = { id: 'p2', repoPath: '/r2', worktreesRootPath: '', agentsMdPath: null, agentsMdContents: null, agents: [] }
    const state: AppState = { ...defaultState(), projects: [p1, p2] }
    const updated = updateProject(state, 'p2', (p) => ({ ...p, repoPath: '/r2-new' }))
    expect(updated.projects[0].repoPath).toBe('/r1')
    expect(updated.projects[1].repoPath).toBe('/r2-new')
  })
})
