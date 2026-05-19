/**
 * Agent opener service — launches external tools in a worktree directory.
 * Cursor: spawns detached `cursor <path>` process.
 * Claude/Claude-Ollama: opens Terminal.app inside a tmux session with a sticky header.
 * Terminal: opens Terminal.app with a banner.
 */

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { PROJECT_COLORS } from '../../shared/types'
import { logger } from '../logger'

export type AgentTool = 'cursor' | 'claude' | 'claude-ollama' | 'terminal'

export interface OpenAgentOptions {
  ollamaModel?: string
  ollamaBaseUrl?: string
  agentName?: string
  branchName?: string
  prNumber?: number
  projectName?: string
  projectColorIndex?: number
  /** If true, don't tint the terminal background (use default). */
  skipBgTint?: boolean
}

/** Wrap a path in single quotes, escaping any embedded single quotes. */
function shellSingleQuote(p: string): string {
  return `'${p.replace(/'/g, "'\\''")}'`
}

/** Escape a string for embedding inside a single-quoted shell string. */
function escSQ(s: string): string {
  return s.replace(/'/g, "'\\''")
}

/** Get the tmux colour string for a project color index. */
function projectTmuxColor(colorIndex: number | undefined): string {
  const idx = (colorIndex ?? 0) % PROJECT_COLORS.length
  return PROJECT_COLORS[idx].tmux
}

/** Get the dark background tint hex for a project color index. */
function projectBgHex(colorIndex: number | undefined): string {
  const idx = (colorIndex ?? 0) % PROJECT_COLORS.length
  return PROJECT_COLORS[idx].bg
}

/**
 * Build a shell snippet that prints a colored banner and sets the tab title.
 * Shows project name (if provided) on a colored line, then agent name below.
 */
function shellBanner(name: string, projectName?: string, colorIndex?: number): string {
  const safeName = escSQ(name)
  // Pick ANSI 256-color index from tmux color (e.g. "colour63" → 63)
  const tmuxCol = projectTmuxColor(colorIndex)
  const ansiIdx = tmuxCol.replace('colour', '')
  const projectLine = projectName
    ? `printf '\\033[48;5;${ansiIdx};97;1m  %-78s\\033[0m\\n' '${escSQ(projectName)}' && `
    : ''
  return (
    `printf '\\033]0;AgentForge: ${safeName}\\007'` +
    ` && ${projectLine}printf '\\n\\033[48;5;237;97;1m  %-78s\\033[0m\\n\\n' '${safeName}'`
  )
}

/** Derive a tmux-safe session name from an agent name. */
function tmuxSessionName(agentName: string): string {
  return 'af-' + agentName.replace(/[^a-zA-Z0-9]/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '').substring(0, 40)
}

/**
 * Write a launch script for a tmux-wrapped claude session.
 * If tmux is available, the session gets a two-line status bar:
 *   Line 1: project name (project color background)
 *   Line 2: agent name (left) + branch/PR (right)
 * If not, falls back to running the command directly.
 * Returns the absolute path to the script.
 */
interface LaunchScriptOptions {
  agentName: string
  worktreePath: string
  claudeCmd: string
  branchName?: string
  prNumber?: number
  projectName?: string
  projectColorIndex?: number
  skipBgTint?: boolean
}

function writeLaunchScript(opts: LaunchScriptOptions): string {
  const { agentName, worktreePath, claudeCmd, branchName, prNumber, projectName, projectColorIndex, skipBgTint } = opts
  const scriptDir = path.join(os.homedir(), '.agent-forge', 'scripts')
  fs.mkdirSync(scriptDir, { recursive: true, mode: 0o700 })

  const session = tmuxSessionName(agentName)
  const scriptPath = path.join(scriptDir, `${session}.sh`)

  const tmuxColor = projectTmuxColor(projectColorIndex)
  const bgHex = projectBgHex(projectColorIndex)

  // Build the right side: branch name + optional PR badge
  const rightParts: string[] = []
  if (prNumber) rightParts.push(`PR #${prNumber}`)
  if (branchName) rightParts.push(branchName)
  const rightText = rightParts.length > 0 ? ` ${rightParts.join(' · ')} ` : ''

  // Line 1: project name with project color (fill= ensures full-width bg)
  const line1Label = projectName ? escSQ(projectName) : escSQ(agentName)
  const line1 = `#[fill=${tmuxColor},bg=${tmuxColor},fg=colour255,bold] ${line1Label} `

  // Line 2: agent name (left) + branch/PR (right) on dark neutral (fill= for full-width)
  const line2Left = `#[fill=colour237,align=left,bg=colour237,fg=colour255,bold] ${escSQ(agentName)} `
  const line2Right = rightText ? `#[align=right,bg=colour237,fg=colour250]${escSQ(rightText)}` : ''
  const line2 = `${line2Left}${line2Right}`

  const script = `#!/bin/bash
SESSION='${escSQ(session)}'
WORK_DIR='${escSQ(worktreePath)}'
CLAUDE_CMD='${escSQ(claudeCmd)}'

if command -v tmux >/dev/null 2>&1; then
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    tmux attach -t "$SESSION"
  else
    tmux new-session -d -s "$SESSION" -x "$(tput cols)" -y "$(tput lines)"
    tmux set-option -t "$SESSION" mouse on
    tmux set-option -t "$SESSION" set-clipboard on
    tmux bind-key -T copy-mode MouseDragEnd1Pane send-keys -X copy-pipe-and-cancel "pbcopy"
    tmux bind-key -T copy-mode-vi MouseDragEnd1Pane send-keys -X copy-pipe-and-cancel "pbcopy"
    tmux set-option -t "$SESSION" status-position top
    tmux set-option -t "$SESSION" status 2
    tmux set-option -t "$SESSION" 'status-format[0]' '${escSQ(line1)}'
    tmux set-option -t "$SESSION" 'status-format[1]' '${escSQ(line2)}'${skipBgTint ? '' : `
    tmux set-option -t "$SESSION" window-style 'bg=${bgHex}'`}
    tmux send-keys -t "$SESSION" "cd \\"$WORK_DIR\\" && $CLAUDE_CMD" Enter
    tmux attach -t "$SESSION"
  fi
else
  cd "$WORK_DIR" && eval "$CLAUDE_CMD"
fi
`
  fs.writeFileSync(scriptPath, script, { mode: 0o755 })
  return scriptPath
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
      lines.push(`  set t to tab 1 of window 1`)
      lines.push(`  set custom title of t to "${safeTitle}"`)
      lines.push(`  set title displays custom title of t to true`)
      lines.push(`  set title displays shell path of t to false`)
      lines.push(`  set title displays window size of t to false`)
      lines.push(`  set title displays device name of t to false`)
      lines.push(`  set title displays file name of t to false`)
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
 * Also kills any matching tmux sessions.
 */
export async function closeAgentWindows(agentName: string, worktreePath: string): Promise<void> {
  try {
    const { execa } = await import('execa')
    const safeName = agentName.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    const safePath = worktreePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

    // Kill matching tmux session
    const session = tmuxSessionName(agentName)
    await execa('tmux', ['kill-session', '-t', session]).catch(() => {})

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

    // Close matching Cursor windows
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
      const scriptPath = writeLaunchScript({
        agentName: options?.agentName ?? path.basename(worktreePath),
        worktreePath,
        claudeCmd: 'claude --continue || claude',
        branchName: options?.branchName,
        prNumber: options?.prNumber,
        projectName: options?.projectName,
        projectColorIndex: options?.projectColorIndex,
        skipBgTint: options?.skipBgTint,
      })
      const title = options?.agentName ? `AgentForge: ${options.agentName}` : undefined
      const success = await openTerminalRunning(shellSingleQuote(scriptPath), title)
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
      const claudeCmd = `ANTHROPIC_BASE_URL=${shellSingleQuote(baseUrl)} claude --continue --model ${shellSingleQuote(model)} || ANTHROPIC_BASE_URL=${shellSingleQuote(baseUrl)} claude --model ${shellSingleQuote(model)}`
      const scriptPath = writeLaunchScript({
        agentName: options?.agentName ?? path.basename(worktreePath),
        worktreePath,
        claudeCmd,
        branchName: options?.branchName,
        prNumber: options?.prNumber,
        projectName: options?.projectName,
        projectColorIndex: options?.projectColorIndex,
        skipBgTint: options?.skipBgTint,
      })
      const title = options?.agentName ? `AgentForge: ${options.agentName}` : undefined
      const success = await openTerminalRunning(shellSingleQuote(scriptPath), title)
      if (!success) {
        return { ok: false, code: 'TERMINAL_FAILED', message: 'Failed to open Terminal.app with claude + Ollama' }
      }
      logger.info(`openAgent: claude-ollama opened at ${worktreePath} model=${model}`)
      return { ok: true }
    }

    case 'terminal': {
      const banner = options?.agentName ? `${shellBanner(options.agentName, options?.projectName, options?.projectColorIndex)} && ` : ''
      const cmd = `${banner}cd ${shellSingleQuote(worktreePath)}`
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
