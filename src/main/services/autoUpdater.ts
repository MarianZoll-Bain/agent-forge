/**
 * Auto-update service wrapping electron-updater.
 * No-op in dev mode (!app.isPackaged). Sends status events to the renderer.
 */

import { app } from 'electron'
import type { BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateInfo } from 'electron-updater'
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
  autoUpdater.checkForUpdates().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Check failed'
    logger.warn('autoUpdater checkForUpdates error:', message)
    updateStatus({ checking: false, error: message })
  })
}

export function downloadUpdate(): void {
  if (!app.isPackaged) return
  autoUpdater.downloadUpdate().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Download failed'
    logger.warn('autoUpdater downloadUpdate error:', message)
    updateStatus({ error: message })
  })
}

export function installUpdate(): void {
  if (!app.isPackaged) return
  autoUpdater.quitAndInstall(false, true)
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
  autoUpdater.autoInstallOnAppQuit = true
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

  autoUpdater.on('download-progress', () => {
    // Could push progress %, but keeping it simple for now
  })

  autoUpdater.on('update-downloaded', () => {
    logger.info('autoUpdater: update downloaded')
    updateStatus({ downloaded: true })
  })

  autoUpdater.on('error', (err: Error) => {
    logger.warn('autoUpdater error:', err.message)
    updateStatus({ checking: false, error: err.message })
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
