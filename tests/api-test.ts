/**
 * Simple API Test Script for ClawCartel Backend
 *
 * Usage:
 *   npx tsx tests/api-test.ts <command> [options]
 *
 * Commands:
 *   health                    Check backend health
 *   start "<idea>"            Start a new run
 *   get <runId>               Get run details
 *   events <runId>            Get run events (HTTP polling)
 *   stream <runId>            Stream events via Socket.IO
 *
 * Examples:
 *   npx tsx tests/api-test.ts health
 *   npx tsx tests/api-test.ts start "Build a Solana NFT marketplace"
 *   npx tsx tests/api-test.ts stream <run-id>
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000'
const API_URL = `${BACKEND_URL}/v1/agent`

// Colors
const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
}

// Agent character info
const AGENT_INFO: Record<string, { name: string; emoji: string; color: string }> = {
  pm: { name: 'Vince', emoji: '👔', color: C.red },
  fe: { name: 'Pixel', emoji: '🎨', color: C.cyan },
  // eslint-disable-next-line camelcase
  be_sc: { name: 'Chain', emoji: '⚙️', color: C.yellow },
  // eslint-disable-next-line camelcase
  bd_research: { name: 'Scout', emoji: '🔍', color: C.green },
}

function log(msg: string) {
  console.log(`${C.gray}[${new Date().toLocaleTimeString()}]${C.reset} ${msg}`)
}

async function checkHealth() {
  console.log(`${C.blue}Checking backend health...${C.reset}`)

  try {
    const res = await fetch(`${BACKEND_URL}/`)
    const response = await res.json().catch(() => null)
    const data = response?.data || response

    if (res.ok && data?.health === 'ok') {
      console.log(`${C.green}✅ Backend OK${C.reset}`, data)
    } else {
      console.log(`${C.red}❌ Backend Error:${C.reset} ${res.status}`, response)
    }
  } catch (err) {
    console.log(`${C.red}❌ Backend unreachable:${C.reset}`, err instanceof Error ? err.message : err)
  }

  console.log(`\n${C.blue}Checking agent service health...${C.reset}`)

  try {
    const res = await fetch(`${API_URL}/health`)
    const response = await res.json().catch(() => null)
    const data = response?.data || response

    if (res.ok) {
      if (data?.status === 'ok') {
        console.log(`${C.green}✅ Agent Service OK${C.reset}`, data)
      } else {
        console.log(`${C.yellow}⚠️ Agent Service Degraded${C.reset}`, data)
      }
    } else {
      console.log(`${C.red}❌ Agent Service Error:${C.reset} ${res.status}`, response)
    }
  } catch (err) {
    console.log(`${C.red}❌ Agent Service unreachable:${C.reset}`, err instanceof Error ? err.message : err)
  }
}

async function startRun(idea: string, mode: 'single' | 'squad' = 'squad') {
  console.log(`${C.blue}Starting run...${C.reset}`)
  console.log(`${C.gray}Idea: ${idea}${C.reset}`)

  try {
    const res = await fetch(`${API_URL}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idea,
        mode,
        parallel: true,
      })
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }

    const response = await res.json()
    const data = response?.data || response
    console.log(`${C.green}✅ Run started!${C.reset}`)
    console.log(`   Run ID: ${C.bold}${data.id}${C.reset}`)
    console.log(`   Status: ${data.status}`)
    console.log(`\n${C.yellow}To stream events:${C.reset}`)
    console.log(`   npx tsx tests/api-test.ts stream ${data.id}`)

    return data.id
  } catch (err) {
    console.error(`${C.red}Failed to start run:${C.reset}`, err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

async function getRun(runId: string) {
  console.log(`${C.blue}Fetching run: ${runId}${C.reset}`)

  try {
    const res = await fetch(`${API_URL}/runs/${runId}`)

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }

    const response = await res.json()
    const data = response?.data || response
    console.log(JSON.stringify(data, null, 2))
  } catch (err) {
    console.error(`${C.red}Failed to get run:${C.reset}`, err instanceof Error ? err.message : err)
  }
}

async function getEvents(runId: string) {
  console.log(`${C.blue}Fetching events for run: ${runId}${C.reset}`)

  try {
    const res = await fetch(`${API_URL}/runs/${runId}/events`)

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }

    const response = await res.json()
    const data = response?.data || response
    console.log(`\nTotal events: ${data.totalEvents}`)
    console.log(`Run ID: ${data.runId}\n`)

    data.events?.forEach((event: any, i: number) => {
      const time = new Date(event.createdAt).toLocaleTimeString()
      console.log(`${C.gray}[${time}]${C.reset} ${C.bold}${event.agentRole}${C.reset} | ${event.eventType}`)
      if (event.payload?.message) {
        const msg = String(event.payload.message).slice(0, 100)
        console.log(`   ${C.gray}${msg}${event.payload.message.length > 100 ? '...' : ''}${C.reset}`)
      }
    })
  } catch (err) {
    console.error(`${C.red}Failed to get events:${C.reset}`, err instanceof Error ? err.message : err)
  }
}

async function streamEvents(runId: string) {
  console.log(`${C.blue}Streaming events for run: ${runId}${C.reset}`)
  console.log(`${C.gray}Connecting via Socket.IO...${C.reset}\n`)

  const { io } = await import('socket.io-client')

  const socket = io(BACKEND_URL, {
    transports: ['websocket'],
  })

  let eventCount = 0
  const agentBuffers: Record<string, string> = {}

  // Print header
  console.log(`${C.bold}💬 CLAWCARTEL AGENT CHAT${C.reset}\n`)
  console.log(`${C.gray}Waiting for agents to join...${C.reset}\n`)

  socket.on('connect', () => {
    socket.emit('join_run', { runId })
  })

  socket.on('joined_run', () => {
    console.log(`${C.green}✅ Connected to run room${C.reset}\n`)
  })

  socket.on('run_replay', (data) => {
    if (data.events?.length > 0) {
      console.log(`${C.gray}📂 Loaded ${data.events.length} historical events${C.reset}\n`)
    }
  })

  socket.on('agent_event', (event) => {
    eventCount++
    const { role, eventType, payload } = event
    const agentInfo = AGENT_INFO[role] || { name: role, emoji: '🤖', color: C.white }

    switch (eventType) {
    case 'agent.started': {
      console.log(`${agentInfo.color}${agentInfo.emoji} ${C.bold}${agentInfo.name}${C.reset} ${C.gray}joined the discussion${C.reset}`)
      break
    }

    case 'agent.delta': {
      // Just accumulate content silently - don't show messy incremental updates
      if (!agentBuffers[role]) {
        agentBuffers[role] = ''
      }
      agentBuffers[role] += payload.message || ''
      break
    }

    case 'agent.done': {
      const fullText = agentBuffers[role] || payload.message || ''
      const lines = fullText.split('\n').filter((l: string) => l.trim())

      if (lines.length > 0) {
        console.log(`\n${agentInfo.color}${agentInfo.emoji} ${C.bold}${agentInfo.name}:${C.reset}`)
        lines.forEach((line: string) => {
          const cleanLine = line.trim().replace(/^[-•*]\s*/, '') // Remove bullet prefixes
          console.log(`  ${agentInfo.color}•${C.reset} ${cleanLine}`)
        })
        console.log(`${C.gray}  ── ${payload.endedDiscussion ? '⏹️ Ended discussion' : '✓ Done'}${C.reset}`)
      }

      delete agentBuffers[role]
      break
    }

    case 'agent.error': {
      console.log(`\n${C.red}❌ ${agentInfo.name} Error:${C.reset} ${payload.message}`)
      delete agentBuffers[role]
      break
    }

    case 'run.done': {
      console.log(`${C.green}${C.bold}\n🏁 RUN COMPLETE${C.reset}: ${payload.message}`)
      console.log(`${C.gray}Total events: ${eventCount}${C.reset}\n`)
      socket.disconnect()
      process.exit(0)
      break
    }

    default: {
      // Unknown event type - ignore
    }
    }
  })

  socket.on('agent_state', (data) => {
    // State changes are handled visually in the done message, no need to print here
  })

  socket.on('disconnect', () => {
    console.log(`\n${C.red}Disconnected${C.reset}`)
    process.exit(0)
  })

  socket.on('connect_error', (err) => {
    console.error(`${C.red}Connection error:${C.reset}`, err.message)
    process.exit(1)
  })

  // Keep alive
  process.stdin.setRawMode?.(true)
  process.stdin.resume()
  process.stdin.on('data', () => {
    socket.disconnect()
    process.exit(0)
  })
}

