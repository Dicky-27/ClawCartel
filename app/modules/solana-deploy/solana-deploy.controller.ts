import { FastifyReply, FastifyRequest } from 'fastify'
import AppException from '#app/exceptions/app_exception'
import ErrorCodes from '#app/exceptions/error_codes'
import ResponseUtil from '#app/utils/response'
import SolanaDeployService from '#app/modules/solana-deploy/solana-deploy.service'
import type {
  CreateDeploymentBody,
  ReportDeploymentReceiptsBody,
} from '#app/modules/solana-deploy/solana-deploy.interface'

interface DeploymentParams {
  deploymentId: string
}

interface AuthContext {
  userId: number
  walletAddress: string
}

function resolveAuthContext(request: FastifyRequest): AuthContext {
  const userId = request.user?.sub
  const walletAddress = request.user?.wallet

  if (typeof userId !== 'number') {
    throw new AppException(401, ErrorCodes.UNAUTHORIZED, 'Invalid user in JWT payload')
  }

  if (typeof walletAddress !== 'string' || !walletAddress.trim()) {
    throw new AppException(401, ErrorCodes.UNAUTHORIZED, 'Invalid wallet in JWT payload')
  }

  return { userId, walletAddress }
}

const SolanaDeployController = {
  createDeployment: async (
    request: FastifyRequest<{ Body: CreateDeploymentBody }>,
    reply: FastifyReply,
  ) => {
    const auth = resolveAuthContext(request)
    const data = await SolanaDeployService.createDeployment(auth.userId, auth.walletAddress, request.body)

    return ResponseUtil.created(reply, data)
  },

  getDeployment: async (
    request: FastifyRequest<{ Params: DeploymentParams }>,
    reply: FastifyReply,
  ) => {
    const auth = resolveAuthContext(request)
    const data = await SolanaDeployService.getDeployment(auth.userId, auth.walletAddress, request.params.deploymentId)

    return ResponseUtil.success(reply, data)
  },

  reportReceipts: async (
    request: FastifyRequest<{ Params: DeploymentParams; Body: ReportDeploymentReceiptsBody }>,
    reply: FastifyReply,
  ) => {
    const auth = resolveAuthContext(request)
    const data = await SolanaDeployService.reportReceipts(
      auth.userId,
      auth.walletAddress,
      request.params.deploymentId,
      request.body,
    )

    return ResponseUtil.success(reply, data)
  },
}

export default SolanaDeployController
