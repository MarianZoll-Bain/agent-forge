/**
 * Electron main process.
 * Simplified: worktree management + native opener. No embedded agent execution.
 */

import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { registerIpcHandlers, setMainWindow } from './ipcHandlers'
import { logger } from './logger'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

if (isDev) {
  logger.info('App starting (dev mode, watch may have reloaded main process)')
}

function createWindow(): BrowserWindow {
  const preloadPath = join(__dirname, '../preload/index.js')
  const iconExt = process.platform === 'darwin' ? 'icns' : process.platform === 'win32' ? 'ico' : 'png'
  const iconPath = join(__dirname, `../../resources/icon.${iconExt}`)

  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
  })
  setMainWindow(win)
  win.on('closed', () => setMainWindow(null))

  if (isDev) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL ?? 'http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  win.once('ready-to-show', () => win.show())
  return win
}

// US-005: single-instance lock
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.focus()
      win.show()
    }
  })

  app.whenReady().then(() => {
    registerIpcHandlers()
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    app.quit()
  })
}
