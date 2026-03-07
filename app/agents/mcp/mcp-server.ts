import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import Logger from '#app/utils/logger'
import { toolExecutor } from '#app/agents/skills/tool-executor'

export class McpServerService {
  private server: Server

  constructor() {
    this.server = new Server(
      {
        name: 'ClawCartel-Tool-Server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    )

    this.setupHandlers()
  }

  private setupHandlers(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const allTools = (toolExecutor as any).handlers // Accessing private for exposure
      const mcpTools = Array.from(allTools.values()).map((tool: any) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: 'object',
          properties: {}, // We don't have rigorous JSON schemas for our current tools, but we could add them
          additionalProperties: true
        }
      }))

      return {
        tools: mcpTools
      }
    })

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: params } = request.params

      try {
        // We need a dummy context since MCP calls don't have a backend "runId" context usually
        // but our tools expect them. We'll provide a 'system' context.
        const result = await toolExecutor.execute(
          { tool: name, params: params || {} },
          {
            runId: 'mcp-external',
            agentId: 'mcp-client',
            agentRole: 'pm', // Assume PM permissions for external MCP calls by default
            workspacePath: process.env.WORKSPACE_ROOT || '/tmp/claw-cartel-mcp',
          }
        )

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.success ? result.data : result.error)
            }
          ],
          isError: !result.success
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: error instanceof Error ? error.message : 'Unknown error'
            }
          ],
          isError: true
        }
      }
    })
  }

  async start(): Promise<void> {
    try {
      // For now, we only support stdio transport for the server
      const transport = new StdioServerTransport()
      await this.server.connect(transport)
      Logger.info('MCP Server started via stdio')
    } catch (error) {
      Logger.error({ err: error }, 'Failed to start MCP Server')
    }
  }
}

export const mcpServerService = new McpServerService()

// Start the server if this file is run directly
if (process.argv[1] && (process.argv[1].endsWith('mcp-server.ts') || process.argv[1].endsWith('mcp-server.js'))) {
  mcpServerService.start().catch((error) => {
    Logger.error({ err: error }, 'Failed to start MCP Server standalone')
    process.exit(1)
  })
}

export default mcpServerService
