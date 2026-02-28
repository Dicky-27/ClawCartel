import { FastifyInstance } from 'fastify'
import { OpenClawGatewayClient } from '#app/modules/agent/openclaw.gateway'
import runService from '#app/modules/run/run.service'
import Logger from '#app/utils/logger'
import {
  AgentRole,
  StartRunBody,
  StreamEvent,
  AgentState,
} from '#app/modules/agent/agent.interface'
import {
  AgentRun,
  EventType,
  Run,
} from '#app/modules/run/run.interface'

// Simplified agent roles
const ROLE_AGENT_MAP: Record<AgentRole, string> = {
  pm: 'pm-agent',
  // eslint-disable-next-line camelcase
  be_sc: 'be-sc-agent',
  fe: 'fe-agent',
  // eslint-disable-next-line camelcase
  bd_research: 'bd-research-agent',
}

// Squad members (excluding PM who leads)

const SQUAD_ROLES: AgentRole[] = ['be_sc', 'fe', 'bd_research']

const OPENCLAW_ENABLED = (process.env.OPENCLAW_AGENT_ENABLED ?? 'true') === 'true'
const OPENCLAW_TIMEOUT_SECONDS = parseInt(process.env.OPENCLAW_AGENT_TIMEOUT_SECONDS ?? '120')
const DISCUSSION_TIMEOUT_MS = 2 * 60 * 1000 // 2 minutes

// Agent briefs - personality, expertise, and custom instructions
const AGENT_BRIEFS: Record<AgentRole, {
  name: string
  emoji: string
  role: string
  expertise: string
  personality: string
  speakingStyle: string
  constraints: string[]
  quirk: string
}> = {
  pm: {
    name: 'PM',
    emoji: '📋',
    role: 'Product Lead',
    expertise: 'Product strategy, roadmap, cross-functional coordination',
    personality: 'Direct, decisive, slightly impatient but fair. Hates wasted time and rambling.',
    speakingStyle: 'Short punchy sentences. Gets to the point. Uses team member names. No fluff.',
    constraints: [
      'Always address squad members by name (Researcher, FE, BE_SC)',
      'Cut off discussions that go nowhere',
      'Keep meetings under 2 minutes',
      'End with clear action items',
      'Challenge weak ideas immediately',
    ],
    quirk: 'Always watching the clock. Says "Let\'s wrap this up" frequently.',
  },
  // eslint-disable-next-line camelcase
  be_sc: {
    name: 'BE_SC',
    emoji: '⚙️',
    role: 'Backend + Smart Contract Dev',
    expertise: 'Rust/Solana, APIs, database, smart contracts',
    personality: 'Technical, precise, security-obsessed. Always thinks about edge cases and failure modes.',
    speakingStyle: 'Technical but concise. Mentions specific technologies. Brings up risks.',
    constraints: [
      'Always mention gas optimization for Solana',
      'Flag security risks immediately',
      'Suggest specific tech stack (Rust, PostgreSQL, Redis, Anchor)',
      'Consider scalability and edge cases',
      'Question anything that sounds inefficient',
    ],
    quirk: 'Mentions "gas cost" and "what if it fails?" in every conversation.',
  },
  fe: {
    name: 'FE',
    emoji: '🎨',
    role: 'Frontend Dev',
    expertise: 'React/Next.js, UI/UX, WebSocket, real-time interfaces',
    personality: 'Creative, visual thinker. Obsessed with user experience and micro-interactions.',
    speakingStyle: 'Visual descriptions. Mentions animations, components, and user flows.',
    constraints: [
      'Describe UI in component terms',
      'Always mention at least one animation or transition',
      'Consider mobile responsiveness',
      'Suggest specific libraries (Three.js, Framer Motion, Tailwind)',
      'Think about loading states and error handling',
    ],
    quirk: 'Sees everything as React components. Mentions "smooth UX" constantly.',
  },
  // eslint-disable-next-line camelcase
  bd_research: {
    name: 'Researcher',
    emoji: '🔬',
    role: 'BD + Researcher',
    expertise: 'Market research, competitive analysis, partnerships, tokenomics',
    personality: 'Data-driven, curious, skeptical. Always has a stat ready. Knows what competitors are doing.',
    speakingStyle: 'References numbers and real competitors. Asks tough questions.',
    constraints: [
      'Always provide specific numbers (market size, users, volume)',
      'Mention 1-2 real competitors by name (Magic Eden, OpenSea, Blur)',
      'Suggest specific partnership opportunities',
      'Question assumptions with actual data',
      'Bring up regulatory concerns if relevant',
    ],
    quirk: 'Cites random statistics. Says "Actually, the data shows..." often.',
  },
}

