const deployTxSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['txIndex', 'kind', 'txBase64', 'status'],
  properties: {
    txIndex: { type: 'integer', minimum: 0 },
    kind: { type: 'string', enum: ['create_buffer', 'write_chunk', 'deploy_program'] },
    txBase64: { type: 'string' },
    status: { type: 'string', enum: ['pending', 'sent', 'confirmed', 'failed'] },
    signature: { type: 'string', nullable: true },
    slot: { type: 'integer', nullable: true },
    error: { type: 'string', nullable: true },
  },
}

const deploymentViewSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'deploymentId',
    'runId',
    'userId',
    'walletAddress',
    'programName',
    'programId',
    'rpcUrl',
    'loaderModel',
    'status',
    'txCount',
    'confirmedCount',
    'sentCount',
    'failedCount',
    'lastValidBlockHeight',
    'maxDataLen',
    'binarySize',
    'chunkSize',
    'transactions',
    'createdAt',
    'updatedAt',
  ],
  properties: {
    deploymentId: { type: 'string', format: 'uuid' },
    runId: { type: 'string', format: 'uuid' },
    userId: { type: 'integer' },
    walletAddress: { type: 'string' },
    programName: { type: 'string' },
    programId: { type: 'string' },
    rpcUrl: { type: 'string' },
    loaderModel: { type: 'string', enum: ['upgradeable_v3'] },
    status: {
      type: 'string',
      enum: ['preparing', 'ready', 'submitting', 'confirmed', 'failed', 'expired', 'cancelled'],
    },
    txCount: { type: 'integer' },
    confirmedCount: { type: 'integer' },
    sentCount: { type: 'integer' },
    failedCount: { type: 'integer' },
    lastValidBlockHeight: { type: 'integer' },
    maxDataLen: { type: 'integer' },
    binarySize: { type: 'integer' },
    chunkSize: { type: 'integer' },
    errorCode: { type: 'string', nullable: true },
    errorMessage: { type: 'string', nullable: true },
    transactions: {
      type: 'array',
      items: deployTxSchema,
    },
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

const SolanaDeploySchema = {
  createDeployment: {
    tags: ['Solana Deploy'],
    summary: 'Create deployment',
    description: 'Compile Anchor program and return raw deploy transactions to be user-signed.',
    body: {
      type: 'object',
      additionalProperties: false,
      required: ['runId'],
      properties: {
        runId: { type: 'string', format: 'uuid' },
        programName: { type: 'string' },
      },
    },
    response: {
      201: {
        ...successEnvelopeSchema,
        properties: {
          ...successEnvelopeSchema.properties,
          data: {
            type: 'object',
            additionalProperties: false,
            required: [
              'deploymentId',
              'runId',
              'programName',
              'programId',
              'rpcUrl',
              'loaderModel',
              'txCount',
              'lastValidBlockHeight',
              'transactions',
            ],
            properties: {
              deploymentId: { type: 'string', format: 'uuid' },
              runId: { type: 'string', format: 'uuid' },
              programName: { type: 'string' },
              programId: { type: 'string' },
              rpcUrl: { type: 'string' },
              loaderModel: { type: 'string', enum: ['upgradeable_v3'] },
              txCount: { type: 'integer' },
              lastValidBlockHeight: { type: 'integer' },
              simulationMode: { type: 'boolean' },
              transactions: {
                type: 'array',
                items: deployTxSchema,
              },
            },
          },
        },
      },
      401: errorEnvelopeSchema,
      404: errorEnvelopeSchema,
      500: errorEnvelopeSchema,
    },
  },

  getDeployment: {
    tags: ['Solana Deploy'],
    summary: 'Get deployment',
    params: {
      type: 'object',
      additionalProperties: false,
      required: ['deploymentId'],
      properties: {
        deploymentId: { type: 'string', format: 'uuid' },
      },
    },
    response: {
      200: {
        ...successEnvelopeSchema,
        properties: {
          ...successEnvelopeSchema.properties,
          data: deploymentViewSchema,
        },
      },
      401: errorEnvelopeSchema,
      404: errorEnvelopeSchema,
    },
  },

  reportReceipts: {
    tags: ['Solana Deploy'],
    summary: 'Report transaction receipts',
    params: {
      type: 'object',
      additionalProperties: false,
      required: ['deploymentId'],
      properties: {
        deploymentId: { type: 'string', format: 'uuid' },
      },
    },
    body: {
      type: 'object',
      additionalProperties: false,
      required: ['receipts'],
      properties: {
        receipts: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['txIndex', 'signature', 'status'],
            properties: {
              txIndex: { type: 'integer', minimum: 0 },
              signature: { type: 'string' },
              status: { type: 'string', enum: ['sent', 'confirmed', 'failed'] },
              slot: { type: 'integer' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
    response: {
      200: {
        ...successEnvelopeSchema,
        properties: {
          ...successEnvelopeSchema.properties,
          data: deploymentViewSchema,
        },
      },
      401: errorEnvelopeSchema,
      404: errorEnvelopeSchema,
      500: errorEnvelopeSchema,
    },
  },
}

export default SolanaDeploySchema
