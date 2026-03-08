import { FastifyInstance } from 'fastify'
import runService from '#app/modules/run/run.service'
import Logger from '#app/utils/logger'
import {
  AgentRole,
  StartRunBody,
  StreamEvent,
} from '#app/modules/agent-core/agent-core.interface'
import agentLoader, { ROLE_AGENT_MAP } from '#app/agents/agent-loader'
import { PromptBuilder } from '#app/agents/prompt-builder'
import { hasToolCalls, parseToolCalls } from '#app/agents/skills/tool-parser'
import { toolExecutor } from '#app/agents/skills/tool-executor'
import type { ToolContext, ProjectStack } from '#app/agents/skills/skill.types'
import AgentRegistryService from '#app/modules/agent-core/agent-core.registry'
import { OpenClawGatewayClient } from '#app/modules/agent-core/agent-core.gateway'
import { fileSystem } from '#app/modules/agent-core/agent-core.files'
import { AgentRun, EventType, Run } from '#app/modules/run/run.interface'
import { enrichAutonomousPhasePayload } from '#app/modules/agent-autonomous/autonomous-phase'
import { buildTaskResponseContract } from '#app/modules/agent-autonomous/autonomous-output-contract'
import {
  buildFallbackStackDecision,
  parseMvpScopeLine,
} from '#app/modules/agent-autonomous/autonomous-scope'
import { AUTONOMOUS_BUILD_PHASES } from '#app/modules/agent-autonomous/autonomous-build-phases'
import {
  normalizePrdMarkdown,
  validateFrontendFiles,
} from '#app/modules/agent-autonomous/autonomous-validation'
import {
  processMultiRoundDiscussionFlow,
  type Discussion,
} from '#app/modules/agent-autonomous/autonomous-discussion-flow'
import { continueToDevelopmentFlow } from '#app/modules/agent-autonomous/autonomous-build-flow'
import AppConfig from '#app/config/app'

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

const activeDiscussions = new Map<string, Discussion>()
const siwsSessionRuns = new Map<number, string>()
const AGENT_ROLES: AgentRole[] = ['pm', 'fe', 'be_sc', 'bd_research']

interface RuntimeAgentIdentity {
  id: number
  name: string
  role: AgentRole
  emoji: string
}

const promptBuilder = new PromptBuilder(agentLoader)

const runAgentIdentityCache = new Map<string, Record<AgentRole, RuntimeAgentIdentity>>()

function buildAutonomousFallbackIdentity(role: AgentRole): RuntimeAgentIdentity {
  const agent = agentLoader.getByRole(role)

  return {
    id: 0,
    name: agent.name,
    role,
    emoji: agent.emoji,
  }
}

function resolveAutonomousIdentity(runId: string, role: AgentRole): RuntimeAgentIdentity {
  const cached = runAgentIdentityCache.get(runId)?.[role]
  if (cached) {
    return cached
  }

  return buildAutonomousFallbackIdentity(role)
}

async function ensureAutonomousRunIdentities(runId: string): Promise<void> {
  if (runAgentIdentityCache.has(runId)) {
    return
  }

  const agentsByRole = await AgentRegistryService.getAgentsByRole('autonomous')
  const identities: Record<AgentRole, RuntimeAgentIdentity> = {
    pm: buildAutonomousFallbackIdentity('pm'),
    fe: buildAutonomousFallbackIdentity('fe'),
    'be_sc': buildAutonomousFallbackIdentity('be_sc'),
    'bd_research': buildAutonomousFallbackIdentity('bd_research'),
  }

  for (const role of AGENT_ROLES) {
    const entry = agentsByRole[role]
    identities[role] = {
      ...identities[role],
      id: entry.id,
      name: entry.agentName,
      role: entry.role,
    }
  }

  runAgentIdentityCache.set(runId, identities)
}

function clearAutonomousRunIdentities(runId: string): void {
  runAgentIdentityCache.delete(runId)
}

