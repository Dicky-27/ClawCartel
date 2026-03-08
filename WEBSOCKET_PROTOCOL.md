# WebSocket Protocol Specification

## Connection

**Endpoint:** `ws://localhost:3000` (Socket.IO)

**Transport:** WebSocket preferred, fallback to HTTP long-polling

```javascript
const socket = io('http://localhost:3000', {
  transports: ['websocket']
});
```

---

## Client → Server Events

### join_run

Subscribe to events for a specific run.

```javascript
socket.emit('join_run', { 
  runId: '5763fbf3-c9d5-49ab-b64b-65288b1bff6e' 
});
```

**Payload:**
| Field | Type | Description |
|-------|------|-------------|
| runId | string | UUID of the run to subscribe to |

### leave_run (optional)

Unsubscribe from a run.

```javascript
socket.emit('leave_run', { 
  runId: '5763fbf3-c9d5-49ab-b64b-65288b1bff6e' 
});
```

---

## Server → Client Events

### agent_event

All agent-related events are sent on this channel.

**Event Structure:**
```typescript
{
  runId: string;           // Run UUID
  agentRunId: string;      // "autonomous" for autonomous mode
  role: AgentRole;         // pm | fe | be_sc | bd_research
  seq: number;             // Sequence number (timestamp)
  eventType: EventType;    // Type of event
  payload: object;         // Event-specific data
}
```

---

## Event Types

### 1. agent.started

An agent has started generating a response.

**Timing:** At the beginning of each agent's turn

**Payload:**
```typescript
{
  message: string;         // "PM is typing..."
  agentName: string;       // "PM"
  agentEmoji: string;      // "📋"
  timestamp: string;       // ISO timestamp
  phase?: string;          // Current discussion/code phase
}
```

**Example:**
```json
{
  "eventType": "agent.started",
  "payload": {
    "message": "PM is typing...",
    "agentName": "PM",
    "agentEmoji": "📋",
    "timestamp": "2026-02-28T07:00:00.000Z",
    "phase": "round_1"
  }
}
```

**UI Action:** Show typing indicator for the agent

---

### 2. agent.delta

Streaming chunk of agent response.

**Timing:** Multiple times during response generation (every chunk)

**Payload:**
```typescript
{
  message: string;         // Current chunk only
  accumulated: string;     // Full message so far
  agentName: string;
  agentEmoji: string;
  timestamp: string;
  phase?: string;          // Special phases like "file_created"
  fileEvent?: FileEvent;   // If phase is "file_created"
}
```

**Example - Normal Message:**
```json
{
  "eventType": "agent.delta",
  "payload": {
    "message": " analyze",
    "accumulated": "I'll analyze the market",
    "agentName": "Researcher",
    "agentEmoji": "🔬"
  }
}
```

**Example - File Created:**
```json
{
  "eventType": "agent.delta",
  "payload": {
    "message": "📁 Created: backend/package.json",
    "phase": "file_created",
    "agentName": "PM",
    "fileEvent": {
      "runId": "5763fbf3-c9d5-49ab-b64b-65288b1bff6e",
      "action": "created",
      "filePath": "backend/package.json",
      "agentName": "BE_SC",
      "timestamp": "2026-02-28T07:10:00.000Z"
    }
  }
}
```

**UI Action:** 
- Normal: Append chunk to message text
- File created: Add file to file tree

---

### 3. agent.done

Agent has completed their response.

**Timing:** At the end of each agent's turn

**Payload:**
```typescript
{
  message: string;         // Complete message
  agentName: string;
  agentEmoji: string;
  timestamp: string;
}
```

**Example:**
```json
{
  "eventType": "agent.done",
  "payload": {
    "message": "I've analyzed the market...",
    "agentName": "Researcher",
    "agentEmoji": "🔬",
    "timestamp": "2026-02-28T07:00:15.000Z"
  }
}
```

**UI Action:** Remove typing indicator, show complete message

---

### 4. agent.error

Agent encountered an error.

**Timing:** When an error occurs during agent processing

**Payload:**
```typescript
{
  message: string;         // Error message
  agentName: string;
  agentEmoji: string;
  error?: string;          // Error details
}
```

**Example:**
```json
{
  "eventType": "agent.error",
  "payload": {
    "message": "Failed to generate response",
    "agentName": "FE",
    "agentEmoji": "🎨",
    "error": "Gateway timeout"
  }
}
```

**UI Action:** Show error state for agent

---

### 5. run.done

Run has reached a terminal state.

