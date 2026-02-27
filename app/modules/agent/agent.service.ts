import { randomUUID } from 'node:crypto'
import { FastifyInstance } from 'fastify'
import {
  AgentEvent,
  AgentRole,
  AgentRun,
  StartRunBody,
} from '#app/modules/agent/agent.interface'

const RUNS = new Map<string, AgentRun>()
const EVENTS = new Map<string, AgentEvent[]>()

const ROLES: AgentRole[] = ['pm', 'fe', 'be_sc', 'researcher', 'marketing']

function pushEvent(app: FastifyInstance, event: AgentEvent) {
  const list = EVENTS.get(event.runId) ?? []
  list.push(event)
  EVENTS.set(event.runId, list)

  app.io.to(`run:${event.runId}`).emit('agent_event', event)
}

function roleText(role: AgentRole) {
  switch (role) {
  case 'pm':
    return 'Breaking down scope and creating task plan'
  case 'fe':
    return 'Drafting frontend flow and UI implementation notes'
  case 'be_sc':
    return 'Designing backend endpoints and Solana devnet execution plan'
  case 'researcher':
    return 'Collecting references and validating assumptions'
  case 'marketing':
    return 'Preparing launch narrative and campaign draft'
  default:
    return 'Working on assigned task'
  }
}

const AgentService = {
  startRun: (app: FastifyInstance, body: StartRunBody) => {
    const id = randomUUID()
    const now = new Date().toISOString()
    const source = body.source ?? (body.prdText ? 'prd' : 'chat')
    const input = body.prdText ?? body.idea ?? ''

    const run: AgentRun = {
      id,
      status: 'running',
      source,
      input,
      createdAt: now,
      updatedAt: now,
    }

    RUNS.set(id, run)
    EVENTS.set(id, [])

    // Simulate parallel agent workers for FE testing.
    for (const role of ROLES) {
      setTimeout(() => {
        const startedAt = new Date().toISOString()
        pushEvent(app, {
          id: randomUUID(),
          runId: id,
          role,
          type: 'agent.started',
          text: `${role} started`,
          createdAt: startedAt,
        })

        pushEvent(app, {
          id: randomUUID(),
          runId: id,
          role,
          type: 'agent.delta',
          text: roleText(role),
          createdAt: new Date().toISOString(),
        })

        pushEvent(app, {
          id: randomUUID(),
          runId: id,
          role,
          type: 'agent.done',
          text: `${role} completed`,
          createdAt: new Date().toISOString(),
        })

        const current = RUNS.get(id)
        if (!current) return

        const doneCount = (EVENTS.get(id) ?? []).filter(e => e.type === 'agent.done').length
        if (doneCount === ROLES.length) {
          current.status = 'completed'
          current.updatedAt = new Date().toISOString()
          RUNS.set(id, current)

          pushEvent(app, {
            id: randomUUID(),
            runId: id,
            role: 'pm',
            type: 'run.done',
            text: 'Run completed',
            createdAt: new Date().toISOString(),
          })
        }
      }, Math.floor(Math.random() * 700) + 300)
    }

    return run
  },

  getRun: (runId: string) => RUNS.get(runId) ?? null,

  getEvents: (runId: string) => EVENTS.get(runId) ?? [],
}

export default AgentService
