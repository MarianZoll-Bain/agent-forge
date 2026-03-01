# AGENTS.MD – Development Guidelines for Agent Orchestrator

This document gives **AI agents and developers** key development guidelines and best practices to deliver this project reliably. Follow it when implementing features, fixing bugs, or refactoring.

---

## 1. Purpose and Audience

- **Purpose**: Ensure consistent, safe, and maintainable delivery of the Agent Orchestrator app (Electron + React, macOS).
- **Audience**: Anyone implementing work from the backlog (user stories), including AI coding agents and human developers.
- **Authority**: When in doubt, the [architecture](architecture/README.md) and [backlog](backlog/README.md) are the source of truth; this file summarizes and extends them.

---

## 2. Project at a Glance

- **What it is**: A desktop app that orchestrates multiple coding agents, each in an isolated Git worktree per Jira ticket. Agents run via a **pluggable executor** (Cursor, Claude, Ollama-backed). Operators can define **quick actions and prompts**, choose the **agent provider** in the UI, and **kick off agents from a Jira ticket link** (with optional MCP setup guidance).
- **Stack**: Electron (main + renderer), React, TypeScript, Zustand (or Context API), Tailwind/shadcn, IPC for main↔renderer, Git CLI for all git operations.
- **Modularity**: Agent execution is **decoupled** from any single editor; all start/stop/stream go through the **Agent Executor** interface. New providers are added by implementing the contract and registering—no app-level branching on "Cursor vs Claude."

---

## 3. Key Development Guidelines

### 3.1 Modularity and the Agent Executor

- **Never branch on editor type in app logic.** The app must not contain `if (provider === 'cursor') { ... } else if (provider === 'claude') { ... }` outside of provider implementations. All execution flows through the **Agent Executor**; the executor delegates to the **active provider** (from settings).
- **Provider contract**: Every provider implements the same interface: `start(agentId, prompt, cwd, options)`, `stop(agentId)`, and emits the same IPC events (`agent:log`, `agent:exited`). The renderer subscribes to one channel and stays provider-agnostic.
- **Adding a provider**: Implement the executor interface in `src/main/services/agentExecutor/providers/<name>Provider.ts`, register in the provider registry, and add the option to settings. Do not add provider-specific branches in the orchestration layer.

### 3.2 Safety and Security

- **Shell and process**: Use **argument arrays** for all commands (e.g. `spawn('git', ['worktree', 'add', path, branch])`). Never build command strings with user input (no `exec` with string concatenation).
- **Paths**: Validate and sanitize all file paths; resolve from known roots (repo path, worktrees root). Do not trust user input as paths without validation.
- **Secrets**: Do not log or expose API tokens (e.g. Jira, GitHub). Store tokens in secure storage or masked in UI; use env or config that is not committed.
- **Network**: Review system network access is opt-in (default: disabled). Document or guard any outbound calls (Jira API, fetch for review, etc.).

### 3.3 State and Persistence

- **Single source of truth**: App state lives in `~/.mono-agent-orchestrator/state.json`. Use the **State Manager** for load/save; do not bypass it with ad-hoc file writes for app state.
- **Schema**: When adding fields, consider migrations and backward compatibility (e.g. missing keys default to safe values). Document state shape in the architecture.
- **Settings**: Provider ID, Ollama model/URL, Jira base URL/token, worktrees path, review options, etc., are part of settings and persisted. Changes apply as defined (immediately or on next operation).

### 3.4 Git and Worktrees

- **All git via Git Manager / Worktree Manager**: No raw `child_process` for git outside these services. Use git CLI only; no git libraries that might behave differently.
- **Worktree paths**: Resolve under `worktreesRootPath` (e.g. `<repo>/.worktrees/<jiraKey>`). Collision handling (e.g. append slug) must be deterministic and documented.
- **Branch names**: Validate with `git check-ref-format --branch <name>` (or equivalent) before creating worktrees. Use US-009 rules in the backlog.

---

## 4. Best Practices

### 4.1 Delivering Stories and Verification

- **One story at a time**: Implement a single user story (US-xxx) per unit of work. Respect **Dependencies** in the backlog; complete dependencies before starting a story.
- **Verification is the gate**: Every story has a **Verification** section (V1, V2, …). Before marking a story done:
  1. Run each Verification step in order (manually or via tests).
  2. If any step fails, the story is not complete—fix and re-verify.
- **Automation hints**: Prefer adding unit/integration/E2E tests that match the Verification steps (see [backlog/TESTING.md](backlog/TESTING.md)). This makes regression and CI reliable.
- **Acceptance criteria**: Verification steps are derived from acceptance criteria; both must be satisfied. Do not skip criteria because they are “implicit.”

### 4.2 IPC (Main ↔ Renderer)

- **Channels**: Use namespaced channel names (e.g. `git:createWorktree`, `agent:log`, `agent:exited`). Document new channels in the architecture or in code comments.
- **Request–response**: Use `ipcMain.handle` / `ipcRenderer.invoke` for operations that return a result. Return serializable data; avoid passing functions or non-cloneable objects.
- **Streaming**: For agent logs, main process emits `agent:log` (and similar) with `{ agentId, chunk }`; renderer subscribes once and updates UI. Keep the same event shape for all providers so the renderer stays provider-agnostic.
- **Errors**: Reject promises with structured errors (e.g. `{ code, message }`) so the renderer can show user-friendly messages. Do not expose internal stack traces in the UI.

### 4.3 Errors and User Feedback

