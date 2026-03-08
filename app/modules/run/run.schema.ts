const RunSchema = {
  // Run schemas
  listRuns: {
    tags: ['Run'],
    summary: 'List runs',
    description: 'List runs with optional filters and pagination',
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
    tags: ['Run'],
    summary: 'Get run',
    description: 'Get run by ID',
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid' },
      },
    },
  },

  createRun: {
    tags: ['Run'],
    summary: 'Create run',
    description: 'Create a new run',
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
    tags: ['Run'],
    summary: 'Update run',
    description: 'Update run status or input',
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
    tags: ['Run'],
    summary: 'Delete run',
    description: 'Delete run by ID',
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
    tags: ['Run'],
    summary: 'List agent runs',
    description: 'List agent runs with optional filters',
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
    tags: ['Run'],
    summary: 'Get agent run',
    description: 'Get agent run by ID',
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid' },
      },
    },
  },

  createAgentRun: {
    tags: ['Run'],
    summary: 'Create agent run',
    description: 'Create a new agent run',
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
    tags: ['Run'],
    summary: 'Update agent run',
    description: 'Update agent run status',
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
    tags: ['Run'],
    summary: 'Delete agent run',
    description: 'Delete agent run by ID',
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
    tags: ['Run'],
    summary: 'List agent events',
    description: 'List agent events with optional filters',
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
    tags: ['Run'],
    summary: 'Get agent event',
    description: 'Get agent event by ID',
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid' },
      },
    },
  },

  createAgentEvent: {
    tags: ['Run'],
    summary: 'Create agent event',
    description: 'Create a new agent event',
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
    tags: ['Run'],
    summary: 'Delete agent event',
    description: 'Delete agent event by ID',
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid' },
      },
    },
  },

  getNextSeq: {
    tags: ['Run'],
    summary: 'Get next event sequence',
    description: 'Get next sequence number for a run',
    params: {
      type: 'object',
      required: ['runId'],
      properties: {
        runId: { type: 'string', format: 'uuid' },
      },
    },
  },

  // Replay events for a run
  replayEvents: {
    tags: ['Run'],
    summary: 'Replay run events',
    description: 'Replay agent events for a run with optional filters',
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
