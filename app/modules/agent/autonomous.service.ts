/**
 * Multi-Round Autonomous Discussion + Code Generation
 *
 * PM orchestrates a real conversation with multiple rounds, then agents write actual code files.
 */

import { FastifyInstance } from 'fastify'
import { OpenClawGatewayClient } from '#app/modules/agent/openclaw.gateway'
import { fileSystem } from '#app/modules/agent/file-system.service'
import runService from '#app/modules/run/run.service'
import Logger from '#app/utils/logger'
import {
  AgentRole,
  StartRunBody,
  StreamEvent,
} from '#app/modules/agent/agent.interface'
import {
  AgentRun,
  EventType,
  Run,
} from '#app/modules/run/run.interface'

const ROLE_AGENT_MAP: Record<AgentRole, string> = {
  pm: 'pm-agent',
  // eslint-disable-next-line camelcase
  be_sc: 'be-sc-agent',
  fe: 'fe-agent',
  // eslint-disable-next-line camelcase
  bd_research: 'bd-research-agent',
}

// Agent briefs
const AGENT_BRIEFS: Record<AgentRole, {
  name: string
  emoji: string
  role: string
  systemPrompt: string
}> = {
  pm: {
    name: 'PM',
    emoji: '📋',
    role: 'Product Lead',
    systemPrompt: `You are PM, the Product Lead of ClawCartel AI Agency.

PERSONALITY: Direct, decisive, slightly impatient but fair. Hates wasted time.
SPEAKING STYLE: Short punchy sentences. Gets to the point.
QUIRK: Always watching the clock. Says "Let's wrap this up" frequently.

Your job: Lead squad discussions and coordinate code generation.`,
  },
  // eslint-disable-next-line camelcase
  bd_research: {
    name: 'Researcher',
    emoji: '🔬',
    role: 'BD + Researcher',
    systemPrompt: `You are the Researcher at ClawCartel.

PERSONALITY: Data-driven, curious, skeptical.
SPEAKING STYLE: References numbers and real competitors.
QUIRK: "Actually, the data shows..."

During development: Write market research docs and project documentation.`,
  },
  fe: {
    name: 'FE',
    emoji: '🎨',
    role: 'Frontend Dev',
    systemPrompt: `You are FE, the Frontend Developer at ClawCartel.

PERSONALITY: Creative, visual thinker, enthusiastic.
SPEAKING STYLE: Visual descriptions, component thinking.
QUIRK: Sees everything as React components.

During development: Write actual React/Vue components, CSS, and frontend code.
Always provide complete, working code with proper imports and exports.`,
  },
  // eslint-disable-next-line camelcase
  be_sc: {
    name: 'BE_SC',
    emoji: '⚙️',
    role: 'Backend + Smart Contract Dev',
    systemPrompt: `You are BE_SC, the Backend + Smart Contract Developer.

PERSONALITY: Technical, precise, security-obsessed.
SPEAKING STYLE: Technical but concise.
QUIRK: "What if it fails?" Gas cost obsession.

During development: Write API routes, database models, and smart contracts.
Always provide complete, working code with proper error handling.`,
  },
}

// Track active discussions
const activeDiscussions = new Map<string, {
  round: number
  messages: Array<{ role: AgentRole; name: string; content: string }>
  isComplete: boolean
  waitingForUser: boolean
  projectName: string
}>()

// Delay helper
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * Broadcast event to frontend
 */
function broadcast(
  app: FastifyInstance,
  runId: string,
  role: AgentRole,
  eventType: EventType,
  payload: Record<string, unknown>
): void {
  const brief = AGENT_BRIEFS[role]

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

/**
 * Build conversation context from messages
 */
function buildContext(messages: Array<{ role: AgentRole; name: string; content: string }>): string {
  return messages.map(m => `${m.name}: ${m.content}`).join('\n\n')
}

/**
 * Stream agent response with file writing capability
 */
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
  const brief = AGENT_BRIEFS[role]

  // Simulate "thinking" delay
  await delay(1000 + Math.random() * 2000)

  let fileInstructions = ''
  if (fileWrites && fileWrites.length > 0) {
    fileInstructions = `\n\n=== FILE GENERATION TASK ===\nYou MUST write the following files:\n${fileWrites.map(f => `- ${f.path}: ${f.description}`).join('\n')}\n\nFor each file, output in this format:\n===FILE:filepath===\n<file content here>\n===ENDFILE===\n\nProvide complete, production-ready code.`
  }

  const fullPrompt = `${brief.systemPrompt}

=== CONVERSATION CONTEXT ===
${context}

=== YOUR TURN ===
${prompt}${fileInstructions}

Respond as ${brief.name} in your natural voice.`

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

  // Extract and write files if specified
  if (fileWrites && fileWrites.length > 0) {
    await extractAndWriteFiles(app, runId, fullText, brief.name)
  }

  await delay(500)

  return fullText
}

/**
 * Extract file blocks from agent response and write to disk
 */
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

      // Broadcast file creation event
      broadcast(app, runId, 'pm', 'agent.delta', {
        message: `📁 Created: ${filePath}`,
        phase: 'file_created',
        fileEvent: event,
        agentName,
      })

      Logger.info({ runId, filePath, agent: agentName }, 'File created')
    } catch (error) {
      Logger.error({ runId, filePath, error }, 'Failed to write file')
    }
  }
}

/**
 * Multi-round autonomous discussion
 */
