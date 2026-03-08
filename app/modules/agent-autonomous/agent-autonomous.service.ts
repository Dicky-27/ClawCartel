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
import AppException from '#app/exceptions/app_exception'
import ErrorCodes from '#app/exceptions/error_codes'

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

interface Discussion {
  round: number
  messages: Array<{ role: AgentRole; name: string; content: string }>
  isComplete: boolean
  waitingForUser: boolean
  projectName: string
  inputText: string
  stackDecision?: ProjectStack
}

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
  const cleanPayload = stripIdentityPayloadFields(payload)
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
  content: string,
  agentName: string
): Promise<void> {
  const fileBlockRegex = /===FILE:([^=]+)===\n([\s\S]*?)===ENDFILE===/g
  let match: RegExpExecArray | null

  while ((match = fileBlockRegex.exec(content)) !== null) {
    const filePath = match[1].trim()
    const fileContent = match[2].trim()

    try {
      const event = await fileSystem.writeFile(runId, filePath, fileContent, agentName)
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
    fileInstructions = `\n\n=== FILE GENERATION TASK ===\nYou MUST write the following files:\n${fileWrites.map(f => `- ${f.path}: ${f.description}`).join('\n')}\n\nFor each file, use the CODE GENERATION FORMAT specified in your system prompt:\n===CODEGEN_START===\nfile: [filepath]\nlanguage: [lang]\n===\n[code content]\n===CODEGEN_END===\n\nProvide complete, production-ready code.`
  }

  // Inject real-time tool instructions
  const toolInstructions = options?.executeTools !== false ? toolExecutor.buildToolInstructions(role) : ''

  const fullPrompt = `${brief.systemPrompt}${toolInstructions}\n\n=== CONVERSATION CONTEXT ===\n${context}\n\n=== YOUR TURN ===\n${prompt}${fileInstructions}\n\nRespond as ${identity.name} in your natural voice.`

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
    await extractAndWriteFiles(app, runId, fullText, identity.name)
  }

  // ── Tool Call Processing ──────────────────────────────────────────
  if (options?.executeTools !== false && hasToolCalls(fullText)) {
    const { toolCalls } = parseToolCalls(fullText)

    if (toolCalls.length > 0) {
      Logger.info({ runId, role, toolCount: toolCalls.length }, 'Processing agent tool calls')

      const toolContext: ToolContext = {
        runId,
        agentId: identity.name,
        agentRole: role,
        workspacePath: `${process.env.WORKSPACE_ROOT || '/home/xfajarr/.openclaw/workspace/claw-cartel-projects'}/${runId}`,
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
  const runId = run.id
  const projectName = inputText.slice(0, 50).replace(/[^a-zA-Z0-9]/g, '_')

  Logger.info({ runId, projectName }, 'Starting MULTI-ROUND autonomous discussion')

  const discussion: Discussion = {
    round: 1,
    messages: [],
    isComplete: false,
    waitingForUser: false,
    projectName,
    inputText,
  }
  activeDiscussions.set(runId, discussion)

  await runService.updateRun(run.id, { status: 'executing' })

  // ── Immediate feedback ────────────────────────────────────────────
  broadcast(app, runId, 'pm', 'agent.started', {
    message: '🧠 Analyzing your request...',
    phase: 'round_1',
  })

  // ── Fast intent classification ────────────────────────────────────
  const lowerInput = inputText.toLowerCase()
  const isChatByKeyword =
    lowerInput.startsWith('what is') ||
    lowerInput.startsWith('how are') ||
    lowerInput.startsWith('who are') ||
    lowerInput.startsWith('explain ') ||
    lowerInput.startsWith('hey ') ||
    lowerInput.startsWith('hi ') ||
    lowerInput.startsWith('hello')
  const isBuildByKeyword =
    lowerInput.includes('build') ||
    lowerInput.includes('create') ||
    lowerInput.includes('make') ||
    lowerInput.includes('develop') ||
    lowerInput.includes('implement') ||
    lowerInput.includes('design') ||
    lowerInput.includes('app') ||
    lowerInput.includes('website') ||
    lowerInput.includes('platform') ||
    lowerInput.includes('tool') ||
    lowerInput.includes('landing page') ||
    lowerInput.includes('dashboard') ||
    lowerInput.includes('marketplace')

  let intentAnalysis: string

  if (isBuildByKeyword && !isChatByKeyword) {
    intentAnalysis = '[BUILD]'
    Logger.info({ runId }, 'Fast intent classification: BUILD (keyword match)')
  } else if (isChatByKeyword && !isBuildByKeyword) {
    intentAnalysis = '[CHAT]'
    Logger.info({ runId }, 'Fast intent classification: CHAT (keyword match)')
  } else {
    // Ambiguous — fall back to LLM classification
    intentAnalysis = await streamAgentResponse(
      app, runId, null, 'pm',
      `INTERNAL CLASSIFICATION - Classify this user message:\n"${inputText}"\n\nIs this:\nA) BUILD INTENT - user wants to build/create/make something\nB) CASUAL CHAT - user is asking a question or chatting\n\nRespond ONLY with:\n"[BUILD]" or "[CHAT]" - nothing else.`,
      `User input: ${inputText}`,
      undefined,
      { silent: true }
    )
  }

  // Check if casual chat
  if (intentAnalysis.includes('[CHAT]') ||
    (!intentAnalysis.includes('[BUILD]') &&
      (inputText.toLowerCase().includes('what is') ||
        inputText.toLowerCase().includes('how are') ||
        inputText.toLowerCase().includes('explain') ||
        inputText.toLowerCase().includes('?')))) {
    Logger.info({ runId }, 'PM classified as casual chat - skipping squad')
    const chatResponse = await streamAgentResponse(
      app, runId, null, 'pm',
      `User is chatting: "${inputText}"\nRespond naturally as Alex Chen, Product Lead.`,
      `Chat: ${inputText}`
    )
    broadcast(app, runId, 'pm', 'run.done', {
      message: chatResponse,
      phase: 'chat_response',
      isChat: true,
    })
    await runService.updateRun(run.id, { status: 'completed' })
    activeDiscussions.delete(runId)
    clearAutonomousRunIdentities(runId)

    return
  }

  // ROUND 1: Discovery & Scoping
  broadcast(app, runId, 'pm', 'agent.started', {
    message: '🏢 Starting Project Discovery',
    phase: 'round_1',
  })

  // Step 1: PM kickoff
  const pmOpening = await streamAgentResponse(
    app, runId, null, 'pm',
    `New project request: "${inputText}"

You are Alex, the Project Manager and lead of the "Claw Cartel" squad. You orchestrate this team to build projects on Solana.

Kick this off naturally and assertively. Your job is to set the direction for your three team members:
- Riley (Research): Needs to analyze the requirements and determine the technical scope.
- Jordan (Frontend): Will build the UI (defaulting to React/Vite unless specified otherwise).
- Sam (Backend/Smart Contract): Will handle the Solana programs (Anchor) and any off-chain backend.

Example opening:
"Alright team, we have a new project - [summarize]. As the Claw Cartel squad, we need to execute this cleanly. Riley, dig into the scope and tell us if we need a backend or smart contract. Jordan, Sam, stand by to design the architecture based on Riley's data."

Critical objective for this kickoff:
- Riley must determine if MVP requires backend API (YES/NO + reason)
- Riley must determine if MVP requires smart contract (YES/NO + reason)
- Default to frontend-only web app when the user's ask can be just a static/landing page.

Keep it casual but authoritative. Don't assume the full tech stack yourself; delegate to Riley to decide.`,
    `New project: ${inputText}`
  )
  discussion.messages.push({ role: 'pm', name: 'PM', content: pmOpening })

  // Step 2: Researcher responds
  const researcherResponse = await streamAgentResponse(
    app, runId, null, 'bd_research',
    `Scope validation first.

Give the team a practical recommendation with this exact decision format:
- Backend required for MVP: YES or NO + one-line reason
- Smart contract required for MVP: YES or NO + one-line reason

Then provide:
- Fastest shippable MVP path
- Risks and constraints
- Anything Jordan/Sam need to know

Priority: MVP first, with frontend that can build/compile/preview.`,
    buildContext(discussion.messages),
    undefined,
    { executeTools: true },
    discussion.messages
  )
  discussion.messages.push({ role: 'bd_research', name: 'Researcher', content: researcherResponse })

  // Step 3: FE and BE_SC run IN PARALLEL
  broadcast(app, runId, 'pm', 'agent.delta', {
    message: '⚡ FE + BE_SC analyzing in parallel (design + architecture)',
    phase: 'round_1_parallel'
  })

  const results = await Promise.allSettled([
    streamAgentResponse(
      app, runId, null, 'fe',
      'Jordan - what\'s your take on the UI/UX for this? Walk us through your thinking. Tag Sam if you need API details. Keep it conversational.',
      buildContext(discussion.messages),
      undefined,
      { executeTools: true },
      discussion.messages
    ),
    streamAgentResponse(
      app, runId, null, 'be_sc',
      'Sam - what\'s your thinking on backend/architecture? Walk us through your approach. Tag Jordan if you need to know frontend requirements. Keep it conversational.',
      buildContext(discussion.messages),
      undefined,
      { executeTools: true },
      discussion.messages
    ),
  ])

  if (results[0].status === 'fulfilled') {
    discussion.messages.push({ role: 'fe', name: 'FE', content: results[0].value })
  } else {
    Logger.error({ runId, error: results[0].reason }, 'FE failed to respond')
    discussion.messages.push({ role: 'fe', name: 'FE', content: '[FE encountered an error]' })
  }

  if (results[1].status === 'fulfilled') {
    discussion.messages.push({ role: 'be_sc', name: 'BE_SC', content: results[1].value })
  } else {
    Logger.error({ runId, error: results[1].reason }, 'BE_SC failed to respond')
    discussion.messages.push({ role: 'be_sc', name: 'BE_SC', content: '[BE_SC encountered an error]' })
  }

  // ROUND 2: Finalize Scope & Plan
  broadcast(app, runId, 'pm', 'agent.delta', {
    message: '📑 Finalizing Scope & Project Plan',
    phase: 'round_2',
  })

  const pmClosing = await streamAgentResponse(
    app, runId, null, 'pm',
    `Alright team, thanks for the input.

As the orchestrator (Alex), you need to lock the scope now.
Produce a final summary of what we are building based on the squad's discussion.

If we're building a full app, you MUST call the define_scope tool to lock it in for the system:
[TOOL_CALL]
tool: define_scope
params: {
  "stack": {
    "backend": true,
    "smartContract": false,
    "reasoning": "Standard web app with Postgres backend, no blockchain needed for MVP."
  }
}
[/TOOL_CALL]

Then, provide a clear, numbered list of features for the MVP.
End by asking the user for their final approval so the Openclaw squad can start coding.`,
    buildContext(discussion.messages),
    undefined,
    { executeTools: true },
    discussion.messages
  )
  discussion.messages.push({ role: 'pm', name: 'PM', content: pmClosing })

  discussion.waitingForUser = true
  await runService.updateRun(runId, { status: 'awaiting_approval' })

  broadcast(app, runId, 'pm', 'agent.done', {
    message: 'I\'ve outlined the plan above. Ready to start building when you are!',
    phase: 'awaiting_approval',
    waitingForUser: true,
  })
}

// ── Fallback Scope Detection ──────────────────────────────────────

const MVP_SCOPE_LINE_REGEX =
  /\[MVP_SCOPE\]\s*backend_required=(yes|no)\s*;\s*smart_contract_required=(yes|no)\s*;\s*rationale=([^\n]+)/i
const BACKEND_REQUIRED_LINE_REGEX = /backend\s+required\s+for\s+mvp\s*:\s*(yes|no)\b/i
const SMART_CONTRACT_REQUIRED_LINE_REGEX =
  /smart\s*contract\s+required\s+for\s+mvp\s*:\s*(yes|no)\b/i

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some(keyword => text.includes(keyword))
}

function parseRequiredLineDecision(text: string, regex: RegExp): boolean | null {
  const match = text.match(regex)
  if (!match) {
    return null
  }

  return match[1].toLowerCase() === 'yes'
}

function getScopeSignalText(
  inputText: string,
  messages: Array<{ role: AgentRole; content: string }>
): string {
  const strategicMessages = messages
    .filter(message => message.role === 'pm' || message.role === 'bd_research')
    .map(message => message.content)
    .join('\n\n')

  return `${inputText}\n\n${strategicMessages}`.toLowerCase()
}

function detectBackendNeed(
  inputText: string,
  messages: Array<{ role: AgentRole; content: string }>
): boolean {
  const text = getScopeSignalText(inputText, messages)
  const requiredDecision = parseRequiredLineDecision(text, BACKEND_REQUIRED_LINE_REGEX)
  if (requiredDecision !== null) {
    return requiredDecision
  }

  const explicitNoBackendKeywords = [
    'no backend', 'without backend', 'frontend-only', 'frontend only', 'static landing',
    'static page', 'marketing page', 'external form', 'calendly', 'google form', 'no api needed'
  ]
  const explicitBackendKeywords = [
    'backend required', 'requires backend', 'build backend', 'api endpoint', 'rest api',
    'graphql', 'database', 'postgres', 'mongodb', 'mysql', 'server-side', 'authentication',
    'user account', 'admin dashboard', 'webhook', 'store submissions', 'persist lead'
  ]

  const frontendOnlyRequest = containsAny(inputText.toLowerCase(), [
    'landing page', 'marketing page', 'simple page', 'static page'
  ])
  const hasNoBackendSignal = containsAny(text, explicitNoBackendKeywords)
  const hasBackendSignal = containsAny(text, explicitBackendKeywords)

  if (frontendOnlyRequest && !hasBackendSignal) return false
  if (hasNoBackendSignal && !hasBackendSignal) return false

  return hasBackendSignal
}

function detectSmartContractNeed(
  inputText: string,
  messages: Array<{ role: AgentRole; content: string }>
): boolean {
  const text = getScopeSignalText(inputText, messages)
  const requiredDecision = parseRequiredLineDecision(text, SMART_CONTRACT_REQUIRED_LINE_REGEX)
  if (requiredDecision !== null) {
    return requiredDecision
  }

  const explicitNoSmartContractKeywords = [
    'no smart contract', 'without smart contract', 'off-chain only', 'offchain only', 'web2 only'
  ]
  const explicitSmartContractKeywords = [
    'smart contract', 'solana program', 'anchor', 'on-chain', 'onchain', 'nft mint',
    'token contract', 'program id', 'spl token', 'contract deployment', 'dapp'
  ]

  const hasNoSmartContractSignal = containsAny(text, explicitNoSmartContractKeywords)
  const hasSmartContractSignal = containsAny(text, explicitSmartContractKeywords)

  if (hasNoSmartContractSignal && !hasSmartContractSignal) return false

  return hasSmartContractSignal
}

function parseMvpScopeLine(text: string): ProjectStack | null {
  const match = text.match(MVP_SCOPE_LINE_REGEX)
  if (!match) return null

  return {
    frontend: true,
    backend: match[1].toLowerCase() === 'yes',
    smartContract: match[2].toLowerCase() === 'yes',
    reasoning: match[3].trim() || 'Scope locked from PM final decision marker',
  }
}

function buildFallbackStackDecision(
  inputText: string,
  messages: Array<{ role: AgentRole; content: string }>
): ProjectStack {
  return {
    frontend: true,
    backend: detectBackendNeed(inputText, messages),
    smartContract: detectSmartContractNeed(inputText, messages),
    reasoning: 'Fallback scope detection from user request + PM/research discussion',
  }
}

// Code Generation Phases Config
const PHASES = {
  research: {
    role: 'bd_research' as AgentRole,
    files: [],
    prompt: (ctx: string, stackDecision?: ProjectStack) => `Riley, give a concise implementation brief.

Include:
- MVP scope and assumptions
- Risks and constraints
${stackDecision?.backend ? '- Backend API requirements and database schema' : ''}
${stackDecision?.smartContract ? '- Smart contract requirements and security considerations' : ''}
- What FE must prioritize first
${!stackDecision?.backend ? '- NOTE: This is a frontend-only project. No backend API needed.' : ''}
${!stackDecision?.smartContract ? '- NOTE: No smart contracts needed for this project.' : ''}

Do NOT generate code and do NOT output file blocks.

Context:
${ctx}`,
  },
  backend: {
    role: 'be_sc' as AgentRole,
    files: [
      { path: 'backend/package.json', description: 'API server deps' },
      { path: 'backend/src/index.ts', description: 'Hono API server' },
    ],
    prompt: (ctx: string) => `Alright Sam, time to code.

Write the backend based on what we discussed. Multiple files, complete implementation.

Use this format for each file:

===CODEGEN_START===
file: backend/src/index.ts
language: typescript
===
// Your actual code here
===CODEGEN_END===

Generate what we agreed on:
- Node.js/Hono API server
- Database schema if needed
- Package.json, configs, etc.

Working code, not stubs. Match what we scoped.

Context from our discussion:
${ctx}`,
  },
  smartContract: {
    role: 'be_sc' as AgentRole,
    files: [
      { path: 'anchor/Cargo.toml', description: 'Rust workspace configuration' },
      { path: 'anchor/Anchor.toml', description: 'Anchor configuration' },
      { path: 'anchor/programs/my_program/Cargo.toml', description: 'Program dependencies' },
      { path: 'anchor/programs/my_program/src/lib.rs', description: 'Main Solana program (Anchor)' },
      { path: 'anchor/programs/my_program/src/instructions/mod.rs', description: 'Instruction modules' },
      { path: 'anchor/programs/my_program/src/state/mod.rs', description: 'Account state definitions' },
      { path: 'anchor/programs/my_program/src/errors.rs', description: 'Custom error codes' },
      { path: 'anchor/tests/my_program.ts', description: 'Anchor tests' },
    ],
    prompt: (ctx: string) => `Sam, write the Solana smart contract using Anchor.

Use this format for each file:

===CODEGEN_START===
file: anchor/programs/my_program/src/lib.rs
language: rust
===
// Your actual code here
===CODEGEN_END===

Generate the Anchor/Rust smart contract we discussed.
Working code, not stubs.

Context from our discussion:
${ctx}`,
  },
  frontend: {
    role: 'fe' as AgentRole,
    scaffoldedFiles: [
      { path: 'frontend/src/App.tsx', description: 'Main App component' },
      { path: 'frontend/src/index.css', description: 'Global styles' },
    ],
    fullBootstrapFiles: [
      { path: 'frontend/package.json', description: 'NPM scripts and dependencies' },
      { path: 'frontend/index.html', description: 'Vite HTML entry file' },
      { path: 'frontend/tsconfig.json', description: 'TypeScript config' },
      { path: 'frontend/vite.config.ts', description: 'Vite configuration' },
      { path: 'frontend/src/main.tsx', description: 'React entry point' },
      { path: 'frontend/src/App.tsx', description: 'Main App component' },
      { path: 'frontend/src/index.css', description: 'Global styles' },
    ],
    prompt: (
      ctx: string,
      stackDecision?: ProjectStack,
      options?: { scaffoldReady?: boolean }
    ) => `Alright Jordan, time to code.

${options?.scaffoldReady
    ? `The frontend has been scaffolded with Vite + React + TypeScript.
Base config files already exist.`
    : 'Scaffold step failed, so you MUST generate a complete runnable frontend project from scratch (Vite + React + TypeScript).'}

Your job: generate complete application code that runs with \`npm install && npm run build\`.

Use this format for each file:

===CODEGEN_START===
file: frontend/src/App.tsx
language: typescript
===
// Your actual code here
===CODEGEN_END===

Generate:
${options?.scaffoldReady
    ? `1. frontend/src/App.tsx — main component
2. frontend/src/index.css — styles
3. frontend/src/components/*.tsx — components we agreed on
4. frontend/src/hooks/*.ts — custom hooks if needed`
    : `1. frontend/package.json
2. frontend/index.html
3. frontend/tsconfig.json
4. frontend/vite.config.ts
5. frontend/src/main.tsx
6. frontend/src/App.tsx
7. frontend/src/index.css
8. frontend/src/components/*.tsx (if needed)
9. frontend/src/hooks/*.ts (if needed)`}

After generating code, call add_dependencies() for any extra npm packages needed:
[TOOL_CALL]
tool: add_dependencies
params: { "packages": ["react-router-dom", "lucide-react"], "project": "frontend" }
[/TOOL_CALL]

Rules:
- Every file path MUST start with \`frontend/\`
- NO placeholder images — use CSS/SVG for visuals
- Design must look PREMIUM and STUNNING — use modern CSS, gradients, animations
${!stackDecision?.backend ? '- This is frontend-only — use localStorage/state for data persistence' : ''}
${stackDecision?.backend ? '- Backend API runs at http://localhost:3001 — use fetch for API calls' : ''}
- Use TypeScript strictly — no \`any\`
- Every component must be self-contained and complete

Match what we scoped. Working code, not stubs.

Context from our discussion:
${ctx}`,
  },
  deploy: {
    role: 'pm' as AgentRole,
    prompt: (ctx: string, stackDecision?: ProjectStack) => `Alex (PM) - close this run with a final handoff summary.

Include:
- What FE completed
${stackDecision?.backend ? '- What backend API completed' : ''}
${stackDecision?.smartContract ? '- What smart contract completed' : ''}
- Any follow-up tasks and risks
- How to run the project

Do NOT generate code and do NOT output file blocks.

Context from our discussion:
${ctx}`,
  },
}

// ── Continuous Development Trigger ────────────────────────────────

export async function continueToDevelopment(
  app: FastifyInstance,
  runId: string,
  decision: 'approved' | 'rejected'
): Promise<void> {
  const run = await runService.getRun(runId)
  if (!run) throw new Error('Run not found')

  const discussion = activeDiscussions.get(runId)
  if (!discussion) throw new Error('Discussion context not found')

  if (decision === 'rejected') {
    broadcast(app, runId, 'pm', 'agent.done', {
      message: 'User rejected the plan.',
      phase: 'rejected',
    })
    await runService.updateRun(runId, { status: 'cancelled' })
    activeDiscussions.delete(runId)
    clearAutonomousRunIdentities(runId)

    return
  }

  Logger.info({ runId }, '=== STARTING CODE GENERATION ===')
  discussion.waitingForUser = false
  await runService.updateRun(runId, { status: 'executing' })

  const stackDecision: ProjectStack = discussion.stackDecision
    ?? buildFallbackStackDecision(discussion.inputText, discussion.messages)
  discussion.stackDecision = stackDecision

  Logger.info(
    { runId, stack: stackDecision },
    `Stack decision: FE=always, BE=${stackDecision.backend}, SC=${stackDecision.smartContract}`,
  )

  if (!stackDecision.backend && !stackDecision.smartContract) {
    broadcast(app, runId, 'pm', 'agent.delta', {
      message: '✅ Scope locked: frontend-only MVP. Backend and smart contract are skipped for this run.',
      phase: 'scope_lock',
      stackDecision,
    })
  }

  broadcast(app, runId, 'pm', 'agent.started', {
    message: `🚀 Initializing project workspace... (Stack: Frontend${stackDecision.backend ? ' + Backend' : ''}${stackDecision.smartContract ? ' + Smart Contract' : ''})`,
    phase: 'code_generation',
    stackDecision,
  })

  await fileSystem.initProject(runId, discussion.projectName)

  const context = buildContext(discussion.messages)

  // ── Phase 1: Research Brief ──────────────────────────────────────
  const totalPhases = 2 + (stackDecision.backend ? 1 : 0) + (stackDecision.smartContract ? 1 : 0)
  let currentPhase = 1

  broadcast(app, runId, 'pm', 'agent.delta', {
    message: `\n[Phase ${currentPhase}/${totalPhases}: Researcher - Build Brief]`,
    phase: 'phase_brief',
  })
  await streamAgentResponse(
    app, runId, null, PHASES.research.role,
    PHASES.research.prompt(context, stackDecision),
    '',
    undefined,
    { executeTools: true },
    discussion.messages
  )

  // ── Phase 2: Conditional Backend/Smart Contract ──────────────────
  if (stackDecision.smartContract) {
    currentPhase++
    broadcast(app, runId, 'pm', 'agent.delta', {
      message: `\n[Phase ${currentPhase}/${totalPhases}: BE_SC - Smart Contract]`,
      phase: 'phase_smart_contract',
    })
    await streamAgentResponse(
      app, runId, null, PHASES.smartContract.role,
      PHASES.smartContract.prompt(context),
      '',
      PHASES.smartContract.files,
      { executeTools: true }
    )

    const scFiles = await fileSystem.getAllFiles(runId)
    broadcastCodeGen(app, runId, 'be_sc', 'codegen.project.ready' as EventType, {
      projectType: 'smart_contract',
      files: scFiles.filter(f => f.startsWith('anchor/')),
      entryPoint: 'anchor/programs/my_program/src/lib.rs',
      devCommand: 'anchor build && anchor test',
      framework: 'anchor',
    })
  }

  if (stackDecision.backend) {
    currentPhase++
    broadcast(app, runId, 'pm', 'agent.delta', {
      message: `\n[Phase ${currentPhase}/${totalPhases}: BE_SC - Backend API]`,
      phase: 'phase_backend',
    })
    await streamAgentResponse(
      app, runId, null, PHASES.backend.role,
      PHASES.backend.prompt(context),
      '',
      PHASES.backend.files,
      { executeTools: true }
    )

    const beFiles = await fileSystem.getAllFiles(runId)
    broadcastCodeGen(app, runId, 'be_sc', 'codegen.project.ready' as EventType, {
      projectType: 'backend',
      files: beFiles.filter(f => f.startsWith('backend/')),
      entryPoint: 'backend/src/index.ts',
      devCommand: 'npm run dev',
      framework: 'hono',
    })
  }

  // ── Phase 3: Frontend ───────────────────────────────────────────
  currentPhase++
  broadcast(app, runId, 'pm', 'agent.delta', {
    message: `\n[Phase ${currentPhase}/${totalPhases}: FE - Frontend (Scaffold + Code)]`,
    phase: 'phase_frontend',
  })

  const scaffoldContext: ToolContext = {
    runId,
    agentId: 'jordan',
    agentRole: 'fe',
    workspacePath: `${process.env.WORKSPACE_ROOT || '/home/xfajarr/.openclaw/workspace/claw-cartel-projects'}/${runId}`,
  }

  const scaffoldResult = await toolExecutor.execute(
    { tool: 'scaffold_project', params: { template: 'vite-react-ts' } },
    scaffoldContext,
  )
  const scaffoldReady = scaffoldResult.success

  if (scaffoldReady) {
    broadcast(app, runId, 'fe', 'agent.delta', {
      message: '\n📦 Frontend scaffolded with Vite + React + TypeScript',
      agentName: 'Jordan',
      agentEmoji: '🎨',
    })
    broadcastCodeGen(app, runId, 'fe', 'codegen.project.scaffolded' as EventType, {
      projectType: 'frontend',
      template: 'vite-react-ts',
      projectDir: 'frontend',
    })
  } else {
    Logger.warn({ runId, error: scaffoldResult.error }, 'Frontend scaffold failed')
  }

  const frontendFileWrites = scaffoldReady ? PHASES.frontend.scaffoldedFiles : PHASES.frontend.fullBootstrapFiles

  await streamAgentResponse(
    app, runId, null, PHASES.frontend.role,
    PHASES.frontend.prompt(context, stackDecision, { scaffoldReady }),
    '',
    frontendFileWrites,
    { executeTools: true },
    discussion.messages
  )

  const feFiles = await fileSystem.getAllFiles(runId)
  broadcastCodeGen(app, runId, 'fe', 'codegen.project.ready' as EventType, {
    projectType: 'frontend',
    files: feFiles.filter(f => f.startsWith('frontend/')),
    entryPoint: 'frontend/src/main.tsx',
    devCommand: 'npm run dev',
    framework: 'vite-react-ts',
  })

  // ── Final Phase: PM Handoff ──────────────────────────────────────
  broadcast(app, runId, 'pm', 'agent.delta', {
    message: '\n[Final: PM - Handoff Summary]',
    phase: 'phase_handoff',
  })
  await streamAgentResponse(
    app, runId, null, PHASES.deploy.role,
    PHASES.deploy.prompt(context, stackDecision),
    '',
    undefined,
    { executeTools: false },
    discussion.messages
  )

  const stats = await fileSystem.getStats(runId)
  const fileList = await fileSystem.getAllFiles(runId)

  await runService.updateRun(runId, { status: 'completed' })
  broadcast(app, runId, 'pm', 'run.done', {
    message: `✅ Code generation complete! ${stats.totalFiles} files created.`,
    phase: 'completed',
    stats,
    fileList,
    downloadUrl: `/v1/autonomous/runs/${runId}/download`,
  })

  Logger.info({ runId, files: stats.totalFiles }, 'Code generation complete')
  activeDiscussions.delete(runId)
  clearAutonomousRunIdentities(runId)
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
            throw new AppException(409, ErrorCodes.BAD_REQUEST, 'Your session run is still executing. Please wait for completion.')
          }

          if (existingRun.status === 'awaiting_approval') {
            throw new AppException(409, ErrorCodes.BAD_REQUEST, 'Your session run is awaiting approval. Continue or cancel it before sending a new message.')
          }

          run = await runService.updateRun(existingRun.id, {
            inputText,
            status: 'planning',
          })
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
  getDiscussion: (runId: string) => activeDiscussions.get(runId),
  fileSystem,
}

export default AutonomousAgentService