**Timing:** 
- Discussion complete, awaiting approval
- Code generation complete
- Run cancelled or failed

**Payload - Awaiting Approval:**
```typescript
{
  message: string;
  phase: "awaiting_approval";
  discussionSummary: Message[];
  pmFinalDecision: string;
  projectName: string;
}
```

**Payload - Completed:**
```typescript
{
  message: string;
  phase: "completed";
  stats: {
    totalFiles: number;
    totalSize: number;
  };
  fileList: string[];
  downloadUrl: string;
}
```

**Payload - Rejected:**
```typescript
{
  message: string;
  phase: "rejected";
}
```

**Examples:**

Discussion complete:
```json
{
  "eventType": "run.done",
  "payload": {
    "message": "Discussion complete - Ready to build",
    "phase": "awaiting_approval",
    "discussionSummary": [...],
    "pmFinalDecision": "We will build a Solana NFT marketplace...",
    "projectName": "Build_a_Solana_NFT_marketplace"
  }
}
```

Code generation complete:
```json
{
  "eventType": "run.done",
  "payload": {
    "message": "✅ Code generation complete! 18 files created.",
    "phase": "completed",
    "stats": {
      "totalFiles": 18,
      "totalSize": 52400
    },
    "fileList": [
      "README.md",
      "backend/package.json",
      "backend/src/api/routes.ts",
      ...
    ],
    "downloadUrl": "/v1/autonomous/runs/5763fbf3-c9d5-49ab-b64b-65288b1bff6e/download"
  }
}
```

**UI Action:**
- `awaiting_approval`: Show Continue/Cancel buttons
- `completed`: Show file explorer and download button
- `rejected`: Show cancelled state

---

## Phase Reference

### Discussion Phases

| Phase | Description | Agent Activity |
|-------|-------------|----------------|
| `round_1` | Initial thoughts | All agents share first impressions |
| `round_2` | Debate | Agents respond to each other |
| `round_3` | Final positions | Agents state bottom lines |
| `final` | PM synthesis | PM makes final decision |
| `awaiting_approval` | User decision point | Waiting for user input |

### Code Generation Phases

| Phase | Description | Files Created |
|-------|-------------|---------------|
| `code_generation` | Starting | README initialized |
| `phase_1_docs` | Researcher | Market analysis, requirements |
| `phase_2_backend` | BE_SC | Backend API, database, contracts |
| `phase_3_frontend` | FE | React components, pages, hooks |
| `phase_4_deploy` | PM | Docker, deployment scripts |
| `file_created` | File event | Individual file creation |
| `completed` | Done | All files ready |

---

## Event Flow Examples

### Full Discussion Flow

```
CLIENT                                    SERVER
  |                                          |
  |  POST /v1/autonomous/runs               |
  |----------------------------------------->|
  |                           { runId: "..."}|
  |<-----------------------------------------|
  |                                          |
  |  socket.emit('join_run', { runId })     |
  |----------------------------------------->|
  |                                          |
  |<-- agent_event { type: 'agent.started' }| PM starts
  |<-- agent_event { type: 'agent.delta' }  | PM streams
  |<-- agent_event { type: 'agent.delta' }  | PM streams
  |<-- agent_event { type: 'agent.done' }   | PM done
  |                                          |
  |<-- agent_event { type: 'agent.started' }| Researcher starts
  |<-- agent_event { type: 'agent.delta' }  | Researcher streams
  |<-- agent_event { type: 'agent.done' }   | Researcher done
  |                                          |
  |<-- ... (FE, BE_SC, more rounds)         |
  |                                          |
  |<-- agent_event { type: 'run.done' }     | awaiting_approval
  |                              show UI     |
  |                                          |
  |  POST /v1/autonomous/runs/{id}/continue |
  |  { approved: true }                     |
  |----------------------------------------->|
  |                                          |
  |<-- agent_event { type: 'agent.delta' }  | file_created
  |<-- agent_event { type: 'agent.delta' }  | file_created
  |<-- ... (more files)                     |
  |                                          |
  |<-- agent_event { type: 'run.done' }     | completed
  |                           show download  |
```

### File Creation Sequence

