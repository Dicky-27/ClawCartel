import { SIWSMessageParams, NonceData, VerifyResult } from '#app/modules/auth/auth.interface'
import { PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'
import crypto from 'crypto'
import nacl from 'tweetnacl'
import jwt from 'jsonwebtoken'
import db from '#prisma/prisma'
import AppException from '#app/exceptions/app_exception'
import ErrorCodes from '#app/exceptions/error_codes'
import AppConfig from '#app/config/app'

const NONCE_EXPIRY_MINUTES = 10

const AuthService = {
  async generateSiwsNonce(address: string): Promise<NonceData> {
    // Validate Solana address format
    try {
      new PublicKey(address)
    } catch (error) {
      throw new AppException(
        400,
        ErrorCodes.BAD_REQUEST,
        'Invalid Solana wallet address'
      )
    }

    // Reuse existing unexpired nonce to make SIWS init idempotent per wallet
    const existingNonce = await db.authNonce.findUnique({
      where: { address },
    })

    if (existingNonce) {
      if (existingNonce.expiresAt > new Date()) {
        return {
          nonce: existingNonce.nonce,
          message: existingNonce.message,
          expiresAt: existingNonce.expiresAt,
        }
      }

      await db.authNonce.delete({ where: { id: existingNonce.id } })
    }

    // Generate a cryptographically secure random nonce
    const nonce = crypto.randomBytes(32).toString('base64')
    const expiresAt = new Date(Date.now() + NONCE_EXPIRY_MINUTES * 60 * 1000)
    const issuedAt = new Date().toISOString()

    const frontendUrl = AppConfig.app.frontendUrl
    const message = AuthService.createSIWSMessage({
      domain: new URL(frontendUrl).host,
      address,
      statement: 'Sign in to LSD',
      uri: frontendUrl,
      version: '1',
      chainId: 'solana:mainnet-beta',
      nonce,
      issuedAt,
      expirationTime: expiresAt.toISOString(),
    })

    // Store nonce in database
    await db.authNonce.upsert({
      where: {
        address,
      },
      create: {
        address,
        nonce,
        message,
        expiresAt,
      },
      update: {
        nonce,
        message,
        expiresAt,
      },
    })

    return {
      nonce,
      message,
      expiresAt,
    }
  },
  async verifySiwsSignature(
    address: string,
    message: string,
    signature: string
  ): Promise<VerifyResult> {
    // Validate Solana address format
    let publicKey: PublicKey
    try {
      publicKey = new PublicKey(address)
    } catch (error) {
      throw new AppException(
        400,
        ErrorCodes.BAD_REQUEST,
        'Invalid Solana wallet address'
      )
    }

    // Retrieve stored nonce from database
    const storedNonce = await db.authNonce.findFirst({
      where: {
        address: address,
      },
    })

    if (!storedNonce) {
      throw new AppException(
        401,
        ErrorCodes.INVALID_CREDENTIAL,
        'Nonce not found. Please request a new nonce.'
      )
    }

    // Check if nonce has expired
    if (storedNonce.expiresAt < new Date()) {
      await db.authNonce.delete({ where: { id: storedNonce.id } })

      throw new AppException(
        401,
        ErrorCodes.INVALID_CREDENTIAL,
        'Nonce has expired. Please request a new nonce.'
      )
    }

    // Verify message integrity
    if (storedNonce.message !== message) {
      throw new AppException(
        401,
        ErrorCodes.INVALID_CREDENTIAL,
        'Message does not match the expected format'
      )
    }

    // Verify the Ed25519 signature
    try {
      const messageBytes = new TextEncoder().encode(message)
      const signatureBytes = bs58.decode(signature)
      const publicKeyBytes = publicKey.toBytes()

      const isValid = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKeyBytes
      )

      if (!isValid) {
        throw new AppException(
          401,
          ErrorCodes.BAD_REQUEST,
          'Signature verification failed'
        )
      }
    } catch (error) {
      if (error instanceof AppException) {
        throw error
      }

      throw new AppException(
        401,
        ErrorCodes.BAD_REQUEST,
        'Error verifying signature'
      )
    }

    // Delete used nonce (prevent replay attacks)
    await db.authNonce.delete({ where: { id: storedNonce.id } })

    // Get or create user by wallet address
    let user = await db.user.findFirst({
      where: { walletAddress: address },
      omit: { password: true },
    })

    if (!user) {
      const baseUsername = `wallet_${address.slice(0, 8)}`
      let username = baseUsername
      let suffix = 0
      while (await db.user.findFirst({ where: { username } })) {
        suffix += 1
        username = `${baseUsername}_${suffix}`
      }
      user = await db.user.create({
        data: {
          name: `${address.slice(0, 8)}…`,
          username,
          walletAddress: address,
        },
        omit: { password: true },
      })
    }

    const token = jwt.sign(
      { sub: user.id, wallet: address },
      AppConfig.jwt.privateKey,
      { algorithm: 'RS256', expiresIn: '7d' }
    )

    return {
      userId: user.id,
      walletAddress: user.walletAddress,
      token,
    }
  },
  createSIWSMessage(params: SIWSMessageParams): string {
    const {
      domain,
      address,
      statement,
      uri,
      version,
      chainId,
      nonce,
      issuedAt,
      expirationTime,
      notBefore,
      requestId,
      resources,
    } = params

    // Build message following CAIP-74 format
    let message = `${domain} wants you to sign in with your Solana account:\n`
    message += `${address}\n\n`
    message += `${statement}\n\n`
    message += `URI: ${uri}\n`
    message += `Version: ${version}\n`
    message += `Chain ID: ${chainId}\n`
    message += `Nonce: ${nonce}\n`
    message += `Issued At: ${issuedAt}`

    if (expirationTime) {
      message += `\nExpiration Time: ${expirationTime}`
    }

    if (notBefore) {
      message += `\nNot Before: ${notBefore}`
    }

    if (requestId) {
      message += `\nRequest ID: ${requestId}`
    }

    if (resources && resources.length > 0) {
      message += '\nResources:'
      resources.forEach(resource => {
        message += `\n- ${resource}`
      })
    }

    return message
  },
}

export default AuthService
