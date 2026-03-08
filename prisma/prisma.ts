import { PrismaPg } from '@prisma/adapter-pg'
import { Prisma, PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

dotenv.config()

type PaginateArgs<T> = {
  page?: number
  limit?: number
  where?: Prisma.Enumerable<T> | any
  select?: Prisma.Enumerable<T> | any
  include?: Prisma.Enumerable<T> | any
  omit?: Prisma.Enumerable<T> | any
  orderBy?: Prisma.Enumerable<T> | any
}

type PaginateResult<T> = {
  limit: number
  count: number
  total: number
  page: number
  totalPage: number
  data: T[]
}

const connectionString = `${process.env.DATABASE_URL ?? ''}`
const adapter = new PrismaPg({ connectionString })
const db = (new PrismaClient({ adapter })).$extends({
  model: {
    $allModels: {
      async paginate<T>(this: any, { page = 1, limit = 25, where = {}, select = null, include = null, omit = null, orderBy = { id: 'desc' } }: PaginateArgs<T>): Promise<PaginateResult<T>> {
        const skip = (page - 1) * limit
        const options = {
          where,
          omit: undefined,
          orderBy,
          skip,
          take: limit,
          select: undefined,
          include: undefined,
        }

        if (select) {
          options.select = select
        } else {
          options.omit = omit
          options.include = include
        }

        const [data, total] = await Promise.all([
          this.findMany(options),
          this.count({ where }),
        ])

        const totalPage = Math.ceil(total / limit)

        return {
          limit,
          count: data.length,
          total,
          page,
          totalPage: totalPage === 0 ? 1 : totalPage,
          data,
        }
      }
    },
  }
})

export default db