function stripIdentityPayloadFields(payload: Record<string, unknown>): Record<string, unknown> {
  const {
    agent,
    agentId,
    agentName,
    agentEmoji,
    ...rest
  } = payload
  void agent
  void agentId
  void agentName
  void agentEmoji

  return rest
}

function broadcast(
  app: FastifyInstance,
  runId: string,
  role: AgentRole,
  eventType: EventType,
  payload: Record<string, unknown>
): void {
  const cleanPayload = enrichAutonomousPhasePayload(stripIdentityPayloadFields(payload))
  const identity = resolveAutonomousIdentity(runId, role)
  const agent = {
    id: identity.id,
    name: identity.name,
    role: identity.role,
  }

  const streamEvent: StreamEvent = {
    runId,
    agentRunId: 'autonomous',
    agent,
    seq: Date.now(),
    eventType,
    payload: {
      ...cleanPayload,
      timestamp: new Date().toISOString(),
    },
  }

  app.io.to(`run:${runId}`).emit('agent_event', streamEvent)
}

function buildContext(messages: Array<{ role: AgentRole; name: string; content: string }>): string {
  return messages.map(m => `${m.name}: ${m.content}`).join('\n\n')
}

// Code generation streaming state
interface CodeGenState {
  isGenerating: boolean
  filePath: string
  language: string
  buffer: string
  lineCount: number
}

const codeGenStates = new Map<string, CodeGenState>()
const codeGenBuffers = new Map<string, string>()

