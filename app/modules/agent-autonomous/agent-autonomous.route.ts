import { DoneFuncWithErrOrRes, FastifyInstance, FastifyPluginOptions } from 'fastify'
import AutonomousController from '#app/modules/agent-autonomous/agent-autonomous.controller'
import AutonomousSchema from '#app/modules/agent-autonomous/agent-autonomous.schema'
import { StartRunBody } from '#app/modules/agent-core/agent-core.interface'

export default function (
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: DoneFuncWithErrOrRes
) {
  app.get(
    '/agents',
    { schema: AutonomousSchema.listAgents },
    AutonomousController.listAgents
  )

  app.post<{ Body: StartRunBody }>(
    '/runs',
    { schema: AutonomousSchema.startRun },
    AutonomousController.startRun
  )

  app.post<{ Body: StartRunBody }>(
    '/runs/new-thread',
    { schema: AutonomousSchema.startNewThread },
    AutonomousController.startNewThread
  )

  app.get(
    '/runs/:runId',
    { schema: AutonomousSchema.getRun },
    AutonomousController.getRun
  )

  app.post(
    '/runs/:runId/continue',
    { schema: AutonomousSchema.continueToDevelopment },
    AutonomousController.continueToDevelopment
  )

  app.post(
    '/runs/:runId/fix-smart-contract',
    { schema: AutonomousSchema.fixSmartContractBuild },
    AutonomousController.fixSmartContractBuild
  )

  app.get(
    '/runs/:runId/files',
    { schema: AutonomousSchema.getFiles },
    AutonomousController.getFiles
  )

  app.get(
    '/runs/:runId/file-content',
    { schema: AutonomousSchema.getFileContent },
    AutonomousController.getFileContent
  )

  app.get(
    '/runs/:runId/download',
    { schema: AutonomousSchema.downloadProject },
    AutonomousController.downloadProject
  )

  app.get(
    '/runs/:runId/prd/download',
    { schema: AutonomousSchema.downloadPrd },
    AutonomousController.downloadPrd
  )

  done()
}
