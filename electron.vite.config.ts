import { resolve } from 'path'
import { readFileSync } from 'fs'
import { homedir } from 'os'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

function readDevServerPort(): number {
  try {
    const raw = readFileSync(resolve(homedir(), '.agent-forge/state.json'), 'utf-8')
    const state = JSON.parse(raw)
    const port = state?.settings?.devServerPort
    if (typeof port === 'number' && Number.isInteger(port) && port >= 1024 && port <= 65535) return port
  } catch { /* state file missing or malformed — use default */ }
  return 5173
}

const devServerPort = readDevServerPort()

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
        },
        output: {
          entryFileNames: '[name].js',
          dir: 'out/main',
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
        },
        output: {
          entryFileNames: '[name].js',
          dir: 'out/preload',
        },
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    server: {
      port: devServerPort,
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
        },
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
          dir: 'out/renderer',
        },
      },
    },
    plugins: [react()],
  },
})