// Main
async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(`
${C.bold}ClawCartel API Test${C.reset}

Usage: npx tsx tests/api-test.ts <command> [options]

Commands:
  health                    Check backend health
  start "<idea>"            Start a new run
  get <runId>               Get run details
  events <runId>            Get run events (HTTP)
  stream <runId>            Stream events (Socket.IO)

Environment:
  BACKEND_URL               Backend URL (default: http://localhost:3000)

Examples:
  npx tsx tests/api-test.ts health
  npx tsx tests/api-test.ts start "Build a Solana NFT marketplace"
  npx tsx tests/api-test.ts stream <run-id>
`)
    process.exit(0)
  }

  switch (command) {
  case 'health': {
    await checkHealth()
    break
  }

  case 'start': {
    const idea = args[1] || 'Build a web3 dApp'
    const mode = args[2] as 'single' | 'squad' || 'squad'
    await startRun(idea, mode)
    break
  }

  case 'get': {
    if (!args[1]) {
      console.error('Usage: get <runId>')
      process.exit(1)
    }
    await getRun(args[1])
    break
  }

  case 'events': {
    if (!args[1]) {
      console.error('Usage: events <runId>')
      process.exit(1)
    }
    await getEvents(args[1])
    break
  }

  case 'stream': {
    if (!args[1]) {
      console.error('Usage: stream <runId>')
      process.exit(1)
    }
    await streamEvents(args[1])
    break
  }

  default: {
    console.error(`Unknown command: ${command}`)
    console.log('Run with --help for usage')
    process.exit(1)
  }
  }
}

main().catch(console.error)
