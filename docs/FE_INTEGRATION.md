# Frontend Integration Guide

## Overview

Integrate ClawCartel AI agents into your frontend with real-time streaming.

**Flow:**
```
1. User submits idea → POST /runs → Get runId
2. Connect WebSocket with runId → Stream agent conversations
3. Display agents discussing in real-time
```

---

## API Endpoints

### 1. Start a Run

**Endpoint:** `POST /v1/autonomous/runs`

**Request:**
```json
{
  "idea": "Build a Solana NFT marketplace",
  "mode": "squad"
}
```

**Response:**
```json
{
  "id": "abc-123-def",
  "status": "planning",
  "inputText": "Build a Solana NFT marketplace",
  "createdAt": "2026-02-28T10:00:00.000Z"
}
```

---

### 2. WebSocket Events

**Connect:** `ws://localhost:3000` (Socket.IO)

**Join Room:**
```javascript
socket.emit('join_run', { runId: 'abc-123-def' })
```

**Event Types:**

| Event | Description | Payload |
|-------|-------------|---------|
| `agent.started` | Agent joining discussion | `{ agentName, agentEmoji, message }` |
| `agent.delta` | Real-time chat chunk | `{ agentName, message, accumulated }` |
| `agent.done` | Agent finished speaking | `{ agentName, message, phase }` |
| `agent.error` | Agent error | `{ agentName, message }` |
| `run.done` | Discussion complete | `{ message, pmBrief, ... }` |

---

## Quick Integration (React Hook)

```typescript
// useAgentStream.ts
import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

export const useAgentStream = (runId: string | null) => {
  const [messages, setMessages] = useState<any[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    if (!runId) return

    const socket: Socket = io('http://localhost:3000', {
      transports: ['websocket'],
    })

    socket.on('connect', () => {
      setIsConnected(true)
      socket.emit('join_run', { runId })
    })

    socket.on('agent_event', (event) => {
      const { eventType, payload } = event

      if (eventType === 'agent.delta') {
        // Update accumulated message
        setMessages(prev => {
          const existing = prev.find(m => m.agentName === payload.agentName && m.type === 'streaming')
          if (existing) {
            return prev.map(m => m === existing ? { ...m, message: payload.accumulated } : m)
          }
          return [...prev, { ...payload, type: 'streaming' }]
        })
      } else {
        setMessages(prev => [...prev, { ...payload, type: eventType }])
      }
    })

    socket.on('run.done', () => setIsComplete(true))
    socket.on('disconnect', () => setIsConnected(false))

    return () => { socket.disconnect() }
  }, [runId])

  return { messages, isConnected, isComplete }
}

// Component usage
export const AgentChat = () => {
  const [runId, setRunId] = useState<string | null>(null)
  const { messages, isConnected, isComplete } = useAgentStream(runId)

  const startRun = async (idea: string) => {
    const res = await fetch('http://localhost:3000/v1/autonomous/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea }),
    })
    const data = await res.json()
    setRunId(data.id)
  }

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>
          <strong>{msg.agentEmoji} {msg.agentName}</strong>
          <p>{msg.message}</p>
        </div>
      ))}
    </div>
  )
}
```

---

## Vanilla JS Example

See `tests/test-fe.html` for complete working example.

```javascript
const BACKEND_URL = 'http://localhost:3000'

// 1. Start run
const res = await fetch(`${BACKEND_URL}/v1/autonomous/runs`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idea: 'Build NFT marketplace' })
})
const { id: runId } = await res.json()

// 2. Connect WebSocket
const socket = io(BACKEND_URL, { transports: ['websocket'] })

socket.on('connect', () => {
  socket.emit('join_run', { runId })
})

// 3. Listen for events
socket.on('agent_event', (event) => {
  console.log(event.payload.agentName, ':', event.payload.message)
})
```

---

## Event Types

| Event | When | Payload Fields |
|-------|------|----------------|
| `agent.started` | Agent begins speaking | `agentName`, `agentEmoji`, `message` |
| `agent.delta` | Chunk of response | `agentName`, `message`, `accumulated` |
| `agent.done` | Agent finished | `agentName`, `message`, `phase` |
| `agent.error` | Agent failed | `agentName`, `message` |
| `run.done` | All complete | `message`, `pmBrief`, `pmFinal`, etc. |

---

## Testing

```bash
# Start backend
npm run dev

# Start run
curl -X POST http://localhost:3000/v1/autonomous/runs \
  -H "Content-Type: application/json" \
  -d '{"idea": "Build a Solana NFT marketplace"}'

# Stream with CLI
npx tsx tests/api-test.ts stream <run-id>
```
