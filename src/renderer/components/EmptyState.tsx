/**
 * Empty state when there are no worktrees.
 */

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[280px] text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-500/10 dark:to-violet-500/10 flex items-center justify-center mb-5">
        <svg className="w-8 h-8 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      </div>
      <p className="text-base font-medium text-slate-700 dark:text-slate-300 mb-1">No worktrees yet</p>
      <p className="text-sm text-slate-500 dark:text-slate-500">
        Click <span className="font-semibold text-indigo-600 dark:text-indigo-400">+ Add worktree</span> to get started
      </p>
    </div>
  )
}