async function processMultiRoundDiscussion(
  app: FastifyInstance,
  run: Run,
  inputText: string
): Promise<void> {
  const runId = run.id
  const projectName = inputText.slice(0, 50).replace(/[^a-zA-Z0-9]/g, '_')

  Logger.info({ runId, projectName }, 'Starting MULTI-ROUND autonomous discussion')

  // Initialize discussion
  const discussion = {
    round: 1,
    messages: [] as Array<{ role: AgentRole; name: string; content: string }>,
    isComplete: false,
    waitingForUser: false,
    projectName,
  }
  activeDiscussions.set(runId, discussion)

  await runService.updateRun(run.id, { status: 'executing' })

  // ROUND 1: Initial thoughts
  Logger.info({ runId, round: 1 }, 'ROUND 1: Initial thoughts')
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

  for (const role of ['bd_research', 'fe', 'be_sc'] as AgentRole[]) {
    const brief = AGENT_BRIEFS[role]
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

  for (const role of ['bd_research', 'fe', 'be_sc'] as AgentRole[]) {
    const brief = AGENT_BRIEFS[role]
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

  for (const role of ['bd_research', 'fe', 'be_sc'] as AgentRole[]) {
    const brief = AGENT_BRIEFS[role]
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

  // Mark complete
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

  Logger.info({ runId, messageCount: discussion.messages.length }, 'Discussion complete, waiting for user')
}

/**
 * Continue to development - CODE GENERATION PHASE
 */
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

  // Start CODE GENERATION
  Logger.info({ runId }, '=== STARTING CODE GENERATION ===')
  discussion.waitingForUser = false
  await runService.updateRun(runId, { status: 'executing' })

  // Initialize project structure
  broadcast(app, runId, 'pm', 'agent.started', {
    message: '🚀 Initializing project workspace...',
    phase: 'code_generation',
  })

  await fileSystem.initProject(runId, discussion.projectName)

  // PHASE 1: Researcher - Project Documentation
  broadcast(app, runId, 'pm', 'agent.delta', {
    message: '\n[Phase 1/4: Researcher - Project Documentation]',
    phase: 'phase_1_docs',
  })

  const researchFiles = [
    { path: 'research/market-analysis.md', description: 'Market analysis with size, trends, competitors' },
    { path: 'research/competitor-report.md', description: 'Top 5 competitors analysis' },
    { path: 'docs/project-requirements.md', description: 'Project requirements based on discussion' },
  ]

  await streamAgentResponse(
    app, runId, null, 'bd_research',
    `Create project documentation based on our discussion:\n\n${buildContext(discussion.messages)}`,
    '',
    researchFiles
  )

  // PHASE 2: BE_SC - Backend & Smart Contracts
  broadcast(app, runId, 'pm', 'agent.delta', {
    message: '\n[Phase 2/4: BE_SC - Backend Architecture]',
    phase: 'phase_2_backend',
  })

  const backendFiles = [
    { path: 'backend/package.json', description: 'Node.js dependencies (express, prisma, etc)' },
    { path: 'backend/src/api/routes.ts', description: 'Main API routes' },
    { path: 'backend/src/models/schema.prisma', description: 'Database schema' },
    { path: 'backend/src/contracts/main.sol', description: 'Solidity smart contract (if needed)' },
    { path: 'backend/README.md', description: 'Backend setup instructions' },
  ]

  await streamAgentResponse(
    app, runId, null, 'be_sc',
    `Create the complete backend based on project requirements.\n\nContext:\n${buildContext(discussion.messages)}`,
    '',
    backendFiles
  )

  // PHASE 3: FE - Frontend Application
  broadcast(app, runId, 'pm', 'agent.delta', {
    message: '\n[Phase 3/4: FE - Frontend Application]',
    phase: 'phase_3_frontend',
  })

  const frontendFiles = [
    { path: 'frontend/package.json', description: 'React/Vue dependencies' },
    { path: 'frontend/src/App.tsx', description: 'Main App component' },
    { path: 'frontend/src/components/Layout.tsx', description: 'Layout component with navigation' },
    { path: 'frontend/src/pages/Home.tsx', description: 'Home page component' },
    { path: 'frontend/src/hooks/useApi.ts', description: 'API hook for backend calls' },
    { path: 'frontend/src/index.css', description: 'Global styles' },
    { path: 'frontend/README.md', description: 'Frontend setup instructions' },
  ]

  await streamAgentResponse(
    app, runId, null, 'fe',
    `Create the complete frontend application. Use modern React with TypeScript.\n\nContext:\n${buildContext(discussion.messages)}`,
    '',
    frontendFiles
  )

  // PHASE 4: PM - Deployment & Integration
  broadcast(app, runId, 'pm', 'agent.delta', {
    message: '\n[Phase 4/4: PM - Deployment Configuration]',
    phase: 'phase_4_deploy',
  })

  const deployFiles = [
    { path: 'deployment/docker-compose.yml', description: 'Docker compose for full stack' },
    { path: 'deployment/deploy.sh', description: 'Deployment script' },
    { path: 'docs/ARCHITECTURE.md', description: 'System architecture diagram and docs' },
    { path: 'docs/GETTING_STARTED.md', description: 'How to run the project locally' },
  ]

  await streamAgentResponse(
    app, runId, null, 'pm',
    'Create deployment configuration and final documentation.',
    '',
    deployFiles
  )

  // Get final stats
  const stats = await fileSystem.getStats(runId)
  const fileList = await fileSystem.getAllFiles(runId)

  // Complete
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

/**
 * Autonomous Agent Service
 */
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

    // Start multi-round discussion
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

export { fileSystem }

export default AutonomousAgentService