// Detect agent state from content
function detectState(text: string): AgentState {
  const lower = text.toLowerCase()
  if (lower.includes('implement') || lower.includes('build') || lower.includes('deploy')) {
    return 'doing'
  }
  if (lower.includes('plan') || lower.includes('strategy') || lower.includes('design')) {
    return 'planning'
  }

  return 'discussing'
}

/**
 * Build PM prompt - PM receives user input and creates summary/tasks
 */
function buildPMPrompt(inputText: string): string {
  const pm = AGENT_BRIEFS.pm

  return `You are ${pm.name} ${pm.emoji}, the ${pm.role} of ClawCartel.

PERSONALITY: ${pm.personality}
SPEAKING STYLE: ${pm.speakingStyle}
QUIRK: ${pm.quirk}

USER REQUEST: "${inputText}"

Your job: Analyze this request and create a comprehensive brief for your squad.

Provide in your natural PM voice:
- A clear summary of what we're building
- Key objectives and success metrics
- Specific questions for each team member about their domain

Be thorough but concise. Write in complete sentences. Stay in character as a decisive PM.`
}

/**
 * Build squad member prompt for discussion
 */
function buildSquadPrompt(
  role: AgentRole,
  pmBrief: string,
  userInput: string,
  discussionLog: string
): string {
  const brief = AGENT_BRIEFS[role]

  return `You are ${brief.name} ${brief.emoji}, ${brief.role} at ClawCartel.

PERSONALITY: ${brief.personality}
SPEAKING STYLE: ${brief.speakingStyle}
QUIRK: ${brief.quirk}

=== CONTEXT ===
USER REQUEST: "${userInput}"

PM BRIEF:
${pmBrief}

${discussionLog ? `WHAT OTHERS HAVE SAID:\n${discussionLog}\n` : ''}

=== YOUR RESPONSE ===
Respond as ${brief.name} in your natural voice. Share your professional assessment:

- Your analysis of the requirements
- Key considerations from your expertise
- Questions or suggestions for the team
- Any concerns or opportunities you see

Write naturally in complete sentences and paragraphs. Don't use bullet points unless listing specific items. Stay in character and reference your expertise. Be conversational - you're discussing with your squad.`}

/**
 * Build PM summary prompt
 */
function buildPMSummaryPrompt(pmBrief: string, discussionLog: string): string {
  const pm = AGENT_BRIEFS.pm

  return `You are ${pm.name} ${pm.emoji}, the ${pm.role}.

PERSONALITY: ${pm.personality}
SPEAKING STYLE: ${pm.speakingStyle}
QUIRK: ${pm.quirk}

YOUR ORIGINAL BRIEF:
${pmBrief}

SQUAD DISCUSSION:
${discussionLog}

YOUR JOB: Summarize the discussion and give final direction.

Provide in your natural PM voice:
- Key decisions the team made
- Clear action items for each team member
- Any risks or blockers to watch

End decisively with next steps. Write naturally in complete sentences. Stay in character as the PM who keeps things moving.`
}

/**
 * Append event to DB and broadcast to FE via WebSocket
 */
