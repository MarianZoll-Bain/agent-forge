/**
 * Horizontal project tab bar. Each tab = one open repo.
 * Click to switch, drag to reorder, close button per tab, "+" to add.
 */

import { useRef, useState } from 'react'
import { PROJECT_COLORS } from '@shared/types'
import { useAppStore } from '../store/useAppStore'

function projectDisplayName(repoPath: string): string {
  const parts = repoPath.replace(/\/$/, '').split('/')
  return parts[parts.length - 1] ?? 'Unknown'
}

function projectColor(colorIndex: number | undefined): string {
  const idx = (colorIndex ?? 0) % PROJECT_COLORS.length
  return PROJECT_COLORS[idx].css
}

export function ProjectTabs() {
  const projects = useAppStore((s) => s.state?.projects ?? [])
  const currentProjectId = useAppStore((s) => s.state?.currentProjectId)
  const switchProject = useAppStore((s) => s.switchProject)
  const removeProject = useAppStore((s) => s.removeProject)
  const addProject = useAppStore((s) => s.addProject)
  const reorderProjects = useAppStore((s) => s.reorderProjects)

  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  // Drag-and-drop state
  const dragIdRef = useRef<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  function handleDragStart(e: React.DragEvent, projectId: string) {
    dragIdRef.current = projectId
    e.dataTransfer.effectAllowed = 'move'
    // Make the drag image semi-transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, e.nativeEvent.offsetX, e.nativeEvent.offsetY)
    }
  }

  function handleDragOver(e: React.DragEvent, projectId: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragIdRef.current && dragIdRef.current !== projectId) {
      setDropTargetId(projectId)
    }
  }

  function handleDragLeave() {
    setDropTargetId(null)
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    setDropTargetId(null)
    const dragId = dragIdRef.current
    dragIdRef.current = null
    if (!dragId || dragId === targetId) return

    const ids = projects.map((p) => p.id)
    const fromIdx = ids.indexOf(dragId)
    const toIdx = ids.indexOf(targetId)
    if (fromIdx === -1 || toIdx === -1) return

    // Move the dragged item to the target position
    ids.splice(fromIdx, 1)
    ids.splice(toIdx, 0, dragId)
    reorderProjects(ids)
  }

  function handleDragEnd() {
    dragIdRef.current = null
    setDropTargetId(null)
  }

  if (projects.length <= 1) {
    // Single project: show a minimal bar with just the "+" button
    return (
      <div className="flex items-center gap-1 px-4 pt-2">
        {projects.length === 1 && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 px-2 py-1">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: projectColor(projects[0].colorIndex) }}
            />
            {projectDisplayName(projects[0].repoPath)}
          </span>
        )}
        <button
          type="button"
          onClick={addProject}
          title="Add project"
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add project
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-0.5 px-4 pt-2 overflow-x-auto scrollbar-hide">
      {projects.map((project) => {
        const isActive = project.id === currentProjectId
        const isDropTarget = dropTargetId === project.id
        return (
          <div
            key={project.id}
            draggable
            onDragStart={(e) => handleDragStart(e, project.id)}
            onDragOver={(e) => handleDragOver(e, project.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, project.id)}
            onDragEnd={handleDragEnd}
            className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-grab active:cursor-grabbing shrink-0 transition-all ${
              isDropTarget
                ? 'ring-2 ring-indigo-400 dark:ring-indigo-500'
                : ''
            } ${
              isActive
                ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-500/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.04]'
            }`}
            onClick={() => {
              if (!isActive) switchProject(project.id)
            }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: projectColor(project.colorIndex) }}
            />
            <span className="truncate max-w-[140px]">{projectDisplayName(project.repoPath)}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setConfirmRemoveId(project.id)
              }}
              title="Close project"
              className={`p-0.5 rounded transition-colors ${
                isActive
                  ? 'text-indigo-400 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-500/20'
                  : 'text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/[0.06]'
              }`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )
      })}

      {/* Add project button */}
      <button
        type="button"
        onClick={addProject}
        title="Add project"
        className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 shrink-0 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Remove confirmation dialog */}
      {confirmRemoveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30 dark:bg-black/60 animate-fade-in"
            onClick={() => setConfirmRemoveId(null)}
            onKeyDown={(e) => { if (e.key === 'Escape') setConfirmRemoveId(null) }}
          />
          <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-elevated border border-slate-200/80 dark:border-white/[0.08] w-full max-w-sm mx-4 p-6 flex flex-col gap-4 animate-scale-in">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Close project</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Remove <span className="font-semibold text-slate-900 dark:text-white">{projectDisplayName(projects.find((p) => p.id === confirmRemoveId)?.repoPath ?? '')}</span> from your tabs? Worktrees on disk will not be deleted.
            </p>
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setConfirmRemoveId(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-700 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  removeProject(confirmRemoveId)
                  setConfirmRemoveId(null)
                }}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 dark:bg-red-500 text-white font-semibold hover:bg-red-700 dark:hover:bg-red-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
