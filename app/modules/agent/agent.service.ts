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

const ROLE_AGENT_MAP: Record<AgentRole, string> = {
  pm: 'pm-agent',
  fe: 'fe-agent',
  // eslint-disable-next-line camelcase
  be_sc: 'be-sc-agent',
  // eslint-disable-next-line camelcase
  bd_research: 'bd-research-agent',
}


const ROLES: AgentRole[] = ['pm', 'fe', 'be_sc', 'bd_research']

const OPENCLAW_ENABLED = (process.env.OPENCLAW_AGENT_ENABLED ?? 'true') === 'true'
const OPENCLAW_TIMEOUT_SECONDS = parseInt(process.env.OPENCLAW_AGENT_TIMEOUT_SECONDS ?? '120')
const DISCUSSION_TIMEOUT_MS = 2 * 60 * 1000 // 2 minutes

// Agent Character Briefs - Personality, Voice, and Role
const AGENT_CHARACTERS: Record<AgentRole, {
  name: string
  emoji: string
  voice: string
  expertise: string
  quirk: string
}> = {
  pm: {
    name: 'Vince',
    emoji: '👔',
    voice: 'Direct, decisive, slightly impatient but fair',
    expertise: 'Product strategy, roadmap planning, cross-functional coordination',
    quirk: 'Always cuts to the chase, hates meetings that run over',
  },
  fe: {
    name: 'Pixel',
    emoji: '🎨',
    voice: 'Creative, visual thinker, enthusiastic about UX',
    expertise: 'React/Next.js, WebGL, real-time UIs, pixel-perfect design',
    quirk: 'Sees everything as a UI component, sketches ideas mid-conversation',
  },
  // eslint-disable-next-line camelcase
  be_sc: {
    name: 'Chain',
    emoji: '⚙️',
    voice: 'Technical, precise, security-focused',
    expertise: 'Rust/Solana, PostgreSQL, WebSocket servers, smart contracts',
    quirk: 'Mentions "gas optimization" in casual conversation',
  },
  // eslint-disable-next-line camelcase
  bd_research: {
    name: 'Scout',
    emoji: '🔍',
    voice: 'Curious, data-driven, market-savvy',
    expertise: 'Market research, competitive analysis, partnerships, tokenomics',
    quirk: 'Always has a stat ready, knows what competitors are doing',
  },
}

const ROLE_SYSTEM_PROMPT: Record<AgentRole, string> = {
  pm: `You are VINCE (👔), the PM Lead of ClawCartel.
Character: Direct, decisive, slightly impatient but fair. You cut to the chase and hate wasted time.
Expertise: Product strategy, roadmap planning, squad coordination.
Quirk: Always watching the clock, keeps meetings tight.

Your job: LEAD the squad discussion. Coordinate other agents (Pixel, Chain, Scout).
YOU control when discussion ends (max 2 minutes).

Rules:
- Address teammates by name ("Pixel, what's the UI complexity?")
- Keep discussion MOVING - don't let anyone ramble
- Summarize and move to next topic quickly
- Maximum 3-4 short bullet points
- Each point under 15 words
- Total response under 300 characters`,

  fe: `You are PIXEL (🎨), the FE Dev of ClawCartel.
Character: Creative, visual thinker, enthusiastic about UX.
Expertise: React/Next.js, WebGL, real-time UIs, pixel-perfect design.
Quirk: Sees everything as a component, sketches ideas in your head.

Your job: Handle frontend architecture and UX. Report UI complexity to Vince.

Rules:
- Focus on UI components and user flow
- Mention if something needs complex animation
- Maximum 3-4 short bullet points
- Each point under 15 words
- Total response under 300 characters
- No code, just concepts`,

  // eslint-disable-next-line camelcase
  be_sc: `You are CHAIN (⚙️), the BE+SC Dev of ClawCartel.
Character: Technical, precise, security-focused.
Expertise: Rust/Solana, PostgreSQL, WebSocket servers, smart contracts.
Quirk: Mentions "gas optimization" casually.

Your job: Design backend APIs and Solana integration. Report technical complexity to Vince.

Rules:
- Focus on architecture and security
- Flag any on-chain complexity
- Maximum 3-4 short bullet points
- Each point under 15 words
- Total response under 300 characters
- No detailed code, just approach`,

  // eslint-disable-next-line camelcase
  bd_research: `You are SCOUT (🔍), the BD+Researcher of ClawCartel.
Character: Curious, data-driven, market-savvy.
Expertise: Market research, competitive analysis, partnerships, tokenomics.
Quirk: Always has a stat ready, knows competitors' moves.

Your job: Research market fit and identify partnership opportunities. Report findings to Vince.

Rules:
- Reference market data when possible
- Identify 1-2 key competitors or partners
- Maximum 3-4 short bullet points
- Each point under 15 words
- Total response under 300 characters`,
}

