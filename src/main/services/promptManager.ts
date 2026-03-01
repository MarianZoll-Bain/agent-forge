/**
 * Prompt template manager.
 * Reads/writes prompt files directly to tool-native paths on disk.
 * Cursor: ~/.cursor/rules/*.mdc (global) | <repo>/.cursor/rules/*.mdc (project)
 * Claude: ~/.claude/commands/*.md (global) | <repo>/.claude/commands/*.md (project)
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { PromptTool, PromptScope, PromptEntry } from '../../shared/types'
import { logger } from '../logger'

// ---- Path resolution ----

const TOOL_CONFIG: Record<PromptTool, { globalSubdir: string; projectSubdir: string; ext: string }> = {
  cursor: { globalSubdir: '.cursor/rules', projectSubdir: '.cursor/rules', ext: '.mdc' },
  claude: { globalSubdir: '.claude/commands', projectSubdir: '.claude/commands', ext: '.md' },
}

function globalDir(tool: PromptTool): string {
  return path.join(os.homedir(), TOOL_CONFIG[tool].globalSubdir)
}

function projectDir(tool: PromptTool, repoPath: string): string {
  return path.join(repoPath, TOOL_CONFIG[tool].projectSubdir)
}

function extensionFor(tool: PromptTool): string {
  return TOOL_CONFIG[tool].ext
}

// ---- Safety helpers ----

function isUnderRoot(targetPath: string, root: string): boolean {
  const resolved = path.resolve(targetPath)
  const resolvedRoot = path.resolve(root)
  return resolved.startsWith(resolvedRoot + path.sep) || resolved === resolvedRoot
}

/**
 * Sanitize a file name: lowercase, replace unsafe chars with `-`, ensure correct extension.
 * Returns the sanitized name WITH extension.
 */
export function sanitizeFileName(name: string, tool: PromptTool): string {
  const ext = extensionFor(tool)
  // Strip any existing extension that matches
  let base = name
  if (base.toLowerCase().endsWith(ext)) {
    base = base.slice(0, -ext.length)
  }
  // Lowercase, replace anything that isn't alphanumeric or hyphen with hyphen, collapse runs
  base = base
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  if (!base) base = 'untitled'
  return base + ext
}

function makeId(tool: PromptTool, scope: PromptScope, fileName: string): string {
  return `${tool}:${scope}:${fileName}`
}

function resolveDir(tool: PromptTool, scope: PromptScope, repoPath: string | null): string | null {
  if (scope === 'global') return globalDir(tool)
  if (!repoPath) return null
  return projectDir(tool, repoPath)
}

// ---- Result types ----

interface OkResult<T = undefined> {
  ok: true
  [key: string]: unknown
}

interface ErrorResult {
  ok: false
  code: string
  message: string
}

// ---- Public API ----

export interface ListPromptsResult {
  ok: true
  prompts: PromptEntry[]
}

export function listPrompts(repoPath: string | null): ListPromptsResult | ErrorResult {
  const tools: PromptTool[] = ['cursor', 'claude']
  const prompts: PromptEntry[] = []

  for (const tool of tools) {
    const ext = extensionFor(tool)

    // Global
    const gDir = globalDir(tool)
    readPromptsFromDir(gDir, tool, 'global', ext, prompts)

    // Project (only if repo selected)
    if (repoPath) {
      const pDir = projectDir(tool, repoPath)
      readPromptsFromDir(pDir, tool, 'project', ext, prompts)
    }
  }

  return { ok: true, prompts }
}

function readPromptsFromDir(
  dir: string,
  tool: PromptTool,
  scope: PromptScope,
  ext: string,
  out: PromptEntry[],
): void {
  if (!fs.existsSync(dir)) return
  let entries: string[]
  try {
    entries = fs.readdirSync(dir)
  } catch {
    logger.warn(`promptManager: could not read dir ${dir}`)
    return
  }
  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith(ext)) continue
    const filePath = path.join(dir, entry)
    try {
      const stat = fs.statSync(filePath)
      if (!stat.isFile()) continue
      const content = fs.readFileSync(filePath, 'utf-8')
      out.push({
        id: makeId(tool, scope, entry),
        tool,
        scope,
        fileName: entry,
        filePath,
        content,
      })
    } catch {
      logger.warn(`promptManager: could not read file ${filePath}`)
    }
  }
}

