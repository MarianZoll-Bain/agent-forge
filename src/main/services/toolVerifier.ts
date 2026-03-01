/**
 * Verify that tool binaries are available and return their versions.
 */

export interface VerifyToolResult {
  ok: true
  version: string
}

export interface VerifyToolError {
  ok: false
  message: string
}

export type VerifyToolResponse = VerifyToolResult | VerifyToolError

const TIMEOUT_MS = 5_000

async function runVersion(binary: string): Promise<string> {
  const { execa } = await import('execa')
  const { stdout } = await execa(binary, ['--version'], { timeout: TIMEOUT_MS })
  return stdout.trim()
}

export async function verifyTool(tool: 'cursor' | 'claude' | 'claude-ollama' | 'gh'): Promise<VerifyToolResponse> {
  try {
    if (tool === 'cursor') {
      const version = await runVersion('cursor')
      return { ok: true, version }
    }

    if (tool === 'claude') {
      const version = await runVersion('claude')
      return { ok: true, version }
    }

    if (tool === 'claude-ollama') {
      const claudeVersion = await runVersion('claude')
      const ollamaVersion = await runVersion('ollama')
      return { ok: true, version: `claude: ${claudeVersion}, ollama: ${ollamaVersion}` }
    }

    if (tool === 'gh') {
      const version = await runVersion('gh')
      return { ok: true, version }
    }

    return { ok: false, message: `Unknown tool: ${tool}` }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg }
  }
}
