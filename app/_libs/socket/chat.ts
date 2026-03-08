export const CHAT_EVENTS = {
  MESSAGE: "chat:message",
  JOIN: "chat:join",
  LEAVE: "chat:leave",
} as const;

export interface ChatMessagePayload {
  id: string;
  senderId: string;
  senderName?: string;
  content: string;
  role?: "user" | "assistant";
  createdAt?: string;
}

export interface ChatSendPayload {
  content: string;
  senderId: string;
  senderName?: string;
  roomId?: string;
}
