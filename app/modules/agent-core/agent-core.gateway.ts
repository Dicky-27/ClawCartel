/**
 * OpenClaw Gateway Client
 * HTTP streaming with CLI fallback for agent communication
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import Logger from '#app/utils/logger'
import { StreamChunk, AgentResponse } from '#app/modules/agent-core/agent-core.interface'

const execFileAsync = promisify(execFile)

const OPENCLAW_BIN = process.env.OPENCLAW_BIN ?? 'openclaw'
const OPENCLAW_TIMEOUT_SECONDS = parseInt(process.env.OPENCLAW_AGENT_TIMEOUT_SECONDS ?? '120')

export class OpenClawGatewayClient {
  private baseUrl: string
  private wsUrl: string
  private token: string
  private useCliFallback: boolean

  constructor() {
    const rawUrl = process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789'
    this.baseUrl = rawUrl.replace(/\/$/, '')
    this.wsUrl = this.baseUrl.replace(/^http/, 'ws')
    this.token = process.env.OPENCLAW_GATEWAY_TOKEN || ''
    this.useCliFallback = false

    if (!this.token) {
      Logger.warn('OPENCLAW_GATEWAY_TOKEN not set - auth may fail')
    }
  }

  async *streamAgentResponse(
    agentId: string,
    message: string,
    sessionKey?: string
  ): AsyncGenerator<StreamChunk, AgentResponse, unknown> {
    if (!this.useCliFallback) {
      try {
        return yield* this.streamViaHttp(agentId, message, sessionKey)
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : ''
        if (errMsg.includes('405') || errMsg.includes('fetch failed') || errMsg.includes('ECONNREFUSED')) {
          Logger.warn('HTTP endpoint unavailable, falling back to openclaw CLI')
          this.useCliFallback = true
        } else {
          throw error
        }
      }
    }

    return yield* this.streamViaCli(agentId, message, sessionKey)
  }

  private async *streamViaHttp(
    agentId: string,
    message: string,
    sessionKey?: string
  ): AsyncGenerator<StreamChunk, AgentResponse, unknown> {
    const url = `${this.baseUrl}/v1/chat/completions`
    const requestSessionKey = sessionKey || `${agentId}:${Date.now()}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        'x-openclaw-agent-id': agentId,
        ...(requestSessionKey ? { 'x-openclaw-session-key': requestSessionKey } : {}),
      },
      body: JSON.stringify({
        model: `openclaw:${agentId}`,
        messages: [{ role: 'user', content: message }],
        stream: true,
        user: requestSessionKey,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`Gateway error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body from Gateway')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let fullText = ''
    let lastMeta: Record<string, unknown> = {}

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const chunk = this.parseSSELine(line)
          if (!chunk) continue

          if (chunk.done) {
            return {
              text: fullText,
              meta: { sessionId: requestSessionKey, ...lastMeta },
            }
          }

          if (chunk.content) {
            fullText += chunk.content
            yield { content: chunk.content, done: chunk.done }
          }

          if (chunk.meta) {
            lastMeta = { ...lastMeta, ...chunk.meta }
          }
        }
      }

      return {
        text: fullText,
        meta: { sessionId: requestSessionKey, ...lastMeta },
      }
    } finally {
      reader.releaseLock()
    }
  }

  private async *streamViaCli(
    agentId: string,
    message: string,
    sessionKey?: string
  ): AsyncGenerator<StreamChunk, AgentResponse, unknown> {
    const requestSessionKey = sessionKey || `${agentId}:${Date.now()}`

    const args = [
      'agent',
      '--agent', agentId,
      '--message', message,
      '--json',
      '--timeout', String(OPENCLAW_TIMEOUT_SECONDS),
      '--verbose', 'off',
    ]

    if (sessionKey) {
      args.push('--session', sessionKey)
    }

    const env = {
      ...process.env,
      OPENCLAW_GATEWAY_URL: this.wsUrl,
      ...(this.token ? { OPENCLAW_GATEWAY_TOKEN: this.token } : {}),
    }

    try {
      const { stdout } = await execFileAsync(OPENCLAW_BIN, args, {
        maxBuffer: 8 * 1024 * 1024,
        env,
        timeout: OPENCLAW_TIMEOUT_SECONDS * 1000,
      })

      const parsed = JSON.parse(stdout)
      const payloads = parsed?.result?.payloads ?? []

      const text = payloads
        .map((p: { text?: string }) => p?.text ?? '')
        .filter(Boolean)
        .join('\n')
        .trim()

      const chunks = this.chunkText(text)
      for (const chunk of chunks) {
        yield { content: chunk, done: false }
      }

      return {
        text: text || 'No response text from OpenClaw agent.',
        meta: {
          model: parsed?.result?.meta?.agentMeta?.model,
          provider: parsed?.result?.meta?.agentMeta?.provider,
          sessionId: parsed?.result?.meta?.agentMeta?.sessionId || requestSessionKey,
          usage: parsed?.result?.meta?.agentMeta?.lastCallUsage ?? parsed?.result?.meta?.agentMeta?.usage,
          runId: parsed?.runId,
        },
      }
    } catch (error) {
      throw new Error(`CLI execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async callAgent(agentId: string, message: string, sessionKey?: string): Promise<AgentResponse> {
    const requestSessionKey = sessionKey || `${agentId}:${Date.now()}`

    if (!this.useCliFallback) {
      try {
        const url = `${this.baseUrl}/v1/chat/completions`
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`,
            'x-openclaw-agent-id': agentId,
          },
          body: JSON.stringify({
            model: `openclaw:${agentId}`,
            messages: [{ role: 'user', content: message }],
            stream: false,
            user: requestSessionKey,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          const content = data.choices?.[0]?.message?.content || ''

          return {
            text: content,
            meta: {
              model: data.model,
              provider: 'openclaw',
              sessionId: requestSessionKey,
              usage: data.usage,
            },
          }
        }
      } catch {
        this.useCliFallback = true
      }
    }

    const args = [
      'agent',
      '--agent', agentId,
      '--message', message,
      '--json',
      '--timeout', String(OPENCLAW_TIMEOUT_SECONDS),
      '--verbose', 'off',
    ]

    const { stdout } = await execFileAsync(OPENCLAW_BIN, args, {
      maxBuffer: 8 * 1024 * 1024,
      env: {
        ...process.env,
        OPENCLAW_GATEWAY_URL: this.wsUrl,
        ...(this.token ? { OPENCLAW_GATEWAY_TOKEN: this.token } : {}),
      },
    })

    const parsed = JSON.parse(stdout)
    const payloads = parsed?.result?.payloads ?? []
    const text = payloads
      .map((p: { text?: string }) => p?.text ?? '')
      .filter(Boolean)
      .join('\n')
      .trim()

    return {
      text: text || 'No response text from OpenClaw agent.',
      meta: {
        model: parsed?.result?.meta?.agentMeta?.model,
        provider: parsed?.result?.meta?.agentMeta?.provider,
        sessionId: parsed?.result?.meta?.agentMeta?.sessionId || requestSessionKey,
        usage: parsed?.result?.meta?.agentMeta?.lastCallUsage ?? parsed?.result?.meta?.agentMeta?.usage,
        runId: parsed?.runId,
      },
    }
  }

  async healthCheck(): Promise<{ ok: boolean; error?: string; status?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: { 'Authorization': `Bearer ${this.token}` },
      })

      if (!response.ok) {
        return { ok: false, error: `HTTP ${response.status}` }
      }

      const data = await response.json().catch(() => ({}))

      return { ok: true, status: data.status || 'ok' }
    } catch (error) {
      try {
        await execFileAsync(OPENCLAW_BIN, ['health', '--json'], {
          maxBuffer: 2 * 1024 * 1024,
          timeout: 15000,
          env: {
            ...process.env,
            OPENCLAW_GATEWAY_URL: this.wsUrl,
            ...(this.token ? { OPENCLAW_GATEWAY_TOKEN: this.token } : {}),
          },
        })

        return { ok: true, status: 'ok (via CLI)' }
      } catch {
        return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }

  private parseSSELine(line: string): { content?: string; done: boolean; meta?: Record<string, unknown> } | null {
    const trimmed = line.trim()
    if (!trimmed || !trimmed.startsWith('data: ')) return null

    const data = trimmed.slice(6)
    if (data === '[DONE]') return { done: true }

    try {
      const parsed = JSON.parse(data)
      const content = parsed.choices?.[0]?.delta?.content || ''
      const meta: Record<string, unknown> = {}

      if (parsed.model) meta.model = parsed.model
      if (parsed.usage) meta.usage = parsed.usage

      return { content, done: false, meta: Object.keys(meta).length > 0 ? meta : undefined }
    } catch {
      return null
    }
  }

  private chunkText(text: string): string[] {
    const trimmed = text.trim()
    if (!trimmed) return []

    const lines = trimmed.split(/\n+/).map(l => l.trim()).filter(Boolean)
    if (lines.length > 1) return lines

    return trimmed.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)
  }
}

export default new OpenClawGatewayClient()
