import { FastifyReply, FastifyRequest } from 'fastify'
import {
  RunParams,
  StartRunBody,
} from '#app/modules/agent/agent.interface'
import AgentService from '#app/modules/agent/agent.service'

const AgentController = {
  startRun: (
    request: FastifyRequest<{ Body: StartRunBody }>,
    reply: FastifyReply
  ) => {
    const run = AgentService.startRun(request.server, request.body)

    return reply.json(run, 201)
  },

  getRun: (
    request: FastifyRequest<{ Params: RunParams }>,
    reply: FastifyReply
  ) => {
    const run = AgentService.getRun(request.params.runId)

    return reply.json(run)
  },

  getEvents: (
    request: FastifyRequest<{ Params: RunParams }>,
    reply: FastifyReply
  ) => {
    const events = AgentService.getEvents(request.params.runId)

    return reply.json(events)
  },
}

export default AgentController
