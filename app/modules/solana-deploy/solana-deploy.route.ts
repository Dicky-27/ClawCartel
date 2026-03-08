import { DoneFuncWithErrOrRes, FastifyInstance, FastifyPluginOptions } from 'fastify'
import authenticate from '#app/middleware/authenticate'
import SolanaDeployController from '#app/modules/solana-deploy/solana-deploy.controller'
import SolanaDeploySchema from '#app/modules/solana-deploy/solana-deploy.schema'
import type {
  CreateDeploymentBody,
  ReportDeploymentReceiptsBody,
} from '#app/modules/solana-deploy/solana-deploy.interface'

export default function (
  app: FastifyInstance,
  _opts: FastifyPluginOptions,
  done: DoneFuncWithErrOrRes,
) {
  app.post<{ Body: CreateDeploymentBody }>(
    '/deployments',
    {
      preHandler: authenticate,
      schema: SolanaDeploySchema.createDeployment,
    },
    SolanaDeployController.createDeployment,
  )

  app.get<{ Params: { deploymentId: string } }>(
    '/deployments/:deploymentId',
    {
      preHandler: authenticate,
      schema: SolanaDeploySchema.getDeployment,
    },
    SolanaDeployController.getDeployment,
  )

  app.post<{ Params: { deploymentId: string }; Body: ReportDeploymentReceiptsBody }>(
    '/deployments/:deploymentId/receipts',
    {
      preHandler: authenticate,
      schema: SolanaDeploySchema.reportReceipts,
    },
    SolanaDeployController.reportReceipts,
  )

  done()
}
