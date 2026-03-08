import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import type {
  BuildDeployResult,
  BuildDeployTransaction,
  DeployLoaderModel,
  DeployTxKind,
} from '#app/modules/solana-deploy/solana-deploy.interface'

const BPF_UPGRADEABLE_LOADER_PROGRAM_ID = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111')

// Size constants from solana_loader_v3_interface::state helpers.
const PROGRAM_ACCOUNT_SIZE = 36
const BUFFER_METADATA_SIZE = 37
const PROGRAMDATA_METADATA_SIZE = 45
const DEFAULT_CHUNK_SIZE = 900
const DEFAULT_LOADER_MODEL: DeployLoaderModel = 'upgradeable_v3'

interface BuildTransactionsParams {
  connection: Connection
  payer: PublicKey
  authority: PublicKey
  programKeypair: Keypair
  programName: string
  programBinary: Buffer
  chunkSize?: number
  maxDataLenMultiplier?: number
}

function encodeU32(value: number): Buffer {
  const output = Buffer.alloc(4)
  output.writeUInt32LE(value, 0)

  return output
}

function encodeU64(value: bigint): Buffer {
  const output = Buffer.alloc(8)
  output.writeBigUInt64LE(value, 0)

  return output
}

function encodeInitializeBufferInstruction(): Buffer {
  return encodeU32(0)
}

function encodeWriteInstruction(offset: number, bytes: Buffer): Buffer {
  return Buffer.concat([
    encodeU32(1),
    encodeU32(offset),
    encodeU64(BigInt(bytes.length)),
    bytes,
  ])
}

function encodeDeployWithMaxDataLenInstruction(maxDataLen: number): Buffer {
  return Buffer.concat([
    encodeU32(2),
    encodeU64(BigInt(maxDataLen)),
  ])
}

function createInitializeBufferInstruction(
  bufferAddress: PublicKey,
  authorityAddress: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: BPF_UPGRADEABLE_LOADER_PROGRAM_ID,
    keys: [
      { pubkey: bufferAddress, isSigner: false, isWritable: true },
      { pubkey: authorityAddress, isSigner: false, isWritable: false },
    ],
    data: encodeInitializeBufferInstruction(),
  })
}

function createWriteInstruction(
  bufferAddress: PublicKey,
  authorityAddress: PublicKey,
  offset: number,
  bytes: Buffer,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: BPF_UPGRADEABLE_LOADER_PROGRAM_ID,
    keys: [
      { pubkey: bufferAddress, isSigner: false, isWritable: true },
      { pubkey: authorityAddress, isSigner: true, isWritable: false },
    ],
    data: encodeWriteInstruction(offset, bytes),
  })
}

function createDeployWithMaxDataLenInstruction(
  payerAddress: PublicKey,
  programDataAddress: PublicKey,
  programAddress: PublicKey,
  bufferAddress: PublicKey,
  upgradeAuthorityAddress: PublicKey,
  maxDataLen: number,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: BPF_UPGRADEABLE_LOADER_PROGRAM_ID,
    keys: [
      { pubkey: payerAddress, isSigner: true, isWritable: true },
      { pubkey: programDataAddress, isSigner: false, isWritable: true },
      { pubkey: programAddress, isSigner: false, isWritable: true },
      { pubkey: bufferAddress, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: upgradeAuthorityAddress, isSigner: true, isWritable: false },
    ],
    data: encodeDeployWithMaxDataLenInstruction(maxDataLen),
  })
}

function serializeTransaction(
  tx: Transaction,
  txIndex: number,
  kind: DeployTxKind,
): BuildDeployTransaction {
  return {
    txIndex,
    kind,
    txBase64: tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    }).toString('base64'),
  }
}

export async function buildUpgradeableV3DeployTransactions(
  params: BuildTransactionsParams,
): Promise<BuildDeployResult> {
  const {
    connection,
    payer,
    authority,
    programKeypair,
    programName,
    programBinary,
    chunkSize = DEFAULT_CHUNK_SIZE,
    maxDataLenMultiplier = 2,
  } = params

  const binarySize = programBinary.length
  const maxDataLen = Math.max(binarySize * maxDataLenMultiplier, binarySize + 1)
  const bufferSize = BUFFER_METADATA_SIZE + binarySize
  const programDataSize = PROGRAMDATA_METADATA_SIZE + maxDataLen

  const [bufferLamports, programLamports, programDataLamports, latestBlockhash] = await Promise.all([
    connection.getMinimumBalanceForRentExemption(bufferSize),
    connection.getMinimumBalanceForRentExemption(PROGRAM_ACCOUNT_SIZE),
    connection.getMinimumBalanceForRentExemption(programDataSize),
    connection.getLatestBlockhash('confirmed'),
  ])

  const bufferKeypair = Keypair.generate()
  const [programDataAddress] = PublicKey.findProgramAddressSync(
    [programKeypair.publicKey.toBuffer()],
    BPF_UPGRADEABLE_LOADER_PROGRAM_ID,
  )

  const transactions: BuildDeployTransaction[] = []
  let txIndex = 0

  const createBufferTx = new Transaction({
    feePayer: payer,
    recentBlockhash: latestBlockhash.blockhash,
  })
    .add(
      SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: bufferKeypair.publicKey,
        lamports: bufferLamports,
        space: bufferSize,
        programId: BPF_UPGRADEABLE_LOADER_PROGRAM_ID,
      }),
    )
    .add(createInitializeBufferInstruction(bufferKeypair.publicKey, authority))

  createBufferTx.partialSign(bufferKeypair)
  transactions.push(serializeTransaction(createBufferTx, txIndex, 'create_buffer'))
  txIndex += 1

  for (let offset = 0; offset < binarySize; offset += chunkSize) {
    const chunk = programBinary.subarray(offset, Math.min(offset + chunkSize, binarySize))
    const writeTx = new Transaction({
      feePayer: payer,
      recentBlockhash: latestBlockhash.blockhash,
    }).add(
      createWriteInstruction(
        bufferKeypair.publicKey,
        authority,
        offset,
        Buffer.from(chunk),
      ),
    )

    transactions.push(serializeTransaction(writeTx, txIndex, 'write_chunk'))
    txIndex += 1
  }

  const deployTx = new Transaction({
    feePayer: payer,
    recentBlockhash: latestBlockhash.blockhash,
  })
    .add(
      SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: programKeypair.publicKey,
        lamports: programLamports + programDataLamports,
        space: PROGRAM_ACCOUNT_SIZE,
        programId: BPF_UPGRADEABLE_LOADER_PROGRAM_ID,
      }),
    )
    .add(
      createDeployWithMaxDataLenInstruction(
        payer,
        programDataAddress,
        programKeypair.publicKey,
        bufferKeypair.publicKey,
        authority,
        maxDataLen,
      ),
    )

  deployTx.partialSign(programKeypair)
  transactions.push(serializeTransaction(deployTx, txIndex, 'deploy_program'))

  return {
    programName,
    programId: programKeypair.publicKey.toBase58(),
    loaderModel: DEFAULT_LOADER_MODEL,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    maxDataLen,
    binarySize,
    chunkSize,
    transactions,
  }
}
