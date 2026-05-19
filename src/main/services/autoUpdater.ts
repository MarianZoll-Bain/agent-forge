/**
 * Auto-update service wrapping electron-updater.
 * No-op in dev mode (!app.isPackaged). Sends status events to the renderer.
 *
 * On macOS, Squirrel.Mac silently fails with ad-hoc signed builds, so we
 * bypass it entirely: electron-updater downloads the zip, and we manually
 * extract + swap the .app bundle using ditto + mv.
 */

import { app } from 'electron'
import type { BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateInfo } from 'electron-updater'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import type { UpdateStatus } from '../../shared/types'
import { UPDATER_STATUS } from '../../shared/ipc-channels'
import { logger } from '../logger'

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours
const INITIAL_CHECK_DELAY_MS = 10_000 // 10 seconds after launch

let win: BrowserWindow | null = null
let intervalId: ReturnType<typeof setInterval> | null = null
let timeoutId: ReturnType<typeof setTimeout> | null = null

let currentStatus: UpdateStatus = {
  available: false,
  latestVersion: null,
  releaseNotes: null,
  releaseUrl: null,
  downloaded: false,
  downloading: false,
  downloadProgress: 0,
  checking: false,
  error: null,
}

function pushStatus(): void {
  if (win && !win.isDestroyed()) {
    win.webContents.send(UPDATER_STATUS, currentStatus)
  }
}

function updateStatus(partial: Partial<UpdateStatus>): void {
  currentStatus = { ...currentStatus, ...partial }
  pushStatus()
}

export function getAppVersion(): string {
  return app.getVersion()
}

export function getUpdateStatus(): UpdateStatus {
  return { ...currentStatus }
}

export function checkForUpdates(): void {
  if (!app.isPackaged) return
  // Don't check while a download is in progress or already completed
  if (currentStatus.downloading || currentStatus.downloaded) return
  autoUpdater.checkForUpdates().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Check failed'
    logger.warn('autoUpdater checkForUpdates error:', message)
    updateStatus({ checking: false, error: message })
  })
}

export function downloadUpdate(): void {
  if (!app.isPackaged) return
  // Don't start a download if one is already in progress or completed
  if (currentStatus.downloading || currentStatus.downloaded) return
  updateStatus({ downloading: true, downloadProgress: 0, error: null })
  autoUpdater.downloadUpdate().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Download failed'
    logger.warn('autoUpdater downloadUpdate error:', message)
    updateStatus({ downloading: false, downloadProgress: 0, error: message })
  })
}

/**
 * Returns the path to the updater cache directory used by electron-updater.
 * On macOS this is ~/Library/Caches/<app-name>-updater/pending/
 */
function getUpdaterCacheDir(): string {
  const appName = app.getName()
  return path.join(os.homedir(), 'Library', 'Caches', `${appName}-updater`, 'pending')
}

/**
 * Find the downloaded update zip in the updater cache.
 * electron-updater writes an update-info.json alongside the zip.
 */
async function findDownloadedZip(): Promise<string | null> {
  const cacheDir = getUpdaterCacheDir()
  try {
    const files = await fs.readdir(cacheDir)
    // Look for .zip files (not temp-* stale ones — those get cleaned up on init)
    const zipFile = files.find((f) => f.endsWith('.zip') && !f.startsWith('temp-'))
    if (zipFile) return path.join(cacheDir, zipFile)

    // Fallback: any .zip
    const anyZip = files.find((f) => f.endsWith('.zip'))
    if (anyZip) return path.join(cacheDir, anyZip)
  } catch {
    // Cache dir doesn't exist or isn't readable
  }
  return null
}

/**
 * Clean up stale temp-*.zip files left by failed Squirrel attempts.
 */
async function cleanupStaleTempFiles(): Promise<void> {
  const cacheDir = getUpdaterCacheDir()
  try {
    const files = await fs.readdir(cacheDir)
    for (const f of files) {
      if (f.startsWith('temp-') && f.endsWith('.zip')) {
        const filePath = path.join(cacheDir, f)
        logger.info(`autoUpdater: cleaning up stale temp file: ${f}`)
        await fs.unlink(filePath).catch(() => {})
      }
    }
  } catch {
    // Cache dir doesn't exist — nothing to clean
  }
}

/**
 * Spawn a process with argument array. Returns a promise that resolves on exit 0.
 * Uses child_process.spawn directly with argument arrays (no shell).
 */
