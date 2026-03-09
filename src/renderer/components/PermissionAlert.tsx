/**
 * Amber alert banner shown when macOS denies folder access.
 * Offers a "Open System Settings" button that deep-links to Files and Folders preferences.
 */

interface PermissionAlertProps {
  message: string
  onDismiss?: () => void
}

const SYSTEM_SETTINGS_URL = 'x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders'

export function PermissionAlert({ message, onDismiss }: PermissionAlertProps) {
  async function handleOpenSettings() {
    const api = window.agentForge
    if (!api) return
    await api.openExternal(SYSTEM_SETTINGS_URL)
  }

  return (
    <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-4 flex items-start gap-3" role="alert">
      {/* Warning icon */}
      <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.54 20h18.92a1 1 0 00.85-1.28l-8.6-14.86a1 1 0 00-1.72 0z" />
      </svg>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Folder Access Required</h3>
        <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">{message}</p>
        <button
          type="button"
          onClick={handleOpenSettings}
          className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-colors"
        >
          Open System Settings
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-amber-400 hover:text-amber-600 dark:text-amber-500 dark:hover:text-amber-300 p-0.5"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
