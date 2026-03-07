import { FastifyReply, FastifyRequest } from 'fastify'
import LegacyAgentService from '#app/modules/agent-legacy/agent-legacy.service'
import { continueToDevelopment } from '#app/modules/agent-autonomous/agent-autonomous.service'
import Logger from '#app/utils/logger'
import { StartRunBody } from '#app/modules/agent-core/agent-core.interface'
import ResponseUtil from '#app/utils/response'

interface RunParams {
  runId: string
}

interface EventsQuery {
  fromSeq?: number
}

const LegacyAgentController = {
  listAgents: async (_request: FastifyRequest, reply: FastifyReply) => {
    const agents = await LegacyAgentService.listAgents()

    return ResponseUtil.success(reply, { agents })
  },

  health: async (_: FastifyRequest, reply: FastifyReply) => {
    try {
      const health = await LegacyAgentService.healthCheck()

      if (health.ok) {
        return ResponseUtil.success(reply, {
          status: 'ok',
          gateway: 'connected',
          timestamp: new Date().toISOString(),
        })
      }

      return ResponseUtil.serviceUnavailable(
        reply,
        health.error ?? 'OpenClaw gateway unreachable'
      )
    } catch (error) {
      Logger.error({ err: error }, 'Health check failed')

      return ResponseUtil.serviceUnavailable(
        reply,
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  },

  startRun: async (
    request: FastifyRequest<{ Body: StartRunBody }>,
    reply: FastifyReply
  ) => {
    const run = await LegacyAgentService.startRun(request.server, request.body)

    return ResponseUtil.accepted(reply, run)
  },

  getRun: async (
    request: FastifyRequest<{ Params: RunParams }>,
    reply: FastifyReply
  ) => {
    const run = await LegacyAgentService.getRun(request.params.runId)

    if (!run) {
      return ResponseUtil.notFound(reply, 'Run')
    }

    return ResponseUtil.success(reply, run)
  },

  getEvents: async (
    request: FastifyRequest<{ Params: RunParams; Querystring: EventsQuery }>,
    reply: FastifyReply
  ) => {
    const events = await LegacyAgentService.getEvents(
      request.params.runId,
      request.query.fromSeq
    )

    return ResponseUtil.success(reply, events)
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

    await continueToDevelopment(request.server, runId, approved ? 'approved' : 'rejected')

    return ResponseUtil.success(reply, {
      runId,
      action: approved ? 'development_started' : 'cancelled',
    })
  },
}

export default LegacyAgentController
