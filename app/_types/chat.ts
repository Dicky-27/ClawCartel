export enum RunStep {
  IDLE = "idle",
  CHAT = "chat",
  APPROVAL = "approval",
  COMPLETE = "complete",
}

export enum AgentMessageType {
  AGENT = "agent",
  ROUND_MARKER = "round-marker",
  FILE_CREATED = "file-created",
  USER = "user",
}

export interface AgentMessage {
  id: string;
  type: AgentMessageType;
  content: string;
  agentName?: string;
  agentEmoji?: string;
  isDone?: boolean;
  phase?: string;
  createdAt?: string;
}

export interface FileNode {
  name: string;
  type: string;
  path: string;
  size?: number;
  children?: FileNode[];
}

export interface RunStats {
  totalFiles?: number;
  totalSize?: number;
}

export interface ApprovalData {
  message: string;
  discussionSummary?: unknown[];
}

export interface AutonomusRunsRequest {
  idea: string;
  mode: string;
}

export interface AutonomusRunsResponse {
  id: string;
  status: string;
  inputType: string;
  inputText: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutonomusContinueRequest {
  runId: string;
  approved: boolean;
}

export interface AutonomusContinueResponse {
  success: boolean;
  message: string;
  runId: string;
}

export interface AutonomusFilesProjectResponse {
  runId: string;
  files: FileNode[];
  stats: {
    totalFiles: number;
    totalSize: number;
  };
}
