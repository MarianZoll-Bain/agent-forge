/**
 * US-002: Main layout with header and agent board.
 */

import { Header } from './Header'
import { ProjectBar } from './ProjectBar'
import { AgentBoard } from './AgentBoard'

export function MainLayout() {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-zinc-950 relative">
      {/* Decorative gradient orbs */}
      <div className="pointer-events-none absolute -top-32 -right-32 w-[500px] h-[500px] bg-indigo-400/10 dark:bg-indigo-500/[0.07] rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -left-48 w-[400px] h-[400px] bg-violet-400/[0.06] dark:bg-violet-500/[0.04] rounded-full blur-3xl" />
      <Header />
      <div className="px-4 pt-3 shrink-0">
        <ProjectBar />
      </div>
      <main className="flex-1 min-h-0 overflow-auto relative">
        <AgentBoard />
      </main>
    </div>
  )
}
