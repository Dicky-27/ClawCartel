import dotenv from 'dotenv'

dotenv.config()

const port = process.env.APP_PORT ?? '3000'
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
  solana: {
    skipPreflight: process.env.SOLANA_SKIP_PREFLIGHT === 'true',
    rpcUrl: process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com',
    network: process.env.SOLANA_NETWORK ?? 'devnet',
  }
}

export default AppConfig
