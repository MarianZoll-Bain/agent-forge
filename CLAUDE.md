# CLAUDE.md – Claude Code Working Guidelines

> Full development guidelines are in [AGENTS.md](AGENTS.md). This file adds Claude-Code-specific context and shortcuts.

## Project at a Glance

**AgentForge** — Electron + React desktop app (macOS) that orchestrates multiple AI coding agents, each in an isolated Git worktree. Agents run through a **pluggable Agent Executor** interface (Cursor, Claude, Ollama-backed).

**Stack**: Electron 33 · React 18 · TypeScript (strict) · Vite/electron-vite · Zustand · Tailwind · Zod · Vitest

## Source Layout

```
src/
  main/          # Electron main process (Node.js)
    index.ts     # App bootstrap, BrowserWindow setup
    ipcHandlers.ts  # IPC registrations (thin, delegates to services)
    services/    # Business logic (stateManager, worktreeManager, repoValidator, agentsMdReader)
  renderer/      # React UI
    components/  # PascalCase .tsx files
    store/       # Zustand (useAppStore.ts)
  preload/       # Secure IPC bridge (allowlisted methods only)
  shared/        # types.ts, ipc-channels.ts  ← source of truth for shared contracts
```

Key paths outside src:
- `~/.agent-forge/state.json` — app state (never bypass StateManager)
- `<repo>/.worktrees/<name>` — git worktrees

## Architecture Rules (non-negotiable)

1. **No provider branching in app logic.** `if (provider === 'cursor')` only lives inside `src/main/services/agentExecutor/providers/`. New providers: add a file, register it, done.
2. **All git via argument arrays.** `execa('git', ['worktree', 'add', path, branch])` — never string-concatenate user input into shell commands.
3. **All git operations through Worktree/Git Manager services.** No raw `child_process` elsewhere.
4. **All state reads/writes through StateManager.** Atomic writes, 600 permissions, version migrations.
5. **IPC handlers stay thin.** Validate with Zod, delegate to services, return `{ ok, code, message }` on error.
6. **Preload only exposes allowlisted methods.** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.

## IPC Conventions

- Channel names: `namespace:action` (e.g. `git:createWorktree`, `agent:log`)
- Request/response: `ipcMain.handle` / `ipcRenderer.invoke`
- Streaming: emit `{ agentId, chunk }` on `agent:log`; renderer subscribes once
- Errors: reject with `{ code, message }` — no stack traces to renderer
- New channels must be declared in `src/shared/ipc-channels.ts`

## TypeScript Rules

- No `any` — use `unknown` + narrowing
- Shared types in `src/shared/types.ts`; import, don't duplicate
- String literal unions / enums for status fields (`AgentStatus`, severity, etc.)
- Explicit param and return types on service functions

## Testing

```bash
npm test          # Vitest unit tests (src/**/*.test.ts)
npm run dev       # Start Electron dev server
npm run build     # Production build
```

- Tests live alongside source: `src/main/services/foo.test.ts`
- Before marking any story done, run all Verification steps from the relevant `backlog/epic-*.md`
- Prefer tests that mirror V-steps so they become automated acceptance gates

## Story Workflow

1. Read the story in `backlog/epic-*.md` — check **Dependencies** before starting
2. Read **Acceptance Criteria** and **Verification** steps
3. Implement one story at a time
4. Run every Verification step; if any fails, fix before calling it done
5. Branch: `feature/US-xxx-short-description`; commit: present tense, reference story ID

## Safety Checklist (before any PR)

- [ ] No `exec`/shell string built from user input
- [ ] Paths resolved from known roots and validated
- [ ] No tokens/secrets logged or exposed in UI
- [ ] New IPC channels declared in `ipc-channels.ts` and validated with Zod
- [ ] State changes go through StateManager
- [ ] Provider-specific logic stays inside its provider module

## Quick Reference: Key Files

| Purpose | File |
|---------|------|
| Shared types | `src/shared/types.ts` |
| IPC channel contracts | `src/shared/ipc-channels.ts` |
| State persistence | `src/main/services/stateManager.ts` |
| Worktree operations | `src/main/services/worktreeManager.ts` |
| IPC handler registration | `src/main/ipcHandlers.ts` |
| Root React component | `src/renderer/App.tsx` |
| Global Zustand store | `src/renderer/store/useAppStore.ts` |
| Architecture decisions | `architecture/adr/` |
| All user stories | `backlog/epic-*.md` |
| Story index | `backlog/STORY_INDEX.md` |
| Implementation order | `backlog/IMPLEMENTATION_ORDER.md` |
