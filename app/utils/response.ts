import { FastifyReply } from 'fastify'

/**
 * Clean API Response Utilities
 *
 * response format:
 * Success: { status, success, data }
 * Error:   { status, success, error }
 */

export interface ApiError {
  code: string
  message: string
}

export class ResponseUtil {
  /**
   * Success response (2xx)
   */
  static success<T>(reply: FastifyReply, data: T, statusCode = 200): FastifyReply {
    return reply.status(statusCode).send({
      status: statusCode,
      success: true,
      data,
    })
  }

  /**
   * Created response (201)
   */
  static created<T>(reply: FastifyReply, data: T): FastifyReply {
    return this.success(reply, data, 201)
  }

  /**
   * Accepted response (202)
   */
  static accepted<T>(reply: FastifyReply, data: T): FastifyReply {
    return this.success(reply, data, 202)
  }

  /**
   * No content response (204)
   */
  static noContent(reply: FastifyReply): FastifyReply {
    return reply.status(204).send()
  }

  /**
   * Error response (4xx, 5xx)
   */
  static error(
    reply: FastifyReply,
    statusCode: number,
    code: string,
    message: string
  ): FastifyReply {
    return reply.status(statusCode).send({
      status: statusCode,
      success: false,
      error: {
        code,
        message,
      },
    })
  }

  /**
   * Bad Request (400)
   */
  static badRequest(reply: FastifyReply, message: string, code = 'BAD_REQUEST'): FastifyReply {
    return this.error(reply, 400, code, message)
  }

  /**
   * Unauthorized (401)
   */
  static unauthorized(reply: FastifyReply, message = 'Unauthorized'): FastifyReply {
    return this.error(reply, 401, 'UNAUTHORIZED', message)
  }

  /**
   * Not Found (404)
   */
  static notFound(reply: FastifyReply, resource = 'Resource'): FastifyReply {
    return this.error(reply, 404, 'NOT_FOUND', `${resource} not found`)
  }

  /**
   * Internal Server Error (500)
   */
  static internalError(reply: FastifyReply, message = 'Internal server error'): FastifyReply {
    return this.error(reply, 500, 'INTERNAL_ERROR', message)
  }

  /**
   * Service Unavailable (503)
   */
  static serviceUnavailable(reply: FastifyReply, message = 'Service unavailable'): FastifyReply {
    return this.error(reply, 503, 'SERVICE_UNAVAILABLE', message)
  }
}

export default ResponseUtil
