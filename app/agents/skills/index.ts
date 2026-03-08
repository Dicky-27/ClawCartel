import { toolExecutor } from '#app/agents/skills/tool-executor'
import { ALL_TOOL_HANDLERS } from '#app/agents/skills/tool-handlers'
import { mcpClientService } from '#app/agents/mcp/mcp-client'
import Logger from '#app/utils/logger'

/**
 * Register all built-in tool handlers and initialize MCP connections.
 * Call this once during server initialization.
 */
export async function initializeSkills(): Promise<void> {
  // 1. Register local tools
  for (const handler of ALL_TOOL_HANDLERS) {
    toolExecutor.register(handler)
  }

  Logger.info({ count: ALL_TOOL_HANDLERS.length }, 'All local tool handlers registered')

  // 2. Initialize MCP Client (discovery)
  try {
    await mcpClientService.initialize()
    Logger.info('MCP Client initialized and tools discovered')
  } catch (error) {
    Logger.error({ err: error }, 'Failed to initialize MCP Client')
  }
}
