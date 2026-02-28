import { FastifyInstance } from 'fastify'

import AuthRoutes from '#app/modules/auth/auth.route'
import UserRoutes from '#app/modules/user/user.route'
import AgentRoutes from '#app/modules/agent/agent.route'
import AutonomousRoutes from '#app/modules/agent/autonomous.route'
import RunRoutes from '#app/modules/run/run.route'
import UploadRoutes from '#app/modules/upload/upload.route'

export default function (app: FastifyInstance) {
  app.register(AuthRoutes, { prefix: '/auth' })
  app.register(UserRoutes, { prefix: '/user' })
  app.register(AgentRoutes, { prefix: '/agent' })
  app.register(AutonomousRoutes, { prefix: '/autonomous' })
  app.register(RunRoutes, { prefix: '/runs' })
  app.register(UploadRoutes, { prefix: '/upload' })
}
