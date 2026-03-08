import { FastifyReply, FastifyRequest } from 'fastify'
import type { SiwsNonceBody, SiwsVerifyBody } from '#app/modules/auth/auth.interface'
import AuthService from '#app/modules/auth/auth.service'

const AuthController = {
  siwsNonce: async (
    request: FastifyRequest<{ Body: SiwsNonceBody }>,
    reply: FastifyReply
  ) => {
    const { address } = request.body
    const data = await AuthService.generateSiwsNonce(address)

    return reply.json({
      nonce: data.nonce,
      message: data.message,
      expiresAt: data.expiresAt,
    })
  },

  siwsVerify: async (
    request: FastifyRequest<{ Body: SiwsVerifyBody }>,
    reply: FastifyReply
  ) => {
    const { address, message, signature } = request.body
    const data = await AuthService.verifySiwsSignature(address, message, signature)

    return reply.json({
      token: data.token,
      userId: data.userId,
      walletAddress: data.walletAddress,
    })
  },
}

export default AuthController
