import { FastifyReply, FastifyRequest } from 'fastify'
import AutonomousAgentService from '#app/modules/agent/autonomous.service'
import { StartRunBody, RunParams } from '#app/modules/agent/agent.interface'
import runService from '#app/modules/run/run.service'

const AutonomousController = {
  startRun: async (
    request: FastifyRequest<{ Body: StartRunBody }>,
    reply: FastifyReply
  ) => {
    const run = await AutonomousAgentService.startRun(request.server, request.body)

    return reply.json(run, 202)
  },

  getRun: async (
    request: FastifyRequest<{ Params: RunParams }>,
    reply: FastifyReply
  ) => {
    const run = await runService.getRun(request.params.runId)

    return reply.json(run)
  },

  continueToDevelopment: async (
    request: FastifyRequest<{ Params: RunParams; Body: { approved: boolean } }>,
    reply: FastifyReply
  ) => {
    const { runId } = request.params
    const { approved } = request.body

    await AutonomousAgentService.continueToDevelopment(request.server, runId, approved)

    return reply.json({
      success: true,
      message: approved ? 'Development phase started' : 'Run cancelled',
      runId
    })
  },
}

export default AutonomousController
