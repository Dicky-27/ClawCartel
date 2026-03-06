"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { APP_CONFIG } from "../_configs/app";
import { disconnectSocket, getSocket } from "../_libs/socket/socket";
import {
  AgentMessage,
  AgentMessageType,
  ApprovalData,
  FileNode,
  RunStats,
  RunStep,
} from "../_types/chat";
import { ChatService } from "../_services/chat";
import { useMutation } from "@tanstack/react-query";
import { PHASE_LABELS } from "../_constant/chat";

interface ChatContextType {
  step: RunStep;
  messages: AgentMessage[];
  isConnected: boolean;
  error: string | null;
  loading: boolean;
  phase: string | null;
  runId: string | null;
  approvalData: ApprovalData | null;
  files: FileNode[];
  stats: RunStats | null;
  fileCount: number;
  messageCount: number;
  startDiscussion: (idea: string) => Promise<void>;
  sendUserMessage: (content: string) => string;
  removeMessage: (id: string) => void;
  continueToDevelopment: (approved: boolean) => Promise<void>;
  refreshFiles: () => Promise<void>;
  downloadProject: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState<RunStep>(RunStep.IDLE);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [approvalData, setApprovalData] = useState<ApprovalData | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [stats, setStats] = useState<RunStats | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);

  // Refs for mutable values used inside callbacks without triggering re-renders
  const runIdRef = useRef<string | null>(null);
  const activeMessagesRef = useRef<Record<string, string>>({});

  const mutateGetRunsId = useMutation({
    mutationFn: ChatService.getRunsId,
  });

  const mutateContinueToDevelopment = useMutation({
    mutationFn: ChatService.continueToDevelopment,
  });

  const mutateGetFilesProject = useMutation({
    mutationFn: ChatService.getFilesProject,
  });

  const refreshFiles = useCallback(async () => {
    if (!runIdRef.current) return;
    try {
      const response = await mutateGetFilesProject.mutateAsync(runIdRef.current);
      setFiles(response.data?.files ?? []);
    } catch (err) {
      console.error("Failed to load files:", err);
    }
  }, [mutateGetFilesProject]);

  // Stored in a ref so handleEvent can always call the latest version
  const refreshFilesRef = useRef(refreshFiles);

  useEffect(() => {
    refreshFilesRef.current = refreshFiles;
  }, [refreshFiles]);

  const handleEvent = useCallback(
    (event: { eventType: string; payload: Record<string, unknown> }) => {
      const { eventType, payload } = event;

      if (payload.phase && typeof payload.phase === "string") {
        setPhase(PHASE_LABELS[payload.phase] ?? payload.phase.toUpperCase());
      }

      switch (eventType) {
        case "agent.started": {
          const phase = payload.phase as string | undefined;
          const isRoundMarker =
            phase?.startsWith("round") ||
            phase === "final" ||
            phase?.startsWith("phase") ||
            phase === "code_generation";

          if (isRoundMarker) {
            setMessages((prev) => [
              ...prev,
              {
                id: `marker-${Date.now()}`,
                type: AgentMessageType.ROUND_MARKER,
                content: (payload.message as string) || phase || "",
                phase,
              },
            ]);
          } else {
            setLoading(false);
            const id = `msg-${payload.agentName as string}-${Date.now()}`;
            activeMessagesRef.current[payload.agentName as string] = id;
            setMessages((prev) => [
              ...prev,
              {
                id,
                type: AgentMessageType.AGENT,
                content: "",
                agentName: payload.agentName as string,
                agentEmoji: payload.agentEmoji as string,
                isDone: false,
                phase,
              },
            ]);
          }
          break;
        }

        case "agent.delta": {
          const phase = payload.phase as string | undefined;

          if (phase === "file_created") {
            setFileCount((c) => c + 1);
            setMessages((prev) => [
              ...prev,
              {
                id: `file-${Date.now()}`,
                type: AgentMessageType.FILE_CREATED,
                content: payload.message as string,
              },
            ]);
            break;
          }

          if (phase?.startsWith("round") || phase === "final") break;

          const deltaTargetId = activeMessagesRef.current[payload.agentName as string];
          if (deltaTargetId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === deltaTargetId
                  ? {
                      ...m,
                      content: (payload.accumulated as string) || (payload.message as string),
                    }
                  : m,
              ),
            );
          }
          break;
        }

        case "agent.done": {
          const phase = payload.phase as string | undefined;
          if (phase?.startsWith("round") || phase === "final") break;

          const doneTargetId = activeMessagesRef.current[payload.agentName as string];
          if (doneTargetId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === doneTargetId
                  ? { ...m, content: payload.message as string, isDone: true }
                  : m,
              ),
            );
            setMessageCount((c) => c + 1);
            delete activeMessagesRef.current[payload.agentName as string];
          }
          break;
        }

        case "run.done": {
          const phase = payload.phase as string;
          setLoading(false);
          if (phase === "awaiting_approval") {
            setApprovalData({
              message: payload.message as string,
              discussionSummary: payload.discussionSummary as unknown[],
            });
            setStep(RunStep.APPROVAL);
          } else if (phase === "completed") {
            setStats((payload.stats as RunStats) ?? null);
            setStep(RunStep.COMPLETE);
            refreshFilesRef.current();
          } else if (phase === "rejected") {
            setStep(RunStep.IDLE);
          }
          break;
        }
      }
    },
    [],
  );

  const connectWebSocket = useCallback(
    (id: string) => {
      const socket = getSocket();

      // Remove stale listeners so they don't stack across runs
      socket.off("agent_event");
      socket.off("disconnect");

      socket.on("disconnect", () => {
        setIsConnected(false);
      });

      socket.on("agent_event", (raw) => {
        handleEvent(raw);
      });

      const joinRun = () => {
        setIsConnected(true);
        socket.emit("join_run", { runId: id });
      };

      // If the socket is already connected the "connect" event will never fire,
      // so emit join_run immediately; otherwise wait for the connection.
      if (socket.connected) {
        joinRun();
      } else {
        socket.once("connect", () => {
          joinRun();
        });
      }

      socket.once("connect_error", (err) => {
        console.error("[socket] connect_error", err.message, err);
      });
    },
    [handleEvent],
  );

  const startDiscussion = useCallback(
    async (idea: string) => {
      const trimmed = idea.trim();
      if (!trimmed) return;

      setError(null);
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          type: AgentMessageType.USER,
          content: trimmed,
        },
      ]);
      setLoading(true);

      try {
        const response = await mutateGetRunsId.mutateAsync({ idea: trimmed, mode: "squad" });
        if (!response.data?.id) throw new Error(response.message ?? "Failed to start discussion");
        runIdRef.current = response.data?.id;
        setRunId(response.data?.id);
        setStep(RunStep.CHAT);
        connectWebSocket(response.data?.id);
        // Keep loading true until first agent message arrives via socket (agent.started)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start discussion");
        setLoading(false);
      }
    },
    [connectWebSocket, mutateGetRunsId],
  );

  const sendUserMessage = useCallback((content: string): string => {
    const id = `user-${Date.now()}`;
    if (!content.trim()) return id;
    setLoading(true);
    setMessages((prev) => [...prev, { id, type: AgentMessageType.USER, content: content.trim() }]);
    return id;
  }, []);

  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const continueToDevelopment = useCallback(
    async (approved: boolean) => {
      if (!runIdRef.current) return;
      setError(null);
      setLoading(true);
      try {
        const response = await mutateContinueToDevelopment.mutateAsync({
          runId: runIdRef.current,
          approved,
        });
        if (!response.data?.success) throw new Error(response.message ?? "Failed to continue");

        setApprovalData(null);
        if (approved) {
          setMessages((prev) => [
            ...prev,
            {
              id: `marker-${Date.now()}`,
              type: AgentMessageType.ROUND_MARKER,
              content: "🚀 Starting Code Generation...",
            },
          ]);
          setStep(RunStep.CHAT);
          // Keep loading true until first agent message arrives via socket (agent.started)
        } else {
          setStep(RunStep.IDLE);
          setLoading(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to continue");
        setLoading(false);
      }
    },
    [mutateContinueToDevelopment],
  );

  const downloadProject = useCallback(() => {
    if (!runIdRef.current) return;
    window.open(`${APP_CONFIG.api_url}/autonomous/runs/${runIdRef.current}/download`, "_blank");
  }, []);

  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  const value = useMemo(
    () => ({
      step,
      messages,
      isConnected,
      error,
      loading,
      phase,
      runId,
      approvalData,
      files,
      stats,
      fileCount,
      messageCount,
      startDiscussion,
      sendUserMessage,
      removeMessage,
      continueToDevelopment,
      refreshFiles,
      downloadProject,
    }),
    [
      step,
      messages,
      isConnected,
      error,
      loading,
      phase,
      runId,
      approvalData,
      files,
      stats,
      fileCount,
      messageCount,
      startDiscussion,
      sendUserMessage,
      removeMessage,
      continueToDevelopment,
      refreshFiles,
      downloadProject,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
