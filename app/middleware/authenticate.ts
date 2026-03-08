import { FastifyReply, FastifyRequest } from 'fastify'
import AppException from '#app/exceptions/app_exception'
import ErrorCodes from '#app/exceptions/error_codes'

/**
 * Protect a route by verifying the Bearer JWT.
 * On success, `request.user` is populated with the decoded payload.
 *
 * Usage in a route:
 *   app.get('/protected', { preHandler: authenticate }, handler)
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify()
  } catch {
    throw new AppException(401, ErrorCodes.UNAUTHORIZED, 'Invalid or expired token')
  }
}

export default authenticate
