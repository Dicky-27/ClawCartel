import bcrypt from 'bcryptjs'

const Hash = {
  createHash: (plainText: string) => {
    const salt = bcrypt.genSaltSync(10)

    return bcrypt.hashSync(plainText, salt)
  },

  checkHash: (plainText: string, hashedValue: string) => {
    return bcrypt.compareSync(plainText, hashedValue)
  },
}

export default Hash
