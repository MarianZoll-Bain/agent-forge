/**
 * Unit tests for autoUpdater service: version and default status.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron modules before importing the service
vi.mock('electron', () => ({
  app: {
    getVersion: () => '1.0.0',
    isPackaged: false,
  },
}))

vi.mock('electron-updater', () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    logger: null,
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
  },
}))

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('autoUpdater', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('getAppVersion returns the app version from electron', async () => {
    const { getAppVersion } = await import('./autoUpdater')
    expect(getAppVersion()).toBe('1.0.0')
  })

  it('getUpdateStatus returns default status', async () => {
    const { getUpdateStatus } = await import('./autoUpdater')
    const status = getUpdateStatus()
    expect(status).toEqual({
      available: false,
      latestVersion: null,
      releaseNotes: null,
      releaseUrl: null,
      downloaded: false,
      checking: false,
      error: null,
    })
  })

  it('checkForUpdates is a no-op in dev mode', async () => {
    const { checkForUpdates } = await import('./autoUpdater')
    const { autoUpdater } = await import('electron-updater')
    checkForUpdates()
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
  })

  it('downloadUpdate is a no-op in dev mode', async () => {
    const { downloadUpdate } = await import('./autoUpdater')
    const { autoUpdater } = await import('electron-updater')
    downloadUpdate()
    expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled()
  })

  it('installUpdate is a no-op in dev mode', async () => {
    const { installUpdate } = await import('./autoUpdater')
    const { autoUpdater } = await import('electron-updater')
    installUpdate()
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled()
  })
})
