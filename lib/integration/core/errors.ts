export type ErpErrorCode = 
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMIT'
  | 'SERVER_ERROR'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export class ErpException extends Error {
  public code: ErpErrorCode;
  public statusCode?: number;
  public details?: any;

  constructor(message: string, code: ErpErrorCode, statusCode?: number, details?: any) {
    super(message);
    this.name = 'ErpException';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, ErpException.prototype);
  }

  static fromHttpCode(status: number, message: string, details?: any): ErpException {
    switch (status) {
      case 400:
        return new ErpException(message, 'BAD_REQUEST', status, details);
      case 401:
        return new ErpException(message, 'UNAUTHORIZED', status, details);
      case 403:
        return new ErpException(message, 'FORBIDDEN', status, details);
      case 404:
        return new ErpException(message, 'NOT_FOUND', status, details);
      case 409:
        return new ErpException(message, 'CONFLICT', status, details);
      case 422:
        return new ErpException(message, 'VALIDATION_ERROR', status, details);
      case 429:
        return new ErpException(message, 'RATE_LIMIT', status, details);
      case 500:
      case 502:
      case 503:
      case 504:
        return new ErpException(message, 'SERVER_ERROR', status, details);
      default:
        return new ErpException(message, 'UNKNOWN', status, details);
    }
  }
}
