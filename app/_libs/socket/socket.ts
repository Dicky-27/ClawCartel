import { io, type Socket } from "socket.io-client";
import { APP_CONFIG } from "@/app/_configs/app";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const socketUrl = APP_CONFIG.socket_url;
    socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export default getSocket;