// Track discussion state
const discussionTracker = new Map<string, {
  startTime: number
  pmHasEnded: boolean
  agentCount: number
}>()

/**
 * Detect agent state from response content
 */
function detectState(text: string, role: AgentRole): AgentState {
  const lower = text.toLowerCase()

  // Check for planning keywords
  if (lower.includes('plan') ||
      lower.includes('strategy') ||
      lower.includes('approach') ||
      lower.includes('architecture') ||
      lower.includes('design')) {
    return 'planning'
  }

  // Check for doing/implementation keywords
  if (lower.includes('implement') ||
      lower.includes('build') ||
      lower.includes('create') ||
      lower.includes('develop') ||
      lower.includes('code') ||
      lower.includes('deploy')) {
    return 'doing'
  }

  // Check for discussion keywords
  if (lower.includes('discuss') ||
      lower.includes('consider') ||
      lower.includes('think') ||
      lower.includes('analyze')) {
    return 'discussing'
  }

  return 'discussing' // Default state
}

/**
 * Build role-specific prompt
 */
function buildRolePrompt(role: AgentRole, inputText: string, mode: 'single' | 'squad', context?: string): string {
  const character = AGENT_CHARACTERS[role]
  const parts = [
    ROLE_SYSTEM_PROMPT[role],
    `\nMode: ${mode}.`,
    'Context: ClawCartel brainstorming execution.',
    `\nYou are ${character.name} ${character.emoji}. Stay in character!`,
  ]

  if (context) {
    parts.push(`\nSquad discussion so far:\n${context}`)
  }

  parts.push(`\nUser request: "${inputText}"`)

  if (role === 'pm') {
    parts.push('\n⚠️ PM AUTHORITY: You may end the discussion at any time by saying "DISCUSSION ENDED - moving to execution" if you have enough information.')
  }

  parts.push(`\nRespond as ${character.name} ${character.emoji} in your character voice.
MAXIMUM 3-4 short bullet points, under 15 words each, total under 300 characters.
Be brief, actionable, and stay in character!`)

  return parts.join('\n')
}

/**
 * Append event to DB and broadcast to FE
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

  const character = AGENT_CHARACTERS[role]

  const streamEvent: StreamEvent = {
    runId,
    agentRunId: agentRun.id,
    role,
    seq: Number(event.seq),
    eventType,
    payload: {
      ...payload,
      characterName: character.name,
      characterEmoji: character.emoji,
    },
    createdAt: event.createdAt,
  }

  // Broadcast to FE via Socket.IO
  app.io.to(`run:${runId}`).emit('agent_event', streamEvent)

  // Also emit state update if state is in payload
  if (payload.state) {
    app.io.to(`run:${runId}`).emit('agent_state', {
      runId,
      agentRunId: agentRun.id,
      role,
      state: payload.state,
      characterName: character.name,
      characterEmoji: character.emoji,
      timestamp: new Date().toISOString(),
    })
  }

  return streamEvent
}

/**
 * Check if PM should end discussion
 */
