import { promises as fs } from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { Keypair } from '@solana/web3.js'
import AppConfig from '#app/config/app'
import AppException from '#app/exceptions/app_exception'
import ErrorCodes from '#app/exceptions/error_codes'
import Logger from '#app/utils/logger'

const execFileAsync = promisify(execFile)

export interface ResolvedProgramArtifacts {
  workspacePath: string
  anchorDir: string
  targetDir: string
  programName: string
  soPath: string
  keypairPath: string
  programId: string
  soBytes: Buffer
}

interface CommandResult {
  stdout: string
  stderr: string
}

const COMMAND_ERROR_MAX_CHARS = 3000
const CODEGEN_ARTIFACT_LINE_REGEX = /^[ \t]*(===|```[a-zA-Z0-9_-]*)[ \t]*$/gm
const EDITION_2024_ERROR_FRAGMENT = 'feature `edition2024` is required'
const IDL_BUILD_MISSING_ERROR_FRAGMENT = '`idl-build` feature is missing'
const BUILD_SBF_MISSING_ERROR_FRAGMENT = 'no such command: `build-sbf`'
const CONSTANT_TIME_EQ_CRATE = 'constant_time_eq'
const CONSTANT_TIME_EQ_COMPAT_VERSION = '=0.4.1'

export function sanitizeAnchorTomlContent(content: string): { content: string; strippedLines: number } {
  const matches = content.match(CODEGEN_ARTIFACT_LINE_REGEX) || []
  if (matches.length === 0) {
    return { content, strippedLines: 0 }
  }

  const sanitized = content
    .replace(CODEGEN_ARTIFACT_LINE_REGEX, '')
    .replace(/\n{3,}/g, '\n\n')

  return { content: sanitized, strippedLines: matches.length }
}

export function isEdition2024CargoError(details: string): boolean {
  const normalized = details.toLowerCase()

  return normalized.includes(EDITION_2024_ERROR_FRAGMENT.toLowerCase())
    || (normalized.includes('edition2024') && normalized.includes('cargo'))
}

export function upsertConstantTimeEqCompatibilityPatch(cargoToml: string): { content: string; changed: boolean } {
  const patchLine = `${CONSTANT_TIME_EQ_CRATE} = "${CONSTANT_TIME_EQ_COMPAT_VERSION}"`
  const patchSectionRegex = /(\[patch\.crates-io\]\s*\n)([\s\S]*?)(?=\n\[[^\]]+\]|$)/m
  const sectionMatch = cargoToml.match(patchSectionRegex)

  if (sectionMatch) {
    const sectionBody = sectionMatch[2]
    if (new RegExp(`^\\s*${CONSTANT_TIME_EQ_CRATE}\\s*=`, 'm').test(sectionBody)) {
      return { content: cargoToml, changed: false }
    }

    const bodyWithLine = `${sectionBody}${sectionBody.endsWith('\n') || sectionBody.length === 0 ? '' : '\n'}${patchLine}\n`
    const content = cargoToml.replace(
      patchSectionRegex,
      `${sectionMatch[1]}${bodyWithLine}`
    )

    return { content, changed: true }
  }

  const trimmed = cargoToml.replace(/\s*$/, '')
  const suffix = `\n\n[patch.crates-io]\n${patchLine}\n`

  return { content: `${trimmed}${suffix}`, changed: true }
}

export function upsertOverflowChecksReleaseProfile(cargoToml: string): { content: string; changed: boolean } {
  const sectionRegex = /(\[profile\.release\]\s*\n)([\s\S]*?)(?=\n\[[^\]]+\]|$)/m
  const sectionMatch = cargoToml.match(sectionRegex)

  if (sectionMatch) {
    const sectionBody = sectionMatch[2]

    if (/^\s*overflow-checks\s*=\s*true\s*$/m.test(sectionBody)) {
      return { content: cargoToml, changed: false }
    }

    if (/^\s*overflow-checks\s*=\s*false\s*$/m.test(sectionBody)) {
      const nextBody = sectionBody.replace(
        /^\s*overflow-checks\s*=\s*false\s*$/m,
        'overflow-checks = true',
      )
      const content = cargoToml.replace(
        sectionRegex,
        `${sectionMatch[1]}${nextBody}`,
      )

      return { content, changed: true }
    }

    const nextBody = `${sectionBody}${sectionBody.endsWith('\n') || sectionBody.length === 0 ? '' : '\n'}overflow-checks = true\n`
    const content = cargoToml.replace(
      sectionRegex,
      `${sectionMatch[1]}${nextBody}`,
    )

    return { content, changed: true }
  }

  const trimmed = cargoToml.replace(/\s*$/, '')
  const suffix = '\n\n[profile.release]\noverflow-checks = true\n'

  return { content: `${trimmed}${suffix}`, changed: true }
}

export function summarizeCommandFailureDetails(
  output: { stderr?: string; stdout?: string; message?: string },
  maxChars = COMMAND_ERROR_MAX_CHARS,
): string {
  const joined = [output.stderr, output.stdout, output.message]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n')
    .trim()

  if (!joined) {
    return 'unknown error'
  }

  if (joined.length <= maxChars) {
    return joined
  }

  return `[truncated output; showing last ${maxChars} chars]\n${joined.slice(-maxChars)}`
}

export function isMissingIdlBuildFeatureError(details: string): boolean {
  return details.toLowerCase().includes(IDL_BUILD_MISSING_ERROR_FRAGMENT.toLowerCase())
}

export function isMissingBuildSbfCommandError(details: string): boolean {
  return details.toLowerCase().includes(BUILD_SBF_MISSING_ERROR_FRAGMENT.toLowerCase())
}

export function upsertAnchorDebugFeature(cargoToml: string): { content: string; changed: boolean } {
  const sectionRegex = /(\[features\]\s*\n)([\s\S]*?)(?=\n\[[^\]]+\]|\s*$)/
  const sectionMatch = cargoToml.match(sectionRegex)
  const anchorDebugLine = 'anchor-debug = []'

  if (sectionMatch) {
    const sectionBody = sectionMatch[2]
    if (/^\s*anchor-debug\s*=\s*\[.*\]\s*$/m.test(sectionBody)) {
      return { content: cargoToml, changed: false }
    }

    const nextBody = `${sectionBody}${sectionBody.endsWith('\n') || sectionBody.length === 0 ? '' : '\n'}${anchorDebugLine}\n`
    const content = cargoToml.replace(
      sectionRegex,
      `${sectionMatch[1]}${nextBody}`,
    )

    return { content, changed: true }
  }

  const trimmed = cargoToml.replace(/\s*$/, '')
  const suffix = `\n\n[features]\ndefault = []\n${anchorDebugLine}\n`

  return { content: `${trimmed}${suffix}`, changed: true }
}

export function sanitizeAnchorLibRsRecursion(content: string): { content: string; changed: boolean } {
  const useRegex = /use\s+instructions::\{([^}]+)\};/g
  const hasLocalInitializeStruct = /pub\s+struct\s+Initialize<'info>/.test(content)
  const hasLocalIncrementStruct = /pub\s+struct\s+Increment<'info>/.test(content)
  let changed = false
  let initializeAliased = false
  let incrementAliased = false

  let next = content.replace(useRegex, (_match, rawItems: string) => {
    const parsed = rawItems
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    if (parsed.length === 0) {
      return _match
    }

    const rewritten: string[] = []
    for (const item of parsed) {
      if (item === 'initialize') {
        initializeAliased = true
        changed = true
        rewritten.push('initialize as handle_initialize')
        continue
      }

      if (item === 'increment') {
        incrementAliased = true
        changed = true
        rewritten.push('increment as handle_increment')
        continue
      }

      if (item === 'Initialize' && hasLocalInitializeStruct) {
        changed = true
        continue
      }

      if (item === 'Increment' && hasLocalIncrementStruct) {
        changed = true
        continue
      }

      rewritten.push(item)
    }

    const deduped = Array.from(new Set(rewritten))
    if (deduped.length === 0) {
      return ''
    }

    return `use instructions::{${deduped.join(', ')}};`
  })

  if (initializeAliased || incrementAliased) {
    const lines = next.split(/\r?\n/)
    const updatedLines = lines.map((line) => {
      const trimmed = line.trim()
      const indent = line.match(/^\s*/)![0]

      if (initializeAliased && (trimmed === 'initialize(ctx)' || trimmed === 'initialize(ctx);')) {
        changed = true

        return `${indent}handle_initialize(ctx)${trimmed.endsWith(';') ? ';' : ''}`
      }

      if (incrementAliased && (trimmed === 'increment(ctx)' || trimmed === 'increment(ctx);')) {
        changed = true

        return `${indent}handle_increment(ctx)${trimmed.endsWith(';') ? ';' : ''}`
      }

      return line
    })
    next = updatedLines.join('\n')
  }

  return { content: next, changed }
}

export function upsertIdlBuildFeature(cargoToml: string): { content: string; changed: boolean } {
  const sectionRegex = /(\[features\]\s*\n)([\s\S]*?)(?=\n\[[^\]]+\]|\s*$)/
  const sectionMatch = cargoToml.match(sectionRegex)
  const idlBuildLine = 'idl-build = ["anchor-lang/idl-build"]'

  if (sectionMatch) {
    const sectionBody = sectionMatch[2]
    const hasIdlBuildWithAnchorLang = sectionBody
      .split(/\r?\n/)
      .some((line) => line.trim().startsWith('idl-build') && line.includes('anchor-lang/idl-build'))

    if (hasIdlBuildWithAnchorLang) {
      return { content: cargoToml, changed: false }
    }

    if (/^\s*idl-build\s*=\s*\[.*\]\s*$/m.test(sectionBody)) {
      const nextBody = sectionBody.replace(
        /^\s*idl-build\s*=\s*\[.*\]\s*$/m,
        idlBuildLine,
      )
      const content = cargoToml.replace(
        sectionRegex,
        `${sectionMatch[1]}${nextBody}`,
      )

      return { content, changed: true }
    }

    const nextBody = `${sectionBody}${sectionBody.endsWith('\n') || sectionBody.length === 0 ? '' : '\n'}${idlBuildLine}\n`
    const content = cargoToml.replace(
      sectionRegex,
      `${sectionMatch[1]}${nextBody}`,
    )

    return { content, changed: true }
  }

  const trimmed = cargoToml.replace(/\s*$/, '')
  const suffix = `\n\n[features]\ndefault = []\n${idlBuildLine}\n`

  return { content: `${trimmed}${suffix}`, changed: true }
}

async function applyConstantTimeEqCompatibilityPatch(anchorDir: string): Promise<boolean> {
  const cargoTomlPath = path.join(anchorDir, 'Cargo.toml')
  let cargoToml: string

  try {
    cargoToml = await fs.readFile(cargoTomlPath, 'utf-8')
  } catch {
    return false
  }

  const patched = upsertConstantTimeEqCompatibilityPatch(cargoToml)
  if (!patched.changed) {
    return false
  }

  await fs.writeFile(cargoTomlPath, patched.content, 'utf-8')
  Logger.warn(
    { cargoTomlPath, crate: CONSTANT_TIME_EQ_CRATE, version: CONSTANT_TIME_EQ_COMPAT_VERSION },
    'Applied Cargo compatibility patch for constant_time_eq',
  )

  return true
}

async function ensureOverflowChecksEnabled(anchorDir: string): Promise<boolean> {
  const cargoTomlPath = path.join(anchorDir, 'Cargo.toml')
  let cargoToml: string

  try {
    cargoToml = await fs.readFile(cargoTomlPath, 'utf-8')
  } catch {
    return false
  }

  const patched = upsertOverflowChecksReleaseProfile(cargoToml)
  if (!patched.changed) {
    return false
  }

  await fs.writeFile(cargoTomlPath, patched.content, 'utf-8')
  Logger.warn(
    { cargoTomlPath },
    'Enabled [profile.release] overflow-checks = true in workspace Cargo.toml',
  )

  return true
}

async function ensureProgramIdlBuildFeature(anchorDir: string): Promise<boolean> {
  const programsDir = path.join(anchorDir, 'programs')
  let programEntries: string[]

  try {
    programEntries = await fs.readdir(programsDir)
  } catch {
    return false
  }

  let touched = false
  for (const programName of programEntries) {
    const cargoTomlPath = path.join(programsDir, programName, 'Cargo.toml')
    let cargoToml: string

    try {
      cargoToml = await fs.readFile(cargoTomlPath, 'utf-8')
    } catch {
      continue
    }

    const withIdlBuild = upsertIdlBuildFeature(cargoToml)
    const withAnchorDebug = upsertAnchorDebugFeature(withIdlBuild.content)

    if (!withIdlBuild.changed && !withAnchorDebug.changed) {
      continue
    }

    await fs.writeFile(cargoTomlPath, withAnchorDebug.content, 'utf-8')
    touched = true
    Logger.warn(
      { cargoTomlPath },
      'Ensured required Anchor features exist in program Cargo.toml',
    )
  }

  return touched
}

async function validateAnchorWorkspaceForCompile(anchorDir: string): Promise<string[]> {
  const issues: string[] = []

  const workspaceCargoPath = path.join(anchorDir, 'Cargo.toml')
  try {
    const workspaceCargo = await fs.readFile(workspaceCargoPath, 'utf-8')
    const sanitized = sanitizeAnchorTomlContent(workspaceCargo)
    if (sanitized.strippedLines > 0) {
      issues.push('anchor/Cargo.toml contains invalid delimiter artifacts (=== or ```).')
    }
    if (upsertOverflowChecksReleaseProfile(workspaceCargo).changed) {
      issues.push('anchor/Cargo.toml must include [profile.release] overflow-checks = true.')
    }
  } catch {
    issues.push('anchor/Cargo.toml is missing.')
  }

  const anchorTomlPath = path.join(anchorDir, 'Anchor.toml')
  try {
    const anchorToml = await fs.readFile(anchorTomlPath, 'utf-8')
    const sanitized = sanitizeAnchorTomlContent(anchorToml)
    if (sanitized.strippedLines > 0) {
      issues.push('anchor/Anchor.toml contains invalid delimiter artifacts (=== or ```).')
    }
  } catch {
    issues.push('anchor/Anchor.toml is missing.')
  }

  const programsDir = path.join(anchorDir, 'programs')
  let programEntries: string[] = []
  try {
    programEntries = await fs.readdir(programsDir)
  } catch {
    issues.push('anchor/programs directory is missing.')

    return issues
  }

  for (const programName of programEntries) {
    const programCargoPath = path.join(programsDir, programName, 'Cargo.toml')
    try {
      const programCargo = await fs.readFile(programCargoPath, 'utf-8')
      const sanitized = sanitizeAnchorTomlContent(programCargo)
      if (sanitized.strippedLines > 0) {
        issues.push(`anchor/programs/${programName}/Cargo.toml contains invalid delimiter artifacts.`)
      }
      if (!/^\s*edition\s*=\s*"2021"\s*$/m.test(programCargo)) {
        issues.push(`anchor/programs/${programName}/Cargo.toml must use edition = "2021".`)
      }
      if (upsertIdlBuildFeature(programCargo).changed) {
        issues.push(`anchor/programs/${programName}/Cargo.toml must include idl-build = ["anchor-lang/idl-build"].`)
      }
      if (upsertAnchorDebugFeature(programCargo).changed) {
        issues.push(`anchor/programs/${programName}/Cargo.toml must include anchor-debug = [].`)
      }
    } catch {
      issues.push(`anchor/programs/${programName}/Cargo.toml is missing.`)
    }

    const programLibPath = path.join(programsDir, programName, 'src', 'lib.rs')
    try {
      const libRs = await fs.readFile(programLibPath, 'utf-8')
      const sanitized = sanitizeAnchorTomlContent(libRs)
      if (sanitized.strippedLines > 0) {
        issues.push(`anchor/programs/${programName}/src/lib.rs contains invalid delimiter artifacts.`)
      }
      if (sanitizeAnchorLibRsRecursion(libRs).changed) {
        issues.push(
          `anchor/programs/${programName}/src/lib.rs has recursive instruction wrapper pattern (initialize/increment). Use namespaced or aliased handlers.`,
        )
      }
    } catch {
      issues.push(`anchor/programs/${programName}/src/lib.rs is missing.`)
    }
  }

  return issues
}

