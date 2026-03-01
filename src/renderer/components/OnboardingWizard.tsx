/**
 * Full-screen onboarding wizard. 4 steps: Welcome, Tools, Project, Done.
 */

import { useState } from 'react'
import { ToolToggle } from './ToolToggle'
import { useAppStore } from '../store/useAppStore'

interface OnboardingWizardProps {
  onComplete: (settings: {
    enableCursor: boolean
    enableClaude: boolean
    enableClaudeOllama: boolean
    enableGitMode: boolean
  }) => void
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0)
  const [enableCursor, setEnableCursor] = useState(false)
  const [enableClaude, setEnableClaude] = useState(false)
  const [enableClaudeOllama, setEnableClaudeOllama] = useState(false)
  const [enableGitMode, setEnableGitMode] = useState(false)
  const [repoSelected, setRepoSelected] = useState(false)
  const [selectingRepo, setSelectingRepo] = useState(false)
  const refreshState = useAppStore((s) => s.refreshState)
  const repoName = useAppStore((s) => s.repoName())

  async function handleSelectRepo() {
    const api = window.agentForge
    if (!api) return
    setSelectingRepo(true)
    try {
      const result = await api.selectRepository()
      if (result.ok) {
        await refreshState()
        setRepoSelected(true)
      }
    } finally {
      setSelectingRepo(false)
    }
  }

  function handleFinish() {
    onComplete({ enableCursor, enableClaude, enableClaudeOllama, enableGitMode })
  }

  const steps = ['Welcome', 'Tools', 'Project', 'Done']

  const primaryBtn = 'px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 text-white font-semibold hover:from-indigo-600 hover:via-indigo-700 hover:to-violet-700 shadow-lg shadow-indigo-500/25 hover:shadow-xl transition-all duration-200'
  const secondaryBtn = 'px-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 font-medium'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50/80 dark:from-zinc-950 dark:via-zinc-900 dark:to-indigo-950/30 relative">
      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-400/10 dark:bg-indigo-500/[0.06] rounded-full blur-3xl" />
      <div className="relative w-full max-w-lg rounded-2xl glass-heavy shadow-elevated border border-slate-200/60 dark:border-white/[0.06] p-10 flex flex-col gap-7">
        {/* Progress */}
        <div className="flex items-center gap-2 justify-center">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i <= step
                    ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/30'
                    : 'bg-slate-200 dark:bg-zinc-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-8 h-0.5 rounded-full ${i < step ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-zinc-700'}`} />
              )}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="flex flex-col gap-4 text-center">
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Welcome to AgentForge</h1>
            <p className="text-slate-500 dark:text-slate-400 text-base">
              Orchestrate AI coding agents, each in an isolated Git worktree.
            </p>
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`mt-2 self-center text-base ${primaryBtn}`}
            >
              Get Started
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Enable Tools</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Select the AI tools you have installed. Each is verified automatically.
            </p>
            <div className="flex flex-col">
              <ToolToggle tool="cursor" label="Cursor" enabled={enableCursor} onToggle={setEnableCursor} />
              <ToolToggle tool="claude" label="Claude CLI" enabled={enableClaude} onToggle={setEnableClaude} />
              <ToolToggle tool="claude-ollama" label="Claude + Ollama" enabled={enableClaudeOllama} onToggle={setEnableClaudeOllama} />
              <div className="border-t border-slate-200/60 dark:border-white/[0.06] mt-1 pt-1">
                <ToolToggle tool="gh" label="Git Mode (GitHub CLI)" enabled={enableGitMode} onToggle={setEnableGitMode} />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setStep(0)} className={secondaryBtn}>Back</button>
              <button type="button" onClick={() => setStep(2)} className={`text-sm ${primaryBtn}`}>Continue</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Select a Project</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Choose a Git repository. You can switch projects later from the header.
            </p>
            <div className="flex flex-col items-center gap-3 py-4">
              {repoSelected || repoName ? (
                <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{repoName}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSelectRepo}
                  disabled={selectingRepo}
                  className={primaryBtn}
                >
                  {selectingRepo ? 'Opening...' : 'Select Repository'}
                </button>
              )}
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setStep(1)} className={secondaryBtn}>Back</button>
              <button type="button" onClick={() => setStep(3)} className={`text-sm ${primaryBtn}`}>
                {repoSelected || repoName ? 'Continue' : 'Skip'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4 text-center">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">You're All Set!</h2>
            <div className="text-sm text-slate-600 dark:text-slate-400 text-left space-y-2">
              <p><span className="font-bold text-slate-800 dark:text-white">Tools:</span>{' '}
                {[enableCursor && 'Cursor', enableClaude && 'Claude CLI', enableClaudeOllama && 'Claude + Ollama', enableGitMode && 'Git Mode'].filter(Boolean).join(', ') || 'None enabled'}
              </p>
              <p><span className="font-bold text-slate-800 dark:text-white">Project:</span> {repoName || 'Not selected yet'}</p>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setStep(2)} className={secondaryBtn}>Back</button>
              <button type="button" onClick={handleFinish} className={`text-base ${primaryBtn}`}>
                Start Using AgentForge
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
