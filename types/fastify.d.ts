import 'fastify'
import type { Server as SocketIOServer } from 'socket.io'

declare module 'fastify' {
  interface FastifyReply {
    json: (data?: object | string | number | boolean | null, status?: number, code?: string | null, message?: string | null) => void
  }

  interface FastifyInstance {
    io: SocketIOServer
  }
}
