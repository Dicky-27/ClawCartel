/**
 * OpenClaw Gateway WebSocket Client
 * Implements the full OpenClaw Gateway Protocol v3
 * For use when HTTP Chat Completions is not available
 */

import WebSocket from 'ws'
import Logger from '#app/utils/logger'
import crypto from 'crypto'

export interface StreamChunk {
  content: string
  done: boolean
}

export interface AgentResponse {
  text: string
  meta: {
    model?: string
    provider?: string
    sessionId?: string
    usage?: Record<string, unknown>
  }
}

interface ConnectParams {
  agentId: string
  message: string
  sessionKey?: string
}

/**
 * OpenClaw Gateway WebSocket Client
 * Connects via SSH tunnel to remote Gateway
 */
export class OpenClawWebSocketClient {
  private gatewayUrl: string
  private token: string
  private ws: WebSocket | null = null
  private messageQueue: Array<{ id: string; method: string; params: unknown }> = []
  private pendingRequests: Map<string, {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
  }> = new Map()
  private eventHandlers: Map<string, ((payload: unknown) => void)[]> = new Map()
  private connected = false
  private messageId = 0
  private challengeNonce: string | null = null

  constructor() {
    // Use ws:// for WebSocket (not http://)
    const httpUrl = process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789'
    this.gatewayUrl = httpUrl.replace(/^http/, 'ws')
    this.token = process.env.OPENCLAW_GATEWAY_TOKEN || ''

    if (!this.token) {
      Logger.warn('OPENCLAW_GATEWAY_TOKEN not set - auth may fail')
    }

    Logger.info({ gatewayUrl: this.gatewayUrl }, 'OpenClawWebSocketClient initialized')
  }

  /**
   * Connect to Gateway with full handshake
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      Logger.debug('Connecting to Gateway WebSocket...')

      this.ws = new WebSocket(this.gatewayUrl, {
        headers: {
          'User-Agent': 'clawcartel-backend/1.0',
        },
      })

      this.ws.on('open', () => {
        Logger.debug('WebSocket connected, waiting for challenge...')
      })

      this.ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString())
          this.handleMessage(msg, resolve, reject)
        } catch (err) {
          Logger.error({ err, data: data.toString() }, 'Failed to parse message')
        }
      })

      this.ws.on('error', (err) => {
        Logger.error({ err }, 'WebSocket error')
        reject(err)
      })

      this.ws.on('close', () => {
        Logger.debug('WebSocket closed')
        this.connected = false
      })

      // Timeout connection
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('Connection timeout'))
        }
      }, 10000)
    })
  }

  /**
   * Stream agent response
   */
  async *streamAgentResponse(
    agentId: string,
    message: string,
    sessionKey?: string
  ): AsyncGenerator<StreamChunk, AgentResponse, unknown> {
    // Ensure connected
    if (!this.connected) {
      await this.connect()
    }

    const reqSessionKey = sessionKey || `${agentId}:${Date.now()}`
    const streamId = `stream-${Date.now()}`

    Logger.debug({ agentId, sessionKey: reqSessionKey }, 'Starting agent stream via WebSocket')

    // Accumulate response
    let fullText = ''
    const chunks: string[] = []

    // Set up event handler for agent responses
    const handleAgentEvent = (payload: any) => {
      if (payload?.text) {
        chunks.push(payload.text)
        fullText += payload.text
      }
    }

    this.on('agent.delta', handleAgentEvent)

    try {
      // Call agent via chat method
      const result = await this.callMethod('chat.send', {
        sessionKey: reqSessionKey,
        agentId,
        message,
        stream: true,
      })

      Logger.debug({ result }, 'Chat result')

      // Yield accumulated chunks
      for (const chunk of chunks) {
        yield { content: chunk, done: false }
      }

      return {
        text: fullText,
        meta: {
          sessionId: reqSessionKey,
          provider: 'openclaw',
        },
      }
    } finally {
      this.off('agent.delta', handleAgentEvent)
    }
  }

