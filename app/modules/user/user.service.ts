import AppException from '#app/exceptions/app_exception'
import ErrorCodes from '#app/exceptions/error_codes'
import {
  ListUserQuery,
  CreateUserBody,
  UpdateUserBody,
} from '#app/modules/user/user.interface'
import Hash from '#app/utils/hash'
import db from '#prisma/prisma'
import { User } from '@prisma/client'

const UserService = {
  list: async (query: ListUserQuery) => {
    const { page = 1, limit = 25 } = query
    const users = await db.user.paginate<User>({
      page,
      limit,
      omit: {
        password: true,
      },
    })

    return users
  },

  detail: async (id: number) => {
    const user = await db.user.findFirst({
      where: { id },
      omit: {
        password: true,
      },
    })
    if (!user) {
      throw new AppException(404, ErrorCodes.NOT_FOUND, 'User not found')
    }

    return user
  },

  create: async (data: CreateUserBody) => {
    const {
      name,
      username,
      password,
      confirmPassword,
    } = data

    const foundUser = await db.user.findFirst({
      where: { username }
    })
    if (foundUser) {
      throw new AppException(400, ErrorCodes.BAD_REQUEST, 'Username already used by another user')
    }

    if (password !== confirmPassword) {
      throw new AppException(400, ErrorCodes.BAD_REQUEST, 'Invalid confirmation password')
    }

    const user = await db.user.create({
      data: {
        name,
        username,
        password: Hash.createHash(password),
      },
      omit: {
        password: true,
      }
    })

    return user
  },

  update: async (data: UpdateUserBody) => {
    const {
      id,
      name,
      username,
      oldPassword,
      newPassword,
      confirmPassword,
    } = data

    const user = await db.user.findFirst({
      where: { id }
    })
    if (!user) {
      throw new AppException(404, ErrorCodes.NOT_FOUND, 'User not found')
    }

    if (oldPassword) {
      if (!Hash.checkHash(oldPassword, user.password)) {
        throw new AppException(400, ErrorCodes.BAD_REQUEST, 'Invalid old password')
      }
    }

    if (newPassword || confirmPassword) {
      if (newPassword !== confirmPassword) {
        throw new AppException(400, ErrorCodes.BAD_REQUEST, 'Invalid confirmation password')
      }

      user.password = Hash.createHash(newPassword)
    }

    if (username) {
      const foundUser = await db.user.findFirst({
        where: {
          id: {
            not: user.id,
          },
          username,
        }
      })
      if (foundUser) {
        throw new AppException(400, ErrorCodes.BAD_REQUEST, 'Username already used by another user')
      }

      user.username = username
    }

    user.name = name ?? user.name

    const updatedUser = await db.user.update({
      where: {
        id: user.id,
      },
      data: {
        name: user.name,
        username: user.username,
        password: user.password,
      },
      omit: {
        password: true,
      },
    })

    return updatedUser
  },

  delete: async (id: number) => {
    const user = await db.user.findFirst({
      where: { id }
    })
    if (!user) {
      throw new AppException(404, ErrorCodes.NOT_FOUND, 'User not found')
    }

    await db.user.delete({
      where: {
        id: user.id,
      }
    })

    return true
  },
}

export default UserService
