import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { FastifyInstance } from 'fastify'
import runService from '#app/modules/run/run.service'
import { AgentRole, StartRunBody, StreamEvent } from '#app/modules/agent/agent.interface'
import {
  AgentRun,
  EventType,
  InputType,
  Run,
} from '#app/modules/run/run.interface'

const execFileAsync = promisify(execFile)

const ROLE_AGENT_MAP: Record<AgentRole, string> = {
  pm: 'pm-agent',
  fe: 'fe-agent',
  'be_sc': 'be-sc-agent',
  marketing: 'marketing-agent',
}

const ROLES: AgentRole[] = ['pm', 'fe', 'be_sc', 'marketing']

const OPENCLAW_BIN = process.env.OPENCLAW_BIN ?? 'openclaw'
const OPENCLAW_TIMEOUT_SECONDS = parseInt(process.env.OPENCLAW_AGENT_TIMEOUT_SECONDS ?? '120')
const OPENCLAW_ENABLED = (process.env.OPENCLAW_AGENT_ENABLED ?? 'true') === 'true'
const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL
const OPENCLAW_GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN
const OPENCLAW_GATEWAY_PASSWORD = process.env.OPENCLAW_GATEWAY_PASSWORD

const ROLE_SYSTEM_PROMPT: Record<AgentRole, string> = {
  pm: 'You are PM agent. Break down scope, define tasks, dependencies, and final summary.',
  fe: 'You are FE agent. Focus on frontend architecture, websocket rendering, and UX states.',
  'be_sc': 'You are BE+SC agent. Focus on backend APIs, state persistence, queue flow, and Solana integration.',
  marketing: 'You are Marketing agent. Create concise positioning, launch copy, and GTM suggestions.',
}

const FALLBACK_LOGS: Record<AgentRole, string[]> = {
  pm: [
    'PM: Breaking down the project scope and constraints',
    'PM: Assigning FE, BE+SC, and Marketing workstreams',
    'PM: Consolidating outputs into one execution plan',
  ],
  fe: [
    'FE: Defining mobile flow for chat/PRD input and run timeline',
    'FE: Mapping websocket event rendering for agent bubbles',
    'FE: Preparing reconnect + replay behavior using seq cursor',
  ],
  'be_sc': [
    'BE+SC: Designing run/event persistence schema and indexing',
    'BE+SC: Preparing Solana Devnet execution integration points',
    'BE+SC: Finalizing API contract for run start and status tracking',
  ],
  marketing: [
    'Marketing: Drafting ClawCartel narrative for hackathon judges',
    'Marketing: Preparing launch message based on agent output timeline',
    'Marketing: Proposing concise product positioning and CTA',
  ],
}

function buildRolePrompt(role: AgentRole, inputText: string): string {
  return [
    ROLE_SYSTEM_PROMPT[role],
    'Context: ClawCartel run execution.',
    `User input: ${inputText}`,
    'Respond with concise actionable output in plain text.',
    'Keep it under 8 bullet points and include concrete next actions.',
  ].join('\n')
}

async function checkGatewayConnectivity(): Promise<void> {
  if (!OPENCLAW_ENABLED) return

  const args = ['health', '--json']

  await execFileAsync(OPENCLAW_BIN, args, {
    maxBuffer: 2 * 1024 * 1024,
    timeout: 15_000,
    env: {
      ...process.env,
      ...(OPENCLAW_GATEWAY_URL ? { OPENCLAW_GATEWAY_URL } : {}),
      ...(OPENCLAW_GATEWAY_TOKEN ? { OPENCLAW_GATEWAY_TOKEN } : {}),
      ...(OPENCLAW_GATEWAY_PASSWORD ? { OPENCLAW_GATEWAY_PASSWORD } : {}),
    },
  })
}

function chunkText(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const lines = trimmed
    .split(/\n+/)
    .map(l => l.trim())
    .filter(Boolean)

  if (lines.length > 1) return lines

  return trimmed
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean)
}

async function runOpenClawAgent(role: AgentRole, inputText: string): Promise<{
  text: string
  meta: {
    model?: string
    provider?: string
    sessionId?: string
    usage?: Record<string, unknown>
    runId?: string
  }
}> {
  const agentId = ROLE_AGENT_MAP[role]
  const prompt = buildRolePrompt(role, inputText)

  const args = [
    'agent',
    '--agent',
    agentId,
    '--message',
    prompt,
    '--json',
    '--timeout',
    String(OPENCLAW_TIMEOUT_SECONDS),
    '--verbose',
    'off',
  ]

  const { stdout } = await execFileAsync(OPENCLAW_BIN, args, {
    maxBuffer: 8 * 1024 * 1024,
    env: {
      ...process.env,
      ...(OPENCLAW_GATEWAY_URL ? { OPENCLAW_GATEWAY_URL } : {}),
      ...(OPENCLAW_GATEWAY_TOKEN ? { OPENCLAW_GATEWAY_TOKEN } : {}),
      ...(OPENCLAW_GATEWAY_PASSWORD ? { OPENCLAW_GATEWAY_PASSWORD } : {}),
    },
  })

  const parsed = JSON.parse(stdout)
  const payloads = parsed?.result?.payloads ?? []
  const text = payloads
    .map((p: { text?: string }) => p?.text ?? '')
    .filter(Boolean)
    .join('\n')
    .trim()

  return {
    text: text || 'No response text from OpenClaw agent.',
    meta: {
      model: parsed?.result?.meta?.agentMeta?.model,
      provider: parsed?.result?.meta?.agentMeta?.provider,
      sessionId: parsed?.result?.meta?.agentMeta?.sessionId,
      usage: parsed?.result?.meta?.agentMeta?.lastCallUsage ?? parsed?.result?.meta?.agentMeta?.usage,
      runId: parsed?.runId,
    },
  }
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

  const streamEvent: StreamEvent = {
    runId,
    agentRunId: agentRun.id,
    role,
    seq: Number(event.seq),
    eventType,
    payload,
    createdAt: event.createdAt,
  }

  app.io.to(`run:${runId}`).emit('agent_event', streamEvent)

  return streamEvent
}

