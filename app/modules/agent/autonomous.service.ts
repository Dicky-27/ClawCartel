/**
 * Multi-Round Autonomous Discussion
 *
 * PM orchestrates a real conversation with multiple rounds:
 * - Round 1: All agents share initial thoughts
 * - Round 2: Agents respond to each other (debate/converge)
 * - Round 3: PM asks follow-up questions
 * - Final: PM synthesizes decision
 */

import { FastifyInstance } from 'fastify'
import { OpenClawGatewayClient } from '#app/modules/agent/openclaw.gateway'
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

const OPENCLAW_ENABLED = (process.env.OPENCLAW_AGENT_ENABLED ?? 'true') === 'true'

// Discussion config
const MAX_ROUNDS = 3
const MIN_ROUNDS = 2

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

Your job: Lead squad discussions. Don't just collect opinions - push for deeper analysis.

STRATEGY:
- Round 1: Ask each agent for initial thoughts
- Round 2: Challenge them to respond to EACH OTHER (not just you)
- Round 3: Ask follow-up questions on specific points
- Keep agents engaged in real discussion, not just reporting`,
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

When discussing:
- Question assumptions with data
- Respond to technical points from FE/BE
- Challenge market viability claims
- Suggest partnerships based on gaps you see

Don't just report - ENGAGE in the debate.`,
  },
  fe: {
    name: 'FE',
    emoji: '🎨',
    role: 'Frontend Dev',
    systemPrompt: `You are FE, the Frontend Developer at ClawCartel.

PERSONALITY: Creative, visual thinker, enthusiastic.
SPEAKING STYLE: Visual descriptions, component thinking.
QUIRK: Sees everything as React components.

When discussing:
- Push back on unrealistic timelines from PM
- Ask BE about API constraints before designing
- Question Researcher if user data contradicts your UX assumptions
- Defend design decisions with user experience arguments

Don't just describe - DEBATE with your squad.`,
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

When discussing:
- Challenge FE if UI demands are too complex
- Question Researcher's market assumptions with technical feasibility
- Push back on PM timelines if security needs more time
- Flag when other agents underestimate complexity

Don't just explain - ARGUE for technical correctness.`,
  },
}

// Track active discussions
const activeDiscussions = new Map<string, {
  round: number
  messages: Array<{ role: AgentRole; name: string; content: string }>
  isComplete: boolean
  waitingForUser: boolean
}>()

// Delay helper for realistic pacing
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * Stream agent response with realistic pacing
 */
async function streamAgentResponse(
  app: FastifyInstance,
  runId: string,
  agentRun: AgentRun | null,
  role: AgentRole,
  prompt: string,
  context: string
): Promise<string> {
  const gateway = new OpenClawGatewayClient()
  const brief = AGENT_BRIEFS[role]

  // Simulate "thinking" delay
  await delay(1000 + Math.random() * 2000)

  const fullPrompt = `${brief.systemPrompt}

=== CONVERSATION CONTEXT ===
${context}

=== YOUR TURN ===
${prompt}

Respond as ${brief.name} in your natural voice. Be substantive (3-5 sentences minimum). Engage with what others said.`

  Logger.info({ runId, agent: brief.name, round: activeDiscussions.get(runId)?.round }, 'Agent responding')

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

      // Stream with slight delay for typing effect
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

  // Pause after response for readability
  await delay(500)

  return fullText
}

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
 * Multi-round autonomous discussion
 */
