import { DoneFuncWithErrOrRes, FastifyInstance, FastifyPluginOptions } from 'fastify'
import AutonomousController from '#app/modules/agent/autonomous.controller'
import { StartRunBody } from '#app/modules/agent/agent.interface'

/**
 * Autonomous multi-agent discussion + code generation endpoints
 */
export default function (
  app: FastifyInstance,
  _: FastifyPluginOptions,
  done: DoneFuncWithErrOrRes
) {
  // Start autonomous multi-round discussion
  app.post<{ Body: StartRunBody }>(
    '/runs',
    {
      schema: {
        tags: ['Autonomous'],
        summary: 'Start discussion',
        description: 'Start a multi-round autonomous discussion about a project idea',
        body: {
          type: 'object',
          required: ['idea'],
          properties: {
            idea: { type: 'string', description: 'Project idea description' },
            source: { type: 'string', enum: ['chat', 'prd'], description: 'Input source type' },
            prdText: { type: 'string', description: 'PRD content if source is prd' },
          },
        },
        response: {
          202: {
            description: 'Run created successfully',
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              status: { type: 'string', enum: ['created', 'planning', 'executing', 'awaiting_approval', 'completed', 'failed', 'cancelled'] },
              inputType: { type: 'string', enum: ['chat', 'prd'] },
              inputText: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          503: {
            description: 'Gateway unavailable',
            type: 'object',
            properties: {
              status: { type: 'number' },
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    AutonomousController.startRun
  )

  // Get run status
  app.get(
    '/runs/:runId',
    {
      schema: {
        tags: ['Autonomous'],
        summary: 'Get run status',
        description: 'Get current status of a run',
        params: {
          type: 'object',
          required: ['runId'],
          properties: {
            runId: { type: 'string', format: 'uuid', description: 'Run ID' },
          },
        },
        response: {
          200: {
            description: 'Run details',
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              status: { type: 'string' },
              inputType: { type: 'string' },
              inputText: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          404: {
            description: 'Run not found',
            type: 'object',
            properties: {
              status: { type: 'number' },
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    AutonomousController.getRun
  )

  // Continue to development phase (CODE GENERATION)
  app.post(
    '/runs/:runId/continue',
    {
      schema: {
        tags: ['Autonomous'],
        summary: 'Continue to development',
        description: 'Approve and start code generation phase',
        params: {
          type: 'object',
          required: ['runId'],
          properties: {
            runId: { type: 'string', format: 'uuid', description: 'Run ID' },
          },
        },
        body: {
          type: 'object',
          required: ['approved'],
          properties: {
            approved: { type: 'boolean', description: 'Whether to approve and continue' },
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
          404: {
            description: 'Run not found',
            type: 'object',
            properties: {
              status: { type: 'number' },
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    AutonomousController.continueToDevelopment
  )

  // List project files
  app.get(
    '/runs/:runId/files',
    {
      schema: {
        tags: ['Autonomous'],
        summary: 'List project files',
        description: 'List all generated files for a run',
        params: {
          type: 'object',
          required: ['runId'],
          properties: {
            runId: { type: 'string', format: 'uuid', description: 'Run ID' },
          },
        },
        response: {
          200: {
            description: 'File list',
            type: 'object',
            properties: {
              runId: { type: 'string' },
              files: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    type: { type: 'string', enum: ['file', 'directory'] },
                    path: { type: 'string' },
                    size: { type: 'number' },
                    children: { type: 'array' },
                  },
                },
              },
              stats: {
                type: 'object',
                properties: {
                  totalFiles: { type: 'number' },
                  totalSize: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    AutonomousController.getFiles
  )

  // Get file content
  app.get(
    '/runs/:runId/files/*',
    {
      schema: {
        tags: ['Autonomous'],
        summary: 'Get file content',
        description: 'View content of a specific file',
        params: {
          type: 'object',
          required: ['runId'],
          properties: {
            runId: { type: 'string', format: 'uuid', description: 'Run ID' },
            '*': { type: 'string', description: 'File path' },
          },
        },
        response: {
          200: {
            description: 'File content',
            type: 'object',
            properties: {
              runId: { type: 'string' },
              filePath: { type: 'string' },
              content: { type: 'string' },
            },
          },
          404: {
            description: 'File not found',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    AutonomousController.getFileContent
  )

  // Download project as zip
  app.get(
    '/runs/:runId/download',
    {
      schema: {
        tags: ['Autonomous'],
        summary: 'Download project',
        description: 'Download all generated files as a ZIP archive',
        params: {
          type: 'object',
          required: ['runId'],
          properties: {
            runId: { type: 'string', format: 'uuid', description: 'Run ID' },
          },
        },
        produces: ['application/zip'],
        response: {
          200: {
            description: 'ZIP file',
            type: 'string',
            format: 'binary',
          },
          500: {
            description: 'Failed to create zip',
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    AutonomousController.downloadProject
  )

  done()
}
