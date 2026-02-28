import { FastifyReply, FastifyRequest } from 'fastify'
import type { SiwsNonceBody, SiwsVerifyBody } from '#app/modules/auth/auth.interface'
import AuthService from '#app/modules/auth/auth.service'

const AuthController = {
  siwsNonce: async (
    request: FastifyRequest<{ Body: SiwsNonceBody }>,
    reply: FastifyReply
  ) => {
    try {
      const { address } = request.body
      const data = await AuthService.generateSiwsNonce(address)

      return reply.json({
        status: 200,
        code: 'SUCCESS',
        message: 'Nonce generated successfully',
        data: {
          nonce: data.nonce,
          message: data.message,
          expiresAt: data.expiresAt,
        },
      })
    } catch (error) {
      return reply.json({
        status: 500,
        code: 'ERROR',
        message: 'Internal server error',
        data: null,
      })
    }
  },

  siwsVerify: async (
    request: FastifyRequest<{ Body: SiwsVerifyBody }>,
    reply: FastifyReply
  ) => {
    try {
      const { address, message, signature } = request.body
      const data = await AuthService.verifySiwsSignature(address, message, signature)

      return reply.json({
        status: 200,
        code: 'SUCCESS',
        message: 'Signature verified successfully',
        data: {
          token: data.token,
          userId: data.userId,
          walletAddress: data.walletAddress,
        },
      })
    } catch (error) {
      return reply.json({
        status: 500,
        code: 'ERROR',
        message: 'Internal server error',
        data: null,
      })
    }
  },
}

export default AuthController
