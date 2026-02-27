import { DoneFuncWithErrOrRes, FastifyInstance, FastifyPluginOptions } from 'fastify'
import AgentController from '#app/modules/agent/agent.controller'
import AgentSchema from '#app/modules/agent/agent.schema'
import { RunParams, StartRunBody } from '#app/modules/agent/agent.interface'

export default function (
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: DoneFuncWithErrOrRes
) {
  app.post<{ Body: StartRunBody }>(
    '/runs',
    { schema: AgentSchema.startRun },
    AgentController.startRun
  )

  app.get<{ Params: RunParams }>(
    '/runs/:runId',
    { schema: AgentSchema.runParams },
    AgentController.getRun
  )

  app.get<{ Params: RunParams }>(
    '/runs/:runId/events',
    { schema: AgentSchema.runParams },
    AgentController.getEvents
  )

  done()
}
