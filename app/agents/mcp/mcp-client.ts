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
      await this.discoverTools(config.name, client, config.allowedRoles || ['pm', 'fe', 'be_sc', 'bd_research'])
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
        const handler: ToolHandler = {
          name: `${serverName}_${mcpTool.name}`,
          description: `[MCP: ${serverName}] ${mcpTool.description || ''}`,
          allowedRoles,
          producesFiles: false, // Default to false for custom MCP tools unless we know otherwise
          execute: async (params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
            try {
              const result = await client.request(
                {
                  method: 'tools/call',
                  params: {
                    name: mcpTool.name,
                    arguments: params,
                  },
                },
                CallToolResultSchema
              )

              const toolResult = result as CallToolResult
              const isError = toolResult.isError === true

              // MCP Tool results are usually an array of content blocks (text, image, resource)
              // We'll flatten them to a string or a simplified object for our agents
              const data = toolResult.content

              return {
                success: !isError,
                data,
                error: isError ? 'MCP tool execution failed' : undefined,
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
