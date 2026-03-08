const UserSchema = {
  list: {
    tags: ['User'],
    summary: 'List users',
    description: 'List users with pagination',
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', minimum: 1 },
        limit: { type: 'integer', minimum: 25 },
      },
    },
  },

  detail: {
    tags: ['User'],
    summary: 'Get user',
    description: 'Get user by ID',
    params: {
      type: 'object',
      required: [
        'id',
      ],
      properties: {
        id: { type: 'integer' },
      },
    },
  },

  create: {
    tags: ['User'],
    summary: 'Create user',
    description: 'Register a new user',
    body: {
      type: 'object',
      required: [
        'name',
        'username',
        'password',
        'confirmPassword',
      ],
      properties: {
        name: { type: 'string' },
        username: { type: 'string' },
        password: { type: 'string' },
        confirmPassword: { type: 'string' },
      },
    },
  },

  update: {
    tags: ['User'],
    summary: 'Update user',
    description: 'Update user profile or password',
    body: {
      type: 'object',
      required: [
        'id',
      ],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
        username: { type: 'string' },
        oldPassword: { type: 'string' },
        newPassword: { type: 'string' },
        confirmPassword: { type: 'string' },
      },
    },
  },

  delete: {
    tags: ['User'],
    summary: 'Delete user',
    description: 'Delete user by ID',
    params: {
      type: 'object',
      required: [
        'id',
      ],
      properties: {
        id: { type: 'integer' },
      },
    },
  },
}

export default UserSchema
