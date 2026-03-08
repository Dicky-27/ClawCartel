const UploadSchema = {
  upload: {
    tags: ['Upload'],
    summary: 'Upload file',
    description: 'Upload a file (multipart)',
    body: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
    response: {
      200: {
        status: 200,
        code: 'SUCCESS',
        message: 'File uploaded successfully',
        data: {
          url: 'https://cdn.example.com/file.jpg',
        },
      },
    },
  },
  getCDNUrl: {
    tags: ['Upload'],
    summary: 'Get CDN URL',
    description: 'Get CDN URL for an uploaded file by key',
    querystring: {
      type: 'object',
      properties: {
        key: { type: 'string' },
      },
    },
    response: {
      200: {
        status: 200,
        code: 'SUCCESS',
        message: 'CDN URL retrieved successfully',
        data: {
          url: 'https://cdn.example.com/file.jpg',
        },
      },
    },
  },
}

export default UploadSchema