async function appendAndBroadcast(
  app: FastifyInstance,
  runId: string,
  agentRun: AgentRun,
  role: AgentRole,
  eventType: EventType,
  payload: Record<string, unknown>
): Promise<StreamEvent> {
  const event = await runService.createAgentEvent({
    runId,
    agentRunId: agentRun.id,
    eventType,
    payload,
  })

  const brief = AGENT_BRIEFS[role]

  const streamEvent: StreamEvent = {
    runId,
    agentRunId: agentRun.id,
    role,
    seq: Number(event.seq),
    eventType,
    payload: {
      ...payload,
      agentName: brief.name,
      agentEmoji: brief.emoji,
      agentRole: brief.role,
      personality: brief.personality,
      // Frontend-friendly aliases (mock-fe and others use these)
      characterName: brief.name,
      characterEmoji: brief.emoji,
    },
    createdAt: event.createdAt,
  }

  // broadcast to FE via Socket.IO
  app.io.to(`run:${runId}`).emit('agent_event', streamEvent)

  // emit state update
  if (payload.state) {
    app.io.to(`run:${runId}`).emit('agent_state', {
      runId,
      agentRunId: agentRun.id,
      role,
      state: payload.state,
      agentName: brief.name,
      agentEmoji: brief.emoji,
    })
  }

  return streamEvent
}

/**
 * Stream agent response and broadcast chunks in real-time
 */
async function streamAgentChat(
  app: FastifyInstance,
  run: Run,
  agentRun: AgentRun,
  role: AgentRole,
  prompt: string
): Promise<string> {
  const gateway = new OpenClawGatewayClient()
  const brief = AGENT_BRIEFS[role]

  await runService.updateAgentRun(agentRun.id, {
    status: 'running',
    startedAt: new Date(),
  })

  // Broadcast that agent is starting to chat
  await appendAndBroadcast(app, run.id, agentRun, role, 'agent.started', {
    message: `${brief.name} is joining the discussion`,
    agentName: brief.name,
    agentEmoji: brief.emoji,
    personality: brief.personality,
  })

  try {
    const stream = gateway.streamAgentResponse(
      ROLE_AGENT_MAP[role],
      prompt,
      `${run.id}:${role}`
    )

    let fullText = ''
    let currentState: AgentState = 'discussing'

    for await (const chunk of stream) {
      if (chunk.done) break

      if (chunk.content) {
        fullText += chunk.content

        // Detect state from accumulated text
        const newState = detectState(fullText)
        if (newState !== currentState) {
          currentState = newState
        }

        // BROADCAST EVERY CHUNK in real-time to frontend
        await appendAndBroadcast(app, run.id, agentRun, role, 'agent.delta', {
          message: chunk.content,
          accumulated: fullText,
          state: currentState,
          agentName: brief.name,
          agentEmoji: brief.emoji,
        })
      }
    }

    // Broadcast completion
    await appendAndBroadcast(app, run.id, agentRun, role, 'agent.done', {
      message: fullText,
      state: 'completed',
      agentName: brief.name,
      agentEmoji: brief.emoji,
    })

    await runService.updateAgentRun(agentRun.id, {
      status: 'completed',
      endedAt: new Date(),
    })

    Logger.info({ runId: run.id, role: brief.name, textLength: fullText.length }, 'Agent chat complete')

    return fullText

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    Logger.error({ err: error, runId: run.id, role: brief.name }, 'Agent chat failed')

    await appendAndBroadcast(app, run.id, agentRun, role, 'agent.error', {
      message,
      agentName: brief.name,
      agentEmoji: brief.emoji,
    })

    await runService.updateAgentRun(agentRun.id, {
      status: 'failed',
      endedAt: new Date(),
    })

    throw error
  }
}

/**
 * Process a complete run with PM-led discussion
 */
