import { FastifyRequest, FastifyReply } from 'fastify'
import runService from '#app/modules/run/run.service'
import {
  CreateRunDto,
  CreateAgentRunDto,
  CreateAgentEventDto,
  UpdateRunDto,
  UpdateAgentRunDto,
  ListRunsQuery,
  ListAgentRunsQuery,
  ListAgentEventsQuery,
  ReplayEventsQuery,
} from '#app/modules/run/run.interface'

// Run controllers
const listRuns = async (
  request: FastifyRequest<{ Querystring: ListRunsQuery }>,
  reply: FastifyReply
) => {
  const result = await runService.listRuns(request.query)

  return reply.json(result)
}

const getRun = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  const run = await runService.getRunWithAgentRuns(request.params.id)
  if (!run) {
    return reply.json({ error: 'Run not found' }, 404)
  }

  return reply.json(run)
}

const createRun = async (
  request: FastifyRequest<{ Body: CreateRunDto }>,
  reply: FastifyReply
) => {
  const run = await runService.createRun(request.body)

  return reply.json(run, 201)
}

const updateRun = async (
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateRunDto }>,
  reply: FastifyReply
) => {
  try {
    const run = await runService.updateRun(request.params.id, request.body)

    return reply.json(run)
  } catch (error) {
    return reply.json({ error: 'Run not found' }, 404)
  }
}

const deleteRun = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  try {
    await runService.deleteRun(request.params.id)

    return reply.json({ message: 'Run deleted successfully' })
  } catch (error) {
    return reply.json({ error: 'Run not found' }, 404)
  }
}

// Agent Run controllers
const listAgentRuns = async (
  request: FastifyRequest<{ Querystring: ListAgentRunsQuery }>,
  reply: FastifyReply
) => {
  const result = await runService.listAgentRuns(request.query)

  return reply.json(result)
}

const getAgentRun = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  const agentRun = await runService.getAgentRunWithEvents(request.params.id)
  if (!agentRun) {
    return reply.json({ error: 'Agent run not found' }, 404)
  }

  return reply.json(agentRun)
}

const createAgentRun = async (
  request: FastifyRequest<{ Body: CreateAgentRunDto }>,
  reply: FastifyReply
) => {
  const agentRun = await runService.createAgentRun(request.body)

  return reply.json(agentRun, 201)
}

const updateAgentRun = async (
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateAgentRunDto }>,
  reply: FastifyReply
) => {
  try {
    const agentRun = await runService.updateAgentRun(request.params.id, request.body)

    return reply.json(agentRun)
  } catch (error) {
    return reply.json({ error: 'Agent run not found' }, 404)
  }
}

const deleteAgentRun = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  try {
    await runService.deleteAgentRun(request.params.id)

    return reply.json({ message: 'Agent run deleted successfully' })
  } catch (error) {
    return reply.json({ error: 'Agent run not found' }, 404)
  }
}

// Agent Event controllers
const listAgentEvents = async (
  request: FastifyRequest<{ Querystring: ListAgentEventsQuery }>,
  reply: FastifyReply
) => {
  const result = await runService.listAgentEvents(request.query)

  return reply.json(result)
}

const getAgentEvent = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  const event = await runService.getAgentEvent(request.params.id)
  if (!event) {
    return reply.json({ error: 'Agent event not found' }, 404)
  }

  return reply.json(event)
}

const createAgentEvent = async (
  request: FastifyRequest<{ Body: CreateAgentEventDto }>,
  reply: FastifyReply
) => {
  try {
    const event = await runService.createAgentEvent(request.body)

    return reply.json(event, 201)
  } catch (error: any) {
    if (error.message?.includes('Unique constraint')) {
      return reply.json({ error: 'Event with this sequence number already exists for this run' }, 409)
    }
    throw error
  }
}

const deleteAgentEvent = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  try {
    await runService.deleteAgentEvent(request.params.id)

    return reply.json({ message: 'Agent event deleted successfully' })
  } catch (error) {
    return reply.json({ error: 'Agent event not found' }, 404)
  }
}

// Replay events controller
const replayEvents = async (
  request: FastifyRequest<{ Params: { runId: string }; Querystring: ReplayEventsQuery }>,
  reply: FastifyReply
) => {
  const result = await runService.replayEvents(request.params.runId, request.query)

  return reply.json(result)
}

// Get next sequence number
const getNextSeq = async (
  request: FastifyRequest<{ Params: { runId: string } }>,
  reply: FastifyReply
) => {
  const nextSeq = await runService.getNextSeq(request.params.runId)

  return reply.json({ runId: request.params.runId, nextSeq })
}

const RunController = {
  // Run
  listRuns,
  getRun,
  createRun,
  updateRun,
  deleteRun,
  // Agent Run
  listAgentRuns,
  getAgentRun,
  createAgentRun,
  updateAgentRun,
  deleteAgentRun,
  // Agent Event
  listAgentEvents,
  getAgentEvent,
  createAgentEvent,
  deleteAgentEvent,
  // Replay
  replayEvents,
  getNextSeq,
}

export default RunController
