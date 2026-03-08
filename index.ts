import '#app/config/env'
import Fastify from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import routes from '#app/routes/index'
import AppConfig from '#app/config/app'
import FastifyUtil from '#app/utils/fastify'
import Logger from '#app/utils/logger'
import { registerSocket } from '#app/utils/socket'
import agentLoader from '#app/agents/agent-loader'

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
    await fastify.register(fastifyJwt, {
      secret: {
        private: AppConfig.jwt.privateKey,
        public: AppConfig.jwt.publicKey,
      },
      sign: { algorithm: 'RS256' },
    })

    // Swagger documentation
    const { url: appUrl } = AppConfig.app
    const servers: Array<{ url: string; description: string }> = [
      { url: 'http://localhost:3000', description: 'Local development' },
      { url: appUrl, description: 'Dev server (current URL)' },
    ]
    await fastify.register(fastifySwagger, {
      openapi: {
        info: {
          title: 'ClawCartel API',
          description: 'AI Agent Squad - Autonomous Discussion & Code Generation',
          version: '1.0.0',
        },
        servers,
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
              description: 'Paste your access token as: Bearer <token>',
            },
          },
        },
        tags: [
          { name: 'Autonomous', description: 'Autonomous multi-agent discussion & code generation' },
          { name: 'Agent', description: 'Legacy agent endpoints' },
          { name: 'Solana Deploy', description: 'Solana program deployment APIs' },
          { name: 'Auth', description: 'Authentication' },
          { name: 'User', description: 'User management' },
          { name: 'Run', description: 'Run management' },
          { name: 'Upload', description: 'File upload and CDN' },
        ],
      },
    })
    await fastify.register(fastifySwaggerUi, {
      routePrefix: '/documentation',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
        persistAuthorization: true,
      },
    })

    // Load agent identity files from agents/ directory
    await agentLoader.loadAll()

    // Register tool handlers for the skill system
    const { initializeSkills } = await import('#app/agents/skills/index')
    await initializeSkills()

    await fastify.register(routes)

    registerSocket(fastify)

    await fastify.ready()

    const { host, port } = AppConfig.app
    await fastify.listen({ host, port })
  } catch (e) {
    Logger.error(e, 'Error starting server: ')
    process.exit(1)
  }
})()