async function processRun(
  app: FastifyInstance,
  run: Run,
  inputText: string,
  mode: 'single' | 'squad'
): Promise<void> {
  // STEP 1: PM analyzes user input and creates brief
  Logger.info({ runId: run.id }, 'STEP 1: PM analyzing user input')

  const pmAgentRun = await runService.createAgentRun({
    runId: run.id,
    role: 'pm',
    agentId: ROLE_AGENT_MAP.pm,
    status: 'queued',
  })

  await runService.updateRun(run.id, { status: 'executing' })

  // PM creates the brief
  const pmPrompt = buildPMPrompt(inputText)
  const pmBrief = await streamAgentChat(app, run, pmAgentRun, 'pm', pmPrompt)

  Logger.info({ runId: run.id, briefLength: pmBrief.length }, 'PM brief created')

  // If single mode, we're done
  if (mode === 'single') {
    await runService.updateRun(run.id, { status: 'completed' })
    await appendAndBroadcast(app, run.id, pmAgentRun, 'pm', 'run.done', {
      message: 'Analysis complete',
      pmBrief,
    })

    return
  }

  // STEP 2: Squad discussion - SEQUENTIAL for natural conversation
  Logger.info({ runId: run.id }, 'STEP 2: Starting squad discussion (sequential)')

  // Track discussion
  const discussionLog: string[] = []
  const discussionStartTime = Date.now()

  // Run each squad member sequentially so they can build on previous responses
  for (const role of SQUAD_ROLES) {
    // Check if we've exceeded 2 minutes
    if (Date.now() - discussionStartTime > DISCUSSION_TIMEOUT_MS) {
      Logger.info({ runId: run.id }, 'Discussion timeout reached')
      break
    }

    const agentRun = await runService.createAgentRun({
      runId: run.id,
      role,
      agentId: ROLE_AGENT_MAP[role],
      status: 'queued',
    })

    const logText = discussionLog.join('\n\n')
    const prompt = buildSquadPrompt(role, pmBrief, inputText, logText)

    try {
      const response = await streamAgentChat(app, run, agentRun, role, prompt)

      // Add full response to discussion log
      const brief = AGENT_BRIEFS[role]
      discussionLog.push(`${brief.name}: ${response}`)
    } catch (error) {
      Logger.error({ err: error, runId: run.id, role }, 'Agent discussion failed')
      // Continue with next agent even if one fails
    }
  }

  // STEP 3: PM summarizes discussion and ends
  Logger.info({ runId: run.id }, 'STEP 3: PM summarizing discussion')

  const finalLog = discussionLog.join('\n\n')
  const pmSummaryPrompt = buildPMSummaryPrompt(pmBrief, finalLog)

  const pmSummary = await streamAgentChat(app, run, pmAgentRun, 'pm', pmSummaryPrompt)

  // Mark run complete
  await runService.updateRun(run.id, { status: 'completed' })

  // Broadcast run completion
  await appendAndBroadcast(app, run.id, pmAgentRun, 'pm', 'run.done', {
    message: 'Discussion complete - Execution ready',
    pmBrief,
    discussionSummary: finalLog,
    pmFinalSummary: pmSummary,
  })

  Logger.info({ runId: run.id }, 'Run complete')
}

/**
 * Agent Service
 */
const AgentService = {
  startRun: async (app: FastifyInstance, body: StartRunBody): Promise<Run> => {
    const inputText = body.prdText?.trim() || body.idea?.trim() || ''
    if (!inputText) {
      throw new Error('idea or prdText is required')
    }

    const inputType = body.source ?? (body.prdText ? 'prd' : 'chat')
    const mode: 'single' | 'squad' = body.mode ?? 'squad'

    const run = await runService.createRun({
      inputType,
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

    // Process run in background
    void processRun(app, run, inputText, mode)
      .catch(async (error) => {
        Logger.error({ err: error, runId: run.id }, 'Run processing failed')
        await runService.updateRun(run.id, { status: 'failed' })
      })

    const latestRun = await runService.getRun(run.id)

    return latestRun ?? run
  },

  getRun: (runId: string) => runService.getRunWithAgentRuns(runId),

  getEvents: (runId: string, fromSeq?: number) =>
    runService.replayEvents(runId, { fromSeq }),

  healthCheck: (): Promise<{ ok: boolean; error?: string }> => {
    if (!OPENCLAW_ENABLED) {
      return Promise.resolve({ ok: true })
    }
    const gateway = new OpenClawGatewayClient()

    return gateway.healthCheck()
  },

  getAgentBriefs: () => AGENT_BRIEFS,
}

export default AgentService