- **User-facing messages**: Every error path should result in a clear, actionable message (e.g. “Cursor CLI not found. Install from … and ensure it’s in PATH.”). Avoid raw exception text in the UI.
- **Toasts / notifications**: Use a consistent pattern for success, error, and info (e.g. commit done, PR opened, agent started). Define in one place and reuse.
- **Error boundaries**: Use React error boundaries so a single component failure does not crash the whole app. Log errors for debugging.

### 4.4 TypeScript and Types

- **Strict typing**: Prefer explicit types for function parameters and return values. Avoid `any`; use `unknown` and narrow if needed.
- **Shared types**: Keep shared interfaces (e.g. `Agent`, `Finding`, `Settings`) in a dedicated types module or next to the architecture (e.g. `src/types.ts` or under `src/main/`) and import everywhere. Do not duplicate type definitions.
- **Enums for status**: Use string literal unions or enums for agent status, severity, etc., so refactors are safe and autocomplete works.

### 4.5 Review System and Plugins

- **Plugin interface**: All review plugins implement the same interface (`id`, `name`, `category`, `appliesTo`, `run`). Findings use the standard `Finding` shape (severity, category, message, evidence, pluginId, recommendedFix).
- **Parallel execution**: Review engine runs applicable plugins in parallel (with a concurrency limit). Each plugin must be safe to run in isolation; no shared mutable state between plugins.
- **Timeouts**: Run external commands (lint, test, audit) with a timeout. On timeout, produce a finding with evidence rather than hanging.

### 4.6 Quick Actions and Prompts

- **Provider-agnostic**: Quick action templates (with placeholders like `{{jiraKey}}`, `{{branchName}}`) are resolved in the app and passed to the **active executor**. No provider-specific logic in the quick actions manager.
- **Storage**: Use the configured path (e.g. `~/.mono-agent-orchestrator/quick-actions.json` or repo-scoped). Ensure at least one default quick action exists when the file is missing or empty.

### 4.7 Jira and MCP

- **Jira resolution**: Use the Jira resolver service for “Add from Jira link.” Primary method: Jira REST API with base URL and token from settings. Do not log or expose the token.
- **Create-from-link**: After resolving the ticket, derive branch name (deterministic, valid per git rules), create worktree and agent, then build effective prompt including ticket title/description. Optional “Start agent after create” must use the executor (no direct provider calls).
- **MCP**: The app does not run MCP servers. It may provide documentation and in-app snippets so operators can configure Jira MCP (and others) in Cursor and Claude. Keep config snippets and paths accurate and up to date.

---

## 5. Conventions

### 5.1 Naming and Layout

- **Services**: `src/main/services/<name>.ts` or `src/main/services/<feature>/` (e.g. `agentExecutor/`, `mcp/`). One primary responsibility per service.
- **Components**: `src/renderer/components/<Name>.tsx`. Use PascalCase. Co-locate styles or use a shared Tailwind/shadcn approach.
- **IPC handlers**: Register in a dedicated module (e.g. `ipcHandlers.ts`) or next to the service that owns the operation. Keep handler logic thin; delegate to services.
- **Plugins**: `src/main/plugins/<name>Plugin.ts`. Naming: `<domain>Plugin` (e.g. `agentsMdCompliancePlugin.ts`).

### 5.2 Git and Commits

- **Branch naming**: Prefer `feature/US-xxx-short-description` or `fix/US-xxx-issue` when working from the backlog.
- **Commit messages**: Clear, present tense (e.g. “Add Jira resolver and create-from-link flow”). Reference story ID if useful (e.g. “US-053: Resolve Jira ticket from URL”).

### 5.3 File and Config Paths

- **State**: `~/.mono-agent-orchestrator/state.json`
- **Quick actions**: `~/.mono-agent-orchestrator/quick-actions.json` (or repo-scoped `.agent-orchestrator/quick-actions.json`)
- **Worktrees**: `<repoPath>/.worktrees/<jiraKey>` (or with collision suffix)
- **Review reports**: `<worktreePath>/.agent-orchestrator/reviews/<timestamp>.json`

Use `os.homedir()` and `path.join` (or equivalent) so paths work across environments. Do not hardcode `/Users/...`.

---

## 6. Do’s and Don’ts

| Do | Don’t |
|----|--------|
| Use the Agent Executor for all start/stop/stream | Call Cursor or Claude directly from app logic |
| Use argument arrays for all spawned commands | Build shell command strings with user input |
| Run Verification steps before marking a story done | Skip Verification or acceptance criteria |
| Persist state only through the State Manager | Write app state to arbitrary files |
| Validate paths and branch names before use | Trust user input as paths or refs |
| Return structured errors over IPC | Expose stack traces or raw exceptions in UI |
| Keep provider-specific code inside provider modules | Branch on `provider === 'cursor'` in orchestration |
| Add tests that match Verification steps | Leave Verification only as manual steps forever |
| Document new IPC channels and state fields | Introduce undocumented global state or channels |

---

## 7. References

- **[Architecture](architecture/README.md)** – System design, components, data flows, state shape, ADRs.
- **[Backlog](backlog/README.md)** – Epics, stories, priorities, story format.
- **[IMPLEMENTATION_ORDER.md](backlog/IMPLEMENTATION_ORDER.md)** – Recommended sprint order and MVP/Full Product scope.
- **[TESTING.md](backlog/TESTING.md)** – Verification format and how to use it for manual and automated acceptance.
- **[STORY_INDEX.md](backlog/STORY_INDEX.md)** – Quick reference of all story IDs and points.

When implementing a story, read its **Acceptance Criteria** and **Verification** in the epic file, then implement and verify. Use this AGENTS.MD as the daily guideline for how to write and deliver code in this project.
