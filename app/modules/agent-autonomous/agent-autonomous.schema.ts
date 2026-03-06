const runStatusEnum = [
  'created',
  'planning',
  'executing',
  'awaiting_approval',
  'completed',
  'failed',
  'cancelled',
]

const inputTypeEnum = ['chat', 'prd']
const roleEnum = ['pm', 'fe', 'be_sc', 'bd_research']

const runParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['runId'],
  properties: {
    runId: {
      type: 'string',
      format: 'uuid',
      description: 'Run ID',
    },
  },
}

const fileContentQuerySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['path'],
  properties: {
    path: {
      type: 'string',
      description: 'File path inside the generated project',
    },
  },
}

const runDataSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'status', 'inputType', 'inputText', 'createdAt', 'updatedAt'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    status: { type: 'string', enum: runStatusEnum },
    inputType: { type: 'string', enum: inputTypeEnum },
    inputText: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
}

const successEnvelopeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'success', 'data'],
  properties: {
    status: { type: 'number' },
    success: { type: 'boolean' },
    data: { type: 'object' },
  },
}

const errorEnvelopeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'success', 'error'],
  properties: {
    status: { type: 'number' },
    success: { type: 'boolean' },
    error: {
      type: 'object',
      additionalProperties: false,
      required: ['code', 'message'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
}

const statsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    totalFiles: { type: 'number' },
    totalSize: { type: 'number' },
    byAgent: {
      type: 'object',
      additionalProperties: { type: 'number' },
    },
  },
}

const fileNodeSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    type: { type: 'string', enum: ['file', 'directory'] },
    path: { type: 'string' },
    size: { type: 'number' },
    children: {
      type: 'array',
      items: { type: 'object' },
    },
  },
}

const agentCatalogItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'agentName', 'description', 'skills', 'role'],
  properties: {
    id: { type: 'integer', description: 'Stable numeric agent identifier' },
    agentName: { type: 'string', description: 'Agent display name' },
    description: { type: 'string', description: 'Short agent responsibility summary' },
    skills: {
      type: 'array',
      description: 'Agent capabilities',
      items: { type: 'string' },
    },
    role: { type: 'string', enum: roleEnum },
  },
}

const startRunBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    idea: {
      type: 'string',
      minLength: 1,
      description: 'Project idea description',
    },
    source: {
      type: 'string',
      enum: inputTypeEnum,
      description: 'Input source type',
    },
    prdText: {
      type: 'string',
      minLength: 1,
      description: 'PRD content if source is prd',
    },
  },
  anyOf: [
    { required: ['idea'] },
    { required: ['prdText'] },
  ],
}

const unauthorizedErrorResponse = {
  ...errorEnvelopeSchema,
  description: 'Unauthorized',
  properties: {
    ...errorEnvelopeSchema.properties,
    status: { type: 'number', example: 401 },
    success: { type: 'boolean', example: false },
    error: {
      type: 'object',
      additionalProperties: false,
      required: ['code', 'message'],
      properties: {
        code: { type: 'string', example: 'UNAUTHORIZED' },
        message: { type: 'string', example: 'Invalid or expired token' },
      },
    },
  },
}

const sessionConflictErrorResponse = {
  ...errorEnvelopeSchema,
  description: 'Session run is busy',
  properties: {
    ...errorEnvelopeSchema.properties,
    status: { type: 'number', example: 409 },
    success: { type: 'boolean', example: false },
    error: {
      type: 'object',
      additionalProperties: false,
      required: ['code', 'message'],
      properties: {
        code: { type: 'string', example: 'BAD_REQUEST' },
        message: {
          type: 'string',
          example: 'Your session run is still executing. Please wait for completion.',
        },
      },
    },
  },
}

