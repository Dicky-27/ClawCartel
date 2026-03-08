import { DoneFuncWithErrOrRes, FastifyInstance, FastifyPluginOptions } from 'fastify'
import UploadController from '#app/modules/upload/upload.controller'
import UploadSchema from '#app/modules/upload/upload.schema'

export default function (app: FastifyInstance, _opts: FastifyPluginOptions, done: DoneFuncWithErrOrRes) {
  app.post('/', { schema: UploadSchema.upload }, UploadController.upload)
  app.get('/cdn-url', { schema: UploadSchema.getCDNUrl }, UploadController.getCDNUrl)

  done()
}
