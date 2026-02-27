export interface AuthNonceRequest {
  address: string;
}

export interface AuthNonceResponse {
  nonce: string;
  message: string;
  expiresAt: string;
}

export interface AuthTokenRequest {
  address: string;
  nonce: string;
}

export interface AuthVerifyRequest {
  address: string;
  message: string;
  signature: string;
}

export interface AuthVerifyResponse {
  token: string;
  user: {
    userId: number;
    address: string;
  };
}

export interface AuthResponse {
  id: number;
  walletAddress: string;
}
