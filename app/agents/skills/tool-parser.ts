/**
 * Tool Parser
 * Parses tool calls from agent LLM output.
 *
 * Agents output tool calls using the format:
 * [TOOL_CALL]
 * tool: tool_name
 * params: { "key": "value" }
 * [/TOOL_CALL]
 */

import Logger from '#app/utils/logger'
import type { ToolCall } from '#app/agents/skills/skill.types'

const TOOL_CALL_START = '[TOOL_CALL]'
const TOOL_CALL_END = '[/TOOL_CALL]'
const TOOL_NAME_REGEX = /^[a-z][a-z0-9_]*$/i
const MAX_TOOL_CALLS_PER_RESPONSE = 12
const MAX_TOOL_BLOCK_CHARS = 20_000

function parseToolCallBlock(rawBlock: string): {
    toolCall?: ToolCall
    error?: string
} {
  const block = rawBlock.replace(/\r\n/g, '\n').trim()
  if (!block) {
    return { error: 'Empty [TOOL_CALL] block' }
  }

  const lines = block.split('\n')
  const toolLineIndex = lines.findIndex(line => /^tool\s*:/i.test(line.trim()))
  const paramsLineIndex = lines.findIndex(line => /^params\s*:/i.test(line.trim()))

  if (toolLineIndex === -1) {
    return { error: 'Missing "tool:" line' }
  }
  if (paramsLineIndex === -1) {
    return { error: 'Missing "params:" line' }
  }
  if (paramsLineIndex < toolLineIndex) {
    return { error: '"params:" appears before "tool:"' }
  }

  const toolLine = lines[toolLineIndex].trim()
  const tool = toolLine.split(/:\s*/, 2)[1]?.trim() || ''
  if (!TOOL_NAME_REGEX.test(tool)) {
    return { error: `Invalid tool name "${tool}"` }
  }

  const paramsHead = lines[paramsLineIndex].replace(/^params\s*:/i, '').trim()
  const paramsTail = lines.slice(paramsLineIndex + 1).join('\n')
  const paramsText = [paramsHead, paramsTail].filter(Boolean).join('\n').trim() || '{}'

  if (paramsText.length > MAX_TOOL_BLOCK_CHARS) {
    return { error: `params JSON exceeds max size (${MAX_TOOL_BLOCK_CHARS} chars)` }
  }

  try {
    const parsed = JSON.parse(paramsText)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { error: 'params must be a JSON object' }
    }

    return {
      toolCall: {
        tool,
        params: parsed as Record<string, unknown>,
      },
    }
  } catch {
    return { error: 'params is not valid JSON' }
  }
}

/**
 * Parse [TOOL_CALL]...[/TOOL_CALL] blocks from agent output.
 * Returns the clean text (without tool blocks) and extracted tool calls.
 */
export function parseToolCalls(agentOutput: string): {
    text: string
    toolCalls: ToolCall[]
    errors: string[]
} {
  if (!agentOutput.includes(TOOL_CALL_START)) {
    return {
      text: agentOutput.trim(),
      toolCalls: [],
      errors: [],
    }
  }

  const toolCalls: ToolCall[] = []
  const errors: string[] = []
  let lastIndex = 0
  const textParts: string[] = []

  while (lastIndex < agentOutput.length) {
    const startIndex = agentOutput.indexOf(TOOL_CALL_START, lastIndex)
    if (startIndex === -1) {
      textParts.push(agentOutput.slice(lastIndex))
      break
    }

    if (startIndex > lastIndex) {
      textParts.push(agentOutput.slice(lastIndex, startIndex))
    }

    const blockStart = startIndex + TOOL_CALL_START.length
    const endIndex = agentOutput.indexOf(TOOL_CALL_END, blockStart)
    if (endIndex === -1) {
      errors.push('Unclosed [TOOL_CALL] block')
      textParts.push(agentOutput.slice(startIndex))
      lastIndex = agentOutput.length
      break
    }

    const block = agentOutput.slice(blockStart, endIndex)
    if (block.length > MAX_TOOL_BLOCK_CHARS) {
      errors.push(`Tool block exceeds max size (${MAX_TOOL_BLOCK_CHARS} chars)`)
      lastIndex = endIndex + TOOL_CALL_END.length
      continue
    }

    const parsed = parseToolCallBlock(block)
    if (parsed.toolCall) {
      if (toolCalls.length >= MAX_TOOL_CALLS_PER_RESPONSE) {
        errors.push(`Exceeded max tool calls per response (${MAX_TOOL_CALLS_PER_RESPONSE})`)
      } else {
        toolCalls.push(parsed.toolCall)
      }
    } else if (parsed.error) {
      errors.push(parsed.error)
    }

    lastIndex = endIndex + TOOL_CALL_END.length
  }

  if (errors.length > 0) {
    Logger.warn({ errors }, 'Tool call parsing issues detected')
  }

  return {
    text: textParts.join('').trim(),
    toolCalls,
    errors,
  }
}

/**
 * Check if agent output contains any tool calls.
 */
export function hasToolCalls(agentOutput: string): boolean {
  return agentOutput.includes(TOOL_CALL_START)
}