const AutonomousSchema = {
  listAgents: {
    tags: ['Autonomous'],
    summary: 'List available agents',
    description: 'Return the available agent roster for frontend identity mapping.',
    response: {
      200: {
        ...successEnvelopeSchema,
        description: 'Agent list',
        properties: {
          ...successEnvelopeSchema.properties,
          status: { type: 'number', example: 200 },
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            additionalProperties: false,
            required: ['agents'],
            properties: {
              agents: {
                type: 'array',
                items: agentCatalogItemSchema,
              },
            },
          },
        },
      },
    },
  },

  startRun: {
    tags: ['Autonomous'],
    summary: 'Start discussion',
    description: 'Start a multi-round autonomous discussion. Reuses SIWS thread runId when available.',
    body: startRunBodySchema,
    response: {
      202: {
        ...successEnvelopeSchema,
        description: 'Run created successfully',
        properties: {
          ...successEnvelopeSchema.properties,
          status: { type: 'number', example: 202 },
          success: { type: 'boolean', example: true },
          data: runDataSchema,
        },
      },
      401: unauthorizedErrorResponse,
      409: sessionConflictErrorResponse,
      503: {
        ...errorEnvelopeSchema,
        description: 'Gateway unavailable',
        properties: {
          ...errorEnvelopeSchema.properties,
          status: { type: 'number', example: 503 },
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            additionalProperties: false,
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'SERVICE_UNAVAILABLE' },
              message: { type: 'string', example: 'OpenClaw gateway unreachable' },
            },
          },
        },
      },
    },
  },

  startNewThread: {
    tags: ['Autonomous'],
    summary: 'Start new thread',
    description:
      'Force-create a fresh autonomous thread and return a new runId for a new socket room.',
    body: startRunBodySchema,
    response: {
      202: {
        ...successEnvelopeSchema,
        description: 'New thread created successfully',
        properties: {
          ...successEnvelopeSchema.properties,
          status: { type: 'number', example: 202 },
          success: { type: 'boolean', example: true },
          data: runDataSchema,
        },
      },
      401: unauthorizedErrorResponse,
      503: {
        ...errorEnvelopeSchema,
        description: 'Gateway unavailable',
        properties: {
          ...errorEnvelopeSchema.properties,
          status: { type: 'number', example: 503 },
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            additionalProperties: false,
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'SERVICE_UNAVAILABLE' },
              message: { type: 'string', example: 'OpenClaw gateway unreachable' },
            },
          },
        },
      },
    },
  },

  getRun: {
    tags: ['Autonomous'],
    summary: 'Get run status',
    description: 'Get current status of a run',
    params: runParamsSchema,
    response: {
      200: {
        ...successEnvelopeSchema,
        description: 'Run details',
        properties: {
          ...successEnvelopeSchema.properties,
          status: { type: 'number', example: 200 },
          success: { type: 'boolean', example: true },
          data: runDataSchema,
        },
      },
      404: {
        ...errorEnvelopeSchema,
        description: 'Run not found',
        properties: {
          ...errorEnvelopeSchema.properties,
          status: { type: 'number', example: 404 },
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            additionalProperties: false,
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'NOT_FOUND' },
              message: { type: 'string', example: 'Run not found' },
            },
          },
        },
      },
    },
  },

  continueToDevelopment: {
    tags: ['Autonomous'],
    summary: 'Continue to development',
    description: 'Approve and start the code generation phase',
    params: runParamsSchema,
    body: {
      type: 'object',
      additionalProperties: false,
      required: ['approved'],
      properties: {
        approved: {
          type: 'boolean',
          description: 'Whether to approve and continue',
        },
      },
    },
    response: {
      200: {
        ...successEnvelopeSchema,
        description: 'Approval resolved',
        properties: {
          ...successEnvelopeSchema.properties,
          status: { type: 'number', example: 200 },
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            additionalProperties: false,
            required: ['runId', 'action'],
            properties: {
              runId: { type: 'string', format: 'uuid' },
              action: {
                type: 'string',
                enum: ['development_started', 'cancelled'],
              },
            },
          },
        },
      },
      404: {
        ...errorEnvelopeSchema,
        description: 'Run not found',
        properties: {
          ...errorEnvelopeSchema.properties,
          status: { type: 'number', example: 404 },
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            additionalProperties: false,
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'NOT_FOUND' },
              message: { type: 'string', example: 'Run not found' },
            },
          },
        },
      },
    },
  },

  getFiles: {
    tags: ['Autonomous'],
    summary: 'List project files',
    description: 'List all generated files for a run',
    params: runParamsSchema,
    response: {
      200: {
        ...successEnvelopeSchema,
        description: 'File list',
        properties: {
          ...successEnvelopeSchema.properties,
          status: { type: 'number', example: 200 },
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            additionalProperties: false,
            required: ['runId', 'files', 'stats'],
            properties: {
              runId: { type: 'string', format: 'uuid' },
              files: {
                type: 'array',
                items: fileNodeSchema,
              },
              stats: statsSchema,
            },
          },
        },
      },
      500: {
        ...errorEnvelopeSchema,
        description: 'Failed to list files',
        properties: {
          ...errorEnvelopeSchema.properties,
          status: { type: 'number', example: 500 },
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            additionalProperties: false,
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'INTERNAL_ERROR' },
              message: { type: 'string', example: 'Failed to list files' },
            },
          },
        },
      },
    },
  },

  getFileContent: {
    tags: ['Autonomous'],
    summary: 'Get file content',
    description: 'View content of a specific file',
    params: runParamsSchema,
    querystring: fileContentQuerySchema,
    response: {
      200: {
        ...successEnvelopeSchema,
        description: 'File content',
        properties: {
          ...successEnvelopeSchema.properties,
          status: { type: 'number', example: 200 },
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            additionalProperties: false,
            required: ['runId', 'filePath', 'content'],
            properties: {
              runId: { type: 'string', format: 'uuid' },
              filePath: { type: 'string' },
              content: { type: 'string' },
            },
          },
        },
      },
      404: {
        ...errorEnvelopeSchema,
        description: 'File not found',
        properties: {
          ...errorEnvelopeSchema.properties,
          status: { type: 'number', example: 404 },
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            additionalProperties: false,
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'NOT_FOUND' },
              message: { type: 'string', example: 'File not found' },
            },
          },
        },
      },
    },
  },

  downloadProject: {
    tags: ['Autonomous'],
    summary: 'Download project',
    description: 'Download all generated files as a ZIP archive',
    params: runParamsSchema,
    produces: ['application/zip'],
    response: {
      200: {
        description: 'ZIP file',
        type: 'string',
        format: 'binary',
      },
      500: {
        ...errorEnvelopeSchema,
        description: 'Failed to create zip',
        properties: {
          ...errorEnvelopeSchema.properties,
          status: { type: 'number', example: 500 },
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            additionalProperties: false,
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'INTERNAL_ERROR' },
              message: { type: 'string', example: 'Failed to create zip' },
            },
          },
        },
      },
    },
  },
}

export default AutonomousSchema
