/**
 * Utility for detecting macOS directory permission errors and providing user guidance.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { homedir } from 'node:os'

/**
 * Check if an error is a filesystem permission error (EACCES or EPERM).
 */
export function isPermissionError(error: unknown): boolean {
  if (error == null || typeof error !== 'object') return false
  const errno = (error as NodeJS.ErrnoException).code
  return errno === 'EACCES' || errno === 'EPERM'
}

/**
 * Check read + execute access to a directory.
 * Returns `{ accessible: true }` or `{ accessible: false, permissionDenied, message }`.
 */
export function checkDirectoryAccess(dirPath: string): {
  accessible: true
} | {
  accessible: false
  permissionDenied: boolean
  message: string
} {
  try {
    // eslint-disable-next-line no-bitwise
    fs.accessSync(dirPath, fs.constants.R_OK | fs.constants.X_OK)
    return { accessible: true }
  } catch (e: unknown) {
    const denied = isPermissionError(e)
    const msg = e instanceof Error ? e.message : String(e)
    return { accessible: false, permissionDenied: denied, message: msg }
  }
}

/** Protected folder names under the user's home directory on macOS. */
const PROTECTED_FOLDERS: Record<string, string> = {
  Desktop: 'Desktop',
  Documents: 'Documents',
  Downloads: 'Downloads',
}

/**
 * If the given path is inside a macOS-protected folder (Desktop, Documents, Downloads),
 * return guidance text explaining how to grant access. Returns null otherwise.
 */
export function getPermissionGuidance(dirPath: string): string | null {
  if (process.platform !== 'darwin') return null

  const resolved = path.resolve(dirPath)
  const home = homedir()
  const rel = path.relative(home, resolved)

  // Check if path is under ~/Desktop, ~/Documents, or ~/Downloads
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null

  const firstSegment = rel.split(path.sep)[0]
  const folderName = PROTECTED_FOLDERS[firstSegment]
  if (!folderName) return null

  return (
    `macOS requires permission to access your ${folderName} folder. ` +
    'Open System Settings > Privacy & Security > Files and Folders, ' +
    'then enable access for AgentForge.'
  )
}
