/**
 * US-009: Validate git branch names using git check-ref-format.
 * Uses argument arrays (execa) — no shell string injection.
 */

export interface BranchValidationResult {
  valid: boolean
  message?: string
}

/**
 * Validate a branch name using `git check-ref-format --branch <name>`.
 * Returns { valid: true } on success, or { valid: false, message } on failure.
 * If git is not available, returns invalid with an appropriate message.
 */
export async function validateBranchName(name: string): Promise<BranchValidationResult> {
  if (!name || name.trim() === '') {
    return { valid: false, message: 'Branch name is required' }
  }

  try {
    const { execa } = await import('execa')
    await execa('git', ['check-ref-format', '--branch', name])
    return { valid: true }
  } catch (e: unknown) {
    const err = e as { exitCode?: number; code?: string; message?: string }
    // exitCode is set when git ran but rejected the name
    if (typeof err.exitCode === 'number') {
      return { valid: false, message: `Invalid branch name: "${name}"` }
    }
    // code 'ENOENT' or similar means git is not in PATH
    return { valid: false, message: 'git is not available or failed to validate branch name' }
  }
}
