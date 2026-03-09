import { describe, it, expect } from 'vitest'
import { isPermissionError, checkDirectoryAccess, getPermissionGuidance } from './permissionCheck'
import * as os from 'node:os'
import * as path from 'node:path'

describe('isPermissionError', () => {
  it('returns true for EACCES', () => {
    const err = Object.assign(new Error('permission denied'), { code: 'EACCES' })
    expect(isPermissionError(err)).toBe(true)
  })

  it('returns true for EPERM', () => {
    const err = Object.assign(new Error('operation not permitted'), { code: 'EPERM' })
    expect(isPermissionError(err)).toBe(true)
  })

  it('returns false for ENOENT', () => {
    const err = Object.assign(new Error('no such file'), { code: 'ENOENT' })
    expect(isPermissionError(err)).toBe(false)
  })

  it('returns false for null/undefined', () => {
    expect(isPermissionError(null)).toBe(false)
    expect(isPermissionError(undefined)).toBe(false)
  })

  it('returns false for non-object', () => {
    expect(isPermissionError('EACCES')).toBe(false)
  })
})

describe('checkDirectoryAccess', () => {
  it('returns accessible for a readable directory', () => {
    const result = checkDirectoryAccess(os.tmpdir())
    expect(result.accessible).toBe(true)
  })

  it('returns not accessible for a nonexistent path', () => {
    const result = checkDirectoryAccess('/nonexistent/path/that/does/not/exist')
    expect(result.accessible).toBe(false)
  })
})

describe('getPermissionGuidance', () => {
  it('returns guidance for Desktop path on darwin', () => {
    if (process.platform !== 'darwin') return
    const desktopPath = path.join(os.homedir(), 'Desktop', 'my-repo')
    const guidance = getPermissionGuidance(desktopPath)
    expect(guidance).toContain('Desktop')
    expect(guidance).toContain('System Settings')
  })

  it('returns guidance for Documents path on darwin', () => {
    if (process.platform !== 'darwin') return
    const docsPath = path.join(os.homedir(), 'Documents', 'my-repo')
    const guidance = getPermissionGuidance(docsPath)
    expect(guidance).toContain('Documents')
  })

  it('returns guidance for Downloads path on darwin', () => {
    if (process.platform !== 'darwin') return
    const dlPath = path.join(os.homedir(), 'Downloads', 'my-repo')
    const guidance = getPermissionGuidance(dlPath)
    expect(guidance).toContain('Downloads')
  })

  it('returns null for a non-protected path on darwin', () => {
    if (process.platform !== 'darwin') return
    const codePath = path.join(os.homedir(), 'Code', 'my-repo')
    expect(getPermissionGuidance(codePath)).toBeNull()
  })

  it('returns null for paths outside home', () => {
    if (process.platform !== 'darwin') return
    expect(getPermissionGuidance('/tmp/my-repo')).toBeNull()
  })
})
