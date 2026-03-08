import { FastifyInstance } from 'fastify'

import AuthRoutes from '#app/modules/auth/auth.route'
import UserRoutes from '#app/modules/user/user.route'
import LegacyAgentRoutes from '#app/modules/agent-legacy/agent-legacy.route'
import AutonomousRoutes from '#app/modules/agent-autonomous/agent-autonomous.route'
import RunRoutes from '#app/modules/run/run.route'
import UploadRoutes from '#app/modules/upload/upload.route'
import SolanaDeployRoutes from '#app/modules/solana-deploy/solana-deploy.route'

export default function (app: FastifyInstance) {
  app.register(AuthRoutes, { prefix: '/auth' })
  app.register(UserRoutes, { prefix: '/user' })
  app.register(LegacyAgentRoutes, { prefix: '/agent' })
  app.register(AutonomousRoutes, { prefix: '/autonomous' })
  app.register(RunRoutes, { prefix: '/runs' })
  app.register(UploadRoutes, { prefix: '/upload' })
  app.register(SolanaDeployRoutes, { prefix: '/solana/deploy' })
}
