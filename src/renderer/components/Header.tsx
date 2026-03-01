/**
 * Header with AgentForge branding, theme toggle, and settings/prompts buttons.
 * Project switcher is rendered separately via ProjectBar.
 */

import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { SettingsPanel } from './SettingsPanel'
import { PromptsPanel } from './PromptsPanel'

export function Header() {
  const setShowOnboarding = useAppStore((s) => s.setShowOnboarding)
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode)
  const resolvedTheme = useAppStore((s) => s.resolvedTheme)
  const appVersion = useAppStore((s) => s.appVersion)
  const updateStatus = useAppStore((s) => s.updateStatus)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [promptsOpen, setPromptsOpen] = useState(false)

  return (
    <>
      <header className="flex items-center justify-between gap-4 px-5 py-3 glass border-b border-slate-200/60 dark:border-white/[0.06] shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0">
            <span className="font-extrabold text-lg block leading-tight bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 dark:from-indigo-400 dark:via-violet-400 dark:to-purple-400 bg-clip-text text-transparent tracking-tight">AgentForge</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 dark:text-slate-600 leading-none tracking-wide uppercase font-medium">Worktree Orchestrator</span>
              {appVersion && (
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-600 leading-none">v{appVersion}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {updateStatus?.available && <UpdateBadge status={updateStatus} />}
          <HeaderButton
            onClick={() => setPromptsOpen(true)}
            label="Prompts"
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />}
          />
          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleDarkMode}
            className="p-2 rounded-lg text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
            title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
          >
            {resolvedTheme === 'dark' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          <HeaderButton
            onClick={() => setSettingsOpen(true)}
            label="Settings"
            icon={<><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>}
          />
        </div>
      </header>

      {settingsOpen && (
        <SettingsPanel
          onClose={() => setSettingsOpen(false)}
          onOpenOnboarding={() => {
            setSettingsOpen(false)
            setShowOnboarding(true)
          }}
        />
      )}
      {promptsOpen && <PromptsPanel onClose={() => setPromptsOpen(false)} />}
    </>
  )
}

function UpdateBadge({ status }: { status: import('@shared/types').UpdateStatus }) {
  const api = window.agentForge

  function handleClick() {
    if (status.downloaded) {
      api?.installUpdate()
    } else {
      api?.downloadUpdate()
    }
  }

  function handleOpenRelease(e: React.MouseEvent) {
    e.stopPropagation()
    if (status.releaseUrl) {
      api?.openExternal(status.releaseUrl)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {status.downloaded
          ? 'Restart to update'
          : `v${status.latestVersion} available`}
      </button>
      {status.releaseUrl && (
        <button
          type="button"
          onClick={handleOpenRelease}
          className="p-1 rounded text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
          title="View release notes"
          aria-label="View release notes"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
      )}
    </div>
  )
}

function HeaderButton({ onClick, label, icon }: { onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
      title={label}
      aria-label={label}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {icon}
      </svg>
      <span>{label}</span>
    </button>
  )
}
