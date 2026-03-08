import { baseAPI } from "../_libs/api/axios";
import { ApiResponse } from "../_types/api";
import {
  AuthNonceResponse,
  AuthVerifyRequest,
  AuthVerifyResponse,
} from "../_types/auth";

export const AuthService = {
  async getNonce(address: string): Promise<ApiResponse<AuthNonceResponse>> {
    const response = await baseAPI.post<ApiResponse<AuthNonceResponse>>("/auth/siws/nonce", { address });
    return response.data;
  },

  async verify(data: AuthVerifyRequest): Promise<ApiResponse<AuthVerifyResponse>> {
    const response = await baseAPI.post<ApiResponse<AuthVerifyResponse>>("/auth/siws/verify", data);
    return response.data;
  },
};
