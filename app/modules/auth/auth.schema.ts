const AuthSchema = {
  siwsNonce: {
    tags: ['Auth'],
    summary: 'Get SIWS nonce',
    description: 'Request a one-time nonce for Sign-In With Solana (SIWS)',
    body: {
      type: 'object',
      required: ['address'],
      properties: {
        address: { type: 'string', description: 'Solana wallet public key (base58)' },
      },
    },
    response: {
      200: {
        status: 200,
        code: 'SUCCESS',
        message: 'Nonce generated successfully',
        type: 'object',
        required: ['status', 'data'],
        properties: {
          status: { type: 'number', example: 200 },
          code: { type: ['string', 'null'] },
          message: { type: ['string', 'null'] },
          data: {
            type: 'object',
            required: ['nonce', 'message', 'expiresAt'],
            properties: {
              nonce: { type: 'string', description: 'One-time nonce for SIWS' },
              message: { type: 'string', description: 'Message to sign (CAIP-74 format)' },
              expiresAt: { type: 'string', format: 'date-time', description: 'Nonce expiry time' },
            },
          },
        },
      },
    },
  },
  siwsVerify: {
    tags: ['Auth'],
    summary: 'Verify SIWS signature',
    description: 'Verify signed message and issue JWT',
    body: {
      type: 'object',
      required: ['address', 'message', 'signature'],
      properties: {
        address: { type: 'string', description: 'Solana wallet public key (base58)' },
        message: { type: 'string', description: 'SIWS message that was signed' },
        signature: { type: 'string', description: 'Ed25519 signature (base58)' },
      },
    },
    response: {
      200: {
        status: 200,
        code: 'SUCCESS',
        message: 'Signature verified successfully',
        type: 'object',
        required: ['status', 'data'],
        properties: {
          status: { type: 'number', example: 200 },
          code: { type: ['string', 'null'] },
          message: { type: ['string', 'null'] },
          data: {
            type: 'object',
            required: ['token', 'userId', 'walletAddress'],
            properties: {
              token: { type: 'string', description: 'RS256 JWT — use as Bearer token' },
              userId: { type: 'integer', description: 'Authenticated user id' },
              walletAddress: { type: ['string', 'null'], description: 'Wallet address' },
            },
          },
        },
      },
    },
  },
}
export default AuthSchema