const CODEGEN_START_HEADER = '===CODEGEN_START==='
const CODEGEN_END_MARKER = '===CODEGEN_END==='
const CODEGEN_HEADER_REGEX = /^===CODEGEN_START===\r?\nfile:\s*(.+?)\r?\nlanguage:\s*(.+?)\r?\n===\r?\n/
const CODEGEN_MARKER_TAIL_GUARD = Math.max(CODEGEN_START_HEADER.length, CODEGEN_END_MARKER.length)
const CODEGEN_ARTIFACT_LINE_REGEX = /^[ \t]*(===|```[a-zA-Z0-9_-]*)[ \t]*\r?\n?/gm

function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    rs: 'rust',
    sol: 'solidity',
    prisma: 'prisma',
    json: 'json',
    yml: 'yaml',
    yaml: 'yaml',
    css: 'css',
    html: 'html',
    md: 'markdown',
    sh: 'bash',
    toml: 'toml',
  }

  return langMap[ext] || ext || 'text'
}

function normalizeCodegenFilePath(role: AgentRole, filePath: string): string {
  const trimmed = filePath.trim().replace(/^\.?\//, '').replace(/^\/+/, '')

  if (role === 'fe') {
    if (trimmed.startsWith('frontend/')) {
      return trimmed
    }

    if (trimmed.startsWith('backend/') || trimmed.startsWith('anchor/')) {
      return trimmed
    }

    return `frontend/${trimmed}`
  }

  return trimmed
}

export type CodegenProjectType = 'frontend' | 'backend' | 'smart_contract' | 'other'

function detectProjectType(filePath: string): CodegenProjectType {
  const lower = filePath.toLowerCase()
  if (lower.startsWith('frontend/') || lower.startsWith('src/')) return 'frontend'
  if (lower.startsWith('backend/') || lower.startsWith('server/')) return 'backend'
  if (lower.startsWith('anchor/') || lower.includes('programs/') || lower.endsWith('.rs')) return 'smart_contract'

  return 'other'
}

export function sanitizeGeneratedFileContent(
  role: AgentRole,
  filePath: string,
  content: string
): { content: string; strippedArtifactLines: number } {
  const language = detectLanguage(filePath)
  const shouldSanitizeCodegenArtifacts =
    (role === 'fe' || role === 'be_sc') &&
    language !== 'markdown'

  if (!shouldSanitizeCodegenArtifacts) {
    return { content, strippedArtifactLines: 0 }
  }

  const artifactMatches = content.match(CODEGEN_ARTIFACT_LINE_REGEX)
  if (!artifactMatches || artifactMatches.length === 0) {
    return { content, strippedArtifactLines: 0 }
  }

  const stripped = content
    .replace(CODEGEN_ARTIFACT_LINE_REGEX, '')
    .replace(/^\n+/, '')

  Logger.warn(
    { role, filePath, strippedArtifactLines: artifactMatches.length },
    'Sanitized codegen artifact lines from generated file content',
  )

  return { content: stripped, strippedArtifactLines: artifactMatches.length }
}

function broadcastCodeGen(
  app: FastifyInstance,
  runId: string,
  role: AgentRole,
  eventType: EventType,
  payload: Record<string, unknown>
): void {
  const cleanPayload = stripIdentityPayloadFields(payload)
  const identity = resolveAutonomousIdentity(runId, role)
  const agent = {
    id: identity.id,
    name: identity.name,
    role: identity.role,
  }

  const filePath = (cleanPayload.filePath as string) || ''
  const explicitProjectType = typeof cleanPayload.projectType === 'string'
    ? cleanPayload.projectType
    : undefined
  const projectType = explicitProjectType || detectProjectType(filePath)

  const streamEvent = {
    runId,
    agentRunId: 'autonomous',
    agent,
    seq: Date.now(),
    eventType,
    payload: {
      ...cleanPayload,
      projectType,
      timestamp: new Date().toISOString(),
    },
  }

  app.io.to(`run:${runId}`).emit('codegen_event', streamEvent)
}

function broadcastDM(
  app: FastifyInstance,
  runId: string,
  fromRole: AgentRole,
  toRole: AgentRole,
  content: string
): void {
  const fromIdentity = resolveAutonomousIdentity(runId, fromRole)
  const toIdentity = resolveAutonomousIdentity(runId, toRole)
  const fromAgent = {
    id: fromIdentity.id,
    name: fromIdentity.name,
    role: fromIdentity.role,
  }

  const dmEvent = {
    runId,
    agentRunId: 'autonomous',
    agent: fromAgent,
    seq: Date.now(),
    eventType: 'agent.dm' as EventType,
    isDM: true,
    dmTarget: toRole,
    payload: {
      from: fromIdentity.role,
      fromAgentId: fromIdentity.id,
      fromName: fromIdentity.name,
      fromEmoji: fromIdentity.emoji,
      to: toIdentity.role,
      toAgentId: toIdentity.id,
      toName: toIdentity.name,
      toEmoji: toIdentity.emoji,
      content,
      timestamp: new Date().toISOString(),
    },
  }

  app.io.to(`run:${runId}`).emit('agent_event', dmEvent)
  Logger.info({ runId, from: fromIdentity.role, to: toIdentity.role }, 'DM sent between agents')
}

function getCodegenStateKey(runId: string, role: AgentRole): string {
  return `${runId}:${role}`
}

function getCodegenBufferKey(runId: string, role: AgentRole): string {
  return `${runId}:${role}:buffer`
}

function clearCodeGenStreamState(runId: string, role: AgentRole): void {
  codeGenStates.delete(getCodegenStateKey(runId, role))
  codeGenBuffers.delete(getCodegenBufferKey(runId, role))
}

async function finalizeCodeGenState(
  app: FastifyInstance,
  runId: string,
  role: AgentRole,
  state: CodeGenState
): Promise<void> {
  const identity = resolveAutonomousIdentity(runId, role)
  const sanitized = sanitizeGeneratedFileContent(role, state.filePath, state.buffer)
  state.buffer = sanitized.content
  state.lineCount = (state.buffer.match(/\n/g) || []).length

  Logger.info({ runId, role, filePath: state.filePath, lines: state.lineCount }, '✅ Code generation complete')

  broadcastCodeGen(app, runId, role, 'codegen.done', {
    filePath: state.filePath,
    language: state.language,
    totalLines: state.lineCount,
    totalChars: state.buffer.length,
  })

  const event = await fileSystem.writeFile(
    runId,
    state.filePath,
    state.buffer,
    identity.name
  )

  broadcast(app, runId, role, 'agent.delta', {
    message: `📁 Created: ${state.filePath}`,
    phase: 'file_created',
    fileEvent: event,
  })
}

async function processCodeGenStream(
  app: FastifyInstance,
  runId: string,
  role: AgentRole,
  chunk: string
): Promise<string> {
  const stateKey = getCodegenStateKey(runId, role)
  const bufferKey = getCodegenBufferKey(runId, role)
  let state = codeGenStates.get(stateKey)
  let nonCodeText = ''

  let contentToProcess = (codeGenBuffers.get(bufferKey) || '') + chunk

  while (contentToProcess.length > 0) {
    if (!state?.isGenerating) {
      const startIdx = contentToProcess.indexOf(CODEGEN_START_HEADER)

      if (startIdx === -1) {
        const safeLen = Math.max(0, contentToProcess.length - CODEGEN_MARKER_TAIL_GUARD)
        if (safeLen > 0) {
          nonCodeText += contentToProcess.slice(0, safeLen)
          contentToProcess = contentToProcess.slice(safeLen)
        }
        break
      }

      if (startIdx > 0) {
        nonCodeText += contentToProcess.slice(0, startIdx)
        contentToProcess = contentToProcess.slice(startIdx)
      }

      const startMatch = contentToProcess.match(CODEGEN_HEADER_REGEX)
      if (!startMatch) {
        break
      }

      const filePath = startMatch[1].trim()
      state = {
        isGenerating: true,
        filePath: normalizeCodegenFilePath(role, filePath),
        language: startMatch[2].trim() || detectLanguage(filePath),
        buffer: '',
        lineCount: 0,
      }
      codeGenStates.set(stateKey, state)

      Logger.info({ runId, role, filePath: state.filePath }, '🚀 Code generation started')

      broadcastCodeGen(app, runId, role, 'codegen.started', {
        filePath: state.filePath,
        language: state.language,
      })

      contentToProcess = contentToProcess.slice(startMatch[0].length)
      continue
    }

    const endIndex = contentToProcess.indexOf(CODEGEN_END_MARKER)
    if (endIndex === -1) {
      const safeLen = Math.max(0, contentToProcess.length - (CODEGEN_END_MARKER.length - 1))
      if (safeLen > 0) {
        await processCodeGenContent(app, runId, role, state, contentToProcess.slice(0, safeLen))
        contentToProcess = contentToProcess.slice(safeLen)
      }
      break
    }

    if (endIndex > 0) {
      const contentBeforeEnd = contentToProcess.slice(0, endIndex)
      if (contentBeforeEnd.length > 0) {
        await processCodeGenContent(app, runId, role, state, contentBeforeEnd)
      }
    }

    await finalizeCodeGenState(app, runId, role, state)
    codeGenStates.delete(stateKey)
    state = undefined
    contentToProcess = contentToProcess.slice(endIndex + CODEGEN_END_MARKER.length)
  }

  if (contentToProcess.length > 0) {
    codeGenBuffers.set(bufferKey, contentToProcess)
  } else {
    codeGenBuffers.delete(bufferKey)
  }

  return nonCodeText
}

async function flushCodeGenStream(
  app: FastifyInstance,
  runId: string,
  role: AgentRole
): Promise<void> {
  const stateKey = getCodegenStateKey(runId, role)
  const bufferKey = getCodegenBufferKey(runId, role)
  const state = codeGenStates.get(stateKey)

  if (state?.isGenerating) {
    const bufferedTail = codeGenBuffers.get(bufferKey) || ''
    if (bufferedTail.length > 0) {
      await processCodeGenContent(app, runId, role, state, bufferedTail)
    }
    await finalizeCodeGenState(app, runId, role, state)
  }

  clearCodeGenStreamState(runId, role)
}

async function processCodeGenContent(
  app: FastifyInstance,
  runId: string,
  role: AgentRole,
  state: CodeGenState,
  content: string
): Promise<void> {
  state.buffer += content

  const newLines = (content.match(/\n/g) || []).length
  state.lineCount += newLines

  const projectType = detectProjectType(state.filePath)

  await broadcastCodeGen(app, runId, role, 'codegen.delta', {
    filePath: state.filePath,
    language: state.language,
    projectType,
    chunk: content,
    lineNumber: state.lineCount,
  })
}

async function extractAndWriteFiles(
  app: FastifyInstance,
  runId: string,
  role: AgentRole,
  content: string,
  agentName: string
): Promise<void> {
  const fileBlockRegex = /===FILE:([^=]+)===\n([\s\S]*?)===ENDFILE===/g
  let match: RegExpExecArray | null

  while ((match = fileBlockRegex.exec(content)) !== null) {
    const filePath = match[1].trim()
    const fileContent = match[2].trim()
    const sanitized = sanitizeGeneratedFileContent(role, filePath, fileContent)

    try {
      const event = await fileSystem.writeFile(runId, filePath, sanitized.content, agentName)
      broadcast(app, runId, 'pm', 'agent.delta', {
        message: `📁 Created: ${filePath}`,
        phase: 'file_created',
        fileEvent: event,
        agentName,
      })
    } catch (error) {
      Logger.error({ runId, filePath, error }, 'Failed to write file')
    }
  }
}

async function streamAgentResponse(
  app: FastifyInstance,
  runId: string,
  agentRun: AgentRun | null,
  role: AgentRole,
  prompt: string,
  context: string,
  fileWrites?: Array<{ path: string; description: string }>,
  options?: { silent?: boolean; executeTools?: boolean },
  discussionRef?: Array<{ role: AgentRole; name: string; content: string }>
): Promise<string> {
  void agentRun
  const gateway = new OpenClawGatewayClient()
  const brief = promptBuilder.buildBrief(role)
  const identity = resolveAutonomousIdentity(runId, role)
  const canGenerateCode = role === 'fe' || role === 'be_sc'
  const isCodeGenTask = canGenerateCode && Boolean(fileWrites && fileWrites.length > 0)
  const isSilent = options?.silent === true

  // Reduced delay for faster response
  await delay(150 + Math.random() * 200)

  let fileInstructions = ''
  if (isCodeGenTask && fileWrites && fileWrites.length > 0) {
    fileInstructions = `\n\n=== FILE GENERATION TASK ===\nYou MUST write the following files:\n${fileWrites.map(f => `- ${f.path}: ${f.description}`).join('\n')}\n\nFor each file, use the CODE GENERATION FORMAT specified in your system prompt:\n===CODEGEN_START===\nfile: [filepath]\nlanguage: [lang]\n===\n[code content]\n===CODEGEN_END===\n\nRules:\n- NEVER output a standalone \`===\` line inside file content.\n- NEVER wrap file content in markdown fences (no \`\`\` blocks).\n- Provide complete, production-ready code.`
  }

  // Inject real-time tool instructions
  const toolInstructions = options?.executeTools !== false ? toolExecutor.buildToolInstructions(role) : ''
  const responseContract = buildTaskResponseContract(role, prompt, isCodeGenTask)

  const fullPrompt = `${brief.systemPrompt}${toolInstructions}\n\n${responseContract}\n\n=== CONVERSATION CONTEXT ===\n${context}\n\n=== YOUR TURN ===\n${prompt}${fileInstructions}\n\nRespond as ${identity.name} in your natural voice.`

  Logger.info({ runId, agent: identity.name }, 'Agent responding')

  if (!isSilent) {
    broadcast(app, runId, role, 'agent.started', {
      message: `${identity.name} is typing...`,
      agentName: identity.name,
      agentEmoji: brief.emoji,
    })
  }

  const stream = gateway.streamAgentResponse(
    ROLE_AGENT_MAP[role],
    fullPrompt,
    `${runId}:${role}:${Date.now()}`
  )

  let fullText = ''
  let visibleText = ''

  try {
    for await (const chunk of stream) {
      if (chunk.done) break
      if (chunk.content) {
        fullText += chunk.content

        if (isCodeGenTask) {
          const nonCodeText = await processCodeGenStream(app, runId, role, chunk.content)
          if (nonCodeText) {
            visibleText += nonCodeText
          }
        } else {
          visibleText += chunk.content
          if (!isSilent) {
            broadcast(app, runId, role, 'agent.delta', {
              message: chunk.content,
              accumulated: visibleText,
              agentName: identity.name,
              agentEmoji: brief.emoji,
            })
          }
        }
      }
    }

    if (isCodeGenTask) {
      await flushCodeGenStream(app, runId, role)
    }
  } catch (error) {
    if (isCodeGenTask) {
      const activeState = codeGenStates.get(getCodegenStateKey(runId, role))
      broadcastCodeGen(app, runId, role, 'codegen.error', {
        filePath: activeState?.filePath ?? '',
        error: error instanceof Error ? error.message : 'Unknown code generation error',
      })
      clearCodeGenStreamState(runId, role)
    }
    throw error
  }

  const doneMessage = isCodeGenTask
    ? (visibleText.trim() || `${identity.name} finished code generation.`)
    : visibleText

  if (!isSilent) {
    broadcast(app, runId, role, 'agent.done', {
      message: doneMessage,
      isCodeGeneration: isCodeGenTask,
      agentName: identity.name,
      agentEmoji: brief.emoji,
    })
  }

  if (isCodeGenTask && fullText.includes('===FILE:')) {
    await extractAndWriteFiles(app, runId, role, fullText, identity.name)
  }

  // ── Tool Call Processing ──────────────────────────────────────────
  if (options?.executeTools !== false && hasToolCalls(fullText)) {
    const { toolCalls, errors } = parseToolCalls(fullText)

    if (errors.length > 0) {
      Logger.warn({ runId, role, errors }, 'Tool call parsing produced errors')
    }

    if (toolCalls.length > 0) {
      Logger.info({ runId, role, toolCount: toolCalls.length }, 'Processing agent tool calls')

      const toolContext: ToolContext = {
        runId,
        agentId: identity.name,
        agentRole: role,
        workspacePath: `${AppConfig.workspace.root}/${runId}`,
      }

      await processToolCalls(app, runId, role, toolCalls, toolContext, discussionRef)
    }
  }

  await delay(100)

  return fullText
}

