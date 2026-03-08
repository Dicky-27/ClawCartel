import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import RouteV1 from '#app/routes/v1'

export default function (app: FastifyInstance) {
  app.get('/', (request: FastifyRequest, reply: FastifyReply) => reply.json({ health: 'ok' }))

  app.register(RouteV1, { prefix: '/v1' })
}
