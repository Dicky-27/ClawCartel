"use client";

import * as React from "react";
import { PixelAvatar } from "@/app/_components/PixelAvatar";
import { Button } from "@/app/_components/ui/button";
import { ScrollArea } from "@/app/_components/ui/scroll-area";
import { Textarea } from "@/app/_components/ui/textarea";
import { useSocketChat } from "@/app/_hooks/useSocketChat";
import { useSolana } from "@/app/_providers/SolanaProvider";
import { cn, getSolanaColorById, truncateId } from "@/app/_libs/utils";
import { BotIcon, MessageSquareIcon, Paperclip, SendIcon, WalletIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/_components/ui/popover";
import { AgentDialog } from "@/app/_components/agents/AgentDialog";
import { AGENTS, getAgentById } from "@/app/_data/agents";
import type { Agent } from "@/app/_data/agents";

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName?: string;
  content: string;
  role?: "user" | "assistant";
}


export const DUMMY_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: "1",
    senderId: "adam",
    senderName: "Adam",
    content: "Let's align on the strategy before we build.",
  },
  {
    id: "2",
    senderId: "alex",
    senderName: "Alex",
    content: "What if we tried a quick prototype first?",
  },
  {
    id: "3",
    senderId: "amelia",
    senderName: "Amelia",
    content: "I'll document the flow and edge cases.",
  },
  {
    id: "4",
    senderId: "bob",
    senderName: "BOB",
    content: "Ship it and we can fix in prod if needed.",
  },
  { id: "5", senderId: "adam", senderName: "Adam", content: "Risk is low if we scope to v1 only." },
  { id: "6", senderId: "alex", senderName: "Alex", content: "I'll have a demo by EOD." },
  {
    id: "7",
    senderId: "amelia",
    senderName: "Amelia",
    content: "QA checklist is ready. Who runs it?",
  },
  { id: "8", senderId: "bob", senderName: "BOB", content: "I'll run the E2E suite tonight." },
];

export interface ChatPanelProps {
  title?: string;
  emptyPlaceholder?: React.ReactNode;
  className?: string;
  roomId?: string;
  initialMessages?: ChatMessage[];
  onSend?: (message: string) => void;
  agentsPanelOpen?: boolean;
  onAgentsPanelOpenChange?: (open: boolean) => void;
  /** When set, opens the agent dialog (e.g. after clicking map or avatar) */
  agentForDialog?: Agent | null;
  onAgentDialogChange?: (agent: Agent | null) => void;
  agentIds?: string[];
}

const DEFAULT_AGENT_IDS = ["adam", "alex", "amelia", "bob"];

const AVATAR_HOVER =
  "group inline-flex shrink-0 rounded-full p-0.5 ring-2 ring-transparent transition-transform hover:scale-[1.06] hover:ring-primary focus-visible:scale-[1.06] focus-visible:ring-primary focus-visible:outline-none";

