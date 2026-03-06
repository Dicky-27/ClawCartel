"use client";

import * as React from "react";
import { Button } from "@/app/_components/ui/button";
import { ScrollArea } from "@/app/_components/ui/scroll-area";
import { Textarea } from "@/app/_components/ui/textarea";
import { useChat } from "@/app/_providers/ChatProvider";
import { useSolana } from "@/app/_providers/SolanaProvider";
import { cn, getAgentColorByName, shortenAddress } from "@/app/_libs/utils";
import { BotIcon, CheckIcon, LogOut, SendIcon, WalletIcon, XIcon } from "lucide-react";
import { AgentDialog } from "@/app/_components/agents/AgentDialog";
import type { Agent } from "@/app/_data/agents";
import Image from "next/image";
import { ChatBubble } from "./ChatBubble";

export interface ChatPanelProps {
  emptyPlaceholder?: React.ReactNode;
  className?: string;
  agentsPanelOpen?: boolean;
  onAgentsPanelOpenChange?: (open: boolean) => void;
  agentForDialog?: Agent | null;
  onAgentDialogChange?: (agent: Agent | null) => void;
  agentIds?: string[];
}

export function ChatPanel({
  emptyPlaceholder,
  className,
  agentForDialog: agentForDialogProp,
  onAgentDialogChange,
}: ChatPanelProps) {
  const { isConnected: isWalletConnected, setOpen: setWalletOpen, selectedAccount } = useSolana();

  const {
    step,
    messages,
    loading,
    approvalData,
    startDiscussion,
    sendUserMessage,
    continueToDevelopment,
  } = useChat();

  const [input, setInput] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [internalAgentForDialog, setInternalAgentForDialog] = React.useState<Agent | null>(null);
  const agentForDialog = agentForDialogProp ?? internalAgentForDialog;
  const setAgentForDialog = onAgentDialogChange ?? setInternalAgentForDialog;

  const scrollToBottom = () =>
    requestAnimationFrame(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }));

  const prevMessageCountRef = React.useRef(messages.length);
  React.useEffect(() => {
    if (loading) scrollToBottom();
  }, [loading]);
  React.useEffect(() => {
    const prev = prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;
    if (messages.length > prev) scrollToBottom();
  }, [messages.length]);

  const handleSend = () => {
    if (!isWalletConnected) return;
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    if (step === "idle") {
      startDiscussion(text);
    } else if (step === "chat") {
      sendUserMessage(text);
    }
    scrollToBottom();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isWalletConnected) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const showInput = isWalletConnected && step !== "approval" && step !== "complete";

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header */}
      <div className="border-border/50 flex items-center justify-between border-b px-3 py-2 pr-10">
        <div className="flex items-center gap-2">
          <span className="font-parabole mt-2 ml-2 text-lg">Chat</span>
        </div>
        <BotIcon className="mt-2 mr-2 size-5 lg:mr-0" />
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
              <p className="font-parabole text-text-primary text-center text-lg uppercase">
                Start a conversation
              </p>
              <p className="font-pp-neue-montreal-book text-muted-foreground mt-1 text-center text-xs">
                Describe your project idea to kick off the discussion.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              if (m.type === "round-marker") {
                return (
                  <div key={m.id} className="flex items-center gap-2 py-1">
                    <div className="border-border/50 flex-1 border-t" />
                    <span className="text-muted-foreground shrink-0 font-mono text-[10px] font-medium tracking-wider uppercase">
                      {m.content}
                    </span>
                    <div className="border-border/50 flex-1 border-t" />
                  </div>
                );
              }

              if (m.type === "file-created") {
                return (
                  <div
                    key={m.id}
                    className="border-border/50 text-muted-foreground bg-muted/30 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
                  >
                    <span>📄</span>
                    <span className="font-mono">{m.content}</span>
                  </div>
                );
              }

              const isUser = m.type === "user";
              const label = isUser ? "You" : (m.agentName ?? "Agent");

              return (
                <ChatBubble
                  key={m.id}
                  name={label}
                  date={m.createdAt ?? ""}
                  imagePath={isUser ? "/images/img-user.png" : "/images/img-agent.png"}
                  content={m.content}
                  isUser={isUser}
                />
              );
            })
          )}
          {loading && (
            <div
              className="flex w-full flex-col items-start animate-in fade-in-0 duration-200"
              role="status"
              aria-live="polite"
              aria-label="Agent is thinking"
            >
              <div className="flex items-center justify-between">
                <Image
                  src="/images/img-agent.png"
                  alt="Agent"
                  width={32}
                  height={32}
                  className="size-8 object-contain"
                />
                <p className="text-muted-foreground font-pp-neue-montreal-book text-lg"> </p>
              </div>
              <div className="ml-1">
                <h1
                  className="font-pp-neue-montreal-bold mt-1 text-lg"
                  style={{ color: getAgentColorByName("Agent") }}
                >
                  Agent
                </h1>
                <div className="font-pp-neue-montreal-book text-foreground mt-1 flex items-center gap-1.5 text-sm">
                  <span
                    className="bg-primary h-2 w-2 animate-bounce rounded-full"
                    style={{ animationDuration: "0.6s", animationDelay: "0ms" }}
                    aria-hidden
                  />
                  <span
                    className="bg-primary h-2 w-2 animate-bounce rounded-full"
                    style={{ animationDuration: "0.6s", animationDelay: "150ms" }}
                    aria-hidden
                  />
                  <span
                    className="bg-primary h-2 w-2 animate-bounce rounded-full"
                    style={{ animationDuration: "0.6s", animationDelay: "300ms" }}
                    aria-hidden
                  />
                </div>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Approval banner */}
      {step === "approval" && approvalData && (
        <div className="border-border/50 bg-muted/30 border-t p-3">
          <p className="text-foreground mb-1 text-xs font-medium">{approvalData.message}</p>
          <p className="text-muted-foreground mb-3 text-[11px]">
            The squad has agreed on the approach. Ready to generate code?
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => continueToDevelopment(true)}
              disabled={loading}
            >
              <CheckIcon className="mr-1.5 size-3.5" />
              Approve &amp; Build
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => continueToDevelopment(false)}
              disabled={loading}
            >
              <XIcon className="mr-1.5 size-3.5" />
              Reject
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-card-secondary mx-5 mb-5 shrink-0 rounded-2xl border p-2 [box-shadow:-4px_-4px_0px_0px_#8A8483_inset]">
        {!isWalletConnected ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-6 text-center text-sm">
            <WalletIcon className="size-8 opacity-50" />
            <p className="font-pixeloid-sans text-center">Connect your wallet to chat</p>

            <Button
              className="font-parabole bg-background-secondary text-primary hover:bg-background-secondary/90 w-fit gap-2 rounded-full px-4"
              onClick={() => setWalletOpen(true)}
            >
              Connect Wallet
            </Button>
          </div>
        ) : showInput ? (
          <div className="relative flex gap-2 bg-transparent">
            <Button
              type="button"
              size="icon"
              className="text-muted-foreground hover:text-text-primary hover:bg-primary absolute right-1 bottom-1 size-9 shrink-0 bg-transparent"
              onClick={handleSend}
              disabled={loading || !input.trim()}
              aria-label={step === "idle" ? "Start discussion" : "Send"}
            >
              <SendIcon className="size-4" />
            </Button>
            <Textarea
              placeholder={step === "idle" ? "Type a message..." : "Message…"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              className="ring-none min-h-20 resize-none border-none bg-transparent py-2 pr-14 text-sm focus-visible:ring-0 dark:bg-transparent"
              disabled={loading}
            />
          </div>
        ) : null}
      </div>

      {/* Connect Wallet */}
      {isWalletConnected && (
        <div className="flex items-center justify-between border-t px-5 py-4">
          <div className="flex items-center gap-2">
            <Image
              src="/images/img-user.png"
              alt="user"
              width={100}
              height={100}
              className="size-8 object-contain"
            />
            <p className="font-pp-neue-montreal-bold text-lg">
              {shortenAddress(selectedAccount?.address ?? "")}
            </p>
          </div>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => setWalletOpen(true)}
            className={"group hover:bg-transparent dark:hover:bg-transparent"}
          >
            <LogOut className="text-muted-foreground group-hover:text-text-primary size-5" />
          </Button>
        </div>
      )}

      <AgentDialog
        open={!!agentForDialog}
        onOpenChange={(open) => !open && setAgentForDialog(null)}
        agent={agentForDialog}
      />
    </div>
  );
}
