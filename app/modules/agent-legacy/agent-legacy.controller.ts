/**
 * Legacy Agent Controller (Orchestrated Mode)
 */

import { FastifyReply, FastifyRequest } from 'fastify'
import LegacyAgentService from '#app/modules/agent-legacy/agent-legacy.service'
import { continueToDevelopment } from '#app/modules/agent-autonomous/agent-autonomous.service'
import Logger from '#app/utils/logger'
import { StartRunBody } from '#app/modules/agent-core/agent-core.interface'

interface RunParams {
  runId: string
}

interface EventsQuery {
  fromSeq?: number
}

const LegacyAgentController = {
  health: async (_: FastifyRequest, reply: FastifyReply) => {
    try {
      const health = await LegacyAgentService.healthCheck()

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
    const run = await LegacyAgentService.startRun(request.server, request.body)

    return reply.json(run, 202)
  },

  getRun: async (
    request: FastifyRequest<{ Params: RunParams }>,
    reply: FastifyReply
  ) => {
    const run = await LegacyAgentService.getRun(request.params.runId)

    return reply.json(run)
  },

  getEvents: async (
    request: FastifyRequest<{ Params: RunParams; Querystring: EventsQuery }>,
    reply: FastifyReply
  ) => {
    const events = await LegacyAgentService.getEvents(
      request.params.runId,
      request.query.fromSeq
    )

    return reply.json(events)
  },

  continueToDevelopment: async (
    request: FastifyRequest<{
      Params: RunParams;
      Body: { approved: boolean }
    }>,
    reply: FastifyReply
  ) => {
    const { runId } = request.params
    const { approved } = request.body

    await continueToDevelopment(request.server, runId, approved)

    return reply.json({
      success: true,
      message: approved ? 'Development phase started' : 'Run cancelled',
      runId
    })
  },
}

export default LegacyAgentController
