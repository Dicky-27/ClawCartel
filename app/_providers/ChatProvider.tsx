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
  DeployedContract,
  FileNode,
  RunStats,
  RunStep,
} from "../_types/chat";
import { ChatService } from "../_services/chat";
import { useMutation } from "@tanstack/react-query";
import { BUILD_STEPPER_PHASES, PHASE_LABELS } from "../_constant/chat";
import { useAgents } from "./AgentsProvider";

interface SocketAgentPayload {
  id?: number;
  name?: string;
  role?: string;
}

const CODEGEN_DEBOUNCE_MS = 200;

interface ChatContextType {
  step: RunStep;
  messages: AgentMessage[];
  isConnected: boolean;
  error: string | null;
  loading: boolean;
  phase: string | null;
  phaseKey: string | null;
  runId: string | null;
  approvalData: ApprovalData | null;
  files: FileNode[];
  stats: RunStats | null;
  fileCount: number;
  messageCount: number;
  agentBubbles: Record<string, string>;
  codegenPendingWrites: Record<string, string>;
  hasCodegenPending: boolean;
  deployedTxHashes: DeployedContract[];
  ackCodegenWrite: (path: string) => void;
  ackCodegenWrites: (paths: string[]) => void;
  startDiscussion: (idea: string) => Promise<void>;
  sendUserMessage: (content: string) => string;
  removeMessage: (id: string) => void;
  continueToDevelopment: (approved: boolean) => Promise<void>;
  refreshFiles: () => Promise<void>;
  downloadProject: () => void;
  downloadPrd: () => void;
  isDownloadingPrd: boolean;
  resetThread: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { agents } = useAgents();
  const [step, setStep] = useState<RunStep>(RunStep.IDLE);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [phaseKey, setPhaseKey] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [approvalData, setApprovalData] = useState<ApprovalData | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [stats, setStats] = useState<RunStats | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [agentBubbles, setAgentBubbles] = useState<Record<string, string>>({});
  const [codegenPendingWrites, setCodegenPendingWrites] = useState<Record<string, string>>({});
  const [deployedTxHashes, setDeployedTxHashes] = useState<DeployedContract[]>([]);
  const [isDownloadingPrd, setIsDownloadingPrd] = useState(false);

  // Refs for mutable values used inside callbacks without triggering re-renders
  const runIdRef = useRef<string | null>(null);
  const activeMessagesRef = useRef<Record<string, string>>({});
  const codegenBuffersRef = useRef<Record<string, string>>({});
  const codegenDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const fileCreatedIdRef = useRef(0);
  const markerIdRef = useRef(0);
  const phaseKeyRef = useRef<string | null>(null);
  const codegenHasSetPhaseRef = useRef(false);
  useEffect(() => {
    phaseKeyRef.current = phaseKey;
  }, [phaseKey]);

  const mutateGetRunsId = useMutation({
    mutationFn: ChatService.getRunsId,
  });

  const mutateContinueToDevelopment = useMutation({
    mutationFn: ChatService.continueToDevelopment,
  });

  const mutateGetFilesProject = useMutation({
    mutationFn: ChatService.getFilesProject,
  });

