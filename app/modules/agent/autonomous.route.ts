import { DoneFuncWithErrOrRes, FastifyInstance, FastifyPluginOptions } from 'fastify'
import AutonomousController from '#app/modules/agent/autonomous.controller'
import { StartRunBody } from '#app/modules/agent/agent.interface'

/**
 * Autonomous multi-agent discussion endpoints
 * Multi-round PM-orchestrated squad discussion
 */
export default function (
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: DoneFuncWithErrOrRes
) {
  // Start autonomous multi-round discussion
  app.post<{ Body: StartRunBody }>('/runs', AutonomousController.startRun)

  // Get run status
  app.get('/runs/:runId', AutonomousController.getRun)

  // Continue to development phase
  app.post('/runs/:runId/continue', AutonomousController.continueToDevelopment)

  done()
}