/**
 * Helper to process tool calls with real-time broadcasting.
 */
async function processToolCalls(
  app: FastifyInstance,
  runId: string,
  role: AgentRole,
  toolCalls: any[],
  context: ToolContext,
  discussionRef?: Array<{ role: AgentRole; name: string; content: string }>
): Promise<any[]> {
  const results: any[] = []

  for (const call of toolCalls) {
    // 1. Broadcast tool starting
    broadcast(app, runId, role, 'tool.called' as EventType, {
      tool: call.tool,
      params: call.params,
    })

    // 2. Execute tool
    const result = await toolExecutor.execute(call, context)
    results.push(result)

    // 3. Broadcast result
    broadcast(app, runId, role, 'tool.result' as EventType, {
      tool: call.tool,
      success: result.success,
      data: result.data,
      error: result.error,
    })

    // 4. Feed result back to discussion context if provided
    if (discussionRef) {
      discussionRef.push({
        role,
        name: 'System (Tool Result)',
        content: `Tool "${call.tool}" result: ${JSON.stringify(result.success ? result.data : result.error)}`,
      })
    }

    // Special case: handle define_scope updates directly to discussion state
    if (call.tool === 'define_scope' && result.success && result.data) {
      const discussion = activeDiscussions.get(runId)
      if (discussion) {
        const scopeData = (result.data as { stack?: ProjectStack }).stack
        if (scopeData) {
          discussion.stackDecision = scopeData
          // Trigger a custom broadcast to update the UI stack state immediately
          broadcast(app, runId, role, 'agent.delta', {
            message: `\n✅ Scope updated by tool: ${scopeData.reasoning}`,
            stackDecision: scopeData,
          })
        }
      }
    }
  }

  return results
}

