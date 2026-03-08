import db from '#prisma/prisma'
import type {
  DeployReceiptInput,
  DeploymentView,
} from '#app/modules/solana-deploy/solana-deploy.interface'

interface CreateDeploymentArgs {
  runId: string
  userId: number
  walletAddress: string
  programName: string
  programId: string
  rpcUrl: string
  loaderModel: string
  lastValidBlockHeight: number
  maxDataLen: number
  binarySize: number
  chunkSize: number
  transactions: Array<{
    txIndex: number
    kind: string
    txBase64: string
    signature?: string
  }>
}

const orm = db as any

function mapDeployment(deployment: any): DeploymentView {
  const transactions = deployment.txs
    .slice()
    .sort((a: any, b: any) => a.txIndex - b.txIndex)
    .map((tx: any) => ({
      txIndex: tx.txIndex,
      kind: tx.kind,
      txBase64: tx.txBase64,
      status: tx.status,
      signature: tx.signature,
      slot: tx.slot != null ? Number(tx.slot) : null,
      error: tx.error,
    }))

  const confirmedCount = transactions.filter((tx: any) => tx.status === 'confirmed').length
  const sentCount = transactions.filter((tx: any) => tx.status === 'sent').length
  const failedCount = transactions.filter((tx: any) => tx.status === 'failed').length

  return {
    deploymentId: deployment.id,
    runId: deployment.runId,
    userId: deployment.userId,
    walletAddress: deployment.walletAddress,
    programName: deployment.programName,
    programId: deployment.programId,
    rpcUrl: deployment.rpcUrl,
    loaderModel: deployment.loaderModel,
    status: deployment.status,
    txCount: transactions.length,
    confirmedCount,
    sentCount,
    failedCount,
    lastValidBlockHeight: Number(deployment.lastValidBlockHeight),
    maxDataLen: deployment.maxDataLen,
    binarySize: deployment.binarySize,
    chunkSize: deployment.chunkSize,
    errorCode: deployment.errorCode,
    errorMessage: deployment.errorMessage,
    transactions,
    createdAt: deployment.createdAt.toISOString(),
    updatedAt: deployment.updatedAt.toISOString(),
  }
}

const SolanaDeployRepository = {
  async createDeployment(args: CreateDeploymentArgs): Promise<DeploymentView> {
    const deployment = await orm.programDeployment.create({
      data: {
        runId: args.runId,
        userId: args.userId,
        walletAddress: args.walletAddress,
        programName: args.programName,
        programId: args.programId,
        rpcUrl: args.rpcUrl,
        loaderModel: args.loaderModel,
        lastValidBlockHeight: BigInt(args.lastValidBlockHeight),
        maxDataLen: args.maxDataLen,
        binarySize: args.binarySize,
        chunkSize: args.chunkSize,
        status: 'ready',
        txs: {
          createMany: {
            data: args.transactions.map((tx) => ({
              txIndex: tx.txIndex,
              kind: tx.kind,
              txBase64: tx.txBase64,
              status: 'pending',
              signature: tx.signature,
            })),
          },
        },
      },
      include: {
        txs: true,
      },
    })

    return mapDeployment(deployment)
  },

  async findDeploymentForUser(
    deploymentId: string,
    userId: number,
    walletAddress: string,
  ): Promise<DeploymentView | null> {
    const deployment = await orm.programDeployment.findFirst({
      where: {
        id: deploymentId,
        userId,
        walletAddress,
      },
      include: {
        txs: true,
      },
    })

    if (!deployment) {
      return null
    }

    return mapDeployment(deployment)
  },

  async applyReceipts(
    deploymentId: string,
    userId: number,
    walletAddress: string,
    receipts: DeployReceiptInput[],
  ): Promise<DeploymentView | null> {
    const deployment = await orm.programDeployment.findFirst({
      where: {
        id: deploymentId,
        userId,
        walletAddress,
      },
      include: {
        txs: true,
      },
    })

    if (!deployment) {
      return null
    }

    for (const receipt of receipts) {
      await orm.programDeploymentTx.updateMany({
        where: {
          deploymentId,
          txIndex: receipt.txIndex,
        },
        data: {
          status: receipt.status,
          signature: receipt.signature,
          slot: receipt.slot != null ? BigInt(receipt.slot) : undefined,
          error: receipt.error,
        },
      })
    }

    const updated = await orm.programDeployment.findUnique({
      where: { id: deploymentId },
      include: { txs: true },
    })

    if (!updated) {
      return null
    }

    const txs = updated.txs
    const hasFailed = txs.some((tx) => tx.status === 'failed')
    const allConfirmed = txs.every((tx) => tx.status === 'confirmed')
    const hasSubmitted = txs.some((tx) => tx.status === 'sent' || tx.status === 'confirmed')

    let status = updated.status
    if (hasFailed) {
      status = 'failed'
    } else if (allConfirmed) {
      status = 'confirmed'
    } else if (hasSubmitted) {
      status = 'submitting'
    } else {
      status = 'ready'
    }

    const refreshed = await orm.programDeployment.update({
      where: { id: deploymentId },
      data: { status },
      include: { txs: true },
    })

    return mapDeployment(refreshed)
  },

  async markDeploymentFailed(
    deploymentId: string,
    errorCode: string,
    errorMessage: string,
  ): Promise<void> {
    await orm.programDeployment.update({
      where: { id: deploymentId },
      data: {
        status: 'failed',
        errorCode,
        errorMessage,
      },
    })
  },

  async markDeploymentExpired(
    deploymentId: string,
    errorMessage: string,
  ): Promise<DeploymentView | null> {
    const deployment = await orm.programDeployment.update({
      where: { id: deploymentId },
      data: {
        status: 'expired',
        errorCode: 'SESSION_EXPIRED',
        errorMessage,
      },
      include: {
        txs: true,
      },
    })

    if (!deployment) {
      return null
    }

    return mapDeployment(deployment)
  },
}

export default SolanaDeployRepository
