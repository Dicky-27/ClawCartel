import { DoneFuncWithErrOrRes, FastifyInstance, FastifyPluginOptions } from 'fastify'
import {
  ListUserQuery,
  DetailUserParam,
  CreateUserBody,
  UpdateUserBody,
} from '#app/modules/user/user.interface'
import UserSchema from '#app/modules/user/user.schema'
import UserController from '#app/modules/user/user.controller'

export default function (app: FastifyInstance, opts: FastifyPluginOptions, done: DoneFuncWithErrOrRes) {
  app.get<{ Querystring: ListUserQuery }>(
    '/',
    { schema: UserSchema.list },
    UserController.list,
  )
  app.get<{ Params: DetailUserParam }>(
    '/:id',
    { schema: UserSchema.detail },
    UserController.detail,
  )
  app.post<{ Body: CreateUserBody }>(
    '/',
    { schema: UserSchema.create },
    UserController.create,
  )
  app.put<{ Body: UpdateUserBody }>(
    '/',
    { schema: UserSchema.update },
    UserController.update,
  )
  app.delete<{ Params: DetailUserParam }>(
    '/:id',
    { schema: UserSchema.delete },
    UserController.delete,
  )

  done()
}
