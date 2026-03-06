import dotenv from 'dotenv'

dotenv.config()

const DatabaseConfig = {
  postgresql: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    poolSize: parseInt(process.env.DB_POOL_SIZE ?? '10'),
  },
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB),
    keyPrefix: process.env.REDIS_KEY_PREFIX,
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES ?? '3'),
    enableReadyCheck: true,
    showFriendlyErrorStack: true,
  },
}

export default DatabaseConfig
