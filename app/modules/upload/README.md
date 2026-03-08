# Upload module

**Endpoint:** `POST /v1/upload`

Send a multipart form with a single file. Field name must be `file`. Optional form field `filename` for the stored name.

**Example (curl):**
```bash
curl -X POST http://localhost:3000/v1/upload -F "file=@/path/to/your/file.pdf"
```

**Response:** `{ filename, key, url }` — file is uploaded to S3; `key` is the object key, `url` is the public URL.

**Limit:** 4MB per file (config in `app/utils/fastify.ts`).

## S3 env variables

Set these in `.env` (you add the values yourself):

| Variable | Description |
|----------|-------------|
| `S3_BUCKET` | S3 bucket name |
| `AWS_REGION` | AWS region (default `us-east-1`) |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `S3_ENDPOINT` | Optional. Custom endpoint (e.g. MinIO). |
| `S3_PUBLIC_URL` | Optional. Base URL for public links (e.g. CDN). If set, `url` in response uses this instead of the default S3 URL. |
