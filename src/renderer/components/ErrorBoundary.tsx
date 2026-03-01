/**
 * US-039: React error boundary to catch unhandled renderer errors.
 * Displays a friendly fallback UI and a "Copy diagnostics" button.
 */

import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  copied: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, copied: false }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Unhandled renderer error:', error.message, info.componentStack)
  }

  handleCopyDiagnostics = () => {
    const { error } = this.state
    const diagnostics = JSON.stringify(
      {
        message: error?.message ?? 'Unknown error',
        stack: error?.stack?.split('\n').slice(0, 10).join('\n') ?? '',
        ua: navigator.userAgent,
        time: new Date().toISOString(),
      },
      null,
      2,
    )
    navigator.clipboard.writeText(diagnostics).then(() => {
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2000)
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 p-8">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-red-200 dark:border-red-500/20 shadow-elevated p-8 max-w-lg w-full flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Something went wrong</h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              An unexpected error occurred. You can reload to recover, or copy the diagnostics to share with support.
            </p>
            {this.state.error?.message && (
              <pre className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-white/[0.06] rounded-xl p-4 text-xs text-red-700 dark:text-red-400 font-mono whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-5 py-2.5 text-sm rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold hover:from-indigo-600 hover:to-indigo-700 shadow-lg shadow-indigo-500/25"
              >
                Reload app
              </button>
              <button
                type="button"
                onClick={this.handleCopyDiagnostics}
                className="px-5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 font-medium"
              >
                {this.state.copied ? 'Copied!' : 'Copy diagnostics'}
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
