import { Redis } from 'ioredis'
import DatabaseConfig from '#app/config/database'
import Logger from '#app/utils/logger'

class RedisClient {
  private client!: Redis
  private isConnected: boolean = false

  constructor() {
    this.client = new Redis({
      host: DatabaseConfig.redis.host,
      port: DatabaseConfig.redis.port,
      password: DatabaseConfig.redis.password,
      db: DatabaseConfig.redis.db,
      keyPrefix: DatabaseConfig.redis.keyPrefix,
      maxRetriesPerRequest: DatabaseConfig.redis.maxRetriesPerRequest,
      enableReadyCheck: DatabaseConfig.redis.enableReadyCheck,
      showFriendlyErrorStack: DatabaseConfig.redis.showFriendlyErrorStack,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000)

        return delay
      },
      reconnectOnError: (err: Error) => {
        const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNREFUSED']

        return targetErrors.some(e => err.message.includes(e))
      },
    })

    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.isConnected = true
      Logger.info('Redis client connected')
    })

    this.client.on('ready', () => {
      Logger.info('Redis client ready')
    })

    this.client.on('error', (err: Error) => {
      Logger.error({ err }, 'Redis client error')
    })

    this.client.on('close', () => {
      this.isConnected = false
      Logger.warn('Redis client connection closed')
    })

    this.client.on('reconnecting', () => {
      Logger.info('Redis client reconnecting...')
    })
  }

  getClient(): Redis {
    return this.client
  }

  getStatus(): boolean {
    return this.isConnected
  }

  ping(): Promise<string> {
    return this.client.ping()
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key)
    } catch (error) {
      Logger.error({ error, key }, 'Redis GET error')

      return null
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, value)
      } else {
        await this.client.set(key, value)
      }
    } catch (error) {
      Logger.error({ error, key }, 'Redis SET error')
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key)
    } catch (error) {
      Logger.error({ error, key }, 'Redis DEL error')
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key)

      return result === 1
    } catch (error) {
      Logger.error({ error, key }, 'Redis EXISTS error')

      return false
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.client.expire(key, seconds)
    } catch (error) {
      Logger.error({ error, key }, 'Redis EXPIRE error')
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key)
    } catch (error) {
      Logger.error({ error, key }, 'Redis TTL error')

      return -1
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const data = await this.get(key)
    if (!data) return null
    try {
      return JSON.parse(data) as T
    } catch {
      return null
    }
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds)
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      return await this.client.incrby(key, amount)
    } catch (error) {
      Logger.error({ error, key }, 'Redis INCR error')

      return 0
    }
  }

  async decrement(key: string, amount: number = 1): Promise<number> {
    try {
      return await this.client.decrby(key, amount)
    } catch (error) {
      Logger.error({ error, key }, 'Redis DECR error')

      return 0
    }
  }

  async hGet(key: string, field: string): Promise<string | null> {
    try {
      return await this.client.hget(key, field)
    } catch (error) {
      Logger.error({ error, key, field }, 'Redis HGET error')

      return null
    }
  }

  async hSet(key: string, field: string, value: string): Promise<void> {
    try {
      await this.client.hset(key, field, value)
    } catch (error) {
      Logger.error({ error, key, field }, 'Redis HSET error')
    }
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    try {
      return await this.client.hgetall(key)
    } catch (error) {
      Logger.error({ error, key }, 'Redis HGETALL error')

      return {}
    }
  }

  async hDel(key: string, field: string): Promise<void> {
    try {
      await this.client.hdel(key, field)
    } catch (error) {
      Logger.error({ error, key, field }, 'Redis HDEL error')
    }
  }

  async lPush(key: string, value: string): Promise<number> {
    try {
      return await this.client.lpush(key, value)
    } catch (error) {
      Logger.error({ error, key }, 'Redis LPUSH error')

      return 0
    }
  }

  async rPush(key: string, value: string): Promise<number> {
    try {
      return await this.client.rpush(key, value)
    } catch (error) {
      Logger.error({ error, key }, 'Redis RPUSH error')

      return 0
    }
  }

  async lPop(key: string): Promise<string | null> {
    try {
      return await this.client.lpop(key)
    } catch (error) {
      Logger.error({ error, key }, 'Redis LPOP error')

      return null
    }
  }

  async rPop(key: string): Promise<string | null> {
    try {
      return await this.client.rpop(key)
    } catch (error) {
      Logger.error({ error, key }, 'Redis RPOP error')

      return null
    }
  }

  async lRange(key: string, start: number = 0, stop: number = -1): Promise<string[]> {
    try {
      return await this.client.lrange(key, start, stop)
    } catch (error) {
      Logger.error({ error, key }, 'Redis LRANGE error')

      return []
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern)
    } catch (error) {
      Logger.error({ error, pattern }, 'Redis KEYS error')

      return []
    }
  }

  async flushDb(): Promise<void> {
    try {
      await this.client.flushdb()
    } catch (error) {
      Logger.error({ error }, 'Redis FLUSHDB error')
    }
  }

  async quit(): Promise<void> {
    await this.client.quit()
  }
}

export const redis = new RedisClient()
export default redis
