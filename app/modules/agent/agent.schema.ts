const AgentSchema = {
  startRun: {
    body: {
      type: 'object',
      properties: {
        idea: { type: 'string' },
        prdText: { type: 'string' },
        source: { type: 'string', enum: ['chat', 'prd'] },
      },
    },
  },
  runParams: {
    params: {
      type: 'object',
      required: ['runId'],
      properties: {
        runId: { type: 'string' },
      },
    },
  },
}

export default AgentSchema