async function tryRecoverEdition2024CompileFailure(anchorDir: string, details: string): Promise<boolean> {
  if (!isEdition2024CargoError(details)) {
    return false
  }

  await applyConstantTimeEqCompatibilityPatch(anchorDir)

  try {
    await runCommand(
      'cargo',
      ['update', '-p', CONSTANT_TIME_EQ_CRATE, '--precise', CONSTANT_TIME_EQ_COMPAT_VERSION.replace(/^=/, '')],
      anchorDir,
    )
    Logger.warn(
      { anchorDir, crate: CONSTANT_TIME_EQ_CRATE, version: CONSTANT_TIME_EQ_COMPAT_VERSION },
      'Pinned constant_time_eq to compatibility version after edition2024 error',
    )
  } catch (error) {
    Logger.warn(
      {
        anchorDir,
        crate: CONSTANT_TIME_EQ_CRATE,
        version: CONSTANT_TIME_EQ_COMPAT_VERSION,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to pin constant_time_eq; retrying anchor build anyway',
    )
  }

  return true
}

async function tryRecoverIdlBuildFeatureFailure(anchorDir: string, details: string): Promise<boolean> {
  if (!isMissingIdlBuildFeatureError(details)) {
    return false
  }

  const patched = await ensureProgramIdlBuildFeature(anchorDir)
  if (patched) {
    Logger.warn({ anchorDir }, 'Recovered compile failure by patching missing idl-build feature')
  }

  return patched
}

async function ensureBinaryAvailable(command: string): Promise<void> {
  try {
    await execFileAsync(command, ['--version'])
  } catch {
    throw new AppException(
      500,
      ErrorCodes.TOOLCHAIN_MISSING,
      `${command} CLI is required on the backend host`,
    )
  }
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs = AppConfig.solana.deployCompileTimeoutMs,
): Promise<CommandResult> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
      env: process.env,
    })

    return { stdout, stderr }
  } catch (error) {
    const candidate = error as {
      stdout?: string
      stderr?: string
      message?: string
      code?: string | number
    }
    const details = summarizeCommandFailureDetails(candidate)

    Logger.error(
      {
        command,
        args,
        cwd,
        code: candidate.code,
        stderrLength: candidate.stderr?.length ?? 0,
        stdoutLength: candidate.stdout?.length ?? 0,
        details,
      },
      'Command failed',
    )
    throw new AppException(500, ErrorCodes.COMPILE_FAILED, details)
  }
}

