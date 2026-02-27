import { FastifyReply, FastifyRequest } from 'fastify'
import {
  EventsQuery,
  RunParams,
  StartRunBody,
} from '#app/modules/agent/agent.interface'
import AgentService from '#app/modules/agent/agent.service'
import Logger from '#app/utils/logger'

const AgentController = {
  health: async (_: FastifyRequest, reply: FastifyReply) => {
    try {
      const health = await AgentService.healthCheck()

      if (health.ok) {
        return reply.json({
          status: 'ok',
          gateway: 'connected',
          timestamp: new Date().toISOString(),
        })
      } else {
        return reply.status(503).json({
          status: 'degraded',
          gateway: 'disconnected',
          error: health.error,
          timestamp: new Date().toISOString(),
        })
      }
    } catch (error) {
      Logger.error({ err: error }, 'Health check failed')

      return reply.status(503).json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  },

  startRun: async (
    request: FastifyRequest<{ Body: StartRunBody }>,
    reply: FastifyReply
  ) => {
    const run = await AgentService.startRun(request.server, request.body)

    return reply.json(run, 202)
  },

  getRun: async (
    request: FastifyRequest<{ Params: RunParams }>,
    reply: FastifyReply
  ) => {
    const run = await AgentService.getRun(request.params.runId)

    return reply.json(run)
  },

  getEvents: async (
    request: FastifyRequest<{ Params: RunParams; Querystring: EventsQuery }>,
    reply: FastifyReply
  ) => {
    const events = await AgentService.getEvents(
      request.params.runId,
      request.query.fromSeq
    )

    return reply.json(events)
  },
}

export default AgentController
