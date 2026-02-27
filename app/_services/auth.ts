import { baseAPI } from "../_libs/api/axios";
import { authAPI } from "../_libs/api/axiosAuth";
import { ApiResponse } from "../_types/api";
import {
  AuthNonceResponse,
  AuthResponse,
  AuthVerifyRequest,
  AuthVerifyResponse,
} from "../_types/auth";

export const AuthService = {
  async getNonce(address: string): Promise<ApiResponse<AuthNonceResponse>> {
    const response = await baseAPI.post<ApiResponse<AuthNonceResponse>>("/auth/nonce", { address });
    return response.data;
  },

  async verify(data: AuthVerifyRequest): Promise<ApiResponse<AuthVerifyResponse>> {
    const response = await baseAPI.post<ApiResponse<AuthVerifyResponse>>("/auth/verify", data);
    return response.data;
  },

  async getUser(): Promise<ApiResponse<AuthResponse>> {
    const response = await authAPI.get<ApiResponse<AuthResponse>>(`/auth`);
    return response.data;
  },
};
