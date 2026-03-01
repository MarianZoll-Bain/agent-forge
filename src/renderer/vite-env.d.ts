/// <reference types="vite/client" />

import type { PreloadAPI } from '@shared/ipc-channels'

declare global {
  interface Window {
    agentForge?: PreloadAPI
  }
}

export {}