async function executeRole(
  app: FastifyInstance,
  run: Run,
  agentRun: AgentRun,
  role: AgentRole,
  inputText: string
): Promise<void> {
  await runService.updateAgentRun(agentRun.id, {
    status: 'running',
    startedAt: new Date(),
  })

  await appendAndBroadcast(app, run.id, agentRun, role, 'agent.started', {
    message: `${role} started`,
    source: OPENCLAW_ENABLED ? 'openclaw' : 'fallback',
    agentId: ROLE_AGENT_MAP[role],
  })

  try {
    let latestAgentMeta: Record<string, unknown> | undefined

    if (OPENCLAW_ENABLED) {
      await appendAndBroadcast(app, run.id, agentRun, role, 'agent.delta', {
        message: `${role}: contacting OpenClaw agent...`,
        source: 'openclaw',
      })

      const result = await runOpenClawAgent(role, inputText)
      latestAgentMeta = result.meta
      const chunks = chunkText(result.text)

      if (chunks.length === 0) {
        await appendAndBroadcast(app, run.id, agentRun, role, 'agent.delta', {
          message: `${role}: no content returned`,
          source: 'openclaw',
          agentMeta: result.meta,
        })
      } else {
        for (const chunk of chunks) {
          await appendAndBroadcast(app, run.id, agentRun, role, 'agent.delta', {
            message: chunk,
            source: 'openclaw',
            agentMeta: result.meta,
          })
        }
      }
    } else {
      for (const line of FALLBACK_LOGS[role]) {
        await appendAndBroadcast(app, run.id, agentRun, role, 'agent.delta', {
          message: line,
          source: 'fallback',
        })
      }
    }

    await appendAndBroadcast(app, run.id, agentRun, role, 'agent.done', {
      message: `${role} completed`,
      source: OPENCLAW_ENABLED ? 'openclaw' : 'fallback',
      ...(latestAgentMeta ? { agentMeta: latestAgentMeta } : {}),
    })

    await runService.updateAgentRun(agentRun.id, {
      status: 'completed',
      endedAt: new Date(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown agent error'

    await appendAndBroadcast(app, run.id, agentRun, role, 'agent.error', {
      message,
      source: OPENCLAW_ENABLED ? 'openclaw' : 'fallback',
    })

    await runService.updateAgentRun(agentRun.id, {
      status: 'failed',
      endedAt: new Date(),
    })
  }
}

const AgentService = {
  startRun: async (app: FastifyInstance, body: StartRunBody): Promise<Run> => {
    const inputText = body.prdText?.trim() || body.idea?.trim() || ''
    const inputType: InputType = body.source ?? (body.prdText ? 'prd' : 'chat')

    const run = await runService.createRun({
      inputType,
      inputText,
      status: 'planning',
    })

    try {
      await checkGatewayConnectivity()
    } catch (error) {
      await runService.updateRun(run.id, { status: 'failed' })
      const message = error instanceof Error ? error.message : 'Gateway connectivity check failed'
      throw new Error(`OpenClaw gateway unreachable: ${message}`)
    }

    const agentRuns = await Promise.all(
      ROLES.map(role =>
        runService.createAgentRun({
          runId: run.id,
          role,
          agentId: ROLE_AGENT_MAP[role],
          status: 'queued',
        })
      )
    )

    await runService.updateRun(run.id, { status: 'executing' })

    await Promise.all(
      agentRuns.map(agentRun => {
        const role = agentRun.role as AgentRole

        return executeRole(app, run, agentRun, role, inputText)
      })
    )

    const latest = await runService.getRunWithAgentRuns(run.id)
    const hasFailure = latest?.agentRuns.some(a => a.status === 'failed') ?? false

    await runService.updateRun(run.id, {
      status: hasFailure ? 'failed' : 'completed',
    })

    const pmAgentRun = agentRuns.find(a => a.role === 'pm') ?? agentRuns[0]
    if (pmAgentRun) {
      await appendAndBroadcast(app, run.id, pmAgentRun, 'pm', 'run.done', {
        message: hasFailure ? 'Run completed with errors' : 'Run completed',
        source: OPENCLAW_ENABLED ? 'openclaw' : 'fallback',
      })
    }

    const latestRun = await runService.getRun(run.id)

    return latestRun ?? run
  },

  getRun: (runId: string) => runService.getRunWithAgentRuns(runId),

  getEvents: (runId: string, fromSeq?: number) =>
    runService.replayEvents(runId, {
      fromSeq,
    }),
}

export default AgentService