function spawnAsync(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'pipe' })
    let stderr = ''
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} exited with code ${code}: ${stderr.trim()}`))
    })
  })
}

/**
 * Manual install: extract zip and swap app bundle, bypassing Squirrel.
 *
 * Steps:
 * 1. Find the downloaded zip
 * 2. Extract with ditto -xk to a temp directory
 * 3. Move old .app to backup, move new .app into place
 * 4. Relaunch via `open` and quit current instance
 * 5. Spawn a detached cleanup process to remove backup + temp
 */
export async function installUpdate(): Promise<void> {
  if (!app.isPackaged) return

  stopAutoUpdater()

  try {
    // 1. Locate downloaded zip
    const zipPath = await findDownloadedZip()
    if (!zipPath) {
      throw new Error('Downloaded update zip not found in cache')
    }
    logger.info(`autoUpdater: installing from ${zipPath}`)

    // 2. Determine paths
    // app.getPath('exe') returns e.g. /Applications/AgentForge.app/Contents/MacOS/AgentForge
    const exePath = app.getPath('exe')
    const appBundlePath = path.resolve(exePath, '..', '..', '..') // -> /Applications/AgentForge.app
    const appBundleDir = path.dirname(appBundlePath) // -> /Applications
    const appBundleName = path.basename(appBundlePath) // -> AgentForge.app

    // Temp dir for extraction
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-forge-update-'))
    // Backup path for old app
    const backupPath = path.join(os.tmpdir(), `agent-forge-backup-${Date.now()}.app`)

    // 3. Extract zip with ditto (macOS native, preserves attrs + resource forks)
    logger.info('autoUpdater: extracting update zip')
    await spawnAsync('/usr/bin/ditto', ['-xk', zipPath, tmpDir])

    // Find the .app inside the extracted directory
    const extracted = await fs.readdir(tmpDir)
    const newAppName = extracted.find((f) => f.endsWith('.app'))
    if (!newAppName) {
      throw new Error('No .app bundle found in extracted update')
    }
    const newAppPath = path.join(tmpDir, newAppName)

    // 4. Clear quarantine attributes from extracted app (prevents Gatekeeper block)
    logger.info('autoUpdater: clearing quarantine attributes')
    await spawnAsync('/usr/bin/xattr', ['-cr', newAppPath])

    // 5. Swap bundles: move old to backup, move new into place
    logger.info('autoUpdater: swapping app bundles')
    await spawnAsync('/bin/mv', [appBundlePath, backupPath])
    await spawnAsync('/bin/mv', [newAppPath, path.join(appBundleDir, appBundleName)])

    // 6. Re-sign the swapped app ad-hoc (mv invalidates the original signature)
    const installedAppPath = path.join(appBundleDir, appBundleName)
    logger.info('autoUpdater: re-signing app bundle ad-hoc')
    await spawnAsync('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', installedAppPath])

    // 7. Relaunch the new app
    logger.info('autoUpdater: relaunching')
    spawn('/usr/bin/open', ['-n', installedAppPath], { detached: true, stdio: 'ignore' }).unref()

    // 8. Spawn detached cleanup process (removes backup + temp dir after a short delay)
    spawn('/bin/sh', ['-c', `sleep 3 && rm -rf "${backupPath}" "${tmpDir}"`], {
      detached: true,
      stdio: 'ignore',
    }).unref()

    // 9. Clean up the cache zip so it doesn't get re-applied
    await fs.unlink(zipPath).catch(() => {})

    // 10. Quit current instance
    app.quit()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Install failed'
    logger.error('autoUpdater: install failed:', message)
    updateStatus({ error: message, downloaded: false })
  }
}

function extractReleaseNotes(info: UpdateInfo): string | null {
  if (!info.releaseNotes) return null
  if (typeof info.releaseNotes === 'string') return info.releaseNotes
  if (Array.isArray(info.releaseNotes)) {
    return info.releaseNotes.map((n) => (typeof n === 'string' ? n : n.note ?? '')).join('\n')
  }
  return null
}

export function initAutoUpdater(mainWindow: BrowserWindow): void {
  if (!app.isPackaged) {
    logger.info('autoUpdater: skipped (dev mode)')
    return
  }

  win = mainWindow

  autoUpdater.autoDownload = false
  // Disable Squirrel's auto-install — we handle install manually
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.logger = null // we handle logging ourselves

  autoUpdater.on('checking-for-update', () => {
    logger.info('autoUpdater: checking for update')
    updateStatus({ checking: true, error: null })
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    logger.info('autoUpdater: update available', info.version)
    updateStatus({
      checking: false,
      available: true,
      latestVersion: info.version,
      releaseNotes: extractReleaseNotes(info),
      releaseUrl: `https://github.com/MarianZoll-Bain/agent-forge/releases/tag/v${info.version}`,
    })
  })

  autoUpdater.on('update-not-available', () => {
    logger.info('autoUpdater: no update available')
    updateStatus({ checking: false })
  })

  autoUpdater.on('download-progress', (progress) => {
    updateStatus({ downloading: true, downloadProgress: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', () => {
    logger.info('autoUpdater: update downloaded')
    updateStatus({ downloaded: true, downloading: false, downloadProgress: 100 })
  })

  autoUpdater.on('error', (err: Error) => {
    logger.warn('autoUpdater error:', err.message)
    updateStatus({ checking: false, downloading: false, downloadProgress: 0, downloaded: false, error: err.message })
  })

  // Clean up stale temp files from previous failed Squirrel attempts
  cleanupStaleTempFiles().catch((err: unknown) => {
    logger.warn('autoUpdater: stale cleanup failed:', err)
  })

  // Delayed first check
  timeoutId = setTimeout(() => {
    checkForUpdates()
  }, INITIAL_CHECK_DELAY_MS)

  // Periodic checks
  intervalId = setInterval(() => {
    checkForUpdates()
  }, CHECK_INTERVAL_MS)
}

export function stopAutoUpdater(): void {
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  win = null
}
