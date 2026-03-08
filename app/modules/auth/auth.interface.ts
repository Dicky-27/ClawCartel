export interface SIWSMessageParams {
  domain: string
  address: string
  statement: string
  uri: string
  version: string
  chainId: string
  nonce: string
  issuedAt: string
  expirationTime: string
  notBefore?: string
  requestId?: string
  resources?: string[]
}

export interface NonceData {
    nonce: string
    message: string
    expiresAt: Date
}

export interface VerifyResult {
  userId: number
  walletAddress: string | null
  token: string
}

export interface SiwsNonceBody {
  address: string
}

export interface SiwsVerifyBody {
  address: string
  message: string
  signature: string
}
