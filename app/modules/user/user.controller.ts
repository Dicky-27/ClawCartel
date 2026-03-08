import { FastifyReply, FastifyRequest } from 'fastify'
import {
  ListUserQuery,
  DetailUserParam,
  CreateUserBody,
  UpdateUserBody,
} from '#app/modules/user/user.interface'
import UserService from '#app/modules/user/user.service'

const UserController = {
  list: async (request: FastifyRequest<{ Querystring: ListUserQuery }>, reply: FastifyReply) => {
    const users = await UserService.list(request.query)

    return reply.json(users)
  },

  detail: async (request: FastifyRequest<{ Params: DetailUserParam }>, reply: FastifyReply) => {
    const user = await UserService.detail(request.params.id)

    return reply.json(user)
  },

  create: async (request: FastifyRequest<{ Body: CreateUserBody }>, reply: FastifyReply) => {
    const user = await UserService.create(request.body)

    return reply.json(user)
  },

  update: async (request: FastifyRequest<{ Body: UpdateUserBody }>, reply: FastifyReply) => {
    const user = await UserService.update(request.body)

    return reply.json(user)
  },

  delete: async (request: FastifyRequest<{ Params: DetailUserParam }>, reply: FastifyReply) => {
    await UserService.delete(request.params.id)

    return reply.json()
  },
}

export default UserController
