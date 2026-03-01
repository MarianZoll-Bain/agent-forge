/**
 * Simple main-process logger. Logs to stdout; in dev, run with `make dev` to see in terminal.
 * Set DEBUG=1 or ELECTRON_ORCHESTRATOR_DEBUG=1 for verbose logs.
 */

const debug = process.env.DEBUG === '1' || process.env.ELECTRON_ORCHESTRATOR_DEBUG === '1'
const prefix = '[Main]'

function formatMsg(tag: string, ...args: unknown[]): string {
  const rest = args.map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
  return `${prefix} ${tag} ${rest.join(' ')}`
}

export const logger = {
  info(...args: unknown[]) {
    console.log(formatMsg('[INFO]', ...args))
  },
  warn(...args: unknown[]) {
    console.warn(formatMsg('[WARN]', ...args))
  },
  error(...args: unknown[]) {
    console.error(formatMsg('[ERROR]', ...args))
  },
  debug(...args: unknown[]) {
    if (debug) console.log(formatMsg('[DEBUG]', ...args))
  },
}
