/**
 * ClawCartel Agent Chat Stream
 *
 * Usage:
 *   npx tsx tests/api-test.ts stream <runId>
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
}

// Agent display config
const AGENT_DISPLAY: Record<string, { color: string; label: string }> = {
  pm: { color: C.blue, label: 'PM' },
  fe: { color: C.cyan, label: 'FE' },
  // eslint-disable-next-line camelcase
  be_sc: { color: C.yellow, label: 'BE_SC' },
  // eslint-disable-next-line camelcase
  bd_research: { color: C.green, label: 'Researcher' },
}

async function streamEvents(runId: string) {
  console.log(`${C.blue}${C.bold}🔗 Connecting to ClawCartel...${C.reset}\n`)

  const { io } = await import('socket.io-client')
  const socket = io(BACKEND_URL, { transports: ['websocket'] })

  const chatHistory: string[] = []
  let currentSpeaker = ''
  let currentBuffer = ''

  socket.on('connect', () => {
    socket.emit('join_run', { runId })
  })

  socket.on('joined_run', () => {
    console.log(`${C.green}✅ Connected to room${C.reset}\n`)
  })

  socket.on('run_replay', (data) => {
    if (data.events?.length > 0) {
      console.log(`${C.gray}📂 Loaded ${data.events.length} previous messages${C.reset}\n`)
      // Replay existing events
      data.events.forEach((event: any) => displayEvent(event))
      console.log()
    }
  })

  function displayEvent(event: any) {
    const { role, eventType, payload } = event
    const agent = AGENT_DISPLAY[role] || { color: C.white, label: role }

    switch (eventType) {
    case 'agent.started': {
      // Just a subtle indicator that agent is starting
      if (role === 'pm') {
        console.log(`\n${C.blue}${C.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`)
        console.log(`${C.blue}${C.bold}📋 PM Analyzing Request${C.reset}`)
        console.log(`${C.blue}${C.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`)
      }
      break
    }

    case 'agent.delta': {
      // Just accumulate, don't print chunks
      const speaker = payload.agentName || agent.label
      if (speaker !== currentSpeaker) {
        currentSpeaker = speaker
        currentBuffer = ''
      }
      if (payload.message) {
        currentBuffer += payload.message
      }
      break
    }

    case 'agent.done': {
      const speaker = payload.agentName || agent.label
      const fullText = payload.message || currentBuffer

      // Show the complete natural response
      if (fullText) {
        console.log(`\n${agent.color}${C.bold}[${agent.label}]${C.reset} ${C.gray}${speaker}${C.reset}`)
        console.log(`${C.gray}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`)

        // Show full text as-is (natural paragraph format)
        const paragraphs = fullText.split('\n\n').filter(p => p.trim())
        paragraphs.forEach(para => {
          console.log(`\n${para.trim()}`)
        })

        const icon = payload.endedDiscussion ? '⏹️' : '✅'
        console.log(`\n${C.gray}  ${icon} ${icon === '⏹️' ? 'Ended discussion' : 'Done'}${C.reset}`)
        console.log()
      }

      currentSpeaker = ''
      currentBuffer = ''
      break
    }

    case 'agent.error': {
      if (currentSpeaker) {
        console.log()
        currentSpeaker = ''
      }
      console.log(`${C.red}❌ ${payload.agentName || agent.label}: ${payload.message}${C.reset}\n`)
      break
    }

    case 'run.done': {
      if (currentSpeaker) {
        console.log()
        currentSpeaker = ''
      }
      console.log(`${C.green}${C.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`)
      console.log(`${C.green}${C.bold}🏁 ${payload.message}${C.reset}`)
      console.log(`${C.green}${C.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}\n`)
      socket.disconnect()
      process.exit(0)
      break
    }

    default: {
      // Ignore unknown events
      break
    }
    }
  }

  socket.on('agent_event', (event) => {
    displayEvent(event)
  })

  socket.on('disconnect', () => {
    console.log(`\n${C.gray}Disconnected${C.reset}`)
    process.exit(0)
  })

  socket.on('connect_error', (err) => {
    console.error(`${C.red}Connection failed:${C.reset}`, err.message)
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

async function startRun(idea: string) {
  console.log(`${C.blue}Starting run...${C.reset}`)

  const res = await fetch(`${API_URL}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idea, mode: 'squad', parallel: true }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    console.error(`${C.red}Server error:${C.reset}`, errorText)
    throw new Error(`HTTP ${res.status}: ${errorText.slice(0, 200)}`)
  }

  const response = await res.json()
  const data = response?.data || response

  console.log(`${C.green}✅ Run started!${C.reset}`)
  console.log(`Run ID: ${C.bold}${data.id}${C.reset}\n`)
  console.log(`${C.yellow}To watch discussion:${C.reset}`)
  console.log(`  npx tsx tests/api-test.ts stream ${data.id}\n`)

  return data.id
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (command === 'stream' && args[1]) {
    await streamEvents(args[1])
  } else if (command === 'start' && args[1]) {
    await startRun(args[1])
  } else {
    console.log(`
${C.bold}ClawCartel Agent Chat${C.reset}

Usage:
  npx tsx tests/api-test.ts start "<idea>"   Start new run
  npx tsx tests/api-test.ts stream <runId>   Watch discussion

Examples:
  npx tsx tests/api-test.ts start "Build a Solana NFT marketplace"
  npx tsx tests/api-test.ts stream abc-123-def
`)
  }
}

main().catch(console.error)
