export interface ListUserQuery {
  page?: number
  limit?: number
}

export interface DetailUserParam {
  id: number
}

export interface CreateUserBody {
  name: string
  username: string
  password: string
  confirmPassword: string
}

export interface UpdateUserBody {
  id: number
  name?: string
  username?: string
  oldPassword?: string
  newPassword?: string
  confirmPassword?: string
}
