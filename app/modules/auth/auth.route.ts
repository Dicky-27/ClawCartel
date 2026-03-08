import { DoneFuncWithErrOrRes, FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { SiwsNonceBody, SiwsVerifyBody } from '#app/modules/auth/auth.interface'
import AuthController from '#app/modules/auth/auth.controller'
import AuthSchema from '#app/modules/auth/auth.schema'

export default function (app: FastifyInstance, _opts: FastifyPluginOptions, done: DoneFuncWithErrOrRes) {
  app.post<{ Body: SiwsNonceBody }>(
    '/siws/nonce',
    { schema: AuthSchema.siwsNonce },
    AuthController.siwsNonce,
  )
  app.post<{ Body: SiwsVerifyBody }>(
    '/siws/verify',
    { schema: AuthSchema.siwsVerify },
    AuthController.siwsVerify,
  )

  done()
}
