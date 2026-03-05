/**
 * Autonomous Agent Service
 * Multi-round discussion + Code generation
 */

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
  SQUAD_ROLES,
  AUTONOMOUS_AGENT_BRIEFS,
} from '#app/modules/agent-core/agent-core.config'
import { OpenClawGatewayClient } from '#app/modules/agent-core/agent-core.gateway'
import { fileSystem } from '#app/modules/agent-core/agent-core.files'
import { AgentRun, EventType, Run } from '#app/modules/run/run.interface'

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

interface Discussion {
  round: number
  messages: Array<{ role: AgentRole; name: string; content: string }>
  isComplete: boolean
  waitingForUser: boolean
  projectName: string
}

const activeDiscussions = new Map<string, Discussion>()

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
  fileWrites?: Array<{ path: string; description: string }>
): Promise<string> {
  const gateway = new OpenClawGatewayClient()
  const brief = AUTONOMOUS_AGENT_BRIEFS[role]

  await delay(1000 + Math.random() * 2000)

  let fileInstructions = ''
  if (fileWrites && fileWrites.length > 0) {
    fileInstructions = `\n\n=== FILE GENERATION TASK ===\nYou MUST write the following files:\n${fileWrites.map(f => `- ${f.path}: ${f.description}`).join('\n')}\n\nFor each file, output in this format:\n===FILE:filepath===\n<file content here>\n===ENDFILE===\n\nProvide complete, production-ready code.`
  }

  const fullPrompt = `${brief.systemPrompt}\n\n=== CONVERSATION CONTEXT ===\n${context}\n\n=== YOUR TURN ===\n${prompt}${fileInstructions}\n\nRespond as ${brief.name} in your natural voice.`

  Logger.info({ runId, agent: brief.name }, 'Agent responding')

  broadcast(app, runId, role, 'agent.started', {
    message: `${brief.name} is typing...`,
    agentName: brief.name,
    agentEmoji: brief.emoji,
  })

  const stream = gateway.streamAgentResponse(
    ROLE_AGENT_MAP[role],
    fullPrompt,
    `${runId}:${role}:${Date.now()}`
  )

  let fullText = ''

  for await (const chunk of stream) {
    if (chunk.done) break
    if (chunk.content) {
      fullText += chunk.content
      broadcast(app, runId, role, 'agent.delta', {
        message: chunk.content,
        accumulated: fullText,
        agentName: brief.name,
        agentEmoji: brief.emoji,
      })
    }
  }

  broadcast(app, runId, role, 'agent.done', {
    message: fullText,
    agentName: brief.name,
    agentEmoji: brief.emoji,
  })

  if (fileWrites && fileWrites.length > 0) {
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

  // Intent analysis
  const intentAnalysis = await streamAgentResponse(
    app, runId, null, 'pm',
    `Analyze this user message INTENT:\n"${inputText}"\n\nIs this:\nA) BUILD INTENT - user wants to build a project (proceed with squad)\nB) CASUAL CHAT - user is asking a question or chatting (respond directly)\n\nIf A: Say "[BUILD]" then introduce the project.\nIf B: Say "[CHAT]" then answer directly without involving the squad.`,
    `User input: ${inputText}`
  )

  // Check if casual chat
  if (intentAnalysis.includes('[CHAT]') ||
      (!intentAnalysis.includes('[BUILD]') &&
       (inputText.toLowerCase().includes('what is') ||
        inputText.toLowerCase().includes('how are') ||
        inputText.toLowerCase().includes('explain') ||
        inputText.toLowerCase().includes('?')))) {
    Logger.info({ runId }, 'PM classified as casual chat - skipping squad')
    broadcast(app, runId, 'pm', 'run.done', {
      message: intentAnalysis.replace('[CHAT]', '').trim(),
      phase: 'chat_response',
      isChat: true,
    })
    await runService.updateRun(run.id, { status: 'completed' })
    activeDiscussions.delete(runId)

    return
  }

  // ROUND 1: Initial thoughts
  broadcast(app, runId, 'pm', 'agent.started', {
    message: 'Starting multi-round discussion',
    phase: 'round_1',
  })

  const pmOpening = await streamAgentResponse(
    app, runId, null, 'pm',
    `Kick off this discussion about: "${inputText}"\n\nIntroduce the project and ask Researcher for market perspective first.`,
    `New project: ${inputText}`
  )
  discussion.messages.push({ role: 'pm', name: 'PM', content: pmOpening })

  for (const role of SQUAD_ROLES) {
    const brief = AUTONOMOUS_AGENT_BRIEFS[role]
    const response = await streamAgentResponse(
      app, runId, null, role,
      'Share your initial thoughts on this project.',
      buildContext(discussion.messages)
    )
    discussion.messages.push({ role, name: brief.name, content: response })
  }

  // ROUND 2: Debate
  discussion.round = 2
  broadcast(app, runId, 'pm', 'agent.delta', { message: '\n[Round 2: Debate]', phase: 'round_2' })

  const pmR2 = await streamAgentResponse(
    app, runId, null, 'pm',
    'Challenge the team. Ask FE about timeline. Ask BE_SC to respond to Researcher\'s market concerns.',
    buildContext(discussion.messages)
  )
  discussion.messages.push({ role: 'pm', name: 'PM', content: pmR2 })

  for (const role of SQUAD_ROLES) {
    const brief = AUTONOMOUS_AGENT_BRIEFS[role]
    const response = await streamAgentResponse(
      app, runId, null, role,
      'Respond to the challenges. Defend your position or concede points.',
      buildContext(discussion.messages)
    )
    discussion.messages.push({ role, name: brief.name, content: response })
  }

  // ROUND 3: Final positions
  discussion.round = 3
  broadcast(app, runId, 'pm', 'agent.delta', { message: '\n[Round 3: Final Positions]', phase: 'round_3' })

  const pmR3 = await streamAgentResponse(
    app, runId, null, 'pm',
    'Ask each agent for their FINAL position and non-negotiables.',
    buildContext(discussion.messages)
  )
  discussion.messages.push({ role: 'pm', name: 'PM', content: pmR3 })

  for (const role of SQUAD_ROLES) {
    const brief = AUTONOMOUS_AGENT_BRIEFS[role]
    const response = await streamAgentResponse(
      app, runId, null, role,
      'Give your FINAL position. Bottom line?',
      buildContext(discussion.messages)
    )
    discussion.messages.push({ role, name: brief.name, content: response })
  }

  // PM Final Decision
  const pmFinal = await streamAgentResponse(
    app, runId, null, 'pm',
    'Synthesize the discussion. What did we agree on? Provide FINAL DECISION and ACTION ITEMS for each role.',
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
    files: [
      { path: 'research/market-analysis.md', description: 'Market analysis with size, trends, competitors' },
      { path: 'research/competitor-report.md', description: 'Top 5 competitors analysis' },
      { path: 'docs/project-requirements.md', description: 'Project requirements based on discussion' },
    ],
    prompt: (ctx: string) => `Create project documentation based on our discussion:\n\n${ctx}`,
  },
  backend: {
    role: 'be_sc' as AgentRole,
    files: [
      { path: 'backend/package.json', description: 'Hono + TypeScript + Prisma dependencies' },
      { path: 'backend/src/index.ts', description: 'Hono app entry point with middleware setup' },
      { path: 'backend/src/routes/index.ts', description: 'Route aggregator' },
      { path: 'backend/src/routes/api.ts', description: 'Main API routes with Hono' },
      { path: 'backend/src/middleware/auth.ts', description: 'JWT auth middleware' },
      { path: 'backend/src/middleware/error.ts', description: 'Global error handler' },
      { path: 'backend/src/lib/db.ts', description: 'Prisma client setup' },
      { path: 'backend/prisma/schema.prisma', description: 'Database schema' },
      { path: 'backend/src/types/index.ts', description: 'TypeScript types/interfaces' },
      { path: 'backend/.env.example', description: 'Environment variables template' },
      { path: 'backend/README.md', description: 'Setup instructions (Hono + Prisma)' },
    ],
    prompt: (ctx: string) => `Create a production-ready backend using HONO framework.

REQUIREMENTS:
- Use Hono (not Express) - it's lightweight and fast
- TypeScript with strict types
- Prisma ORM with PostgreSQL
- JWT authentication middleware
- Input validation on all routes
- Proper error handling middleware
- Health check endpoint

Think critically: 
- What happens if DB is down?
- Are we handling CORS properly?
- Is this endpoint idempotent?
- Did we prevent N+1 queries?

Context:\n${ctx}`,
  },
  frontend: {
    role: 'fe' as AgentRole,
    files: [
      { path: 'frontend/package.json', description: 'React 18 + TypeScript + Vite dependencies' },
      { path: 'frontend/vite.config.ts', description: 'Vite configuration with path aliases' },
      { path: 'frontend/tsconfig.json', description: 'TypeScript strict config' },
      { path: 'frontend/index.html', description: 'HTML entry point' },
      { path: 'frontend/src/main.tsx', description: 'React 18 entry with createRoot' },
      { path: 'frontend/src/App.tsx', description: 'Main App with routing' },
      { path: 'frontend/src/components/Layout/Layout.tsx', description: 'Layout with nav + error boundary' },
      { path: 'frontend/src/components/Layout/Layout.module.css', description: 'Layout scoped styles' },
      { path: 'frontend/src/components/UI/Loading.tsx', description: 'Reusable loading spinner' },
      { path: 'frontend/src/components/UI/ErrorFallback.tsx', description: 'Error boundary fallback' },
      { path: 'frontend/src/pages/Home/Home.tsx', description: 'Home page component' },
      { path: 'frontend/src/hooks/useApi.ts', description: 'Type-safe API hook with error handling' },
      { path: 'frontend/src/types/index.ts', description: 'Shared TypeScript interfaces' },
      { path: 'frontend/src/lib/utils.ts', description: 'Helper utilities' },
      { path: 'frontend/src/index.css', description: 'TailwindCSS imports + global styles' },
      { path: 'frontend/.env.example', description: 'Environment variables template' },
      { path: 'frontend/README.md', description: 'Setup instructions (Vite)' },
    ],
    prompt: (ctx: string) => `Create a production-ready frontend using REACT + VITE.

REQUIREMENTS:
- React 18 with TypeScript (strict mode)
- Vite as build tool (not CRA)
- TailwindCSS for styling
- Proper folder structure (components/, pages/, hooks/, types/)
- Error boundaries on routes
- Loading states for async operations
- Responsive mobile-first design

CRITICAL THINKING - Ask yourself:
- Did I handle the loading state?
- What if the API returns an error?
- Is this accessible (ARIA, keyboard nav)?
- Will this look good on mobile?
- Are props properly typed?
- Is the component too big? Should I split it?

Context:\n${ctx}`,
  },
  deploy: {
    role: 'pm' as AgentRole,
    files: [
      { path: 'deployment/docker-compose.yml', description: 'Docker compose for full stack' },
      { path: 'deployment/deploy.sh', description: 'Deployment script' },
      { path: 'docs/ARCHITECTURE.md', description: 'System architecture diagram and docs' },
      { path: 'docs/GETTING_STARTED.md', description: 'How to run the project locally' },
    ],
    prompt: () => 'Create deployment configuration and final documentation.',
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

  // Phase 1: Researcher
  broadcast(app, runId, 'pm', 'agent.delta', {
    message: '\n[Phase 1/4: Researcher - Project Documentation]',
    phase: 'phase_1_docs',
  })
  await streamAgentResponse(
    app, runId, null, PHASES.research.role,
    PHASES.research.prompt(context),
    '',
    PHASES.research.files
  )

  // Phase 2: Backend
  broadcast(app, runId, 'pm', 'agent.delta', {
    message: '\n[Phase 2/4: BE_SC - Backend Architecture]',
    phase: 'phase_2_backend',
  })
  await streamAgentResponse(
    app, runId, null, PHASES.backend.role,
    PHASES.backend.prompt(context),
    '',
    PHASES.backend.files
  )

  // Phase 3: Frontend
  broadcast(app, runId, 'pm', 'agent.delta', {
    message: '\n[Phase 3/4: FE - Frontend Application]',
    phase: 'phase_3_frontend',
  })
  await streamAgentResponse(
    app, runId, null, PHASES.frontend.role,
    PHASES.frontend.prompt(context),
    '',
    PHASES.frontend.files
  )

  // Phase 4: Deployment
  broadcast(app, runId, 'pm', 'agent.delta', {
    message: '\n[Phase 4/4: PM - Deployment Configuration]',
    phase: 'phase_4_deploy',
  })
  await streamAgentResponse(
    app, runId, null, PHASES.deploy.role,
    PHASES.deploy.prompt(),
    '',
    PHASES.deploy.files
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

const AutonomousAgentService = {
  startRun: async (app: FastifyInstance, body: StartRunBody): Promise<Run> => {
    const inputText = body.prdText?.trim() || body.idea?.trim() || ''
    if (!inputText) {
      throw new Error('idea or prdText is required')
    }

    const run = await runService.createRun({
      inputType: body.source ?? (body.prdText ? 'prd' : 'chat'),
      inputText,
      status: 'planning',
    })

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
  },

  continueToDevelopment,
  getDiscussion: (runId: string) => activeDiscussions.get(runId),
  fileSystem,
}

export default AutonomousAgentService
