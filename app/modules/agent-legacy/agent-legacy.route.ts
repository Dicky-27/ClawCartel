/**
 * Legacy Agent Routes (Orchestrated Mode)
 */

import { DoneFuncWithErrOrRes, FastifyInstance, FastifyPluginOptions } from 'fastify'
import LegacyAgentController from '#app/modules/agent-legacy/agent-legacy.controller'
import LegacyAgentSchema from '#app/modules/agent-legacy/agent-legacy.schema'
import { StartRunBody } from '#app/modules/agent-core/agent-core.interface'

export default function (
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: DoneFuncWithErrOrRes
) {
  app.get('/agents', { schema: LegacyAgentSchema.listAgents }, LegacyAgentController.listAgents)

  app.get('/health', { schema: LegacyAgentSchema.health }, LegacyAgentController.health)

  app.post<{ Body: StartRunBody }>(
    '/runs',
    { schema: LegacyAgentSchema.startRun },
    LegacyAgentController.startRun
  )

  app.get<{ Params: { runId: string } }>(
    '/runs/:runId',
    { schema: LegacyAgentSchema.getRun },
    LegacyAgentController.getRun
  )

  app.get<{ Params: { runId: string } }>(
    '/runs/:runId/events',
    { schema: LegacyAgentSchema.getEvents },
    LegacyAgentController.getEvents
  )

  app.post<{
    Params: { runId: string };
    Body: { approved: boolean }
  }>(
    '/runs/:runId/continue',
    { schema: LegacyAgentSchema.continueToDevelopment },
    LegacyAgentController.continueToDevelopment
  )

  done()
}