  /**
   * Disconnect
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.connected = false
    }
  }

  private handleMessage(
    msg: any,
    connectResolve: () => void,
    connectReject: (err: Error) => void
  ): void {
    Logger.debug({ type: msg.type, method: msg.method }, 'Received message')

    switch (msg.type) {
    case 'event':
      if (msg.event === 'connect.challenge') {
        this.handleChallenge(msg.payload, connectResolve, connectReject)
      } else {
        this.handleEvent(msg)
      }
      break

    case 'res':
      this.handleResponse(msg)
      break

    default:
      Logger.debug({ msg }, 'Unknown message type')
    }
  }

  private handleChallenge(
    payload: { nonce: string; ts: number },
    connectResolve: () => void,
    connectReject: (err: Error) => void
  ): void {
    Logger.debug({ nonce: payload.nonce }, 'Received challenge')
    this.challengeNonce = payload.nonce

    try {
      // Generate device identity
      const deviceKeypair = this.generateDeviceKeypair()
      const signature = this.signChallenge(payload.nonce, deviceKeypair)

      // Send connect request
      const connectReq = {
        type: 'req',
        id: this.nextId(),
        method: 'connect',
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: 'clawcartel-backend',
            version: '1.0.0',
            platform: 'node',
            mode: 'operator',
          },
          role: 'operator',
          scopes: ['operator.read', 'operator.write'],
          caps: [],
          commands: [],
          permissions: {},
          auth: { token: this.token },
          locale: 'en-US',
          userAgent: 'clawcartel-backend/1.0',
          device: {
            id: deviceKeypair.id,
            publicKey: deviceKeypair.publicKey,
            signature,
            signedAt: Date.now(),
            nonce: payload.nonce,
          },
        },
      }

      this.send(connectReq)

      // Wait for hello-ok response
      const checkConnected = setInterval(() => {
        if (this.connected) {
          clearInterval(checkConnected)
          connectResolve()
        }
      }, 100)

      setTimeout(() => {
        clearInterval(checkConnected)
        if (!this.connected) {
          connectReject(new Error('Connect timeout'))
        }
      }, 5000)

    } catch (err) {
      connectReject(err instanceof Error ? err : new Error('Connect failed'))
    }
  }

  private handleResponse(msg: any): void {
    const pending = this.pendingRequests.get(msg.id)
    if (!pending) {
      // Check if this is connect response
      if (msg.payload?.type === 'hello-ok') {
        Logger.debug('Connected to Gateway')
        this.connected = true
      }

      return
    }

    this.pendingRequests.delete(msg.id)

    if (msg.ok) {
      pending.resolve(msg.payload)
    } else {
      pending.reject(new Error(msg.error?.message || 'Request failed'))
    }
  }

  private handleEvent(msg: any): void {
    const handlers = this.eventHandlers.get(msg.event) || []
    for (const handler of handlers) {
      try {
        handler(msg.payload)
      } catch (err) {
        Logger.error({ err }, 'Event handler error')
      }
    }
  }

  private callMethod(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'))

        return
      }

      const id = this.nextId()
      const req = {
        type: 'req',
        id,
        method,
        params,
      }

      this.pendingRequests.set(id, { resolve, reject })
      this.send(req)

      // Timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error('Request timeout'))
        }
      }, 60000)
    })
  }

  private send(data: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  private nextId(): string {
    return `req-${++this.messageId}-${Date.now()}`
  }

  private on(event: string, handler: (payload: unknown) => void): void {
    const handlers = this.eventHandlers.get(event) || []
    handlers.push(handler)
    this.eventHandlers.set(event, handlers)
  }

  private off(event: string, handler: (payload: unknown) => void): void {
    const handlers = this.eventHandlers.get(event) || []
    const idx = handlers.indexOf(handler)
    if (idx > -1) {
      handlers.splice(idx, 1)
    }
  }

  private generateDeviceKeypair(): { id: string; publicKey: string; privateKey: string } {
    // Generate Ed25519-like keypair (simplified for demo)
    const id = `clawcartel-${crypto.randomBytes(8).toString('hex')}`
    const keypair = crypto.generateKeyPairSync('ed25519')
    const publicKey = keypair.publicKey.export({ type: 'spki', format: 'pem' }).toString('base64')
    const privateKey = keypair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString('base64')

    return { id, publicKey, privateKey }
  }

  private signChallenge(nonce: string, keypair: { privateKey: string }): string {
    // Sign the challenge nonce
    const sign = crypto.createSign('SHA256')
    sign.update(nonce)

    return sign.sign(keypair.privateKey, 'base64')
  }

  /**
   * Check health via WebSocket
   */
  async healthCheck(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.connect()
      this.disconnect()

      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}

export default OpenClawWebSocketClient
