/**
 * Agent opener service — launches external tools in a worktree directory.
 * Cursor: spawns detached `cursor <path>` process.
 * Claude: opens Terminal.app → `cd <path> && claude`.
 * Claude-Ollama: opens Terminal.app → `cd <path> && export ANTHROPIC_BASE_URL=... && claude --model <model>`.
 */

import { logger } from '../logger'

export type AgentTool = 'cursor' | 'claude' | 'claude-ollama'

export interface OpenAgentOptions {
  ollamaModel?: string
  ollamaBaseUrl?: string
}

/** Wrap a path in single quotes, escaping any embedded single quotes. */
function shellSingleQuote(p: string): string {
  return `'${p.replace(/'/g, "'\\''")}'`
}

/**
 * Open a new Terminal.app tab/window running `shellCmd`.
 * Returns true on success, false if osascript is not available or fails.
 */
async function openTerminalRunning(shellCmd: string): Promise<boolean> {
  try {
    const { execa } = await import('execa')
    const appleCmd = shellCmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    await execa('osascript', [
      '-e', 'tell application "Terminal"',
      '-e', '  activate',
      '-e', `  do script "${appleCmd}"`,
      '-e', 'end tell',
    ])
    return true
  } catch (e) {
    logger.warn(`openTerminalRunning failed: ${e instanceof Error ? e.message : e}`)
    return false
  }
}

export interface OpenAgentResult {
  ok: true
}

export interface OpenAgentError {
  ok: false
  code: string
  message: string
}

export type OpenAgentResponse = OpenAgentResult | OpenAgentError

export async function openAgent(
  tool: AgentTool,
  worktreePath: string,
  options?: OpenAgentOptions,
): Promise<OpenAgentResponse> {
  switch (tool) {
    case 'cursor': {
      try {
        const { execa } = await import('execa')
        await execa('cursor', [worktreePath], { detached: true, stdio: 'ignore' })
        logger.info(`openAgent: cursor opened at ${worktreePath}`)
        return { ok: true }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        logger.error(`openAgent: cursor failed: ${msg}`)
        return { ok: false, code: 'CURSOR_FAILED', message: `Failed to open Cursor: ${msg}` }
      }
    }

    case 'claude': {
      const cmd = `cd ${shellSingleQuote(worktreePath)} && claude`
      const success = await openTerminalRunning(cmd)
      if (!success) {
        return { ok: false, code: 'TERMINAL_FAILED', message: 'Failed to open Terminal.app with claude' }
      }
      logger.info(`openAgent: claude opened at ${worktreePath}`)
      return { ok: true }
    }

    case 'claude-ollama': {
      const model = options?.ollamaModel
      if (!model) {
        return { ok: false, code: 'NO_MODEL', message: 'Ollama model is required. Set it in Settings.' }
      }
      const baseUrl = options?.ollamaBaseUrl ?? 'http://localhost:11434'
      const parts = [
        `cd ${shellSingleQuote(worktreePath)}`,
        `export ANTHROPIC_BASE_URL=${shellSingleQuote(baseUrl)}`,
        `claude --model ${shellSingleQuote(model)}`,
      ]
      const cmd = parts.join(' && ')
      const success = await openTerminalRunning(cmd)
      if (!success) {
        return { ok: false, code: 'TERMINAL_FAILED', message: 'Failed to open Terminal.app with claude + Ollama' }
      }
      logger.info(`openAgent: claude-ollama opened at ${worktreePath} model=${model}`)
      return { ok: true }
    }

    default:
      return { ok: false, code: 'UNKNOWN_TOOL', message: `Unknown tool: ${tool as string}` }
  }
}