export function parseDevnetProgramsFromAnchorToml(content: string): string[] {
  const lines = content.split(/\r?\n/)
  let inDevnetSection = false
  const programs: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    if (/^\[programs\.devnet\]$/i.test(trimmed)) {
      inDevnetSection = true
      continue
    }

    if (/^\[.+\]$/.test(trimmed)) {
      inDevnetSection = false
      continue
    }

    if (!inDevnetSection) {
      continue
    }

    const [name] = trimmed.split('=')
    if (name && name.trim()) {
      programs.push(name.trim())
    }
  }

  return programs
}

function readProgramIdFromKeypair(secretBytes: number[]): string {
  const secret = Uint8Array.from(secretBytes)
  const keypair = Keypair.fromSecretKey(secret)

  return keypair.publicKey.toBase58()
}

async function resolveProgramName(anchorDir: string, requestedProgramName?: string): Promise<string> {
  const anchorTomlPath = path.join(anchorDir, 'Anchor.toml')
  const targetDeployDir = path.join(anchorDir, 'target', 'deploy')

  if (requestedProgramName) {
    return requestedProgramName
  }

  try {
    const toml = await fs.readFile(anchorTomlPath, 'utf-8')
    const names = parseDevnetProgramsFromAnchorToml(toml)
    if (names.length > 0) {
      return names[0]
    }
  } catch {
    // Fall through to discover from target/deploy.
  }

  const entries = await fs.readdir(targetDeployDir)
  const soEntry = entries.find((entry) => entry.endsWith('.so'))
  if (!soEntry) {
    throw new AppException(500, ErrorCodes.ARTIFACT_NOT_FOUND, 'No .so artifact found in anchor/target/deploy')
  }

  return soEntry.replace(/\.so$/, '')
}