function AgentsPopoverContent({
  onSelectAgent,
  onClose,
}: {
  onSelectAgent: (agent: Agent) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="text-muted-foreground text-xs">
        Click an avatar to read about that agent.
      </p>
      <div className="flex flex-wrap gap-3">
        {AGENTS.map((agent) => (
          <button
            key={agent.id}
            type="button"
            onClick={() => {
              onSelectAgent(agent);
              onClose();
            }}
            className={AVATAR_HOVER}
            aria-label={`About ${agent.name}`}
          >
            <PixelAvatar
              id={agent.id}
              size={40}
              title={agent.name}
              className=""
            />
          </button>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="w-full text-xs" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}

export function ChatPanel({
  emptyPlaceholder,
  className,
  roomId = "global",
  initialMessages = [],
  onSend,
  agentsPanelOpen,
  onAgentsPanelOpenChange,
  agentForDialog: agentForDialogProp,
  onAgentDialogChange,
  agentIds = DEFAULT_AGENT_IDS,
}: ChatPanelProps) {
  const {
    isConnected: isWalletConnected,
    setOpen: setWalletOpen,
    selectedAccount,
    selectedWallet,
  } = useSolana();
  const socketChat = useSocketChat({
    roomId,
    senderId: selectedAccount?.address ?? null,
    senderName:
      selectedWallet?.name ?? (selectedAccount ? truncateId(selectedAccount.address) : null),
    initialMessages: isWalletConnected ? [] : initialMessages,
  });
  const messages = isWalletConnected ? socketChat.messages : initialMessages;
  const sendMessage = isWalletConnected ? socketChat.sendMessage : undefined;
  const [input, setInput] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [internalAgentsOpen, setInternalAgentsOpen] = React.useState(false);
  const agentsOpen = agentsPanelOpen ?? internalAgentsOpen;
  const setAgentsOpen = onAgentsPanelOpenChange ?? setInternalAgentsOpen;
  const [internalAgentForDialog, setInternalAgentForDialog] = React.useState<Agent | null>(null);
  const agentForDialog = agentForDialogProp ?? internalAgentForDialog;
  const setAgentForDialog = onAgentDialogChange ?? setInternalAgentForDialog;

  const handleSend = () => {
    if (!isWalletConnected) return;
    const text = input.trim();
    if (!text) return;
    setInput("");
    sendMessage?.(text);
    onSend?.(text);
    requestAnimationFrame(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }));
  };

  const handleFileUpload = () => {
    const file = input.trim();
    if (!file) return;
    setInput("");
    sendMessage?.(file);
    onSend?.(file);
  };

  const currentUserId = selectedAccount?.address ?? "user";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isWalletConnected) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isAgentId = (id: string) => agentIds.includes(id);

  return (
    <div className={cn("bg-background flex h-full flex-col", className)}>
      <div className="border-border/50 flex items-center justify-between border-b px-3 py-2 pr-10">
        <span className="text-xs font-bold">Chat</span>
        <Popover open={agentsOpen} onOpenChange={setAgentsOpen}>
          <PopoverTrigger
            className="hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs"
            aria-label="View agents"
          >
            <BotIcon className="size-3.5" />
            Agents
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-0" side="bottom">
            <AgentsPopoverContent
              onSelectAgent={(agent) => setAgentForDialog(agent)}
              onClose={() => setAgentsOpen(false)}
            />
          </PopoverContent>
        </Popover>
      </div>
      {/* Messages */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-3">
          {messages.length === 0 && emptyPlaceholder != null ? (
            <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center py-8 text-center text-sm">
              {emptyPlaceholder}
            </div>
          ) : messages.length === 0 ? (
            <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center py-8 text-center text-sm">
              <MessageSquareIcon className="mb-2 size-8 opacity-50" />
              <p>Start a conversation</p>
              <p className="mt-1 text-xs">Ask anything or describe what you’re building.</p>
            </div>
          ) : (
            messages.map((m) => {
              const { bg } = getSolanaColorById(m.senderId);
              const isUser =
                m.role === "user" || m.senderId === "user" || m.senderId === currentUserId;
              const label = isUser ? "You" : (m.senderName ?? truncateId(m.senderId));
              const avatar = (
                <PixelAvatar
                  id={m.senderId}
                  size={36}
                  title={m.senderName ?? m.senderId}
                  className="shrink-0"
                />
              );
              return (
                <div
                  key={m.id}
                  className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}
                >
                  {isAgentId(m.senderId) ? (
                    <button
                      type="button"
                      onClick={() => {
                        const agent = getAgentById(m.senderId);
                        if (agent) setAgentForDialog(agent);
                      }}
                      className={AVATAR_HOVER}
                      aria-label={`About ${m.senderName ?? m.senderId}`}
                    >
                      {avatar}
                    </button>
                  ) : (
                    avatar
                  )}
                  <div
                    className={cn(
                      "text-foreground max-w-[85%] rounded-xl border px-3 py-2 text-sm wrap-break-word",
                      isUser && "ml-auto border-[#14F195]/40 bg-[#14F195]/20",
                    )}
                    style={
                      isUser
                        ? undefined
                        : {
                            backgroundColor: `${bg}18`,
                            borderColor: `${bg}50`,
                          }
                    }
                  >
                    {!isUser && (
                      <div className="text-muted-foreground mb-0.5 font-mono text-[10px] font-medium tracking-wider uppercase">
                        {label}
                      </div>
                    )}
                    <span className="text-foreground">{m.content}</span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-border/50 shrink-0 border-t p-2">
        {!isWalletConnected ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-6 text-center text-sm">
            <WalletIcon className="size-8 opacity-50" />
            <p>Connect your wallet to chat</p>
            <Button variant="secondary" size="sm" onClick={() => setWalletOpen(true)}>
              <WalletIcon className="mr-2 size-4" />
              Connect Wallet
            </Button>
          </div>
        ) : (
          <div className="relative flex gap-2">
            <Button
              type="button"
              size="icon"
              className="absolute top-3 right-3 size-9 shrink-0"
              onClick={handleSend}
              aria-label="Send"
            >
              <SendIcon className="size-4" />
            </Button>

            <Button
              type="button"
              size="icon"
              className="absolute bottom-3 left-3 size-9 shrink-0"
              onClick={handleFileUpload}
              aria-label="Upload file"
            >
              <Paperclip className="size-4" />
            </Button>

            <Textarea
              placeholder="Message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              className="min-h-40 resize-none py-2 text-sm"
            />
          </div>
        )}
      </div>

      <AgentDialog
        open={!!agentForDialog}
        onOpenChange={(open) => !open && setAgentForDialog(null)}
        agent={agentForDialog}
      />
    </div>
  );
}
