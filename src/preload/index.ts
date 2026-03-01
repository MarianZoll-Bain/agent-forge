/**
 * Preload script.
 * Exposes only allowlisted API to the renderer. No generic invoke(channel, ...args).
 * Simplified: worktree management + native opener. No embedded agent execution.
 */

import { contextBridge, ipcRenderer } from 'electron'
import type { UpdateStatus } from '../shared/types'
import type {
  AgentValidateBranchPayload,
  AgentCreatePayload,
  AgentOpenPayload,
  SettingsUpdatePayload,
  AgentGitStatusPayload,
  AgentRemovePayload,
  PromptsSavePayload,
  PromptsDeletePayload,
  PromptsChangeScopePayload,
  ToolsVerifyPayload,
  AgentPRStatusPayload,
} from '../shared/ipc-channels'

const api = {
  selectRepository: () => ipcRenderer.invoke('repo:select'),
  getState: () => ipcRenderer.invoke('state:get'),
  validateBranchName: (payload: AgentValidateBranchPayload) =>
    ipcRenderer.invoke('agent:validateBranch', payload),
  createAgent: (payload: AgentCreatePayload) =>
    ipcRenderer.invoke('agent:create', payload),
  updateSettings: (payload: SettingsUpdatePayload) =>
    ipcRenderer.invoke('settings:update', payload),
  openAgent: (payload: AgentOpenPayload) =>
    ipcRenderer.invoke('agent:open', payload),
  getAgentGitStatus: (payload: AgentGitStatusPayload) =>
    ipcRenderer.invoke('agent:gitStatus', payload),
  removeAgent: (payload: AgentRemovePayload) =>
    ipcRenderer.invoke('agent:remove', payload),
  listPrompts: () =>
    ipcRenderer.invoke('prompts:list'),
  savePrompt: (payload: PromptsSavePayload) =>
    ipcRenderer.invoke('prompts:save', payload),
  deletePrompt: (payload: PromptsDeletePayload) =>
    ipcRenderer.invoke('prompts:delete', payload),
  changePromptScope: (payload: PromptsChangeScopePayload) =>
    ipcRenderer.invoke('prompts:changeScope', payload),
  verifyTool: (payload: ToolsVerifyPayload) =>
    ipcRenderer.invoke('tools:verify', payload),
  resetApp: () =>
    ipcRenderer.invoke('app:reset'),
  getAgentPRStatus: (payload: AgentPRStatusPayload) =>
    ipcRenderer.invoke('agent:prStatus', payload),
  openExternal: (url: string) =>
    ipcRenderer.invoke('shell:openExternal', url),
  // Auto-update
  getAppVersion: () =>
    ipcRenderer.invoke('app:version'),
  getUpdateStatus: () =>
    ipcRenderer.invoke('updater:status'),
  checkForUpdates: () =>
    ipcRenderer.invoke('updater:check'),
  downloadUpdate: () =>
    ipcRenderer.invoke('updater:download'),
  installUpdate: () =>
    ipcRenderer.invoke('updater:install'),
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: UpdateStatus) => callback(status)
    ipcRenderer.on('updater:status', handler)
    return () => { ipcRenderer.removeListener('updater:status', handler) }
  },
}

contextBridge.exposeInMainWorld('agentForge', api)