async function processMultiRoundDiscussion(
  app: FastifyInstance,
  run: Run,
  inputText: string
): Promise<void> {
  const runId = run.id
  Logger.info({ runId }, 'Starting MULTI-ROUND autonomous discussion')

  // Initialize discussion
  const discussion = {
    round: 1,
    messages: [] as Array<{ role: AgentRole; name: string; content: string }>,
    isComplete: false,
    waitingForUser: false,
  }
  activeDiscussions.set(runId, discussion)

  await runService.updateRun(run.id, { status: 'executing' })

  // ROUND 1: Initial thoughts from all agents
  Logger.info({ runId, round: 1 }, 'ROUND 1: Initial thoughts')
  broadcast(app, runId, 'pm', 'agent.started', {
    message: 'Starting multi-round discussion',
    phase: 'round_1',
  })

  // PM kicks off
  const pmOpening = await streamAgentResponse(
    app, runId, null, 'pm',
    `Kick off this discussion about: "${inputText}"\n\nIntroduce the project and ask Researcher for market perspective first.`,
    `New project: ${inputText}`
  )
  discussion.messages.push({ role: 'pm', name: 'PM', content: pmOpening })

  // Researcher responds
  const researcherR1 = await streamAgentResponse(
    app, runId, null, 'bd_research',
    'Share your market analysis and competitor research.',
    buildContext(discussion.messages)
  )
  discussion.messages.push({ role: 'bd_research', name: 'Researcher', content: researcherR1 })

  // FE responds
  const feR1 = await streamAgentResponse(
    app, runId, null, 'fe',
    'Share your UI/UX approach and any concerns about the market data.',
    buildContext(discussion.messages)
  )
  discussion.messages.push({ role: 'fe', name: 'FE', content: feR1 })

  // BE_SC responds
  const beR1 = await streamAgentResponse(
    app, runId, null, 'be_sc',
    'Share your technical architecture thoughts and challenge any unrealistic assumptions.',
    buildContext(discussion.messages)
  )
  discussion.messages.push({ role: 'be_sc', name: 'BE_SC', content: beR1 })

  // ROUND 2: Agents respond to EACH OTHER (debate)
  discussion.round = 2
  Logger.info({ runId, round: 2 }, 'ROUND 2: Debate and convergence')
  broadcast(app, runId, 'pm', 'agent.delta', {
    message: '\n[Round 2: Debate and responses]',
    phase: 'round_2',
  })

  // PM challenges and asks follow-ups
  const pmR2 = await streamAgentResponse(
    app, runId, null, 'pm',
    'You heard from everyone. Now:\n1. Challenge FE on their timeline estimate\n2. Ask BE_SC to respond to Researcher\'s market concerns\n3. Push for specific commitments',
    buildContext(discussion.messages)
  )
  discussion.messages.push({ role: 'pm', name: 'PM', content: pmR2 })

  // Researcher responds to technical points
  const researcherR2 = await streamAgentResponse(
    app, runId, null, 'bd_research',
    'Respond to BE_SC\'s technical concerns. Do you agree with the market feasibility? Challenge FE if their UI seems too complex.',
    buildContext(discussion.messages)
  )
  discussion.messages.push({ role: 'bd_research', name: 'Researcher', content: researcherR2 })

  // FE defends and adjusts
  const feR2 = await streamAgentResponse(
    app, runId, null, 'fe',
    'Defend your design decisions or concede points. Respond to PM\'s timeline challenge. Ask BE about API constraints.',
    buildContext(discussion.messages)
  )
  discussion.messages.push({ role: 'fe', name: 'FE', content: feR2 })

  // BE_SC pushes back or agrees
  const beR2 = await streamAgentResponse(
    app, runId, null, 'be_sc',
    'Respond to FE\'s API questions. Agree or disagree with Researcher\'s feasibility. Push back on PM if timeline is unrealistic.',
    buildContext(discussion.messages)
  )
  discussion.messages.push({ role: 'be_sc', name: 'BE_SC', content: beR2 })

  // ROUND 3: Final positions and convergence
  discussion.round = 3
  Logger.info({ runId, round: 3 }, 'ROUND 3: Final positions')
  broadcast(app, runId, 'pm', 'agent.delta', {
    message: '\n[Round 3: Final positions]',
    phase: 'round_3',
  })

  // PM asks for final positions
  const pmR3 = await streamAgentResponse(
    app, runId, null, 'pm',
    'Time to wrap up. Ask each agent for their FINAL position and any non-negotiables.',
    buildContext(discussion.messages)
  )
  discussion.messages.push({ role: 'pm', name: 'PM', content: pmR3 })

  // Each agent gives final word
  for (const role of ['bd_research', 'fe', 'be_sc'] as AgentRole[]) {
    const brief = AGENT_BRIEFS[role]
    const finalResponse = await streamAgentResponse(
      app, runId, null, role,
      'Give your FINAL position. What\'s your bottom line? Any non-negotiables?',
      buildContext(discussion.messages)
    )
    discussion.messages.push({ role, name: brief.name, content: finalResponse })
  }

  // PM Final Decision
  Logger.info({ runId }, 'PM synthesizing final decision')
  broadcast(app, runId, 'pm', 'agent.delta', {
    message: '\n[Final Decision]',
    phase: 'final',
  })

  const pmFinal = await streamAgentResponse(
    app, runId, null, 'pm',
    'Synthesize the entire discussion. What did we agree on? What are the key decisions?\n\nEnd with "FINAL DECISION:" summary and "ACTION ITEMS:" for each role.',
    buildContext(discussion.messages)
  )
  discussion.messages.push({ role: 'pm', name: 'PM', content: pmFinal })

  // Mark discussion complete but waiting for user
  discussion.isComplete = true
  discussion.waitingForUser = true

  // Broadcast completion with action items
  await runService.updateRun(run.id, { status: 'awaiting_approval' })
  broadcast(app, runId, 'pm', 'run.done', {
    message: 'Discussion complete - Awaiting your approval to proceed',
    phase: 'awaiting_approval',
    discussionSummary: discussion.messages,
    pmFinalDecision: pmFinal,
    actionItems: 'Extracted from PM final response',
  })

  Logger.info({ runId, messageCount: discussion.messages.length }, 'Multi-round discussion complete, waiting for user')
}