async function processMultiRoundDiscussion(
  app: FastifyInstance,
  run: Run,
  inputText: string
): Promise<void> {
  await processMultiRoundDiscussionFlow(app, run, inputText, {
    activeDiscussions,
    runService,
    logger: Logger,
    broadcast,
    streamAgentResponse,
    buildContext,
    parseMvpScopeLine,
    buildFallbackStackDecision,
    normalizePrdMarkdown,
    fileSystem,
    clearAutonomousRunIdentities,
  })
}

const PHASES = AUTONOMOUS_BUILD_PHASES

// ── Continuous Development Trigger ────────────────────────────────

export async function continueToDevelopment(
  app: FastifyInstance,
  runId: string,
  decision: 'approved' | 'rejected'
): Promise<void> {
  await continueToDevelopmentFlow(app, runId, decision, {
    runService,
    logger: Logger,
    activeDiscussions,
    buildContext,
    parseMvpScopeLine,
    buildFallbackStackDecision,
    phases: PHASES,
    broadcast,
    broadcastCodeGen,
    streamAgentResponse,
    fileSystem,
    toolExecutor,
    validateFrontendFiles,
    clearAutonomousRunIdentities,
  })
}

interface SmartContractFixPayload {
  errorLog: string
  programName?: string
}

function buildSmartContractFixPrompt(
  context: string,
  payload: SmartContractFixPayload,
): string {
  const clippedError = payload.errorLog.trim().slice(-3500)

  return `${PHASES.smartContract.prompt(context)}

TARGETED MAINTENANCE FIX MODE (NO NEW PRODUCT DISCUSSION):
- This is a repair pass for an existing workspace.
- Modify ONLY files under \`anchor/\`.
- Keep wallet-signed devnet deploy flow unchanged (\`POST /v1/solana/deploy/deployments\`).
- Resolve the compile/deploy failure below with minimal, correct changes.
- Regenerate every touched file fully in codegen format.
${payload.programName ? `- Program hint: ${payload.programName}` : ''}

Error log:
${clippedError}`
}

