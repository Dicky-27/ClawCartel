import Fastify from 'fastify'
import routes from '#app/routes/index'
import AppConfig from '#app/config/app'
import FastifyUtil from '#app/utils/fastify'
import Logger from '#app/utils/logger'
import { registerSocket } from '#app/utils/socket'

const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'yyyy-mm-dd HH:MM:ss.l',
      },
    },
  },
  disableRequestLogging: true,
});

(async () => {
  try {
    FastifyUtil.setResponseLogger(fastify)
    FastifyUtil.decorateReply(fastify)
    FastifyUtil.setErrorHandler(fastify)
    FastifyUtil.setJsonParser(fastify)

    await FastifyUtil.registerHelmet(fastify)
    await FastifyUtil.registerCors(fastify)
    await FastifyUtil.registerRateLimit(fastify)
    await FastifyUtil.registerMultipart(fastify)

    await fastify.register(routes)
    await fastify.ready()

    registerSocket(fastify)

    const { host, port } = AppConfig.app
    await fastify.listen({ host, port })
  } catch (e) {
    Logger.error(e, 'Error starting server: ')
    process.exit(1)
  }
})()
