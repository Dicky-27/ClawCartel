import { authAPI } from "../_libs/api/axiosAuth";
import { ApiResponse } from "../_types/api";

export interface CreateDeploymentRequest {
  runId: string;
  programName?: string;
}

export interface CreateDeploymentResponse {
  id: string;
  runId?: string;
  status?: string;
  [key: string]: unknown;
}

export interface DeploymentStatusResponse {
  id: string;
  status: string;
  runId?: string;
  [key: string]: unknown;
}

export interface ReportReceiptsRequest {
  receipts?: unknown[];
  [key: string]: unknown;
}

export const SolanaDeployService = {
  async createDeployment(
    runId: string,
    programName?: string,
  ): Promise<ApiResponse<CreateDeploymentResponse>> {
    const response = await authAPI.post<ApiResponse<CreateDeploymentResponse>>(
      "/v1/solana/deploy/deployments",
      { runId, programName },
    );
    return response.data;
  },

  async getDeploymentStatus(
    deploymentId: string,
  ): Promise<ApiResponse<DeploymentStatusResponse>> {
    const response = await authAPI.get<ApiResponse<DeploymentStatusResponse>>(
      `/v1/solana/deploy/deployments/${deploymentId}`,
    );
    return response.data;
  },

  async reportDeploymentReceipts(
    deploymentId: string,
    body: ReportReceiptsRequest,
  ): Promise<ApiResponse<unknown>> {
    const response = await authAPI.post<ApiResponse<unknown>>(
      `/v1/solana/deploy/deployments/${deploymentId}/receipts`,
      body,
    );
    return response.data;
  },
};
