import AppException from '#app/exceptions/app_exception'
import ErrorCodes from '#app/exceptions/error_codes'
import fastifyCors from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import fastifyMultipart from '@fastify/multipart'
import fastifyRateLimit from '@fastify/rate-limit'
import {
  DoneFuncWithErrOrRes,
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify'
import { ContentTypeParserDoneFunction } from 'fastify/types/content-type-parser.js'
import AppConfig from '#app/config/app'
import Logger from '#app/utils/logger'

const FastifyUtil = {
  setResponseLogger: (app: FastifyInstance) => {
    app.addHook(
      'onResponse',
      (
        request: FastifyRequest,
        reply: FastifyReply,
        done: DoneFuncWithErrOrRes
      ) => {
        const message = `[${reply.statusCode}] ${request.method} ${request.url} - ${request.ip}`

        if (reply.statusCode < 300) {
          request.server.log.info(message)
        } else {
          request.server.log.warn(message)
          if (request.method === 'POST' || request.method === 'PUT') {
            request.server.log.warn(
              FastifyUtil.sanitizeBody(request.body),
              'REQUEST BODY :'
            )
          }
        }

        done()
      }
    )
  },

  decorateReply: (app: FastifyInstance) => {
    return app.decorateReply(
      'json',
      function (
        this: FastifyReply,
        data: object | string | number | boolean | null = null,
        status = 200,
        message: string | null = null
      ) {
        const isSuccess = status >= 200 && status < 300

        this.status(status).send({
          status,
          success: isSuccess,
          message,
          data: isSuccess ? data : null,
          error: !isSuccess ? { code: 'ERROR', message: String(data) } : undefined,
          meta: {
            timestamp: new Date().toISOString(),
          },
        })
      }
    )
  },

  setErrorHandler: (app: FastifyInstance) => {
    return app.setErrorHandler(function (
      error: FastifyError,
      request: FastifyRequest,
      reply: FastifyReply
    ) {
      // Use standardized response format
      const status = error.statusCode || 500
      const code = (error as any).code || 'SYSTEM_ERROR'
      const message = error.message || 'An error occurred on the system'

      return reply.status(status).send({
        status,
        success: false,
        error: {
          code,
          message,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      })
    })
  },

  setJsonParser: (app: FastifyInstance) => {
    return app.addContentTypeParser(
      'application/json',
      { parseAs: 'string' },
      function (
        request: FastifyRequest,
        body: string | Buffer<ArrayBufferLike>,
        done: ContentTypeParserDoneFunction
      ) {
        try {
          const json = JSON.parse(body as string)
          done(null, json)
        } catch (_) {
          const err = new AppException(
            400,
            ErrorCodes.PARSING_ERROR,
            'Error while parsing JSON request body'
          )
          done(err, null)
        }
      }
    )
  },

  registerHelmet: (app: FastifyInstance) => {
    return app.register(fastifyHelmet, {
      global: true,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ['\'self\''],
          scriptSrc: ['\'self\'', '\'unsafe-inline\''],
          styleSrc: ['\'self\'', '\'unsafe-inline\''],
          imgSrc: ['\'self\'', 'data:', 'https:'],
          connectSrc: ['\'self\''],
          fontSrc: ['\'self\''],
          objectSrc: ['\'none\''],
          mediaSrc: ['\'self\''],
          frameSrc: ['\'none\''],
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })
  },

  registerCors: (app: FastifyInstance) => {
    return app.register(fastifyCors, {
      origin: '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  },

  registerRateLimit: async (app: FastifyInstance) => {
    await app.register(fastifyRateLimit, {
      global: false,
    })
  },

  registerMultipart: (app: FastifyInstance) => {
    return app.register(fastifyMultipart, {
      attachFieldsToBody: 'keyValues',
      limits: {
        fileSize: 4096000,
      },
    })
  },

  sanitizeBody: (body: unknown): unknown => {
    if (!body || typeof body !== 'object') return body
    const SENSITIVE_KEYS = ['password', 'otp', 'token', 'secret', 'pin']
    const sanitized = { ...(body as Record<string, unknown>) }
    for (const key of SENSITIVE_KEYS) {
      if (key in sanitized) sanitized[key] = '[REDACTED]'
    }

    return sanitized
  },

  setGracefulShutdown: (
    app: FastifyInstance,
    options?: {
      timeoutMs?: number
    }
  ) => {
    const timeoutMs =
      options?.timeoutMs ?? AppConfig.app.gracefulShutdownTimeoutMs

    const shutdown = (signal: string) => {
      Logger.info(
        { signal },
        'Received signal, starting graceful shutdown (draining in-flight requests e.g. webhooks)'
      )
      let closed = false

      app
        .close()
        .then(() => {
          closed = true
          Logger.info('Graceful shutdown complete')
          process.exit(0)
        })
        .catch(err => {
          closed = true
          Logger.error({ err }, 'Error during graceful shutdown')
          process.exit(1)
        })

      setTimeout(() => {
        if (!closed) {
          Logger.warn('Graceful shutdown timeout reached, forcing exit')
          process.exit(1)
        }
      }, timeoutMs)
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))
  },
}

export default FastifyUtil
