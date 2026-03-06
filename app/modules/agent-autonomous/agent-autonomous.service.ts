import { FastifyInstance } from 'fastify'
import runService from '#app/modules/run/run.service'
import Logger from '#app/utils/logger'
import {
  AgentRole,
  StartRunBody,
  StreamEvent,
} from '#app/modules/agent-core/agent-core.interface'
import {
  ROLE_AGENT_MAP,
  AUTONOMOUS_AGENT_BRIEFS,
} from '#app/modules/agent-core/agent-core.config'
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
}

const activeDiscussions = new Map<string, Discussion>()
const siwsSessionRuns = new Map<number, string>()

function broadcast(
  app: FastifyInstance,
  runId: string,
  role: AgentRole,
  eventType: EventType,
  payload: Record<string, unknown>
): void {
  const brief = AUTONOMOUS_AGENT_BRIEFS[role]

  const streamEvent: StreamEvent = {
    runId,
    agentRunId: 'autonomous',
    role,
    seq: Date.now(),
    eventType,
    payload: {
      ...payload,
      agentName: brief.name,
      agentEmoji: brief.emoji,
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

function broadcastCodeGen(
  app: FastifyInstance,
  runId: string,
  role: AgentRole,
  eventType: EventType,
  payload: Record<string, unknown>
): void {
  const brief = AUTONOMOUS_AGENT_BRIEFS[role]

  const streamEvent = {
    runId,
    agentRunId: 'autonomous',
    role,
    seq: Date.now(),
    eventType,
    payload: {
      ...payload,
      agentName: brief.name,
      agentEmoji: brief.emoji,
      timestamp: new Date().toISOString(),
    },
  }

  app.io.to(`run:${runId}`).emit('codegen_event', streamEvent)
}

// Broadcast a DM (private message) between agents
function broadcastDM(
  app: FastifyInstance,
  runId: string,
  fromRole: AgentRole,
  toRole: AgentRole,
  content: string
): void {
  const fromBrief = AUTONOMOUS_AGENT_BRIEFS[fromRole]
  const toBrief = AUTONOMOUS_AGENT_BRIEFS[toRole]

  const dmEvent = {
    runId,
    agentRunId: 'autonomous',
    role: fromRole,
    seq: Date.now(),
    eventType: 'agent.dm' as EventType,
    isDM: true,
    dmTarget: toRole,
    payload: {
      from: fromRole,
      fromName: fromBrief.name,
      fromEmoji: fromBrief.emoji,
      to: toRole,
      toName: toBrief.name,
      content,
      timestamp: new Date().toISOString(),
    },
  }

  app.io.to(`run:${runId}`).emit('agent_event', dmEvent)
  Logger.info({ runId, from: fromRole, to: toRole }, 'DM sent between agents')
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
    AUTONOMOUS_AGENT_BRIEFS[role].name
  )

  // Keep non-code status updates on the regular agent channel.
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

  // Carry incomplete markers across stream chunks.
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
        // Incomplete header, keep it buffered for the next chunk.
        break
      }

      const filePath = startMatch[1].trim()
      state = {
        isGenerating: true,
        filePath,
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
      // Emit only safe part; keep tail in case end marker arrives split across chunks.
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

  // Count new lines in this chunk
  const newLines = (content.match(/\n/g) || []).length
  state.lineCount += newLines

  // Broadcast chunk
  await broadcastCodeGen(app, runId, role, 'codegen.delta', {
    filePath: state.filePath,
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
  options?: { silent?: boolean }
): Promise<string> {
  void agentRun
  const gateway = new OpenClawGatewayClient()
  const brief = AUTONOMOUS_AGENT_BRIEFS[role]
  const canGenerateCode = role === 'fe' || role === 'be_sc'
  const isCodeGenTask = canGenerateCode && Boolean(fileWrites && fileWrites.length > 0)
  const isSilent = options?.silent === true

  await delay(1000 + Math.random() * 2000)

  let fileInstructions = ''
  if (isCodeGenTask && fileWrites && fileWrites.length > 0) {
    fileInstructions = `\n\n=== FILE GENERATION TASK ===\nYou MUST write the following files:\n${fileWrites.map(f => `- ${f.path}: ${f.description}`).join('\n')}\n\nFor each file, use the CODE GENERATION FORMAT specified in your system prompt:\n===CODEGEN_START===\nfile: [filepath]\nlanguage: [lang]\n===\n[code content]\n===CODEGEN_END===\n\nProvide complete, production-ready code.`
  }

  const fullPrompt = `${brief.systemPrompt}\n\n=== CONVERSATION CONTEXT ===\n${context}\n\n=== YOUR TURN ===\n${prompt}${fileInstructions}\n\nRespond as ${brief.name} in your natural voice.`

  Logger.info({ runId, agent: brief.name }, 'Agent responding')

  if (!isSilent) {
    broadcast(app, runId, role, 'agent.started', {
      message: `${brief.name} is typing...`,
      agentName: brief.name,
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

  // During build phases, only FE and BE_SC can stream code on `codegen_event`.

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
              agentName: brief.name,
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
    ? (visibleText.trim() || `${brief.name} finished code generation.`)
    : visibleText

  if (!isSilent) {
    broadcast(app, runId, role, 'agent.done', {
      message: doneMessage,
      isCodeGeneration: isCodeGenTask,
      agentName: brief.name,
      agentEmoji: brief.emoji,
    })
  }

  if (isCodeGenTask && fullText.includes('===FILE:')) {
    await extractAndWriteFiles(app, runId, fullText, brief.name)
  }

  await delay(500)

  return fullText
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
  }
  activeDiscussions.set(runId, discussion)

  await runService.updateRun(run.id, { status: 'executing' })

  // Intent analysis - silent classification, no visible response
  const intentAnalysis = await streamAgentResponse(
    app, runId, null, 'pm',
    `INTERNAL CLASSIFICATION - Classify this user message:\n"${inputText}"\n\nIs this:\nA) BUILD INTENT - user wants to build/create/make something\nB) CASUAL CHAT - user is asking a question or chatting\n\nRespond ONLY with:\n"[BUILD]" or "[CHAT]" - nothing else.`,
    `User input: ${inputText}`,
    undefined,
    { silent: true }
  )

  // Check if casual chat
  if (intentAnalysis.includes('[CHAT]') ||
      (!intentAnalysis.includes('[BUILD]') &&
       (inputText.toLowerCase().includes('what is') ||
        inputText.toLowerCase().includes('how are') ||
        inputText.toLowerCase().includes('explain') ||
        inputText.toLowerCase().includes('?')))) {
    Logger.info({ runId }, 'PM classified as casual chat - skipping squad')
    // For chat, get a proper response from PM
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

    return
  }

  // ROUND 1: Discovery & Scoping
  // Order: PM → Researcher → (FE + BE_SC in parallel)
  broadcast(app, runId, 'pm', 'agent.started', {
    message: '🏢 Starting Project Discovery',
    phase: 'round_1',
  })

  // Step 1: PM kickoff
  const pmOpening = await streamAgentResponse(
    app, runId, null, 'pm',
    `New project just came in: "${inputText}"

Kick this off naturally. Like:
"Alright team, new project - [summarize what user wants]. Riley, can you dig into this and let us know what we're looking at? Jordan and Sam, stand by for when we figure out the approach."

Keep it casual. Don't assume tech stack.`,
    `New project: ${inputText}`
  )
  discussion.messages.push({ role: 'pm', name: 'PM', content: pmOpening })

  // Step 2: Researcher responds
  const researcherResponse = await streamAgentResponse(
    app, runId, null, 'bd_research',
    'Looking into this project. Share what you found - competitors, tech options, scope. Tag Jordan and Sam with anything they need to know. Keep it conversational like you\'re updating the team in Slack.',
    buildContext(discussion.messages)
  )
  discussion.messages.push({ role: 'bd_research', name: 'Researcher', content: researcherResponse })

  // Step 3: FE and BE_SC run IN PARALLEL
  broadcast(app, runId, 'pm', 'agent.delta', {
    message: '⚡ FE + BE_SC analyzing in parallel (design + architecture)',
    phase: 'round_1_parallel'
  })

  // Jordan and Sam respond naturally
  const results = await Promise.allSettled([
    streamAgentResponse(
      app, runId, null, 'fe',
      'Jordan - what\'s your take on the UI/UX for this? Walk us through your thinking. Tag Sam if you need API details. Keep it conversational.',
      buildContext(discussion.messages)
    ),
    streamAgentResponse(
      app, runId, null, 'be_sc',
      'Sam - what\'s your thinking on backend/architecture? Walk us through your approach. Tag Jordan if you need to know frontend requirements. Keep it conversational.',
      buildContext(discussion.messages)
    ),
  ])

  // Process results
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

  // ROUND 2: Technical Design Review
  // PM facilitates technical alignment between FE and BE_SC
  discussion.round = 2
  broadcast(app, runId, 'pm', 'agent.delta', { message: '🔧 Technical Design Review', phase: 'round_2' })

  const pmR2 = await streamAgentResponse(
    app, runId, null, 'pm',
    'Alright, let\'s nail down the technical approach. Jordan - thoughts on the UI complexity? Sam - any concerns on the backend? Figure it out together.',
    buildContext(discussion.messages)
  )
  discussion.messages.push({ role: 'pm', name: 'PM', content: pmR2 })

  // Jordan and Sam respond with technical details
  const results2 = await Promise.allSettled([
    streamAgentResponse(
      app, runId, null, 'fe',
      'Jordan - dive deeper. What components are you building? Any concerns about the approach? Chat with Sam about API needs.',
      buildContext(discussion.messages)
    ),
    streamAgentResponse(
      app, runId, null, 'be_sc',
      'Sam - dive deeper. What\'s the backend looking like? Database, APIs? Chat with Jordan about what he needs.',
      buildContext(discussion.messages)
    ),
  ])

  if (results2[0].status === 'fulfilled') {
    discussion.messages.push({ role: 'fe', name: 'FE', content: results2[0].value })
  } else {
    Logger.error({ runId, error: results2[0].reason }, 'FE round 2 failed')
    discussion.messages.push({ role: 'fe', name: 'FE', content: '[FE technical analysis]' })
  }

  if (results2[1].status === 'fulfilled') {
    discussion.messages.push({ role: 'be_sc', name: 'BE_SC', content: results2[1].value })
  } else {
    Logger.error({ runId, error: results2[1].reason }, 'BE_SC round 2 failed')
    discussion.messages.push({ role: 'be_sc', name: 'BE_SC', content: '[BE_SC technical analysis]' })
  }

  // ROUND 3: Final MVP Scope Lock
  discussion.round = 3
  broadcast(app, runId, 'pm', 'agent.delta', { message: '🎯 Final MVP Scope Lock', phase: 'round_3' })

  const pmR3 = await streamAgentResponse(
    app, runId, null, 'pm',
    'Let\'s lock in what we\'re actually building. Jordan, Sam - what are your final commitments? What\'s definitely in for MVP, and what\'s getting cut?',
    buildContext(discussion.messages)
  )
  discussion.messages.push({ role: 'pm', name: 'PM', content: pmR3 })

  // Jordan and Sam give final commitments
  const results3 = await Promise.allSettled([
    streamAgentResponse(
      app, runId, null, 'fe',
      'Jordan - final check. What are you committing to for this MVP? What\'s in scope and what\'s pushed to v2? Be realistic.',
      buildContext(discussion.messages)
    ),
    streamAgentResponse(
      app, runId, null, 'be_sc',
      'Sam - final check. What are you committing to for this MVP? What\'s in scope and what\'s pushed to v2? Be realistic.',
      buildContext(discussion.messages)
    ),
  ])

  if (results3[0].status === 'fulfilled') {
    discussion.messages.push({ role: 'fe', name: 'FE', content: results3[0].value })
  } else {
    Logger.error({ runId, error: results3[0].reason }, 'FE round 3 failed')
    discussion.messages.push({ role: 'fe', name: 'FE', content: '[FE final commitment]' })
  }

  if (results3[1].status === 'fulfilled') {
    discussion.messages.push({ role: 'be_sc', name: 'BE_SC', content: results3[1].value })
  } else {
    Logger.error({ runId, error: results3[1].reason }, 'BE_SC round 3 failed')
    discussion.messages.push({ role: 'be_sc', name: 'BE_SC', content: '[BE_SC final commitment]' })
  }

  // PM Final MVP Decision
  const pmFinal = await streamAgentResponse(
    app, runId, null, 'pm',
    `Alright team, let's lock this in.

Summarize what we agreed on:
- What are we building (one sentence)
- Who's doing what (Riley, Jordan, Sam)
- What's in for MVP vs pushed to v2
- Timeline

Keep it casual but clear. Like a summary you'd send to the client.`,
    buildContext(discussion.messages)
  )
  discussion.messages.push({ role: 'pm', name: 'PM', content: pmFinal })

  discussion.isComplete = true
  discussion.waitingForUser = true

  await runService.updateRun(run.id, { status: 'awaiting_approval' })
  broadcast(app, runId, 'pm', 'run.done', {
    message: 'Discussion complete - Ready to build',
    phase: 'awaiting_approval',
    discussionSummary: discussion.messages,
    pmFinalDecision: pmFinal,
    projectName: discussion.projectName,
  })

  Logger.info({ runId, messageCount: discussion.messages.length }, 'Discussion complete')
}

// Code Generation Phases
const PHASES = {
  research: {
    role: 'bd_research' as AgentRole,
    prompt: (ctx: string) => `Riley, give a concise implementation brief for Jordan and Sam.

Include:
- MVP scope and assumptions
- Risks and constraints
- What FE and BE_SC must prioritize first

Do NOT generate code and do NOT output file blocks.

Context:
${ctx}`,
  },
  backend: {
    role: 'be_sc' as AgentRole,
    files: [
      // Anchor program files (Solana smart contract)
      { path: 'anchor/Cargo.toml', description: 'Rust workspace configuration' },
      { path: 'anchor/Anchor.toml', description: 'Anchor configuration' },
      { path: 'anchor/programs/my_program/Cargo.toml', description: 'Program dependencies' },
      { path: 'anchor/programs/my_program/src/lib.rs', description: 'Main Solana program (Anchor)' },
      { path: 'anchor/programs/my_program/src/instructions/mod.rs', description: 'Instruction modules' },
      { path: 'anchor/programs/my_program/src/state/mod.rs', description: 'Account state definitions' },
      { path: 'anchor/programs/my_program/src/errors.rs', description: 'Custom error codes' },
      { path: 'anchor/tests/my_program.ts', description: 'Anchor tests' },
      { path: 'anchor/migrations/deploy.ts', description: 'Deployment script' },
      { path: 'anchor/README.md', description: 'Program documentation' },
      // Optional: Backend API if needed for off-chain data
      { path: 'backend/package.json', description: 'Optional: API server deps' },
      { path: 'backend/src/index.ts', description: 'Optional: Hono API server' },
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
- If we said API → Node.js/Hono + database
- If we said smart contract → Anchor/Rust (only if discussed)
- Package.json, configs, etc.

Working code, not stubs. Match what we scoped.

Context from our discussion:
${ctx}`,
  },
  frontend: {
    role: 'fe' as AgentRole,
    files: [
      { path: 'frontend/src/App.tsx', description: 'Main App component' },
      { path: 'frontend/src/components/Layout/Layout.tsx', description: 'Layout component' },
      { path: 'frontend/src/pages/Home.tsx', description: 'Home page' },
      { path: 'frontend/src/hooks/useApi.ts', description: 'API hooks' },
      { path: 'frontend/src/index.css', description: 'Tailwind styles' },
      { path: 'frontend/.env.example', description: 'Environment variables' },
      { path: 'frontend/README.md', description: 'Setup instructions' },
    ],
    prompt: (ctx: string) => `Alright Jordan, time to code. 

Write the React frontend based on what we discussed. Multiple files, complete implementation.

Use this format for each file:

===CODEGEN_START===
file: frontend/src/App.tsx
language: typescript
===
// Your actual code here
===CODEGEN_END===

Generate:
- package.json with dependencies
- Main App component
- Any components we agreed on
- Hooks for data/API
- Styles

Match what we scoped in the discussion. Working code, not stubs.

Context from our discussion:
${ctx}`,
  },
  deploy: {
    role: 'pm' as AgentRole,
    prompt: (ctx: string) => `Alex (PM) - close this run with a final handoff summary.

Include:
- What FE completed
- What BE_SC completed
- Any follow-up tasks and risks

Do NOT generate code and do NOT output file blocks.

Context:
${ctx}`,
  },
}

export async function continueToDevelopment(
  app: FastifyInstance,
  runId: string,
  approved: boolean
): Promise<void> {
  const discussion = activeDiscussions.get(runId)
  if (!discussion) {
    throw new Error('Discussion not found')
  }

  if (!approved) {
    broadcast(app, runId, 'pm', 'run.done', {
      message: 'User rejected the plan.',
      phase: 'rejected',
    })
    await runService.updateRun(runId, { status: 'cancelled' })
    activeDiscussions.delete(runId)

    return
  }

  Logger.info({ runId }, '=== STARTING CODE GENERATION ===')
  discussion.waitingForUser = false
  await runService.updateRun(runId, { status: 'executing' })

  broadcast(app, runId, 'pm', 'agent.started', {
    message: '🚀 Initializing project workspace...',
    phase: 'code_generation',
  })

  await fileSystem.initProject(runId, discussion.projectName)

  const context = buildContext(discussion.messages)

  // Phase 1: Research brief (no code generation)
  broadcast(app, runId, 'pm', 'agent.delta', {
    message: '\n[Phase 1/3: Researcher - Build Brief]',
    phase: 'phase_1_brief',
  })
  await streamAgentResponse(
    app, runId, null, PHASES.research.role,
    PHASES.research.prompt(context),
    ''
  )

  // Phase 2: Backend + Frontend code generation (parallel)
  broadcast(app, runId, 'pm', 'agent.delta', {
    message: '\n[Phase 2/3: FE + BE_SC - Code Generation (Parallel)]',
    phase: 'phase_2_codegen_parallel',
  })

  await Promise.all([
    // Backend runs in parallel
    streamAgentResponse(
      app, runId, null, PHASES.backend.role,
      PHASES.backend.prompt(context),
      '',
      PHASES.backend.files
    ),
    // Frontend runs in parallel
    streamAgentResponse(
      app, runId, null, PHASES.frontend.role,
      PHASES.frontend.prompt(context),
      '',
      PHASES.frontend.files
    ),
  ])

  // Phase 3: PM final handoff (no code generation)
  broadcast(app, runId, 'pm', 'agent.delta', {
    message: '\n[Phase 3/3: PM - Final Handoff]',
    phase: 'phase_3_handoff',
  })
  await streamAgentResponse(
    app, runId, null, PHASES.deploy.role,
    PHASES.deploy.prompt(context),
    ''
  )

  // Complete
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
            throw new AppException(
              409,
              ErrorCodes.BAD_REQUEST,
              'Your session run is still executing. Please wait for completion.'
            )
          }

          if (existingRun.status === 'awaiting_approval') {
            throw new AppException(
              409,
              ErrorCodes.BAD_REQUEST,
              'Your session run is awaiting approval. Continue or cancel it before sending a new message.'
            )
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

  // Check Gateway
  try {
    const gateway = new OpenClawGatewayClient()
    const health = await gateway.healthCheck()
    if (!health.ok) {
      throw new Error(`Gateway unreachable: ${health.error}`)
    }
  } catch (error) {
    await runService.updateRun(run.id, { status: 'failed' })
    const message = error instanceof Error ? error.message : 'Gateway check failed'
    throw new Error(`OpenClaw gateway unreachable: ${message}`)
  }

  // Start discussion
  void processMultiRoundDiscussion(app, run, inputText)
    .catch(async (error) => {
      Logger.error({ err: error, runId: run.id }, 'Multi-round discussion failed')
      await runService.updateRun(run.id, { status: 'failed' })
    })

  const latestRun = await runService.getRun(run.id)

  return latestRun ?? run
}

const AutonomousAgentService = {
  startRun: (app: FastifyInstance, body: StartRunBody, userId?: number): Promise<Run> =>
    startRunInternal(app, body, userId),
  startNewThread: (app: FastifyInstance, body: StartRunBody, userId?: number): Promise<Run> =>
    startRunInternal(app, body, userId, { forceNewThread: true }),

  continueToDevelopment,
  getDiscussion: (runId: string) => activeDiscussions.get(runId),
  fileSystem,
}

export default AutonomousAgentService
