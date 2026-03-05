import 'fastify'
import '@fastify/jwt'
import type { Server as SocketIOServer } from 'socket.io'

export interface JwtPayload {
  sub: number // user id
  wallet: string // solana wallet address
  iat?: number
  exp?: number
}

declare module 'fastify' {
  interface FastifySchema {
    tags?: string[]
    summary?: string
    description?: string
    operationId?: string
    consumes?: string[]
    produces?: string[]
    security?: Array<Record<string, string[]>>
  }

  interface FastifyReply {
    json: (data?: object | string | number | boolean | null, status?: number, code?: string | null, message?: string | null) => void
  }

  interface FastifyInstance {
    io: SocketIOServer
  }

  interface FastifyRequest {
    user: JwtPayload
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload
    user: JwtPayload
  }
}
