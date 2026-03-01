/**
 * Unit tests for agentsMdReader (US-003).
 */

import { describe, it, expect } from 'vitest'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { readAgentsMd } from './agentsMdReader'

const fixturesDir = path.resolve(__dirname, '../../__fixtures__')

describe('agentsMdReader', () => {
  it('returns NOT_FOUND when Agents.MD does not exist', async () => {
    const repo = path.join(fixturesDir, 'no-agents-md-' + Date.now())
    fs.mkdirSync(repo, { recursive: true })
    try {
      const result = await readAgentsMd(repo)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.code).toBe('NOT_FOUND')
    } finally {
      fs.rmSync(repo, { recursive: true, force: true })
    }
  })

  it('returns contents when Agents.MD exists', async () => {
    const repo = path.join(fixturesDir, 'with-agents-md-' + Date.now())
    const content = '# Agents.MD\nTest content.'
    fs.mkdirSync(repo, { recursive: true })
    fs.writeFileSync(path.join(repo, 'Agents.MD'), content, 'utf-8')
    try {
      const result = await readAgentsMd(repo)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.contents).toBe(content)
        expect(result.agentsMdPath).toContain('Agents.MD')
      }
    } finally {
      fs.rmSync(repo, { recursive: true, force: true })
    }
  })
})