const SANITIZABLE_ANCHOR_EXTENSIONS = new Set([
  '.toml',
  '.rs',
  '.json',
  '.ts',
  '.js',
  '.yml',
  '.yaml',
  '.sh',
])

function shouldSkipAnchorSanitizeDir(dirName: string): boolean {
  return dirName === 'target' || dirName === 'node_modules' || dirName === '.git'
}

async function listSanitizableAnchorFiles(anchorDir: string): Promise<string[]> {
  const queue: string[] = [anchorDir]
  const files: string[] = []

  while (queue.length > 0) {
    const current = queue.pop() as string
    const entries = await fs.readdir(current, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (!shouldSkipAnchorSanitizeDir(entry.name)) {
          queue.push(fullPath)
        }
        continue
      }
      if (!entry.isFile()) continue
      if (SANITIZABLE_ANCHOR_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        files.push(fullPath)
      }
    }
  }

  return files
}

async function sanitizeAnchorWorkspaceArtifactsIfNeeded(anchorDir: string): Promise<void> {
  const files = await listSanitizableAnchorFiles(anchorDir)
  let sanitizedFiles = 0
  let strippedArtifactLines = 0
  let libRsFixedFiles = 0

  for (const filePath of files) {
    let raw: string
    try {
      raw = await fs.readFile(filePath, 'utf-8')
    } catch {
      continue
    }

    const sanitized = sanitizeAnchorTomlContent(raw)
    const recursiveFix =
      path.basename(filePath) === 'lib.rs'
        ? sanitizeAnchorLibRsRecursion(sanitized.content)
        : { content: sanitized.content, changed: false }
    const changed = sanitized.strippedLines > 0 || recursiveFix.changed

    if (!changed) {
      continue
    }

    await fs.writeFile(filePath, recursiveFix.content, 'utf-8')
    sanitizedFiles += 1
    strippedArtifactLines += sanitized.strippedLines
    if (recursiveFix.changed) {
      libRsFixedFiles += 1
    }
  }

  if (sanitizedFiles > 0) {
    Logger.warn(
      { anchorDir, sanitizedFiles, strippedArtifactLines, libRsFixedFiles },
      'Sanitized Anchor workspace artifacts before compile',
    )
  }
}

