const RunSchema = {
  // Run schemas
  listRuns: {
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', minimum: 1, default: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
        status: {
          type: 'string',
          enum: ['created', 'planning', 'executing', 'awaiting_approval', 'completed', 'failed']
        },
        inputType: { type: 'string', enum: ['chat', 'prd'] },
      },
    },
  },

  getRun: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid' },
      },
    },
  },

  createRun: {
    body: {
      type: 'object',
      required: ['inputType', 'inputText'],
      properties: {
        inputType: { type: 'string', enum: ['chat', 'prd'] },
        inputText: { type: 'string', minLength: 1 },
        status: {
          type: 'string',
          enum: ['created', 'planning', 'executing', 'awaiting_approval', 'completed', 'failed'],
          default: 'created'
        },
      },
    },
  },

  updateRun: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid' },
      },
    },
    body: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['created', 'planning', 'executing', 'awaiting_approval', 'completed', 'failed']
        },
        inputText: { type: 'string' },
      },
    },
  },

  deleteRun: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid' },
      },
    },
  },

  // Agent Run schemas
  listAgentRuns: {
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', minimum: 1, default: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
        runId: { type: 'string', format: 'uuid' },
        role: { type: 'string', enum: ['pm', 'fe', 'be_sc', 'marketing'] },
        status: { type: 'string', enum: ['queued', 'running', 'completed', 'failed'] },
        agentId: { type: 'string' },
      },
    },
  },

  getAgentRun: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid' },
      },
    },
  },

  createAgentRun: {
    body: {
      type: 'object',
      required: ['runId', 'role', 'agentId'],
      properties: {
        runId: { type: 'string', format: 'uuid' },
        role: { type: 'string', enum: ['pm', 'fe', 'be_sc', 'marketing'] },
        agentId: { type: 'string', minLength: 1 },
        sessionKey: { type: 'string' },
        status: {
          type: 'string',
          enum: ['queued', 'running', 'completed', 'failed'],
          default: 'queued'
        },
      },
    },
  },

  updateAgentRun: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid' },
      },
    },
    body: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['queued', 'running', 'completed', 'failed'] },
        sessionKey: { type: 'string' },
        startedAt: { type: 'string', format: 'date-time' },
        endedAt: { type: 'string', format: 'date-time' },
      },
    },
  },

  deleteAgentRun: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid' },
      },
    },
  },

  // Agent Event schemas
  listAgentEvents: {
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', minimum: 1, default: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
        runId: { type: 'string', format: 'uuid' },
        agentRunId: { type: 'string', format: 'uuid' },
        eventType: {
          type: 'string',
          enum: ['agent.started', 'agent.delta', 'agent.done', 'agent.error', 'run.done']
        },
      },
    },
  },

  getAgentEvent: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid' },
      },
    },
  },

  createAgentEvent: {
    body: {
      type: 'object',
      required: ['runId', 'agentRunId', 'seq', 'eventType', 'payload'],
      properties: {
        runId: { type: 'string', format: 'uuid' },
        agentRunId: { type: 'string', format: 'uuid' },
        seq: { type: 'integer', minimum: 1 },
        eventType: {
          type: 'string',
          enum: ['agent.started', 'agent.delta', 'agent.done', 'agent.error', 'run.done']
        },
        payload: { type: 'object' },
      },
    },
  },

  deleteAgentEvent: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid' },
      },
    },
  },

  // Replay events for a run
  replayEvents: {
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
        fromSeq: { type: 'integer', minimum: 1 },
        toSeq: { type: 'integer', minimum: 1 },
        eventType: {
          type: 'string',
          enum: ['agent.started', 'agent.delta', 'agent.done', 'agent.error', 'run.done']
        },
      },
    },
  },
}

export default RunSchema
