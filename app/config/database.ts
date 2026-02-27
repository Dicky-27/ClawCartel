import dotenv from 'dotenv'

dotenv.config()

const DatabaseConfig = {
  postgresql: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/mydb',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432'),
    database: process.env.DB_NAME ?? 'mydb',
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    ssl: process.env.DB_SSL === 'true',
    poolSize: parseInt(process.env.DB_POOL_SIZE ?? '10'),
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB ?? '0'),
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'app:',
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES ?? '3'),
    enableReadyCheck: true,
    showFriendlyErrorStack: true,
  },
}

export default DatabaseConfig
