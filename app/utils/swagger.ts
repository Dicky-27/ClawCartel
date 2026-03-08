type JsonSchema = Record<string, unknown>

const ApiSchema = {
  /**
   * Success response schema
   * Format: { status, success, data }
   */
  success(data: JsonSchema = {}, status = 200): JsonSchema {
    return {
      type: 'object',
      required: ['status', 'success', 'data'],
      properties: {
        status: { type: 'integer', example: status },
        success: { type: 'boolean', example: true },
        data,
      },
    }
  },

  /**
   * Error response schema
   * Format: { status, success, error }
   */
  error(status: number, code: string, message: string): JsonSchema {
    return {
      type: 'object',
      required: ['status', 'success', 'error'],
      properties: {
        status: { type: 'integer', example: status },
        success: { type: 'boolean', example: false },
        error: {
          type: 'object',
          required: ['code', 'message'],
          properties: {
            code: { type: 'string', example: code },
            message: { type: 'string', example: message },
          },
        },
      },
    }
  },
}

export default ApiSchema
