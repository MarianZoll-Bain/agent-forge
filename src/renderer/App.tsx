/**
 * Root app: loads state on mount, shows onboarding, select repository, or main layout.
 */

import { useEffect, useRef, useState } from 'react'
import { SelectRepository } from './components/SelectRepository'
import { MainLayout } from './components/MainLayout'
import { OnboardingWizard } from './components/OnboardingWizard'
import { PermissionAlert } from './components/PermissionAlert'
import { useAppStore } from './store/useAppStore'
import { ToastContainer } from './components/Toast'
import { ErrorBoundary } from './components/ErrorBoundary'

export default function App() {
  const { setState, setLoadError, setPermissionWarning, setAppVersion, setUpdateStatus, addToast, showOnboarding, setShowOnboarding, applyTheme } = useAppStore()
  const state = useAppStore((s) => s.state)
  const permissionWarning = useAppStore((s) => s.permissionWarning)
  const [initialized, setInitialized] = useState(false)

  // Stable ref for addToast so the updater effect doesn't re-register on every render
  const addToastRef = useRef(addToast)
  addToastRef.current = addToast

  // Track which update toasts have already been shown to prevent duplicates
  const shownUpdateToastRef = useRef<string | null>(null)
  const shownDownloadToastRef = useRef(false)
  const shownErrorToastRef = useRef<string | null>(null)

  useEffect(() => {
    const api = window.agentForge
    if (!api) {
      setLoadError('App API not available')
      setInitialized(true)
      return
    }

    api
      .getState()
      .then(({ state: loaded, warning }) => {
        setState(loaded)
        setLoadError(null)
        setPermissionWarning(warning ?? null)
        applyTheme()
        setInitialized(true)
      })
      .catch((e: Error & { code?: string }) => {
        setLoadError(e.message ?? 'Failed to load state')
        setInitialized(true)
      })

    // Fetch app version
    api.getAppVersion().then(({ version }) => setAppVersion(version)).catch(() => {})

    // Fetch initial update status and subscribe to changes
    api.getUpdateStatus().then((status) => setUpdateStatus(status)).catch(() => {})
    const unsubscribe = api.onUpdateStatus((status) => {
      setUpdateStatus(status)
      if (status.available && !status.downloaded && status.latestVersion && shownUpdateToastRef.current !== status.latestVersion) {
        shownUpdateToastRef.current = status.latestVersion
        addToastRef.current(`Update v${status.latestVersion} available`, 'info')
      }
      if (status.downloaded && !shownDownloadToastRef.current) {
        shownDownloadToastRef.current = true
        addToastRef.current('Update downloaded — restart to apply', 'success')
      }
      if (status.error && shownErrorToastRef.current !== status.error) {
        shownErrorToastRef.current = status.error
        addToastRef.current(`Update error: ${status.error}`, 'error')
      }
      if (!status.error) {
        shownErrorToastRef.current = null
      }
    })

    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleOnboardingComplete(settings: {
    enableCursor: boolean
    enableClaude: boolean
    enableClaudeOllama: boolean
    enableGitMode: boolean
  }) {
    const api = window.agentForge
    if (!api) return
    try {
      const result = await api.updateSettings({
        settings: {
          ...settings,
          onboardingComplete: true,
        },
      })
      if (result.ok) {
        setState(result.state)
      }
    } catch {
      // non-fatal
    }
    setShowOnboarding(false)
  }

  if (!initialized) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading AgentForge...</p>
          </div>
        </div>
      </ErrorBoundary>
    )
  }

  if (!state?.settings.onboardingComplete || showOnboarding) {
    return (
      <ErrorBoundary>
        <OnboardingWizard onComplete={handleOnboardingComplete} />
        <ToastContainer />
      </ErrorBoundary>
    )
  }

  if (!state?.projects?.length) {
    return (
      <ErrorBoundary>
        <SelectRepository />
        <ToastContainer />
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      {permissionWarning && (
        <div className="px-4 pt-2">
          <PermissionAlert
            message={permissionWarning.message}
            onDismiss={() => setPermissionWarning(null)}
          />
        </div>
      )}
      <MainLayout />
      <ToastContainer />
    </ErrorBoundary>
  )
}
