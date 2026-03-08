export type DeployLoaderModel = 'upgradeable_v3'
export type DeployTxKind = 'create_buffer' | 'write_chunk' | 'deploy_program'

export type DeploymentStatus =
  | 'preparing'
  | 'ready'
  | 'submitting'
  | 'confirmed'
  | 'failed'
  | 'expired'
  | 'cancelled'

export type DeployTxStatus = 'pending' | 'sent' | 'confirmed' | 'failed'

export interface CreateDeploymentBody {
  runId: string
  programName?: string
}

export interface DeploymentTxPayload {
  txIndex: number
  kind: DeployTxKind
  txBase64: string
  status: DeployTxStatus
  signature?: string | null
  slot?: number | null
  error?: string | null
}

export interface CreateDeploymentResponse {
  deploymentId: string
  runId: string
  programName: string
  programId: string
  rpcUrl: string
  loaderModel: DeployLoaderModel
  txCount: number
  lastValidBlockHeight: number
  simulationMode?: boolean
  transactions: DeploymentTxPayload[]
}

export interface DeployReceiptInput {
  txIndex: number
  signature: string
  status: 'sent' | 'confirmed' | 'failed'
  slot?: number
  error?: string
}

export interface ReportDeploymentReceiptsBody {
  receipts: DeployReceiptInput[]
}

export interface DeploymentView {
  deploymentId: string
  runId: string
  userId: number
  walletAddress: string
  programName: string
  programId: string
  rpcUrl: string
  loaderModel: DeployLoaderModel
  status: DeploymentStatus
  txCount: number
  confirmedCount: number
  sentCount: number
  failedCount: number
  lastValidBlockHeight: number
  maxDataLen: number
  binarySize: number
  chunkSize: number
  errorCode?: string | null
  errorMessage?: string | null
  transactions: DeploymentTxPayload[]
  createdAt: string
  updatedAt: string
}

export interface BuildDeployTransaction {
  txIndex: number
  kind: DeployTxKind
  txBase64: string
}

export interface BuildDeployResult {
  programName: string
  programId: string
  loaderModel: DeployLoaderModel
  lastValidBlockHeight: number
  maxDataLen: number
  binarySize: number
  chunkSize: number
  transactions: BuildDeployTransaction[]
}
