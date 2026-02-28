import { DoneFuncWithErrOrRes, FastifyInstance, FastifyPluginOptions } from 'fastify'
import AgentController from '#app/modules/agent/agent.controller'
import { RunParams, StartRunBody } from '#app/modules/agent/agent.interface'

export default function (
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: DoneFuncWithErrOrRes
) {
  // Health check
  app.get(
    '/health',
    {
      schema: {
        tags: ['Agent'],
        summary: 'Health check',
        description: 'Check API and gateway health status',
        response: {
          200: {
            description: 'Healthy',
            type: 'object',
            properties: {
              status: { type: 'string', example: 'ok' },
              gateway: { type: 'string', example: 'connected' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
          503: {
            description: 'Degraded',
            type: 'object',
            properties: {
              status: { type: 'string' },
              gateway: { type: 'string' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
    AgentController.health
  )

  // Start a new run
  app.post<{ Body: StartRunBody }>(
    '/runs',
    {
      schema: {
        tags: ['Agent'],
        summary: 'Start agent run (legacy)',
        description: 'Start a new agent run (legacy orchestrated mode)',
        body: {
          type: 'object',
          properties: {
            idea: { type: 'string' },
            prdText: { type: 'string' },
            source: { type: 'string', enum: ['chat', 'prd'] },
          },
        },
        response: {
          202: {
            description: 'Run started',
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              status: { type: 'string' },
            },
          },
        },
      },
    },
    AgentController.startRun
  )

  app.get<{ Params: RunParams }>(
    '/runs/:runId',
    {
      schema: {
        tags: ['Agent'],
        summary: 'Get run',
        description: 'Get run details by ID',
        params: {
          type: 'object',
          required: ['runId'],
          properties: {
            runId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            description: 'Run details',
            type: 'object',
          },
        },
      },
    },
    AgentController.getRun
  )

  app.get<{ Params: RunParams }>(
    '/runs/:runId/events',
    {
      schema: {
        tags: ['Agent'],
        summary: 'Get events',
        description: 'Get events for a run',
        params: {
          type: 'object',
          required: ['runId'],
          properties: {
            runId: { type: 'string', format: 'uuid' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            fromSeq: { type: 'integer', description: 'Starting sequence number' },
          },
        },
        response: {
          200: {
            description: 'Events list',
            type: 'object',
          },
        },
      },
    },
    AgentController.getEvents
  )

  // Continue to development phase
  app.post<{
    Params: RunParams;
    Body: { approved: boolean }
  }>(
    '/runs/:runId/continue',
    {
      schema: {
        tags: ['Agent'],
        summary: 'Continue to development (legacy)',
        description: 'Continue run to development phase',
        params: {
          type: 'object',
          required: ['runId'],
          properties: {
            runId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            approved: { type: 'boolean' },
          },
        },
        response: {
          200: {
            description: 'Success',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              runId: { type: 'string' },
            },
          },
        },
      },
    },
    AgentController.continueToDevelopment
  )

  done()
}
