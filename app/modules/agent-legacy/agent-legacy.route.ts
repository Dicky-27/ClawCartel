/**
 * Legacy Agent Routes (Orchestrated Mode)
 */

import { DoneFuncWithErrOrRes, FastifyInstance, FastifyPluginOptions } from 'fastify'
import LegacyAgentController from '#app/modules/agent-legacy/agent-legacy.controller'
import { StartRunBody } from '#app/modules/agent-core/agent-core.interface'

export default function (
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: DoneFuncWithErrOrRes
) {
  // Health check
  app.get('/health', {
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
  }, LegacyAgentController.health)

  // Start a new run
  app.post<{ Body: StartRunBody }>('/runs', {
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
  }, LegacyAgentController.startRun)

  app.get<{ Params: { runId: string } }>('/runs/:runId', {
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
    },
  }, LegacyAgentController.getRun)

  app.get<{ Params: { runId: string } }>('/runs/:runId/events', {
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
    },
  }, LegacyAgentController.getEvents)

  // Continue to development phase
  app.post<{
    Params: { runId: string };
    Body: { approved: boolean }
  }>('/runs/:runId/continue', {
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
    },
  }, LegacyAgentController.continueToDevelopment)

  done()
}
