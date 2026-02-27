/**
 * CLI Test Script for ClawCartel Agent Events
 *
 * Usage:
 *   npx tsx tests/listen-events.ts [runId]
 *
 *   If runId is provided, joins that run.
 *   If no runId, starts a new run with default prompt.
 *
 * Examples:
 *   npx tsx tests/listen-events.ts                    # Start new run
 *   npx tsx tests/listen-events.ts abc-123-def        # Join existing run
 *   BACKEND_URL=http://localhost:3000 npx tsx tests/listen-events.ts
 */

import { io, Socket } from 'socket.io-client'
import readline from 'readline'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000'
const API_URL = `${BACKEND_URL}/v1/agent`

// Agent display config
const AGENT_CONFIG: Record<string, { name: string; color: string; emoji: string }> = {
  pm: { name: 'Vince (PM)', color: '\x1b[31m', emoji: '👔' },
  fe: { name: 'Pixel (FE)', color: '\x1b[36m', emoji: '🎨' },
  // eslint-disable-next-line camelcase
  be_sc: { name: 'Chain (BE)', color: '\x1b[34m', emoji: '⚙️' },
  // eslint-disable-next-line camelcase
  bd_research: { name: 'Scout (BD+Research)', color: '\x1b[33m', emoji: '🔍' },
}

const RESET = '\x1b[0m'
const GREEN = '\x1b[32m'
const GRAY = '\x1b[90m'
const BOLD = '\x1b[1m'

// State tracking
let eventCount = 0
let runId: string | null = null
const agentBuffers: Record<string, string> = {}
const agentStates: Record<string, string> = {}

function log(message: string, ...args: unknown[]) {
  console.log(`${GRAY}[${new Date().toISOString()}]${RESET}`, message, ...args)
}

function logAgent(role: string, message: string, state?: string) {
  const config = AGENT_CONFIG[role] || { name: role, color: '\x1b[37m', emoji: '🤖' }
  const stateStr = state ? ` [${state.toUpperCase()}]` : ''
  console.log(`${config.color}${config.emoji} ${BOLD}${config.name}${RESET}${config.color}${stateStr}${RESET}: ${message}`)
}

function logSystem(message: string) {
  console.log(`${GREEN}🔔 SYSTEM:${RESET} ${message}`)
}