export interface SavePromptResult {
  ok: true
  prompt: PromptEntry
}

export function savePrompt(
  tool: PromptTool,
  scope: PromptScope,
  fileName: string,
  content: string,
  repoPath: string | null,
): SavePromptResult | ErrorResult {
  const sanitized = sanitizeFileName(fileName, tool)
  const dir = resolveDir(tool, scope, repoPath)
  if (!dir) {
    return { ok: false, code: 'NO_REPO', message: 'No repository selected for project-scoped prompt' }
  }

  const filePath = path.join(dir, sanitized)
  if (!isUnderRoot(filePath, dir)) {
    return { ok: false, code: 'PATH_TRAVERSAL', message: 'File path escapes the target directory' }
  }

  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(filePath, content, 'utf-8')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error(`promptManager: savePrompt failed: ${msg}`)
    return { ok: false, code: 'WRITE_FAILED', message: `Failed to write prompt file: ${msg}` }
  }

  const prompt: PromptEntry = {
    id: makeId(tool, scope, sanitized),
    tool,
    scope,
    fileName: sanitized,
    filePath,
    content,
  }
  logger.info(`promptManager: saved ${prompt.id}`)
  return { ok: true, prompt }
}

export function deletePrompt(
  tool: PromptTool,
  scope: PromptScope,
  fileName: string,
  repoPath: string | null,
): { ok: true } | ErrorResult {
  const dir = resolveDir(tool, scope, repoPath)
  if (!dir) {
    return { ok: false, code: 'NO_REPO', message: 'No repository selected for project-scoped prompt' }
  }

  const filePath = path.join(dir, fileName)
  if (!isUnderRoot(filePath, dir)) {
    return { ok: false, code: 'PATH_TRAVERSAL', message: 'File path escapes the target directory' }
  }

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      logger.info(`promptManager: deleted ${tool}:${scope}:${fileName}`)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error(`promptManager: deletePrompt failed: ${msg}`)
    return { ok: false, code: 'DELETE_FAILED', message: `Failed to delete prompt file: ${msg}` }
  }

  return { ok: true }
}

export interface ChangeScopeResult {
  ok: true
  prompt: PromptEntry
}

export function changeScope(
  tool: PromptTool,
  currentScope: PromptScope,
  fileName: string,
  repoPath: string | null,
): ChangeScopeResult | ErrorResult {
  const targetScope: PromptScope = currentScope === 'global' ? 'project' : 'global'

  const srcDir = resolveDir(tool, currentScope, repoPath)
  const dstDir = resolveDir(tool, targetScope, repoPath)

  if (!srcDir) {
    return { ok: false, code: 'NO_REPO', message: 'No repository selected for project-scoped prompt' }
  }
  if (!dstDir) {
    return { ok: false, code: 'NO_REPO', message: 'No repository selected for project-scoped prompt' }
  }

  const srcPath = path.join(srcDir, fileName)
  const dstPath = path.join(dstDir, fileName)

  if (!isUnderRoot(srcPath, srcDir) || !isUnderRoot(dstPath, dstDir)) {
    return { ok: false, code: 'PATH_TRAVERSAL', message: 'File path escapes the target directory' }
  }

  // Check for conflict
  if (fs.existsSync(dstPath)) {
    return {
      ok: false,
      code: 'CONFLICT',
      message: `A file with this name already exists in ${targetScope} scope`,
    }
  }

  // Read source
  let content: string
  try {
    content = fs.readFileSync(srcPath, 'utf-8')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, code: 'READ_FAILED', message: `Failed to read source file: ${msg}` }
  }

  // Write to destination
  try {
    fs.mkdirSync(dstDir, { recursive: true })
    fs.writeFileSync(dstPath, content, 'utf-8')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, code: 'WRITE_FAILED', message: `Failed to write to ${targetScope}: ${msg}` }
  }

  // Remove source
  try {
    fs.unlinkSync(srcPath)
  } catch (e) {
    logger.warn(`promptManager: changeScope could not remove source ${srcPath}: ${e instanceof Error ? e.message : e}`)
  }

  const prompt: PromptEntry = {
    id: makeId(tool, targetScope, fileName),
    tool,
    scope: targetScope,
    fileName,
    filePath: dstPath,
    content,
  }
  logger.info(`promptManager: moved ${tool}:${currentScope}:${fileName} → ${targetScope}`)
  return { ok: true, prompt }
}