export async function fixSmartContractBuild(
  app: FastifyInstance,
  runId: string,
  payload: SmartContractFixPayload,
): Promise<void> {
  const run = await runService.getRun(runId)
  if (!run) {
    throw new Error('Run not found')
  }
  if (!payload.errorLog?.trim()) {
    throw new Error('errorLog is required')
  }

  await ensureAutonomousRunIdentities(runId)

  const previousStatus = run.status
  const discussion = activeDiscussions.get(runId)
  const discussionRef = discussion?.messages
    ?? [{ role: 'pm' as AgentRole, name: 'PM', content: `Original request: ${run.inputText}` }]
  const context = buildContext(discussionRef)
  const prompt = buildSmartContractFixPrompt(context, payload)

  await runService.updateRun(runId, { status: 'executing' })

  broadcast(app, runId, 'pm', 'agent.started', {
    message: '🛠️ Running targeted smart-contract maintenance fix...',
    phase: 'build_smart_contract',
  })

  try {
    await streamAgentResponse(
      app,
      runId,
      null,
      PHASES.smartContract.role,
      prompt,
      '',
      PHASES.smartContract.files,
      { executeTools: true },
      discussionRef,
    )

    const stats = await fileSystem.getStats(runId)
    const fileList = await fileSystem.getAllFiles(runId)
    await runService.updateRun(runId, { status: 'completed' })

    broadcast(app, runId, 'pm', 'run.done', {
      phase: 'run_completed',
      message: '✅ Smart-contract maintenance fix completed.',
      stats,
      fileList,
      downloadUrl: `/v1/autonomous/runs/${runId}/download`,
    })
  } catch (error) {
    await runService.updateRun(runId, { status: previousStatus })

    broadcast(app, runId, 'pm', 'agent.error', {
      phase: 'build_smart_contract',
      message: error instanceof Error ? error.message : 'Smart-contract fix failed',
    })

    throw error
  }
}

