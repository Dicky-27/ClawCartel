"use client";

import { useCallback, useEffect, useState } from "react";
import { getSocket } from "@/app/_libs/socket/socket";
import { CHAT_EVENTS, type ChatMessagePayload } from "@/app/_libs/socket/chat";

export interface UseSocketChatOptions {
  roomId?: string;
  senderId: string | null;
  senderName?: string | null;
  initialMessages?: ChatMessagePayload[];
}

export function useSocketChat({
  roomId = "global",
  senderId,
  senderName,
  initialMessages = [],
}: UseSocketChatOptions) {
  const [messages, setMessages] = useState<ChatMessagePayload[]>(initialMessages);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    const alreadyConnected = socket.connected;
    queueMicrotask(() => {
      if (alreadyConnected) setIsConnected(true);
    });

    socket.emit(CHAT_EVENTS.JOIN, { roomId });

    const onMessage = (payload: ChatMessagePayload) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.id)) return prev;
        return [...prev, payload];
      });
    };

    socket.on(CHAT_EVENTS.MESSAGE, onMessage);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off(CHAT_EVENTS.MESSAGE, onMessage);
      socket.emit(CHAT_EVENTS.LEAVE, { roomId });
    };
  }, [roomId]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!senderId || !content.trim()) return;
      const socket = getSocket();
      const payload: ChatMessagePayload = {
        id: crypto.randomUUID(),
        senderId,
        senderName: senderName ?? undefined,
        content: content.trim(),
        role: "user",
      };
      setMessages((prev) => [...prev, payload]);
      socket.emit(CHAT_EVENTS.MESSAGE, {
        ...payload,
        roomId,
      });
    },
    [roomId, senderId, senderName],
  );

  return { messages, sendMessage, isConnected };
}