function shouldEndDiscussion(runId: string, pmResponse: string): { shouldEnd: boolean; reason: string } {
  const tracker = discussionTracker.get(runId)
  if (!tracker) return { shouldEnd: false, reason: 'no tracker' }

  // Check if PM explicitly ended
  if (pmResponse.toUpperCase().includes('DISCUSSION ENDED') ||
      pmResponse.toUpperCase().includes('MOVING TO EXECUTION')) {
    return { shouldEnd: true, reason: 'pm_command' }
  }

  // Check 2-minute timeout
  const elapsed = Date.now() - tracker.startTime
  if (elapsed > DISCUSSION_TIMEOUT_MS) {
    return { shouldEnd: true, reason: 'timeout' }
  }

  return { shouldEnd: false, reason: 'continue' }
}

/**
 * Execute single agent with streaming
 */
async function executeRole(
  app: FastifyInstance,
  run: Run,
  agentRun: AgentRun,
  role: AgentRole,
  inputText: string,
  mode: 'single' | 'squad',
  squadContext?: string,
  discussionContext?: { runId: string; allResponses: Map<AgentRole, string> }
): Promise<{ response: string; endedDiscussion: boolean }> {
  const gateway = new OpenClawGatewayClient()
  const agentId = ROLE_AGENT_MAP[role]
  const character = AGENT_CHARACTERS[role]

  // Build context from other agents' responses for PM
  let context = squadContext || ''
  if (discussionContext && role === 'pm') {
    const otherResponses = Array.from(discussionContext.allResponses.entries())
      .map(([r, text]) => `${AGENT_CHARACTERS[r].name}: ${text.slice(0, 100)}`)
      .join('\n')
    if (otherResponses) {
      context = `Team input:\n${otherResponses}`
    }
  }

  const prompt = buildRolePrompt(role, inputText, mode, context)

  // Mark as running
  await runService.updateAgentRun(agentRun.id, {
    status: 'running',
    startedAt: new Date(),
  })

  await appendAndBroadcast(app, run.id, agentRun, role, 'agent.started', {
    message: `${character.name} ${character.emoji} joining discussion`,
    characterName: character.name,
    characterEmoji: character.emoji,
    agentId,
    mode,
  })

  let endedDiscussion = false

  try {
    if (!OPENCLAW_ENABLED) {
      throw new Error('OpenClaw is disabled')
    }

    Logger.debug({ agentId, role, character: character.name }, 'Starting agent stream')
    const stream = gateway.streamAgentResponse(agentId, prompt, `${run.id}:${role}`)
    let fullText = ''
    let currentState: AgentState = 'discussing'
    let chunkCount = 0

    for await (const chunk of stream) {
      Logger.debug({ chunkDone: chunk.done, hasContent: !!chunk.content, contentLength: chunk.content?.length }, 'Received chunk')

      if (chunk.done) {
        Logger.debug('Chunk marked done, breaking stream loop')
        break
      }

      if (chunk.content) {
        fullText += chunk.content
        chunkCount++

        // Detect state change every few chunks to avoid spam
        if (chunkCount % 3 === 0) {
          const newState = detectState(fullText, role)
          if (newState !== currentState) {
            currentState = newState
          }
        }

        // For PM, check if should end discussion
        if (role === 'pm' && discussionContext) {
          const { shouldEnd, reason } = shouldEndDiscussion(discussionContext.runId, fullText)
          if (shouldEnd) {
            Logger.info({ reason, runId: discussionContext.runId }, 'PM ending discussion')
            endedDiscussion = true
            break
          }
        }

        // Broadcast chunk to FE
        Logger.debug({ chunkCount, contentPreview: fullText.slice(0, 50) }, 'Broadcasting delta')
        await appendAndBroadcast(app, run.id, agentRun, role, 'agent.delta', {
          message: chunk.content,
          accumulated: fullText,
          state: currentState,
          characterName: character.name,
          characterEmoji: character.emoji,
          agentId,
          partial: true,
        })
      }
    }

    // For PM, check one more time if should end
    if (role === 'pm' && discussionContext) {
      const { shouldEnd, reason } = shouldEndDiscussion(discussionContext.runId, fullText)
      if (shouldEnd) {
        endedDiscussion = true
      }
    }

    // Final completion
    await appendAndBroadcast(app, run.id, agentRun, role, 'agent.done', {
      message: fullText,
      state: 'completed',
      characterName: character.name,
      characterEmoji: character.emoji,
      agentId,
      chunkCount,
      endedDiscussion,
    })

    await runService.updateAgentRun(agentRun.id, {
      status: 'completed',
      endedAt: new Date(),
    })

    Logger.info({ runId: run.id, role, character: character.name, chunkCount, endedDiscussion }, 'Agent completed successfully')

    return { response: fullText, endedDiscussion }

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown agent error'
    Logger.error({ err: error, runId: run.id, role, character: character.name }, 'Agent execution failed')

    await appendAndBroadcast(app, run.id, agentRun, role, 'agent.error', {
      message,
      state: 'error',
      characterName: character.name,
      characterEmoji: character.emoji,
      agentId,
    })

    await runService.updateAgentRun(agentRun.id, {
      status: 'failed',
      endedAt: new Date(),
    })

    throw error
  }
}

