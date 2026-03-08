import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import {
  ListToolsResultSchema,
  CallToolResultSchema,
  ListToolsResult,
  CallToolResult
} from '@modelcontextprotocol/sdk/types.js'
import Logger from '#app/utils/logger'
import { toolExecutor } from '#app/agents/skills/tool-executor'
import { ToolHandler, ToolContext, ToolResult } from '#app/agents/skills/skill.types'
import { AgentRole } from '#app/modules/agent-core/agent-core.interface'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

interface McpServerConfig {
    name: string
    transport: 'stdio' | 'sse'
    command?: string
    args?: string[]
    url?: string
    env?: Record<string, string>
    allowedRoles?: AgentRole[]
}

const MCP_TOOL_TIMEOUT_MS = parseInt(process.env.MCP_TOOL_TIMEOUT_MS || '15000')
const MCP_TOOL_MAX_CONTENT_CHARS = parseInt(process.env.MCP_TOOL_MAX_CONTENT_CHARS || '20000')
const FALLBACK_ALLOWED_ROLES: AgentRole[] = ['pm']

function sanitizeIdentifier(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function normalizeAllowedRoles(input?: AgentRole[]): AgentRole[] {
  if (!input || input.length === 0) {
    return FALLBACK_ALLOWED_ROLES
  }

  const valid = input.filter(role =>
    role === 'pm' || role === 'fe' || role === 'be_sc' || role === 'bd_research'
  )

  return valid.length > 0 ? valid : FALLBACK_ALLOWED_ROLES
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

function normalizeMcpContent(content: unknown, maxChars: number): string {
  let normalized = ''

  if (Array.isArray(content)) {
    normalized = content.map((block) => {
      if (block && typeof block === 'object' && 'type' in block && 'text' in block) {
        const maybeText = (block as { text?: unknown }).text
        if (typeof maybeText === 'string') {
          return maybeText
        }
      }

      try {
        return JSON.stringify(block)
      } catch {
        return String(block)
      }
    }).join('\n')
  } else if (typeof content === 'string') {
    normalized = content
  } else {
    try {
      normalized = JSON.stringify(content)
    } catch {
      normalized = String(content)
    }
  }

  if (normalized.length > maxChars) {
    return `${normalized.slice(0, maxChars)}\n...[truncated ${normalized.length - maxChars} chars]`
  }

  return normalized
}

export class McpClientService {
  private clients = new Map<string, Client>()
  private configs: McpServerConfig[] = []

  constructor() {
    this.loadConfigs()
  }

  private loadConfigs(): void {
    const configPath = join(process.cwd(), 'app/agents/mcp/mcp-servers.json')
    if (existsSync(configPath)) {
      try {
        const raw = readFileSync(configPath, 'utf8')
        this.configs = JSON.parse(raw)
        Logger.info({ count: this.configs.length }, 'Loaded MCP server configurations')
      } catch (error) {
        Logger.error({ err: error }, 'Failed to load MCP server configurations')
      }
    } else {
      Logger.warn('MCP server config file not found (app/agents/mcp/mcp-servers.json)')
    }
  }

  async initialize(): Promise<void> {
    for (const config of this.configs) {
      await this.connectToServer(config)
    }
  }

  private async connectToServer(config: McpServerConfig): Promise<void> {
    try {
      let transport
      if (config.transport === 'stdio') {
        if (!config.command) throw new Error(`Command required for stdio transport on ${config.name}`)
        transport = new StdioClientTransport({
          command: config.command,
          args: config.args || [],
          env: { ...process.env, ...config.env },
        })
      } else if (config.transport === 'sse') {
        if (!config.url) throw new Error(`URL required for SSE transport on ${config.name}`)
        transport = new SSEClientTransport(new URL(config.url))
      } else {
        throw new Error(`Unsupported transport: ${config.transport}`)
      }

      const client = new Client(
        {
          name: 'ClawCartel-Agent-Host',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      )

      await client.connect(transport)
      this.clients.set(config.name, client)
      Logger.info({ server: config.name }, 'Connected to MCP server')

      // Discover and register tools
      await this.discoverTools(config.name, client, normalizeAllowedRoles(config.allowedRoles))
    } catch (error) {
      Logger.error({ server: config.name, err: error }, 'Failed to connect to MCP server')
    }
  }

  private async discoverTools(serverName: string, client: Client, allowedRoles: AgentRole[]): Promise<void> {
    try {
      const response = await client.request(
        { method: 'tools/list' },
        ListToolsResultSchema
      )

      const tools = (response as ListToolsResult).tools || []
      Logger.info({ server: serverName, toolCount: tools.length }, 'Discovered MCP tools')

      for (const mcpTool of tools) {
        const registeredToolName = `mcp_${sanitizeIdentifier(serverName)}_${sanitizeIdentifier(mcpTool.name)}`
        const handler: ToolHandler = {
          name: registeredToolName,
          description: `[MCP: ${serverName}] ${mcpTool.description || ''}`,
          allowedRoles,
          producesFiles: false, // Default to false for custom MCP tools unless we know otherwise
          execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
            try {
              const callArguments: Record<string, unknown> = {
                ...params,
                __role: context.agentRole,
                __workspacePath: context.workspacePath,
              }
              const token = process.env.MCP_SERVER_TOKEN
              if (token) {
                callArguments.__token = token
              }

              const result = await withTimeout(
                client.request(
                  {
                    method: 'tools/call',
                    params: {
                      name: mcpTool.name,
                      arguments: callArguments,
                    },
                  },
                  CallToolResultSchema
                ),
                MCP_TOOL_TIMEOUT_MS,
                `MCP tool ${serverName}/${mcpTool.name}`
              )

              const toolResult = result as CallToolResult
              const isError = toolResult.isError === true

              // MCP Tool results are usually an array of content blocks (text, image, resource)
              // We'll flatten them to a string or a simplified object for our agents
              const data = {
                content: normalizeMcpContent(toolResult.content, MCP_TOOL_MAX_CONTENT_CHARS),
                source: {
                  server: serverName,
                  tool: mcpTool.name,
                },
              }

              return {
                success: !isError,
                data,
                error: isError ? `MCP tool execution failed (${serverName}/${mcpTool.name})` : undefined,
              }
            } catch (error) {
              return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown MCP error',
              }
            }
          },
        }

        toolExecutor.register(handler)
      }
    } catch (error) {
      Logger.error({ server: serverName, err: error }, 'Failed to discover tools from MCP server')
    }
  }

  async disconnectAll(): Promise<void> {
    for (const [name, client] of this.clients) {
      try {
        await client.close()
        Logger.info({ server: name }, 'Disconnected from MCP server')
      } catch (error) {
        Logger.error({ server: name, err: error }, 'Error disconnecting from MCP server')
      }
    }
    this.clients.clear()
  }
}

export const mcpClientService = new McpClientService()
export default mcpClientService
