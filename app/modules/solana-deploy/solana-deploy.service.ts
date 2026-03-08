import { promises as fs } from 'fs'
import path from 'path'
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js'
import AppConfig from '#app/config/app'
import AppException from '#app/exceptions/app_exception'
import ErrorCodes from '#app/exceptions/error_codes'
import db from '#prisma/prisma'
import type {
  BuildDeployResult,
  CreateDeploymentBody,
  CreateDeploymentResponse,
  DeployTxKind,
  DeploymentView,
  ReportDeploymentReceiptsBody,
} from '#app/modules/solana-deploy/solana-deploy.interface'
import {
  compileAndResolveProgramArtifacts,
  readProgramKeypair,
} from '#app/modules/solana-deploy/solana-deploy.compiler'
import { buildUpgradeableV3DeployTransactions } from '#app/modules/solana-deploy/solana-deploy.tx-builder'
import SolanaDeployRepository from '#app/modules/solana-deploy/solana-deploy.repository'

const WORKSPACE_ROOT = AppConfig.workspace.root

async function assertRunAndWorkspace(runId: string): Promise<string> {
  const run = await db.run.findUnique({ where: { id: runId } })
  if (!run) {
    throw new AppException(404, ErrorCodes.NOT_FOUND, 'Run not found')
  }

  const workspacePath = path.join(WORKSPACE_ROOT, runId)
  try {
    const stat = await fs.stat(workspacePath)
    if (!stat.isDirectory()) {
      throw new Error('workspace path is not a directory')
    }
  } catch {
    throw new AppException(404, ErrorCodes.ARTIFACT_NOT_FOUND, 'Run workspace not found')
  }

  return workspacePath
}

function toDeploymentResponse(
  deployment: DeploymentView,
  options?: { simulationMode?: boolean },
): CreateDeploymentResponse {
  return {
    deploymentId: deployment.deploymentId,
    runId: deployment.runId,
    programName: deployment.programName,
    programId: deployment.programId,
    rpcUrl: deployment.rpcUrl,
    loaderModel: deployment.loaderModel,
    txCount: deployment.txCount,
    lastValidBlockHeight: deployment.lastValidBlockHeight,
    simulationMode: options?.simulationMode,
    transactions: deployment.transactions,
  }
}

async function expireDeploymentIfNeeded(deployment: DeploymentView): Promise<DeploymentView> {
  if (AppConfig.solana.deploySimulationMode) {
    return deployment
  }

  if (deployment.status === 'confirmed' || deployment.status === 'failed' || deployment.status === 'cancelled') {
    return deployment
  }

  const connection = new Connection(AppConfig.solana.rpcUrl, { commitment: 'confirmed' })
  const blockHeight = await connection.getBlockHeight('confirmed')

  if (blockHeight <= deployment.lastValidBlockHeight) {
    return deployment
  }

  const expired = await SolanaDeployRepository.markDeploymentExpired(
    deployment.deploymentId,
    `Deployment expired at block height ${blockHeight}`,
  )

  return expired ?? deployment
}

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

function serializeSimulationTx(
  feePayer: PublicKey,
  recentBlockhash: string,
  kind: DeployTxKind,
  txIndex: number,
): string {
  const tx = new Transaction({
    feePayer,
    recentBlockhash,
  })
    .add(
      SystemProgram.transfer({
        fromPubkey: feePayer,
        toPubkey: feePayer,
        lamports: 0,
      }),
    )
    .add(
      new TransactionInstruction({
        programId: MEMO_PROGRAM_ID,
        keys: [],
        data: Buffer.from(`clawcartel-sim-${kind}-${txIndex}`),
      }),
    )

  return tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  }).toString('base64')
}

async function buildSimulationDeployPlan(
  payer: PublicKey,
  programNameHint?: string,
): Promise<BuildDeployResult> {
  const programName = programNameHint?.trim() || 'mock_program'
  const programId = Keypair.generate().publicKey.toBase58()
  const connection = new Connection(AppConfig.solana.rpcUrl, {
    commitment: 'confirmed',
    disableRetryOnRateLimit: false,
  })

  let recentBlockhash = Keypair.generate().publicKey.toBase58()
  let lastValidBlockHeight = Math.floor(Date.now() / 1000) + 1_000_000
  try {
    const latest = await connection.getLatestBlockhash('confirmed')
    recentBlockhash = latest.blockhash
    lastValidBlockHeight = latest.lastValidBlockHeight
  } catch {
    // Keep fallback values so simulation can proceed without live RPC.
  }

  const kinds: DeployTxKind[] = ['create_buffer', 'write_chunk', 'deploy_program']
  const transactions = kinds.map((kind, txIndex) => ({
    txIndex,
    kind,
    txBase64: serializeSimulationTx(payer, recentBlockhash, kind, txIndex),
  }))

  return {
    programName,
    programId,
    loaderModel: 'upgradeable_v3',
    lastValidBlockHeight,
    maxDataLen: 2048,
    binarySize: 1024,
    chunkSize: AppConfig.solana.deployChunkSize,
    transactions,
  }
}