/**
 * Process a complete run with all agents
 */
async function processRun(
  app: FastifyInstance,
  run: Run,
  inputText: string,
  mode: 'single' | 'squad',
  roles: AgentRole[],
  parallel: boolean
): Promise<void> {
  // Initialize discussion tracker for squad mode
  if (mode === 'squad') {
    discussionTracker.set(run.id, {
      startTime: Date.now(),
      pmHasEnded: false,
      agentCount: roles.length,
    })
  }

  // Create agent runs
  const agentRuns = await Promise.all(
    roles.map(role =>
      runService.createAgentRun({
        runId: run.id,
        role,
        agentId: ROLE_AGENT_MAP[role],
        status: 'queued',
      })
    )
  )

  await runService.updateRun(run.id, { status: 'executing' })

  // Collect all responses for context
  const allResponses = new Map<AgentRole, string>()
  const discussionContext = mode === 'squad' ? { runId: run.id, allResponses } : undefined

  if (parallel) {
    // Execute all agents in parallel (squad mode)
    const results = await Promise.all(
      agentRuns.map(async (agentRun) => {
        const role = agentRun.role as AgentRole
        try {
          // Non-PM agents first, then PM last if in squad mode
          if (mode === 'squad' && role === 'pm') {
            // Wait a bit for others to respond
            await new Promise(r => setTimeout(r, 5000))
          }

          const result = await executeRole(
            app,
            run,
            agentRun,
            role,
            inputText,
            mode,
            undefined,
            discussionContext
          )

          allResponses.set(role, result.response)

          return { role, ...result }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown agent error'
          Logger.error({ err: error, role, runId: run.id }, 'Parallel agent failed')

          // Broadcast error to FE
          const character = AGENT_CHARACTERS[role]
          await appendAndBroadcast(app, run.id, agentRun, role, 'agent.error', {
            message,
            state: 'error',
            characterName: character.name,
            characterEmoji: character.emoji,
            agentId: ROLE_AGENT_MAP[role],
          })

          await runService.updateAgentRun(agentRun.id, {
            status: 'failed',
            endedAt: new Date(),
          })

          return { role, response: '', endedDiscussion: false }
        }
      })
    )

    // Check if PM ended discussion
    const pmResult = results.find(r => r.role === 'pm')
    if (pmResult?.endedDiscussion) {
      Logger.info({ runId: run.id }, 'Discussion was ended by PM')
    }
  } else {
    // Execute sequentially with context sharing
    let squadContext = ''

    for (const agentRun of agentRuns) {
      const role = agentRun.role as AgentRole

      try {
        const result = await executeRole(
          app,
          run,
          agentRun,
          role,
          inputText,
          mode,
          squadContext,
          discussionContext
        )

        allResponses.set(role, result.response)

        // Add to context for next agents
        const character = AGENT_CHARACTERS[role]
        squadContext += `\n[${character.name}]: ${result.response.slice(0, 200)}`

        // If PM ended discussion, stop here
        if (result.endedDiscussion) {
          Logger.info({ runId: run.id, role }, 'PM ended discussion, stopping sequence')
          break
        }
      } catch (error) {
        Logger.error({ err: error, role, runId: run.id }, 'Sequential agent failed')
        // Continue with next agent even if one fails
      }
    }
  }

  // Cleanup tracker
  discussionTracker.delete(run.id)

  // Check final status
  const latest = await runService.getRunWithAgentRuns(run.id)
  const hasFailure = latest?.agentRuns.some(a => a.status === 'failed') ?? false

  await runService.updateRun(run.id, {
    status: hasFailure ? 'failed' : 'completed',
  })

  // Emit run completion
  const pmOrFirst = agentRuns.find(a => a.role === 'pm') ?? agentRuns[0]
  if (pmOrFirst) {
    const character = AGENT_CHARACTERS[pmOrFirst.role as AgentRole]
    await appendAndBroadcast(app, run.id, pmOrFirst, pmOrFirst.role as AgentRole, 'run.done', {
      message: hasFailure ? 'Run completed with errors' : 'Run completed successfully',
      characterName: character.name,
      characterEmoji: character.emoji,
      mode,
      parallel,
      roles,
      hasFailure,
    })
  }
}

