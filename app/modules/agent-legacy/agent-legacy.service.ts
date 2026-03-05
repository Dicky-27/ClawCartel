/**
 * Legacy Agent Service (Orchestrated Mode)
 * Backend-controlled agent execution
 */

import { FastifyInstance } from 'fastify'
import runService from '#app/modules/run/run.service'
import Logger from '#app/utils/logger'
import {
  AgentRole,
  StartRunBody,
  StreamEvent,
  AgentState,
} from '#app/modules/agent-core/agent-core.interface'
import {
  ROLE_AGENT_MAP,
  SQUAD_ROLES,
  LEGACY_AGENT_BRIEFS,
  DISCUSSION_TIMEOUT_MS,
} from '#app/modules/agent-core/agent-core.config'
import { OpenClawGatewayClient } from '#app/modules/agent-core/agent-core.gateway'
import { AgentRun, EventType, Run } from '#app/modules/run/run.interface'

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

function buildPMPrompt(inputText: string): string {
  const pm = LEGACY_AGENT_BRIEFS.pm

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

function buildSquadPrompt(
  role: AgentRole,
  pmBrief: string,
  userInput: string,
  discussionLog: string
): string {
  const brief = LEGACY_AGENT_BRIEFS[role]

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

Write naturally in complete sentences and paragraphs. Don't use bullet points unless listing specific items. Stay in character and reference your expertise. Be conversational - you're discussing with your squad.`
}

function buildPMSummaryPrompt(pmBrief: string, discussionLog: string): string {
  const pm = LEGACY_AGENT_BRIEFS.pm

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

  const brief = LEGACY_AGENT_BRIEFS[role]

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
      characterName: brief.name,
      characterEmoji: brief.emoji,
    },
    createdAt: event.createdAt,
  }

  app.io.to(`run:${runId}`).emit('agent_event', streamEvent)

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

async function streamAgentChat(
  app: FastifyInstance,
  run: Run,
  agentRun: AgentRun,
  role: AgentRole,
  prompt: string
): Promise<string> {
  const gateway = new OpenClawGatewayClient()
  const brief = LEGACY_AGENT_BRIEFS[role]

  await runService.updateAgentRun(agentRun.id, {
    status: 'running',
    startedAt: new Date(),
  })

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
        const newState = detectState(fullText)
        if (newState !== currentState) {
          currentState = newState
        }

        await appendAndBroadcast(app, run.id, agentRun, role, 'agent.delta', {
          message: chunk.content,
          accumulated: fullText,
          state: currentState,
          agentName: brief.name,
          agentEmoji: brief.emoji,
        })
      }
    }

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

async function processRun(
  app: FastifyInstance,
  run: Run,
  inputText: string,
  mode: 'single' | 'squad'
): Promise<void> {
  // STEP 1: PM analyzes user input
  Logger.info({ runId: run.id }, 'STEP 1: PM analyzing user input')

  const pmAgentRun = await runService.createAgentRun({
    runId: run.id,
    role: 'pm',
    agentId: ROLE_AGENT_MAP.pm,
    status: 'queued',
  })

  await runService.updateRun(run.id, { status: 'executing' })

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

  // STEP 2: Squad discussion
  Logger.info({ runId: run.id }, 'STEP 2: Starting squad discussion')

  const discussionLog: string[] = []
  const discussionStartTime = Date.now()

  for (const role of SQUAD_ROLES) {
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
      const brief = LEGACY_AGENT_BRIEFS[role]
      discussionLog.push(`${brief.name}: ${response}`)
    } catch (error) {
      Logger.error({ err: error, runId: run.id, role }, 'Agent discussion failed')
    }
  }

  // STEP 3: PM summarizes
  Logger.info({ runId: run.id }, 'STEP 3: PM summarizing discussion')

  const finalLog = discussionLog.join('\n\n')
  const pmSummaryPrompt = buildPMSummaryPrompt(pmBrief, finalLog)
  const pmSummary = await streamAgentChat(app, run, pmAgentRun, 'pm', pmSummaryPrompt)

  await runService.updateRun(run.id, { status: 'completed' })
  await appendAndBroadcast(app, run.id, pmAgentRun, 'pm', 'run.done', {
    message: 'Discussion complete - Execution ready',
    pmBrief,
    discussionSummary: finalLog,
    pmFinalSummary: pmSummary,
  })

  Logger.info({ runId: run.id }, 'Run complete')
}

const LegacyAgentService = {
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
    const gateway = new OpenClawGatewayClient()

    return gateway.healthCheck()
  },

  getAgentBriefs: () => LEGACY_AGENT_BRIEFS,
}

export default LegacyAgentService