  const mutateStartNewThread = useMutation({
    mutationFn: ChatService.startNewThread,
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
    (event: {
      eventType: string;
      payload?: Record<string, unknown>;
      data?: Record<string, unknown>;
      agent?: SocketAgentPayload;
    }) => {
      const payload = event.payload || event.data || {};
      const { eventType } = event;
      const topLevelAgent = event.agent || (payload.agent as SocketAgentPayload | undefined);
      const agentName =
        (topLevelAgent?.name as string | undefined) ?? (payload.agentName as string | undefined);
      const agentId = topLevelAgent?.id;
      const agentRole = topLevelAgent?.role as string | undefined;
      const resolvedName =
        (typeof agentName === "string" ? agentName : null) ||
        (typeof agentId !== "undefined"
          ? agents.find((a) => a.id === `agent-${agentId}`)?.name
          : null);
      const bubbleKey = resolvedName ?? `agent-${agentId ?? ""}`;

      if (payload.phase && typeof payload.phase === "string") {
        setPhaseKey(payload.phase);
        setPhase(PHASE_LABELS[payload.phase] ?? payload.phase.toUpperCase());
      }

      switch (eventType) {
        case "agent.started": {
          const phase = payload.phase as string | undefined;
          const isRoundMarker =
            phase?.startsWith("round") ||
            phase === "final" ||
            phase?.startsWith("phase") ||
            phase === "code_generation" ||
            phase === "scope_lock";

          // If this is a new phase, show it once as a round marker (use PHASE_LABELS so wording is editable in chat.ts)
          if (isRoundMarker) {
            setMessages((prev) => {
              // Ensure we don't duplicate markers back-to-back
              const lastSelectedMessage = prev[prev.length - 1];
              if (
                lastSelectedMessage?.type === AgentMessageType.ROUND_MARKER &&
                lastSelectedMessage.phase === phase
              ) {
                return prev;
              }
              const label = phase ? (PHASE_LABELS[phase] ?? (payload.message as string)) : (payload.message as string);
              markerIdRef.current += 1;
              return [
                ...prev,
                {
                  id: `marker-${markerIdRef.current}`,
                  type: AgentMessageType.ROUND_MARKER,
                  content: label || phase || "",
                  phase,
                },
              ];
            });
            // Do not add an agent bubble for phase-only messages (no "Alex" + "CODE GENERATION" / "BRIEF")
            setLoading(false);
            break;
          }

          // Start the agent message bubble for streaming (only when we have real content, not just a phase label)
          setLoading(false);
          const id = `msg-${bubbleKey}-${Date.now()}`;
          activeMessagesRef.current[bubbleKey] = id;
          setMessages((prev) => [
            ...prev,
            {
              id,
              type: AgentMessageType.AGENT,
              content: (payload.message as string) || "",
              agentName: bubbleKey,
              agentEmoji: payload.agentEmoji as string | undefined,
              agentId,
              agentRole,
              isDone: false,
              phase,
            },
          ]);
          break;
        }

        case "agent.delta": {
          const phase = payload.phase as string | undefined;
          const isRoundMarker =
            !!phase &&
            phase !== "file_created" &&
            (phase.startsWith("round") ||
              phase === "final" ||
              phase.startsWith("phase") ||
              phase === "code_generation" ||
              phase === "scope_lock");

          if (phase === "file_created") {
            setFileCount((c) => c + 1);
            fileCreatedIdRef.current += 1;
            setMessages((prev) => [
              ...prev,
              {
                id: `file-${fileCreatedIdRef.current}`,
                type: AgentMessageType.FILE_CREATED,
                content: payload.message as string,
              },
            ]);
            break;
          }

          if (isRoundMarker && phase) {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.type === AgentMessageType.ROUND_MARKER && last.phase === phase) return prev;
              const label = PHASE_LABELS[phase] ?? (payload.message as string);
              markerIdRef.current += 1;
              return [
                ...prev,
                {
                  id: `marker-${markerIdRef.current}`,
                  type: AgentMessageType.ROUND_MARKER,
                  content: label || phase || "",
                  phase,
                },
              ];
            });
          }

          const accumulated = payload.accumulated as string | undefined;
          if (typeof accumulated === "string" && bubbleKey) {
            setAgentBubbles((prev) => ({ ...prev, [bubbleKey]: accumulated }));
          }

          let deltaTargetId = activeMessagesRef.current[bubbleKey];
          const wouldBePhaseOnly =
            isRoundMarker && (accumulated === undefined || accumulated === "");
          if (
            (accumulated !== undefined || (payload.message as string)) &&
            !deltaTargetId &&
            bubbleKey &&
            !wouldBePhaseOnly
          ) {
            const id = `msg-${bubbleKey}-${Date.now()}`;
            activeMessagesRef.current[bubbleKey] = id;
            deltaTargetId = id;
            setMessages((prev) => [
              ...prev,
              {
                id,
                type: AgentMessageType.AGENT,
                content: accumulated ?? (payload.message as string) ?? "",
                agentName: bubbleKey,
                agentEmoji: payload.agentEmoji as string | undefined,
                agentId,
                agentRole,
                isDone: false,
                phase,
              },
            ]);
          }
          // Only update delta content if not just a random phase update without new chunks
          if (deltaTargetId && (accumulated !== undefined || !isRoundMarker)) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === deltaTargetId
                  ? {
                      ...m,
                      // Avoid overriding with phase messages if accumulated is absent
                      content: accumulated ?? (payload.message as string) ?? m.content,
                    }
                  : m,
              ),
            );
          }
          break;
        }

        case "agent.done": {
          const phase = payload.phase as string | undefined;
          const doneTargetId = activeMessagesRef.current[bubbleKey];
          if (doneTargetId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === doneTargetId
                  ? { ...m, content: (payload.message as string) ?? m.content, isDone: true }
                  : m,
              ),
            );
            setMessageCount((c) => c + 1);
            delete activeMessagesRef.current[bubbleKey];
          }
          setLoading(false);

          if (phase === "awaiting_approval") {
            setApprovalData({
              message: payload.message as string,
              discussionSummary: payload.discussionSummary as unknown[],
            });
            setStep(RunStep.APPROVAL);
          } else if (phase === "rejected") {
            setStep(RunStep.IDLE);
            setPhaseKey(null);
            setAgentBubbles({});
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
            setPhaseKey("completed");
            setPhase(null);
            setAgentBubbles({});
            codegenHasSetPhaseRef.current = false;
            refreshFilesRef.current();
          } else if (phase === "rejected") {
            setStep(RunStep.IDLE);
            setPhaseKey(null);
            setAgentBubbles({});
          } else if (phase === "chat_response") {
            setPhaseKey(null);
            setPhase(null);
            setAgentBubbles({});
          }
          break;
        }
      }
    },
    [agents],
  );

  const ackCodegenWrite = useCallback((path: string) => {
    setCodegenPendingWrites((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
  }, []);

  const ackCodegenWrites = useCallback((paths: string[]) => {
    if (paths.length === 0) return;
    setCodegenPendingWrites((prev) => {
      const next = { ...prev };
      for (const path of paths) delete next[path];
      return next;
    });
  }, []);

  const handleCodegenEvent = useCallback(
    (raw: { eventType: string; payload?: Record<string, unknown>; data?: Record<string, unknown> }) => {
      const payload = raw.payload || raw.data || {};
      const { eventType } = raw;
      console.log("[ChatProvider] codegen_event received", {
        eventType,
        payloadKeys: Object.keys(payload ?? {}),
        hasFilePath: "filePath" in (payload ?? {}),
        hasChunk: "chunk" in (payload ?? {}),
      });
      const projectType = payload.projectType as string | undefined;
      // Only buffer frontend files for the WebContainer preview
      const isFrontend = !projectType || projectType === "frontend";

      const advancePhaseKeyIfLater = (candidate: string) => {
        const currentIdx = BUILD_STEPPER_PHASES.indexOf(phaseKeyRef.current ?? "");
        const candidateIdx = BUILD_STEPPER_PHASES.indexOf(candidate);
        if (candidateIdx === -1) return;
        if (currentIdx === -1 || candidateIdx > currentIdx) {
          setPhaseKey(candidate);
          setPhase(PHASE_LABELS[candidate] ?? candidate);
        }
      };

      switch (eventType) {
        case "codegen.started": {
          if (!isFrontend) break;
          const filePath = payload.filePath as string | undefined;
          if (typeof filePath === "string") {
            const existing = codegenDebounceRef.current[filePath];
            if (existing) clearTimeout(existing);
            delete codegenDebounceRef.current[filePath];
            codegenBuffersRef.current[filePath] = "";
          }
          advancePhaseKeyIfLater(projectType === "frontend" ? "phase_frontend" : "code_generation");
          break;
        }
        case "codegen.delta": {
          if (!isFrontend) break;
          if (!codegenHasSetPhaseRef.current) {
            codegenHasSetPhaseRef.current = true;
            advancePhaseKeyIfLater("code_generation");
          }
          const filePath = payload.filePath as string | undefined;
          if (typeof filePath !== "string") break;
          // Content from chunk only (same as useWebSocket.sample.ts: current.content + incomingChunk)
          const incomingChunk =
            typeof payload.chunk === "string"
              ? payload.chunk
              : payload.chunk != null
                ? String(payload.chunk)
                : "";
          if (!codegenBuffersRef.current[filePath]) {
            codegenBuffersRef.current[filePath] = "";
          }
          codegenBuffersRef.current[filePath] += incomingChunk;
          const existing = codegenDebounceRef.current[filePath];
          if (existing) clearTimeout(existing);
          codegenDebounceRef.current[filePath] = setTimeout(() => {
            delete codegenDebounceRef.current[filePath];
            // Flush only the buffer built from chunks for this file
            const content = codegenBuffersRef.current[filePath];
            if (content !== undefined) {
              setCodegenPendingWrites((prev) => ({ ...prev, [filePath]: content }));
            }
          }, CODEGEN_DEBOUNCE_MS);
          break;
        }
        case "codegen.done": {
          const filePath = payload.filePath as string | undefined;

          // Track deployed contract tx hash (from any projectType)
          if (typeof filePath === "string") {
            const txHash = payload.txHash as string | undefined;
            if (typeof txHash === "string" && txHash.length > 0) {
              setDeployedTxHashes((prev) => [...prev, { txHash, filePath }]);
            }
          }

          // Only flush frontend files to the WebContainer
          if (!isFrontend) break;
          if (typeof filePath === "string") {
            const existing = codegenDebounceRef.current[filePath];
            if (existing) clearTimeout(existing);
            delete codegenDebounceRef.current[filePath];
            // Final content from buffer (built only from chunk in codegen.delta)
            const content = codegenBuffersRef.current[filePath];
            if (content !== undefined) {
              setCodegenPendingWrites((prev) => ({ ...prev, [filePath]: content }));
            }
            delete codegenBuffersRef.current[filePath];
          }
          break;
        }
        case "codegen.error": {
          const message =
            (payload.message as string) ?? (payload.error as string) ?? "Code generation failed";
          setError(typeof message === "string" ? message : "Code generation failed");
          break;
        }
        default:
          console.log("[ChatProvider] codegen_event unhandled eventType", eventType);
      }
    },
    [],
  );

  const connectWebSocket = useCallback(
    (id: string) => {
      const socket = getSocket();

      socket.off("agent_event");
      socket.off("codegen_event");
      socket.off("disconnect");

      socket.on("disconnect", () => {
        setIsConnected(false);
      });

      socket.on("agent_event", (raw) => {
        const ev = raw as { eventType?: string };
        console.log("[ChatProvider] agent_event received", { eventType: ev?.eventType ?? "unknown" });
        handleEvent(raw);
      });

      socket.on("codegen_event", (raw) => {
        const ev = raw as { eventType?: string };
        console.log("[ChatProvider] codegen_event connected, eventType:", ev?.eventType ?? "unknown");
        handleCodegenEvent(raw);
      });

      const joinRun = () => {
        console.log("[ChatProvider] join_run", { runId: id, socketConnected: socket.connected });
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
    [handleEvent, handleCodegenEvent],
  );

  const startDiscussion = useCallback(
    async (idea: string) => {
      const trimmed = idea.trim();
      if (!trimmed) return;

      setError(null);
      setAgentBubbles({});
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
      setApprovalData(null);
      if (approved) {
        setStep(RunStep.CHAT);
      } else {
        setStep(RunStep.IDLE);
      }
      setLoading(true);
      try {
        const response = await mutateContinueToDevelopment.mutateAsync({
          runId: runIdRef.current,
          approved,
        });
        if (!response.data?.success) throw new Error(response.message ?? "Failed to continue");
        if (!approved) {
          setStep(RunStep.IDLE);
          setLoading(false);
        }
        // When approved, keep loading true until first agent message arrives via socket (agent.started)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to continue");
        setLoading(false);
        if (approved) setStep(RunStep.APPROVAL);
      }
    },
    [mutateContinueToDevelopment],
  );

  const downloadProject = useCallback(() => {
    if (!runIdRef.current) return;
    window.open(`${APP_CONFIG.api_url}/autonomous/runs/${runIdRef.current}/download`, "_blank");
  }, []);

  const downloadPrd = useCallback(async () => {
    const id = runIdRef.current;
    if (!id || isDownloadingPrd) return;
    setIsDownloadingPrd(true);
    try {
      const blob = await ChatService.getPrdDownload(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "prd.md";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download PRD:", err);
    } finally {
      setIsDownloadingPrd(false);
    }
  }, [isDownloadingPrd]);

  const resetThread = useCallback(async () => {
    setError(null);
    setLoading(true);

    // Clear everything immediately for a snappy UI
    setMessages([]);
    setStep(RunStep.IDLE);
    setApprovalData(null);
    setPhaseKey(null);
    setPhase(null);
    setAgentBubbles({});
    setCodegenPendingWrites({});
    setDeployedTxHashes([]);
    setStats(null);
    setFiles([]);
    setFileCount(0);
    setMessageCount(0);

    // Reset refs
    runIdRef.current = null;
    activeMessagesRef.current = {};
    codegenBuffersRef.current = {};
    codegenHasSetPhaseRef.current = false;
    fileCreatedIdRef.current = 0;
    markerIdRef.current = 0;

    try {
      const response = await mutateStartNewThread.mutateAsync({
        idea: " ",
        mode: "squad",
      });
      if (!response.data?.id) throw new Error(response.message ?? "Failed to start new thread");
      runIdRef.current = response.data.id;
      setRunId(response.data.id);
      connectWebSocket(response.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset thread");
    } finally {
      setLoading(false);
    }
  }, [connectWebSocket, mutateStartNewThread]);

  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  const hasCodegenPending = Object.keys(codegenPendingWrites).length > 0;

  const value = useMemo(
    () => ({
      step,
      messages,
      isConnected,
      error,
      loading,
      phase,
      phaseKey,
      runId,
      approvalData,
      files,
      stats,
      fileCount,
      messageCount,
      agentBubbles,
      codegenPendingWrites,
      hasCodegenPending,
      deployedTxHashes,
      ackCodegenWrite,
      ackCodegenWrites,
      startDiscussion,
      sendUserMessage,
      removeMessage,
      continueToDevelopment,
      refreshFiles,
      downloadProject,
      downloadPrd,
      isDownloadingPrd,
      resetThread,
    }),
    [
      step,
      messages,
      isConnected,
      error,
      loading,
      phase,
      phaseKey,
      runId,
      approvalData,
      files,
      stats,
      fileCount,
      messageCount,
      agentBubbles,
      codegenPendingWrites,
      hasCodegenPending,
      deployedTxHashes,
      isDownloadingPrd,
      ackCodegenWrite,
      ackCodegenWrites,
      startDiscussion,
      sendUserMessage,
      removeMessage,
      continueToDevelopment,
      refreshFiles,
      downloadProject,
      downloadPrd,
      resetThread,
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
