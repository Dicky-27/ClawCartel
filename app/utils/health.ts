import db from '#prisma/prisma'
import redis from '#app/utils/redis'
import Logger from '#app/utils/logger'

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  uptime: number
  services: {
    database: ServiceHealth
    redis: ServiceHealth
  }
}

interface ServiceHealth {
  status: 'up' | 'down'
  responseTime?: number
  message?: string
}

class HealthService {
  private startTime: number = Date.now()

  async check(): Promise<HealthStatus> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ])

    const [database, redis] = checks

    const allHealthy = database.status === 'up' && redis.status === 'up'
    const anyDown = database.status === 'down' || redis.status === 'down'

    return {
      status: allHealthy ? 'healthy' : anyDown ? 'unhealthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      services: {
        database,
        redis,
      },
    }
  }

  private async checkDatabase(): Promise<ServiceHealth> {
    const start = Date.now()
    try {
      await db.$queryRaw`SELECT 1`

      return {
        status: 'up',
        responseTime: Date.now() - start,
      }
    } catch (error) {
      Logger.error({ error }, 'Database health check failed')

      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  private async checkRedis(): Promise<ServiceHealth> {
    const start = Date.now()
    try {
      await redis.ping()

      return {
        status: 'up',
        responseTime: Date.now() - start,
      }
    } catch (error) {
      Logger.error({ error }, 'Redis health check failed')

      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000)
  }
}

export const healthService = new HealthService()
export default healthService
