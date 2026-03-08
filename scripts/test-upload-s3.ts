/**
 * Test S3 upload endpoint.
 * Usage: npx tsx scripts/test-upload-s3.ts [file-path]
 * If no path given, uploads a small dummy file.
 * Exits 0 on success, 1 on failure.
 */

const BASE = process.env.API_URL ?? 'http://localhost:3000'

function normalizeFilePath(raw: string): string {
  // Strip all leading file: + slashes/backslashes (e.g. file:///file:///C:/ or file:\C:\)
  let path = raw.replace(/^(file:[\\/]*)+/i, '').trim()
  try {
    path = decodeURIComponent(path)
  } catch {
    // leave as-is if decode fails
  }

  return path
}

async function run() {
  const rawPath = process.argv[2]
  const filePath = rawPath ? normalizeFilePath(rawPath) : ''
  const form = new FormData()

  if (filePath) {
    const fs = await import('fs/promises')
    const path = await import('path')
    const content = await fs.readFile(filePath)
    const name = path.basename(filePath)
    form.append('file', new Blob([content]), name)
    form.append('filename', name)
    console.log('Uploading:', filePath)
  } else {
    form.append('file', new Blob(['hello from S3 test\n']), 'test-s3.txt')
    form.append('filename', 'test-s3.txt')
    console.log('Uploading dummy file: test-s3.txt')
  }

  const res = await fetch(`${BASE}/v1/upload`, {
    method: 'POST',
    body: form,
  })

  const json = (await res.json()) as {
    status?: number
    code?: string
    message?: string
    data?: { filename?: string; key?: string; url?: string }
  }

  if (!res.ok) {
    console.error('FAIL – request failed')
    console.error('Status:', res.status)
    console.error('Response:', JSON.stringify(json, null, 2))
    process.exit(1)
  }

  const data = json.data ?? json
  const hasKey = typeof (data as { key?: string }).key === 'string'
  const hasUrl = typeof (data as { url?: string }).url === 'string'

  if (!hasKey || !hasUrl) {
    console.error('FAIL – response missing key or url (S3 response shape)')
    console.error('Response:', JSON.stringify(json, null, 2))
    process.exit(1)
  }

  console.log('OK – file uploaded to S3')
  console.log('  filename:', (data as { filename?: string }).filename)
  console.log('  key:', (data as { key: string }).key)
  console.log('  url:', (data as { url: string }).url)

  const url = (data as { url: string }).url
  if (url.startsWith('http')) {
    try {
      const head = await fetch(url, { method: 'HEAD' })
      if (head.ok) {
        console.log('  url reachable: yes')
      } else {
        console.log('  url reachable: no (', head.status, ')')
      }
    } catch {
      console.log('  url reachable: skip (could not check)')
    }
  }

  process.exit(0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
