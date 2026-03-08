import dotenv from 'dotenv'
import path from 'node:path'

dotenv.config()

const port = process.env.APP_PORT ?? '3000'
const defaultWorkspaceRoot = path.resolve(process.cwd(), 'workspace', 'claw-cartel-projects')
const AppConfig = {
  app: {
    host: process.env.APP_HOST ?? '0.0.0.0',
    port: parseInt(port),
    gracefulShutdownTimeoutMs: parseInt(process.env.APP_GRACEFUL_SHUTDOWN_TIMEOUT_MS ?? '5000'),
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    url: process.env.APP_URL ?? `http://localhost:${port}`,
  },
  jwt: {
    privateKey: Buffer.from(
      process.env.JWT_PRIVATE_KEY ?? '',
      'base64'
    ).toString('utf8'),
    publicKey: Buffer.from(process.env.JWT_PUBLIC_KEY ?? '', 'base64').toString(
      'utf8'
    ),
  },
  workspace: {
    root: process.env.WORKSPACE_ROOT ?? defaultWorkspaceRoot,
  },
  solana: {
    skipPreflight: process.env.SOLANA_SKIP_PREFLIGHT === 'true',
    rpcUrl: process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com',
    network: process.env.SOLANA_NETWORK ?? 'devnet',
    deployChunkSize: parseInt(process.env.SOLANA_DEPLOY_CHUNK_SIZE ?? '900'),
    deployMaxDataLenMultiplier: parseInt(process.env.SOLANA_DEPLOY_MAX_DATA_MULTIPLIER ?? '2'),
    deployCompileTimeoutMs: parseInt(process.env.SOLANA_DEPLOY_COMPILE_TIMEOUT_MS ?? '900000'),
    deployAutoRepairEnabled: process.env.SOLANA_DEPLOY_AUTO_REPAIR === 'true',
    deploySimulationMode: process.env.SOLANA_DEPLOY_SIMULATION_MODE === 'true',
  }
}

export default AppConfig
