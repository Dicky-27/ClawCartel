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
const modeEnum = ['single', 'squad']
const roleEnum = ['pm', 'fe', 'be_sc', 'bd_research']
const agentRunStatusEnum = ['queued', 'running', 'completed', 'failed']
const eventTypeEnum = ['agent.started', 'agent.delta', 'agent.done', 'agent.error', 'run.done']

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

const eventsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    fromSeq: {
      type: 'integer',
      minimum: 1,
      description: 'Replay events starting from this sequence number',
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

const agentRunSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'runId', 'role', 'agentId', 'status'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    runId: { type: 'string', format: 'uuid' },
    role: { type: 'string', enum: roleEnum },
    agentId: { type: 'string' },
    sessionKey: { type: ['string', 'null'] },
    status: { type: 'string', enum: agentRunStatusEnum },
    startedAt: { type: ['string', 'null'], format: 'date-time' },
    endedAt: { type: ['string', 'null'], format: 'date-time' },
  },
}

const replayEventSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['seq', 'eventType', 'payload', 'role', 'agentId', 'createdAt'],
  properties: {
    seq: { type: 'string' },
    eventType: { type: 'string', enum: eventTypeEnum },
    payload: {
      type: 'object',
      additionalProperties: true,
    },
    role: { type: 'string', enum: roleEnum },
    agentRole: { type: 'string', enum: roleEnum },
    agentId: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
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

const LegacyAgentSchema = {
  listAgents: {
    tags: ['Agent'],
    summary: 'List available agents',
    description: 'Return the available legacy agent roster for frontend identity mapping.',
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

  health: {
    tags: ['Agent'],
    summary: 'Health check',
    description: 'Check API and gateway health status',
    response: {
      200: {
        ...successEnvelopeSchema,
        description: 'Healthy',
        properties: {
          ...successEnvelopeSchema.properties,
          status: { type: 'number', example: 200 },
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            additionalProperties: false,
            required: ['status', 'gateway', 'timestamp'],
            properties: {
              status: { type: 'string', example: 'ok' },
              gateway: { type: 'string', example: 'connected' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
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

  startRun: {
    tags: ['Agent'],
    summary: 'Start agent run (legacy)',
    description: 'Start a new agent run in legacy orchestrated mode',
    body: {
      type: 'object',
      additionalProperties: false,
      properties: {
        idea: { type: 'string', minLength: 1 },
        prdText: { type: 'string', minLength: 1 },
        source: { type: 'string', enum: inputTypeEnum },
        mode: { type: 'string', enum: modeEnum },
      },
      anyOf: [
        { required: ['idea'] },
        { required: ['prdText'] },
      ],
    },
    response: {
      202: {
        ...successEnvelopeSchema,
        description: 'Run started',
        properties: {
          ...successEnvelopeSchema.properties,
          status: { type: 'number', example: 202 },
          success: { type: 'boolean', example: true },
          data: runDataSchema,
        },
      },
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
    tags: ['Agent'],
    summary: 'Get run',
    description: 'Get legacy run details by ID',
    params: runParamsSchema,
    response: {
      200: {
        ...successEnvelopeSchema,
        description: 'Run details',
        properties: {
          ...successEnvelopeSchema.properties,
          status: { type: 'number', example: 200 },
          success: { type: 'boolean', example: true },
          data: {
            ...runDataSchema,
            required: [...runDataSchema.required, 'agentRuns'],
            properties: {
              ...runDataSchema.properties,
              agentRuns: {
                type: 'array',
                items: agentRunSchema,
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

  getEvents: {
    tags: ['Agent'],
    summary: 'Get events',
    description: 'Replay events for a legacy run',
    params: runParamsSchema,
    querystring: eventsQuerySchema,
    response: {
      200: {
        ...successEnvelopeSchema,
        description: 'Run events',
        properties: {
          ...successEnvelopeSchema.properties,
          status: { type: 'number', example: 200 },
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            additionalProperties: false,
            required: ['runId', 'totalEvents', 'events'],
            properties: {
              runId: { type: 'string', format: 'uuid' },
              totalEvents: { type: 'number' },
              events: {
                type: 'array',
                items: replayEventSchema,
              },
            },
          },
        },
      },
    },
  },

  continueToDevelopment: {
    tags: ['Agent'],
    summary: 'Continue to development (legacy)',
    description: 'Continue a legacy run into the development phase',
    params: runParamsSchema,
    body: {
      type: 'object',
      additionalProperties: false,
      required: ['approved'],
      properties: {
        approved: { type: 'boolean' },
      },
    },
    response: {
      200: {
        ...successEnvelopeSchema,
        description: 'Development phase started or cancelled',
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
    },
  },
}

export default LegacyAgentSchema