/**
 * Continue to development phase after user approval
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
      message: 'User rejected the plan. Discussion ended.',
      phase: 'rejected',
    })
    await runService.updateRun(runId, { status: 'cancelled' })
    activeDiscussions.delete(runId)

    return
  }

  // Start development phase
  Logger.info({ runId }, 'Starting DEVELOPMENT phase')
  discussion.waitingForUser = false
  await runService.updateRun(runId, { status: 'executing' })

  broadcast(app, runId, 'pm', 'agent.started', {
    message: 'Development phase starting',
    phase: 'development',
  })

  // DEVELOPMENT ROUNDS
  // Each agent creates their deliverables

  // Phase 1: Researcher creates market report
  broadcast(app, runId, 'pm', 'agent.delta', {
    message: '\n[Phase 1: Market Research Report]',
    phase: 'development_research',
  })

  const researchReport = await streamAgentResponse(
    app, runId, null, 'bd_research',
    'Create a detailed market research report. Include: market size, top 5 competitors, partnership opportunities, regulatory concerns. Format as a professional report.',
    buildContext(discussion.messages)
  )

  // Phase 2: FE creates UI specs
  broadcast(app, runId, 'pm', 'agent.delta', {
    message: '\n[Phase 2: UI/UX Specifications]',
    phase: 'development_ui',
  })

  const uiSpecs = await streamAgentResponse(
    app, runId, null, 'fe',
    'Create detailed UI/UX specifications. Include: component list, page flows, animation specs, responsive breakpoints, suggested libraries. Format as design specs.',
    buildContext([...discussion.messages, { role: 'bd_research', name: 'Researcher', content: researchReport }])
  )

  // Phase 3: BE_SC creates tech specs
  broadcast(app, runId, 'pm', 'agent.delta', {
    message: '\n[Phase 3: Technical Architecture]',
    phase: 'development_tech',
  })

  const techSpecs = await streamAgentResponse(
    app, runId, null, 'be_sc',
    'Create technical architecture documentation. Include: API design, database schema, smart contract structure, security considerations, deployment steps. Format as technical spec.',
    buildContext([...discussion.messages,
      { role: 'bd_research', name: 'Researcher', content: researchReport },
      { role: 'fe', name: 'FE', content: uiSpecs }
    ])
  )

  // PM creates final project plan
  broadcast(app, runId, 'pm', 'agent.delta', {
    message: '\n[Phase 4: Project Roadmap]',
    phase: 'development_roadmap',
  })

  const projectPlan = await streamAgentResponse(
    app, runId, null, 'pm',
    `Create a comprehensive project roadmap based on:\n\nResearch Report: ${researchReport.slice(0, 500)}...\n\nUI Specs: ${uiSpecs.slice(0, 500)}...\n\nTech Specs: ${techSpecs.slice(0, 500)}...\n\nInclude: milestones, timeline, resource allocation, risk mitigation.`,
    buildContext(discussion.messages)
  )

  // Complete
  await runService.updateRun(runId, { status: 'completed' })
  broadcast(app, runId, 'pm', 'run.done', {
    message: 'Development phase complete - All deliverables ready',
    phase: 'completed',
    deliverables: {
      marketResearch: researchReport,
      uiSpecs: uiSpecs,
      techSpecs: techSpecs,
      projectPlan: projectPlan,
    },
  })

  activeDiscussions.delete(runId)
  Logger.info({ runId }, 'Development phase complete')
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
}

export default AutonomousAgentService
