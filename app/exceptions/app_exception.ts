import ErrorCodes from '#app/exceptions/error_codes'

export default class AppException extends Error {
  private _status: number
  private _code: string
  private _message: string

  constructor(status = 500, code: ErrorCodes = ErrorCodes.SYSTEM_ERROR, message = 'An error occured on the server') {
    super(message)

    this._status = status
    this._code = code
    this._message = message
  }

  public get status() {
    return this._status
  }

  public get statusCode() {
    return this._status
  }

  public get code() {
    return this._code
  }

  public get message() {
    return this._message
  }
}