export async function compileAndResolveProgramArtifacts(
  workspacePath: string,
  requestedProgramName?: string,
): Promise<ResolvedProgramArtifacts> {
  const anchorDir = path.join(workspacePath, 'anchor')

  try {
    const stat = await fs.stat(anchorDir)
    if (!stat.isDirectory()) {
      throw new Error('anchor path is not a directory')
    }
  } catch {
    throw new AppException(404, ErrorCodes.ARTIFACT_NOT_FOUND, 'anchor workspace was not found for this run')
  }

  await ensureBinaryAvailable('anchor')
  await ensureBinaryAvailable('solana')
  await ensureBinaryAvailable('cargo')
  const autoRepairEnabled = AppConfig.solana.deployAutoRepairEnabled === true

  if (autoRepairEnabled) {
    await sanitizeAnchorWorkspaceArtifactsIfNeeded(anchorDir)
    await ensureOverflowChecksEnabled(anchorDir)
    await ensureProgramIdlBuildFeature(anchorDir)
  } else {
    const issues = await validateAnchorWorkspaceForCompile(anchorDir)
    if (issues.length > 0) {
      throw new AppException(
        500,
        ErrorCodes.COMPILE_FAILED,
        `Anchor workspace validation failed before compile:\n${issues.map(issue => `- ${issue}`).join('\n')}`,
      )
    }
  }

  Logger.info({ anchorDir }, 'Compiling anchor program for deployment')
  try {
    await runCommand('anchor', ['build'], anchorDir)
  } catch (error) {
    const details = error instanceof AppException ? error.message : String(error)
    if (isMissingBuildSbfCommandError(details)) {
      throw new AppException(
        500,
        ErrorCodes.TOOLCHAIN_MISSING,
        'Missing `cargo build-sbf` command. Install the Solana SBF toolchain that matches your Anchor CLI version.',
      )
    }
    if (!autoRepairEnabled) {
      if (isEdition2024CargoError(details)) {
        throw new AppException(
          500,
          ErrorCodes.TOOLCHAIN_MISSING,
          'Rust/Cargo toolchain is too old for crates requiring edition2024. Upgrade Rust/Cargo to 1.85+ on the backend host.',
        )
      }

      throw error
    }

    const recoveredEdition = await tryRecoverEdition2024CompileFailure(anchorDir, details)
    const recoveredIdlBuild = await tryRecoverIdlBuildFeatureFailure(anchorDir, details)
    if (!recoveredEdition && !recoveredIdlBuild) {
      throw error
    }

    Logger.warn({ anchorDir }, 'Retrying anchor build after compile recovery patch')

    try {
      await runCommand('anchor', ['build'], anchorDir)
    } catch (retryError) {
      const retryDetails = retryError instanceof AppException ? retryError.message : String(retryError)
      if (isMissingBuildSbfCommandError(retryDetails)) {
        throw new AppException(
          500,
          ErrorCodes.TOOLCHAIN_MISSING,
          'Missing `cargo build-sbf` command. Install the Solana SBF toolchain that matches your Anchor CLI version.',
        )
      }

      if (isEdition2024CargoError(retryDetails)) {
        throw new AppException(
          500,
          ErrorCodes.TOOLCHAIN_MISSING,
          'Rust/Cargo toolchain is too old for crates requiring edition2024. Upgrade Rust/Cargo to 1.85+ on the backend host.',
        )
      }

      throw retryError
    }
  }

  const programName = await resolveProgramName(anchorDir, requestedProgramName)
  const targetDir = path.join(anchorDir, 'target', 'deploy')
  const soPath = path.join(targetDir, `${programName}.so`)
  const keypairPath = path.join(targetDir, `${programName}-keypair.json`)

  try {
    await fs.access(soPath)
  } catch {
    throw new AppException(
      500,
      ErrorCodes.ARTIFACT_NOT_FOUND,
      `Program binary not found at target/deploy/${programName}.so`,
    )
  }

  let keypairRaw: number[]
  try {
    const keypairJson = await fs.readFile(keypairPath, 'utf-8')
    keypairRaw = JSON.parse(keypairJson) as number[]
    if (!Array.isArray(keypairRaw) || keypairRaw.length < 64) {
      throw new Error('invalid keypair json')
    }
  } catch {
    throw new AppException(
      500,
      ErrorCodes.ARTIFACT_NOT_FOUND,
      `Program keypair not found at target/deploy/${programName}-keypair.json`,
    )
  }

  const soBytes = await fs.readFile(soPath)
  const programId = readProgramIdFromKeypair(keypairRaw)

  return {
    workspacePath,
    anchorDir,
    targetDir,
    programName,
    soPath,
    keypairPath,
    programId,
    soBytes,
  }
}

export async function readProgramKeypair(keypairPath: string): Promise<Keypair> {
  const keypairRaw = JSON.parse(await fs.readFile(keypairPath, 'utf-8')) as number[]
  if (!Array.isArray(keypairRaw) || keypairRaw.length < 64) {
    throw new AppException(500, ErrorCodes.ARTIFACT_NOT_FOUND, 'Program keypair is malformed')
  }

  return Keypair.fromSecretKey(Uint8Array.from(keypairRaw))
}