interface StartRunOptions {
  forceNewThread?: boolean
}

async function startRunInternal(
  app: FastifyInstance,
  body: StartRunBody,
  userId?: number,
  options?: StartRunOptions
): Promise<Run> {
  const inputText = body.prdText?.trim() || body.idea?.trim() || ''
  if (!inputText) {
    throw new Error('idea or prdText is required')
  }

  const inputType = body.source ?? (body.prdText ? 'prd' : 'chat')
  const forceNewThread = options?.forceNewThread === true
  let run: Run

  if (typeof userId === 'number') {
    if (forceNewThread) {
      run = await runService.createRun({
        inputType,
        inputText,
        status: 'planning',
      })
      siwsSessionRuns.set(userId, run.id)
    } else {
      const existingRunId = siwsSessionRuns.get(userId)

      if (existingRunId) {
        const existingRun = await runService.getRun(existingRunId)

        if (existingRun) {
          if (existingRun.status === 'executing') {
            Logger.warn(
              { userId, previousRunId: existingRun.id },
              'Existing session run still executing; creating a new run for latest prompt',
            )
            run = await runService.createRun({
              inputType,
              inputText,
              status: 'planning',
            })
            siwsSessionRuns.set(userId, run.id)
          } else if (existingRun.status === 'awaiting_approval') {
            Logger.info(
              { userId, previousRunId: existingRun.id },
              'Existing session run awaiting approval; auto-cancelling and starting a new run',
            )
            await runService.updateRun(existingRun.id, { status: 'cancelled' })
            activeDiscussions.delete(existingRun.id)
            clearAutonomousRunIdentities(existingRun.id)

            run = await runService.createRun({
              inputType,
              inputText,
              status: 'planning',
            })
            siwsSessionRuns.set(userId, run.id)
          } else {
            run = await runService.updateRun(existingRun.id, {
              inputText,
              status: 'planning',
            })
          }
        } else {
          siwsSessionRuns.delete(userId)
          run = await runService.createRun({
            inputType,
            inputText,
            status: 'planning',
          })
          siwsSessionRuns.set(userId, run.id)
        }
      } else {
        run = await runService.createRun({
          inputType,
          inputText,
          status: 'planning',
        })
        siwsSessionRuns.set(userId, run.id)
      }
    }
  } else {
    run = await runService.createRun({
      inputType,
      inputText,
      status: 'planning',
    })
  }

  await ensureAutonomousRunIdentities(run.id)

  try {
    const gateway = new OpenClawGatewayClient()
    const health = await gateway.healthCheck()
    if (!health.ok) {
      throw new Error(`Gateway unreachable: ${health.error}`)
    }
  } catch (error) {
    await runService.updateRun(run.id, { status: 'failed' })
    clearAutonomousRunIdentities(run.id)
    const message = error instanceof Error ? error.message : 'Gateway check failed'
    throw new Error(`OpenClaw gateway unreachable: ${message}`)
  }

  void processMultiRoundDiscussion(app, run, inputText)
    .catch(async (error) => {
      Logger.error({ err: error, runId: run.id }, 'Multi-round discussion failed')
      await runService.updateRun(run.id, { status: 'failed' })
      clearAutonomousRunIdentities(run.id)
    })

  const latestRun = await runService.getRun(run.id)

  return latestRun ?? run
}

const AutonomousAgentService = {
  startRun: (app: FastifyInstance, body: StartRunBody, userId?: number): Promise<Run> =>
    startRunInternal(app, body, userId),
  startNewThread: (app: FastifyInstance, body: StartRunBody, userId?: number): Promise<Run> =>
    startRunInternal(app, body, userId, { forceNewThread: true }),

  listAgents: () => AgentRegistryService.listAgents('autonomous'),
  continueToDevelopment,
  fixSmartContractBuild,
  getDiscussion: (runId: string) => activeDiscussions.get(runId),
  fileSystem,
}

export default AutonomousAgentService
