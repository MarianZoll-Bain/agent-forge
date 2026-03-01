/**
 * US-003: Read Agents.MD from repo root.
 * Case-sensitive filename: Agents.MD
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { promisify } from 'node:util'

const readFile = promisify(fs.readFile)

const AGENTS_MD_FILENAME = 'Agents.MD'

export interface ReadAgentsMdResult {
  ok: true
  contents: string
  agentsMdPath: string
}

export interface ReadAgentsMdError {
  ok: false
  code: string
  message: string
}

export type ReadAgentsMdResponse = ReadAgentsMdResult | ReadAgentsMdError

/**
 * Reads Agents.MD from repo root if it exists. UTF-8 encoding.
 * If file does not exist, returns ok: false with code NOT_FOUND (graceful).
 * If file exists but read fails (e.g. permissions), returns error.
 */
export async function readAgentsMd(repoPath: string): Promise<ReadAgentsMdResponse> {
  const resolvedRepo = path.resolve(repoPath)
  const agentsMdPath = path.join(resolvedRepo, AGENTS_MD_FILENAME)
  try {
    const raw = await readFile(agentsMdPath, 'utf-8')
    return { ok: true, contents: raw, agentsMdPath }
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException
    if (err.code === 'ENOENT') {
      return { ok: false, code: 'NOT_FOUND', message: 'Agents.MD not found at repo root' }
    }
    const message = err.message ?? String(e)
    return {
      ok: false,
      code: 'READ_FAILED',
      message: `Could not read Agents.MD: ${message}`,
    }
  }
}
