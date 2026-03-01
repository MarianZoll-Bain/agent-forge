/**
 * Root app: loads state on mount, shows onboarding, select repository, or main layout.
 */

import { useEffect, useState } from 'react'
import { SelectRepository } from './components/SelectRepository'
import { MainLayout } from './components/MainLayout'
import { OnboardingWizard } from './components/OnboardingWizard'
import { useAppStore } from './store/useAppStore'
import { ToastContainer } from './components/Toast'
import { ErrorBoundary } from './components/ErrorBoundary'

export default function App() {
  const { setState, setLoadError, hasRepo, showOnboarding, setShowOnboarding, applyTheme } = useAppStore()
  const state = useAppStore((s) => s.state)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const api = window.agentForge
    if (!api) {
      setLoadError('App API not available')
      setInitialized(true)
      return
    }

    api
      .getState()
      .then(({ state: loaded }) => {
        setState(loaded)
        setLoadError(null)
        applyTheme()
        setInitialized(true)
      })
      .catch((e: Error & { code?: string }) => {
        setLoadError(e.message ?? 'Failed to load state')
        setInitialized(true)
      })
  }, [setState, setLoadError, applyTheme])

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

  if (!hasRepo()) {
    return (
      <ErrorBoundary>
        <SelectRepository />
        <ToastContainer />
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <MainLayout />
      <ToastContainer />
    </ErrorBoundary>
  )
}
