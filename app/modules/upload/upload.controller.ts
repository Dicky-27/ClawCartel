import { FastifyReply, FastifyRequest } from 'fastify'
import db from '#prisma/prisma'
import { isS3Configured, uploadToS3 } from '#app/modules/upload/upload.service'

export default {
  upload: async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>
    const fileBuffer = body?.file

    if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
      return reply.json(null, 400, 'NO_FILE', 'No file was sent. Use form field name "file".')
    }

    const filename =
      typeof body.filename === 'string' && body.filename
        ? body.filename
        : `upload-${Date.now()}.bin`

    if (!isS3Configured()) {
      return reply.json(null, 503, 'S3_NOT_CONFIGURED', 'S3 is not configured. Set S3_BUCKET and AWS credentials in env.')
    }

    const { key, url } = await uploadToS3(fileBuffer, filename)

    const record = await db.upload.create({
      data: { filename, key, url },
    })

    return reply.json({
      id: record.id,
      filename: record.filename,
      key: record.key,
      url: record.url,
      createdAt: record.createdAt,
    })
  },
  getCDNUrl: (request: FastifyRequest, reply: FastifyReply) => {
    return reply.json(null, 200, null, 'https://claw-cartel-monolith.s3.ap-southeast-2.amazonaws.com')
  }
}
