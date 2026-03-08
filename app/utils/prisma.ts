import AppException from '#app/exceptions/app_exception'
import ErrorCodes from '#app/exceptions/error_codes'
import { FastifyRequest } from 'fastify'

const PrismaUtil = {
  buildQuery: function (request: FastifyRequest, allowedFields: string[] = []) {
    const {
      filterKeys = '',
      filterOperators = '',
      filterValues = '',
    } = request.query as any
    const operatorDicts = {
      '=': 'equals',
      '!=': 'not',
      '>': 'gt',
      '>=': 'gte',
      '<': 'lt',
      '<=': 'lte',
      like: 'contains',
    }
    const filter = {}

    const keys: string[] = filterKeys.split(',')
    const operators: string[] = filterOperators.split(',')
    const values: string[] = filterValues.split(',')

    if (
      keys.length !== operators.length ||
      operators.length !== values.length
    ) {
      throw new AppException(
        400,
        ErrorCodes.BAD_REQUEST,
        'Invalid filter queries'
      )
    }

    keys.forEach((key, i) => {
      if (
        allowedFields.includes(key) &&
        Object.keys(operatorDicts).includes(operators[i])
      ) {
        const value = values[i]
        let parsedValue: any = value
        if (value === 'true' || value === 'false') {
          parsedValue = value === 'true'
        } else if (value.includes(';')) {
          parsedValue = value.split(';')
          parsedValue = parsedValue.map((e: any) => {
            if (!isNaN(Number.parseFloat(e))) {
              return Number.parseFloat(e)
            } else {
              return e
            }
          })
        } else {
          if (!isNaN(Number.parseFloat(value))) {
            parsedValue = Number.parseFloat(value)
          }
        }

        const operator = operatorDicts[operators[i]]
        if (filter[key] === undefined) {
          filter[key] = {}
        }

        if (operator === 'equals' && Array.isArray(parsedValue)) {
          filter[key]['in'] = parsedValue
        } else {
          filter[key][operator] = parsedValue
          if (operator === 'contains') {
            filter[key]['mode'] = 'insensitive'
          }
        }
      }
    })

    return filter['OR'] || filter
  },

  buildOrder: function (request: FastifyRequest) {
    const { orderBy = '' } = request.query as any
    const orders: string[] = orderBy.split(',')
    const orderQuery = {
      ...(orders.length === 0 && { id: 'desc' }),
    }

    for (const order of orders) {
      const orderArr: string[] = order.split(':')
      if (orderArr.length < 2) continue

      if (orderArr[1] === 'asc' || orderArr[1] === 'desc') {
        orderQuery[orderArr[0]] = orderArr[1]
      }
    }

    return orderQuery
  },
}

export default PrismaUtil
