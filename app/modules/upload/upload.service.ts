import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const bucket = process.env.S3_BUCKET ?? ''
const region = process.env.AWS_REGION ?? 'us-east-1'

const s3 = new S3Client({
  region,
  endpoint: process.env.S3_ENDPOINT || undefined,
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
      : undefined,
})

function getPublicUrl(key: string): string {
  if (process.env.S3_PUBLIC_URL) {
    return `${process.env.S3_PUBLIC_URL.replace(/\/$/, '')}/${key}`
  }

  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
}

export async function uploadToS3(
  buffer: Buffer,
  filename: string
): Promise<{ key: string; url: string }> {
  const key = `uploads/${Date.now()}-${filename}`

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: undefined,
    })
  )

  return { key, url: getPublicUrl(key) }
}

export function isS3Configured(): boolean {
  return Boolean(bucket)
}