async function startRun(idea: string, mode: 'single' | 'squad' = 'squad', parallel = true) {
  log('Starting new run...', { idea, mode, parallel })

  const response = await fetch(`${API_URL}/agent/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idea,
      mode,
      parallel,
      ...(mode === 'single' && { role: 'pm' })
    })
  })

  if (!response.ok) {
    throw new Error(`Failed to start run: ${response.status} ${response.statusText}`)
  }

  const responseData = await response.json()
  const data = responseData?.data || responseData
  runId = data.id

  logSystem(`Run started: ${BOLD}${runId}${RESET}`)
  log(`Status: ${data.status}`)

  return runId
}

function joinRun(socket: Socket, targetRunId: string) {
  runId = targetRunId
  logSystem(`Joining run: ${BOLD}${runId}${RESET}`)
  socket.emit('join_run', { runId })
}

function setupSocketHandlers(socket: Socket) {
  socket.on('connect', () => {
    logSystem('Connected to backend')
  })

  socket.on('disconnect', () => {
    logSystem('Disconnected from backend')
  })

  socket.on('connect_error', (err) => {
    console.error('Connection error:', err.message)
    process.exit(1)
  })

  socket.on('joined_run', (data) => {
    logSystem(`Joined run room: ${data.runId}`)
  })

  socket.on('left_run', (data) => {
    logSystem(`Left run room: ${data.runId}`)
  })

  socket.on('run_replay', (data) => {
    log(`Loaded ${data.events?.length || 0} historical events`)
    if (data.events?.length > 0) {
      data.events.forEach((event: any) => handleEvent(event))
    }
  })

  socket.on('agent_event', (event) => {
    eventCount++
    handleEvent(event)
  })

  socket.on('agent_state', (data) => {
    agentStates[data.role] = data.state
    // State is already shown in agent_event, but log if standalone
    if (!data.timestamp) {
      logAgent(data.role, `State changed to: ${data.state}`, data.state)
    }
  })
}

function handleEvent(event: any) {
  const { role, eventType, payload } = event

  switch (eventType) {
  case 'agent.started': {
    logAgent(role, `🚀 ${payload.message || 'Agent started'}`, 'started')
    break
  }

  case 'agent.delta': {
    // Accumulate chunks
    if (!agentBuffers[role]) agentBuffers[role] = ''
    agentBuffers[role] += payload.message || ''

    // Show streaming indicator occasionally
    if (eventCount % 10 === 0) {
      process.stdout.write(`${GRAY}.${RESET}`)
    }
    break
  }

  case 'agent.done': {
    process.stdout.write('\n')
    logAgent(role, `${GREEN}✅ Completed${RESET}`, 'completed')

    // Show final output
    const finalText = agentBuffers[role] || payload.message
    if (finalText) {
      const lines = finalText.split('\n').slice(0, 20) // First 20 lines
      lines.forEach((line: string) => {
        console.log(`   ${GRAY}|${RESET} ${line}`)
      })
      if (finalText.split('\n').length > 20) {
        console.log(`   ${GRAY}| ... (${finalText.split('\n').length - 20} more lines)${RESET}`)
      }
    }

    delete agentBuffers[role]
    break
  }

  case 'agent.error': {
    process.stdout.write('\n')
    logAgent(role, `❌ ERROR: ${payload.message || 'Unknown error'}`, 'error')
    delete agentBuffers[role]
    break
  }

  case 'run.done': {
    logSystem(`${GREEN}${BOLD}🏁 RUN COMPLETE${RESET}: ${payload.message || 'Run finished'}`)
    log(`Total events: ${eventCount}`)

    // Summary
    console.log('\n📊 Agent Summary:')
    Object.entries(agentStates).forEach(([agent, state]) => {
      const config = AGENT_CONFIG[agent] || { emoji: '🤖' }
      console.log(`   ${config.emoji} ${agent}: ${state || 'idle'}`)
    })

    setTimeout(() => {
      console.log('\nPress Enter to exit...')
    }, 500)
    break
  }

  default: {
    log('Unknown event:', eventType, payload)
  }
  }
}

async function main() {
  console.clear()
  console.log(`${BOLD}${GREEN}
   ██████╗██╗      █████╗ ██╗    ██╗     ██████╗ █████╗ ██████╗ ████████╗███████╗██╗
  ██╔════╝██║     ██╔══██╗██║    ██║    ██╔════╝██╔══██╗██╔══██╗╚══██╔══╝██╔════╝██║
  ██║     ██║     ███████║██║ █╗ ██║    ██║     ███████║██████╔╝   ██║   █████╗  ██║
  ██║     ██║     ██╔══██║██║███╗██║    ██║     ██╔══██║██╔══██╗   ██║   ██╔══╝  ██║
  ╚██████╗███████╗██║  ██║╚███╔███╔╝    ╚██████╗██║  ██║██║  ██║   ██║   ███████╗███████╗
   ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝      ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚══════╝
  ${RESET}`)
  console.log(`${GRAY}  Agent Event Monitor // Backend: ${BACKEND_URL}${RESET}\n`)

  const args = process.argv.slice(2)
  const targetRunId = args[0]

  // Connect to backend
  const socket = io(BACKEND_URL, {
    transports: ['websocket'],
    reconnection: true,
  })

  setupSocketHandlers(socket)

  // Wait for connection
  await new Promise<void>((resolve) => {
    socket.on('connect', resolve)
    setTimeout(() => {
      if (!socket.connected) {
        console.error('Failed to connect to backend')
        process.exit(1)
      }
    }, 5000)
  })

  if (targetRunId) {
    // Join existing run
    await joinRun(socket, targetRunId)
  } else {
    // Start new run
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    const idea = await new Promise<string>((resolve) => {
      rl.question(`${GREEN}Enter your idea:${RESET} `, (answer) => {
        resolve(answer.trim() || 'Build a Solana NFT marketplace with AI agents')
      })
    })

    const modeAnswer = await new Promise<string>((resolve) => {
      rl.question(`${GREEN}Mode (squad/single) [squad]:${RESET} `, (answer) => {
        resolve(answer.trim() || 'squad')
      })
    })

    rl.close()

    const mode = modeAnswer === 'single' ? 'single' : 'squad'

    try {
      await startRun(idea, mode, true)
      await joinRun(socket, runId!)
    } catch (err) {
      console.error('Failed to start run:', err)
      process.exit(1)
    }
  }

  // Keep alive until run completes
  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.on('data', () => {
    console.log(`\n${GRAY}Events received: ${eventCount}${RESET}`)
    socket.disconnect()
    process.exit(0)
  })

  // Auto-exit after 5 minutes of inactivity
  let lastActivity = Date.now()
  setInterval(() => {
    if (Date.now() - lastActivity > 5 * 60 * 1000) {
      logSystem('No activity for 5 minutes, exiting')
      socket.disconnect()
      process.exit(0)
    }
  }, 30000)

  socket.on('agent_event', () => {
    lastActivity = Date.now()
  })
}

main().catch(console.error)
