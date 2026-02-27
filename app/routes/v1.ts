import { FastifyInstance } from 'fastify'

import UserRoutes from '#app/modules/user/user.route'
import AgentRoutes from '#app/modules/agent/agent.route'
import RunRoutes from '#app/modules/run/run.route'

export default function (app: FastifyInstance) {
  app.register(UserRoutes, { prefix: '/user' })
  app.register(AgentRoutes, { prefix: '/agent' })
  app.register(RunRoutes, { prefix: '/runs' })
}
