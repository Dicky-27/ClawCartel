import { defineConfig, env } from 'prisma/config'
import dotenv from 'dotenv'

dotenv.config()

export default defineConfig({
  schema: './prisma/schemas',
  migrations: {
    seed: 'node --import tsx ./prisma/seeders/index.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  }
})