const SolanaDeployService = {
  async createDeployment(
    userId: number,
    walletAddress: string,
    body: CreateDeploymentBody,
  ): Promise<CreateDeploymentResponse> {
    if (!body.runId) {
      throw new AppException(400, ErrorCodes.BAD_REQUEST, 'runId is required')
    }

    let payer: PublicKey
    try {
      payer = new PublicKey(walletAddress)
    } catch {
      throw new AppException(400, ErrorCodes.BAD_REQUEST, 'Invalid wallet address in deployment token')
    }

    const workspacePath = await assertRunAndWorkspace(body.runId)

    let deployPlan: BuildDeployResult
    let simulationMode = false

    if (AppConfig.solana.deploySimulationMode) {
      deployPlan = await buildSimulationDeployPlan(payer, body.programName)
      simulationMode = true
    } else {
      const artifacts = await compileAndResolveProgramArtifacts(workspacePath, body.programName)
      const programKeypair = await readProgramKeypair(artifacts.keypairPath)

      const connection = new Connection(AppConfig.solana.rpcUrl, {
        commitment: 'confirmed',
        disableRetryOnRateLimit: false,
      })

      deployPlan = await buildUpgradeableV3DeployTransactions({
        connection,
        payer,
        authority: payer,
        programKeypair,
        programName: artifacts.programName,
        programBinary: artifacts.soBytes,
        chunkSize: AppConfig.solana.deployChunkSize,
        maxDataLenMultiplier: AppConfig.solana.deployMaxDataLenMultiplier,
      })
    }

    const deployment = await SolanaDeployRepository.createDeployment({
      runId: body.runId,
      userId,
      walletAddress,
      programName: deployPlan.programName,
      programId: deployPlan.programId,
      rpcUrl: AppConfig.solana.rpcUrl,
      loaderModel: deployPlan.loaderModel,
      lastValidBlockHeight: deployPlan.lastValidBlockHeight,
      maxDataLen: deployPlan.maxDataLen,
      binarySize: deployPlan.binarySize,
      chunkSize: deployPlan.chunkSize,
      transactions: deployPlan.transactions,
    })

    return toDeploymentResponse(deployment, { simulationMode })
  },

  async getDeployment(
    userId: number,
    walletAddress: string,
    deploymentId: string,
  ): Promise<DeploymentView> {
    const deployment = await SolanaDeployRepository.findDeploymentForUser(deploymentId, userId, walletAddress)
    if (!deployment) {
      throw new AppException(404, ErrorCodes.NOT_FOUND, 'Deployment not found')
    }

    return expireDeploymentIfNeeded(deployment)
  },

  async reportReceipts(
    userId: number,
    walletAddress: string,
    deploymentId: string,
    body: ReportDeploymentReceiptsBody,
  ): Promise<DeploymentView> {
    if (!Array.isArray(body.receipts) || body.receipts.length === 0) {
      throw new AppException(400, ErrorCodes.BAD_REQUEST, 'receipts is required')
    }

    for (const receipt of body.receipts) {
      if (typeof receipt.txIndex !== 'number' || receipt.txIndex < 0) {
        throw new AppException(400, ErrorCodes.BAD_REQUEST, 'Invalid receipt.txIndex')
      }
      if (!receipt.signature || !receipt.signature.trim()) {
        throw new AppException(400, ErrorCodes.BAD_REQUEST, 'Invalid receipt.signature')
      }
      if (!['sent', 'confirmed', 'failed'].includes(receipt.status)) {
        throw new AppException(400, ErrorCodes.BAD_REQUEST, 'Invalid receipt.status')
      }
    }

    const deployment = await SolanaDeployRepository.applyReceipts(
      deploymentId,
      userId,
      walletAddress,
      body.receipts,
    )

    if (!deployment) {
      throw new AppException(404, ErrorCodes.NOT_FOUND, 'Deployment not found')
    }

    return expireDeploymentIfNeeded(deployment)
  },
}

export default SolanaDeployService