/**
 * Agent Service
 */
const AgentService = {
  /**
   * Start a new run
   */
  startRun: async (app: FastifyInstance, body: StartRunBody): Promise<Run> => {
    const inputText = body.prdText?.trim() || body.idea?.trim() || ''
    if (!inputText) {
      throw new Error('idea or prdText is required')
    }

    const inputType = body.source ?? (body.prdText ? 'prd' : 'chat')
    const mode: 'single' | 'squad' = body.mode ?? 'squad'
    const roles: AgentRole[] = mode === 'single'
      ? [body.role ?? 'pm']

      : ['pm', 'fe', 'be_sc', 'bd_research']
    const parallel = mode === 'squad' ? (body.parallel ?? true) : false

    // Create run
    const run = await runService.createRun({
      inputType,
      inputText,
      status: 'planning',
    })

    // Check Gateway connectivity
    try {
      const gateway = new OpenClawGatewayClient()
      const health = await gateway.healthCheck()
      if (!health.ok) {
        throw new Error(`Gateway unreachable: ${health.error}`)
      }
    } catch (error) {
      await runService.updateRun(run.id, { status: 'failed' })
      const message = error instanceof Error ? error.message : 'Gateway connectivity check failed'
      throw new Error(`OpenClaw gateway unreachable: ${message}`)
    }

    // Process run in background
    void processRun(app, run, inputText, mode, roles, parallel)
      .catch(async (error) => {
        Logger.error({ err: error, runId: run.id }, 'Run processing failed')
        await runService.updateRun(run.id, { status: 'failed' })
        // Cleanup tracker on error
        discussionTracker.delete(run.id)
      })

    // Return run immediately (processing continues in background)
    const latestRun = await runService.getRun(run.id)

    return latestRun ?? run
  },

  /**
   * Get run with agent runs
   */
  getRun: (runId: string) => runService.getRunWithAgentRuns(runId),

  /**
   * Get events for replay
   */
  getEvents: (runId: string, fromSeq?: number) =>
    runService.replayEvents(runId, { fromSeq }),

  /**
   * Health check
   */
  healthCheck: async (): Promise<{ ok: boolean; error?: string }> => {
    if (!OPENCLAW_ENABLED) {
      return { ok: true } // Fallback mode
    }
    const gateway = new OpenClawGatewayClient()


    return await gateway.healthCheck()
  },

  /**
   * Get agent characters info
   */
  getCharacters: () => AGENT_CHARACTERS,
}

export default AgentService