```
agent_event {
  eventType: 'agent.started',
  payload: { agentName: 'BE_SC', phase: 'phase_2_backend' }
}

agent_event {
  eventType: 'agent.delta',
  payload: { 
    message: '...',
    accumulated: '...===FILE:backend/package.json...',
    agentName: 'BE_SC'
  }
}

agent_event {
  eventType: 'agent.delta',
  payload: {
    phase: 'file_created',
    message: '📁 Created: backend/package.json',
    fileEvent: { filePath: 'backend/package.json', ... }
  }
}

agent_event {
  eventType: 'agent.delta',
  payload: {
    phase: 'file_created',
    message: '📁 Created: backend/src/api/routes.ts',
    fileEvent: { filePath: 'backend/src/api/routes.ts', ... }
  }
}

agent_event {
  eventType: 'agent.done',
  payload: { agentName: 'BE_SC' }
}
```

---

## State Management

### Recommended Client State

```typescript
interface ChatState {
  // Connection
  connected: boolean;
  runId: string | null;
  
  // Discussion
  messages: Array<{
    agentName: string;
    agentEmoji: string;
    text: string;
    status: 'typing' | 'complete' | 'error';
  }>;
  
  // Phase
  currentPhase: string;
  isDiscussionComplete: boolean;
  
  // Files
  files: Array<{
    path: string;
    agentName: string;
    timestamp: string;
  }>;
  
  // Completion
  isComplete: boolean;
  stats: { totalFiles: number; totalSize: number } | null;
  downloadUrl: string | null;
}
```

### State Transitions

```
DISCONNECTED
    ↓ connect
CONNECTED
    ↓ join_run
JOINED
    ↓ agent.started (first message)
DISCUSSING
    ↓ run.done (awaiting_approval)
AWAITING_APPROVAL
    ↓ POST /continue { approved: true }
CODE_GENERATING
    ↓ run.done (completed)
COMPLETED
```

---

## Error Handling

### Connection Errors

```javascript
socket.on('connect_error', (error) => {
  console.error('Connection failed:', error.message);
  // Retry with polling
  socket.io.opts.transports = ['polling', 'websocket'];
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  // 'io server disconnect' - server forced disconnect
  // 'io client disconnect' - client disconnect
  // 'ping timeout' - connection lost
  // 'transport close' - transport closed
  // 'transport error' - transport error
});
```

### Reconnection

Socket.IO automatically reconnects. Listen for:

```javascript
socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts');
  // Re-join the run room
  socket.emit('join_run', { runId });
});

socket.on('reconnect_error', (error) => {
  console.error('Reconnection failed:', error);
});
```

---

## Performance Considerations

### Debouncing

For smooth UI during rapid delta events:

```javascript
import { debounce } from 'lodash';

const updateMessage = debounce((agentName, text) => {
  setMessages(prev => ({
    ...prev,
    [agentName]: text
  }));
}, 50); // 50ms debounce
```

### Virtual Scrolling

For long conversations:

```jsx
import { Virtuoso } from 'react-virtuoso';

<Virtuoso
  data={messages}
  itemContent={(index, message) => (
    <MessageComponent key={index} {...message} />
  )}
/>
```

### File Updates

Batch file creation events:

```javascript
const fileBatch = [];
const BATCH_SIZE = 10;

socket.on('agent_event', (event) => {
  if (event.payload.phase === 'file_created') {
    fileBatch.push(event.payload.fileEvent);
    
    if (fileBatch.length >= BATCH_SIZE) {
      flushFileBatch();
    }
  }
});

function flushFileBatch() {
  setFiles(prev => [...prev, ...fileBatch]);
  fileBatch.length = 0;
}
```

---

## Testing

### Mock Server Events

```javascript
// For testing without backend
function mockEvents(socket) {
  // Simulate agent response
  setTimeout(() => {
    socket.emit('agent_event', {
      eventType: 'agent.started',
      payload: { agentName: 'PM', agentEmoji: '📋' }
    });
  }, 1000);
  
  setTimeout(() => {
    socket.emit('agent_event', {
      eventType: 'agent.delta',
      payload: { 
        agentName: 'PM', 
        accumulated: 'Hello! I will lead this project.' 
      }
    });
  }, 2000);
  
  setTimeout(() => {
    socket.emit('agent_event', {
      eventType: 'agent.done',
      payload: { agentName: 'PM' }
    });
  }, 3000);
}
```

---

## Migration from REST Polling

If currently polling for updates:

```javascript
// BEFORE (Polling)
const interval = setInterval(async () => {
  const events = await fetchEvents(runId, lastSeq);
  processEvents(events);
}, 1000);

// AFTER (WebSocket)
const socket = io(BACKEND_URL);
socket.emit('join_run', { runId });
socket.on('agent_event', processEvent);
```

Benefits:
- Real-time updates (no delay)
- Lower server load
- Automatic reconnection
- More efficient for streaming
