import redis from '#app/utils/redis'
import Logger from '#app/utils/logger'

interface CacheOptions {
  ttl?: number // Time to live in seconds
}

class CacheService {
  private readonly defaultTtl: number = 300 // 5 minutes

  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(key)
    if (!data) return null

    try {
      return JSON.parse(data) as T
    } catch (error) {
      Logger.error({ error, key }, 'Cache parse error')

      return null
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl ?? this.defaultTtl
    await redis.set(key, JSON.stringify(value), ttl)
  }

  async delete(key: string): Promise<void> {
    await redis.del(key)
  }

  async has(key: string): Promise<boolean> {
    return await redis.exists(key)
  }

  async remember<T>(
    key: string,
    callback: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    const value = await callback()
    await this.set(key, value, options)

    return value
  }

  async forever<T>(key: string, value: T): Promise<void> {
    await redis.set(key, JSON.stringify(value))
  }

  async increment(key: string, value: number = 1): Promise<number> {
    return await redis.increment(key, value)
  }

  async decrement(key: string, value: number = 1): Promise<number> {
    return await redis.decrement(key, value)
  }

  async flush(): Promise<void> {
    await redis.flushDb()
  }

  async ttl(key: string): Promise<number> {
    return await redis.ttl(key)
  }
}

export const cache = new CacheService()
export default cache
