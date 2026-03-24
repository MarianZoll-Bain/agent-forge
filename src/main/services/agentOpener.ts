/**
 * Agent opener service — launches external tools in a worktree directory.
 * Cursor: spawns detached `cursor <path>` process.
 * Claude: opens Terminal.app → `cd <path> && claude`.
 * Claude-Ollama: opens Terminal.app → `cd <path> && export ANTHROPIC_BASE_URL=... && claude --model <model>`.
 */

import { logger } from '../logger'

export type AgentTool = 'cursor' | 'claude' | 'claude-ollama' | 'terminal'

export interface OpenAgentOptions {
  ollamaModel?: string
  ollamaBaseUrl?: string
  agentName?: string
}

/** Wrap a path in single quotes, escaping any embedded single quotes. */
function shellSingleQuote(p: string): string {
  return `'${p.replace(/'/g, "'\\''")}'`
}

/**
 * Open a new Terminal.app tab/window running `shellCmd`.
 * Returns true on success, false if osascript is not available or fails.
 */
async function openTerminalRunning(shellCmd: string, windowTitle?: string): Promise<boolean> {
  try {
    const { execa } = await import('execa')
    const appleCmd = shellCmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    const lines = [
      'tell application "Terminal"',
      '  activate',
      `  set newTab to do script "${appleCmd}"`,
    ]
    if (windowTitle) {
      const safeTitle = windowTitle.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      lines.push(`  set custom title of window 1 to "${safeTitle}"`)
    }
    lines.push('end tell')
    await execa('osascript', lines.flatMap((l) => ['-e', l]))
    return true
  } catch (e) {
    logger.warn(`openTerminalRunning failed: ${e instanceof Error ? e.message : e}`)
    return false
  }
}

/**
 * Close all Terminal.app windows and Cursor windows associated with a given agent.
 * Terminal windows are matched by custom title ("AgentForge: <name>") or by
 * having the worktree path in the window name/tty.
 * Cursor windows are closed by telling the Cursor app to close windows whose
 * name contains the worktree folder name.
 * Best-effort: failures are logged but not surfaced.
 */
export async function closeAgentWindows(agentName: string, worktreePath: string): Promise<void> {
  try {
    const { execa } = await import('execa')
    const safeName = agentName.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    const safePath = worktreePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

    // Close matching Terminal.app windows
    const terminalScript = [
      'tell application "Terminal"',
      '  set winsToClose to {}',
      '  repeat with w in windows',
      '    try',
      `      if custom title of w starts with "AgentForge: ${safeName}" then`,
      '        set end of winsToClose to w',
      `      else if name of w contains "${safePath}" then`,
      '        set end of winsToClose to w',
      '      end if',
      '    end try',
      '  end repeat',
      '  repeat with w in winsToClose',
      '    close w',
      '  end repeat',
      'end tell',
    ]
    await execa('osascript', terminalScript.flatMap((l) => ['-e', l])).catch((e) => {
      logger.warn(`closeAgentWindows: Terminal close failed: ${e instanceof Error ? e.message : e}`)
    })

    // Close matching Cursor windows (Cursor is an Electron app; its window name contains the folder)
    const folderName = worktreePath.split('/').pop() ?? ''
    if (folderName) {
      const safeFolderName = folderName.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      const cursorScript = [
        'tell application "System Events"',
        '  if exists (process "Cursor") then',
        '    tell process "Cursor"',
        '      set winsToClose to {}',
        '      repeat with w in windows',
        '        try',
        `          if name of w contains "${safeFolderName}" then`,
        '            set end of winsToClose to w',
        '          end if',
        '        end try',
        '      end repeat',
        '      repeat with w in winsToClose',
        '        try',
        '          click button 1 of w',
        '        end try',
        '      end repeat',
        '    end tell',
        '  end if',
        'end tell',
      ]
      await execa('osascript', cursorScript.flatMap((l) => ['-e', l])).catch((e) => {
        logger.warn(`closeAgentWindows: Cursor close failed: ${e instanceof Error ? e.message : e}`)
      })
    }

    logger.info(`closeAgentWindows: closed windows for agent "${agentName}" at ${worktreePath}`)
  } catch (e) {
    logger.warn(`closeAgentWindows: unexpected error: ${e instanceof Error ? e.message : e}`)
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
      const title = options?.agentName ? `AgentForge: ${options.agentName}` : undefined
      const success = await openTerminalRunning(cmd, title)
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
      const title = options?.agentName ? `AgentForge: ${options.agentName}` : undefined
      const success = await openTerminalRunning(cmd, title)
      if (!success) {
        return { ok: false, code: 'TERMINAL_FAILED', message: 'Failed to open Terminal.app with claude + Ollama' }
      }
      logger.info(`openAgent: claude-ollama opened at ${worktreePath} model=${model}`)
      return { ok: true }
    }

    case 'terminal': {
      const cmd = `cd ${shellSingleQuote(worktreePath)}`
      const title = options?.agentName ? `AgentForge: ${options.agentName}` : undefined
      const success = await openTerminalRunning(cmd, title)
      if (!success) {
        return { ok: false, code: 'TERMINAL_FAILED', message: 'Failed to open Terminal.app' }
      }
      logger.info(`openAgent: terminal opened at ${worktreePath}`)
      return { ok: true }
    }

    default:
      return { ok: false, code: 'UNKNOWN_TOOL', message: `Unknown tool: ${tool as string}` }
  }
}
