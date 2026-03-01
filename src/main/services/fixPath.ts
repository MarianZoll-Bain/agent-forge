/**
 * Fix process.env.PATH for packaged macOS apps.
 *
 * GUI apps launched from /Applications get a minimal PATH (/usr/bin:/bin:/usr/sbin:/sbin).
 * This module spawns the user's login shell to resolve their real PATH and merges it
 * into process.env.PATH so that execa can find git, gh, cursor, claude, ollama, etc.
 *
 * Must be called early in main process startup, before any execa/child_process calls.
 */

import { execFileSync } from 'node:child_process'
import { app } from 'electron'
import { logger } from '../logger'

export function fixPath(): void {
  if (!app.isPackaged) return // dev mode inherits the terminal PATH

  if (process.platform !== 'darwin' && process.platform !== 'linux') return

  const shell = process.env.SHELL || '/bin/zsh'

  try {
    // Run a login interactive shell to source the user's profile and print PATH
    const result = execFileSync(shell, ['-ilc', 'echo $PATH'], {
      encoding: 'utf-8',
      timeout: 5000,
      env: { ...process.env },
    })

    const shellPath = result.trim()
    if (!shellPath) return

    // Merge: put the shell PATH segments first (they contain the user's tools),
    // then append any existing segments that aren't already present
    const shellSegments = shellPath.split(':')
    const existingSegments = (process.env.PATH || '').split(':')
    const seen = new Set(shellSegments)
    for (const seg of existingSegments) {
      if (seg && !seen.has(seg)) {
        shellSegments.push(seg)
        seen.add(seg)
      }
    }

    process.env.PATH = shellSegments.join(':')
    logger.info(`fixPath: resolved ${shellSegments.length} PATH segments from ${shell}`)
  } catch (e) {
    logger.warn(`fixPath: failed to resolve shell PATH: ${e instanceof Error ? e.message : e}`)
  }
}
