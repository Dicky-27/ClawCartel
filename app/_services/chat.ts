import { baseAPI } from "../_libs/api/axios";
import { authAPI } from "../_libs/api/axiosAuth";
import { ApiResponse } from "../_types/api";
import {
  AuthNonceResponse,
  AuthResponse,
  AuthVerifyRequest,
  AuthVerifyResponse,
} from "../_types/auth";
import {
  AutonomusContinueRequest,
  AutonomusContinueResponse,
  AutonomusFilesProjectResponse,
  AutonomusRunsResponse,
} from "../_types/chat";
import { AutonomusRunsRequest } from "../_types/chat";

export const ChatService = {
  async getRunsId(data: AutonomusRunsRequest): Promise<ApiResponse<AutonomusRunsResponse>> {
    const response = await baseAPI.post<ApiResponse<AutonomusRunsResponse>>(
      "/autonomous/runs",
      data,
    );
    return response.data;
  },

  async startNewThread(
    data: AutonomusRunsRequest,
  ): Promise<ApiResponse<AutonomusRunsResponse>> {
    const response = await baseAPI.post<ApiResponse<AutonomusRunsResponse>>(
      "/v1/autonomous/runs/new-thread",
      data,
    );
    return response.data;
  },

  async continueToDevelopment(
    data: AutonomusContinueRequest,
  ): Promise<ApiResponse<AutonomusContinueResponse>> {
    const { runId, approved } = data;
    const response = await baseAPI.post<ApiResponse<AutonomusContinueResponse>>(
      `/autonomous/runs/${runId}/continue`,
      { approved },
    );
    return response.data;
  },

  async getFilesProject(runId: string): Promise<ApiResponse<AutonomusFilesProjectResponse>> {
    const response = await baseAPI.get<ApiResponse<AutonomusFilesProjectResponse>>(
      `/autonomous/runs/${runId}/files`,
    );
    return response.data;
  },
};
