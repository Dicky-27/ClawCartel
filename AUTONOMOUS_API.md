# ClawCartel Autonomous Agent API Documentation

## Overview

The Autonomous Agent API enables AI agents to discuss projects in multiple rounds and generate actual code files on the VPS.

**Base URL:** `http://localhost:3000/v1/autonomous`

**WebSocket:** `ws://localhost:3000` (Socket.IO)

---

## Authentication

Currently no authentication required for local development.

---

## REST API Endpoints

### 1. Start Discussion

Start a multi-round agent discussion about a project idea.

```http
POST /v1/autonomous/runs
```

**Request Body:**
```json
{
  "idea": "Build a Solana NFT marketplace with AI-powered pricing",
  "source": "chat"
}
```

**Response (202 Accepted):**
```json
{
  "id": "5763fbf3-c9d5-49ab-b64b-65288b1bff6e",
  "status": "planning",
  "inputType": "chat",
  "inputText": "Build a Solana NFT marketplace with AI-powered pricing",
  "createdAt": "2026-02-28T07:00:00.000Z",
  "updatedAt": "2026-02-28T07:00:00.000Z"
}
```

---

### 2. Get Run Status

Get current status of a run.

```http
GET /v1/autonomous/runs/{runId}
```

**Response:**
```json
{
  "id": "5763fbf3-c9d5-49ab-b64b-65288b1bff6e",
  "status": "awaiting_approval",
  "inputType": "chat",
  "inputText": "Build a Solana NFT marketplace...",
  "createdAt": "2026-02-28T07:00:00.000Z",
  "updatedAt": "2026-02-28T07:05:00.000Z"
}
```

**Status Values:**
- `planning` - Discussion starting
- `executing` - Agents are discussing or coding
- `awaiting_approval` - Discussion complete, waiting for user to continue
- `completed` - Code generation complete
- `cancelled` - User cancelled
- `failed` - Error occurred

---

### 3. Continue to Development

Approve and start code generation phase.

```http
POST /v1/autonomous/runs/{runId}/continue
```

**Request Body:**
```json
{
  "approved": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Development phase started",
  "runId": "5763fbf3-c9d5-49ab-b64b-65288b1bff6e"
}
```

To cancel:
```json
{
  "approved": false
}
```

---

### 4. List Project Files

List all generated files for a run.

```http
GET /v1/autonomous/runs/{runId}/files
```

**Response:**
```json
{
  "runId": "5763fbf3-c9d5-49ab-b64b-65288b1bff6e",
  "files": [
    {
      "name": "README.md",
      "type": "file",
      "path": "README.md",
      "size": 1250
    },
    {
      "name": "backend",
      "type": "directory",
      "path": "backend",
      "children": [
        {
          "name": "package.json",
          "type": "file",
          "path": "backend/package.json",
          "size": 850
        }
      ]
    }
  ],
  "stats": {
    "totalFiles": 15,
    "totalSize": 45000
  }
}
```

---

### 5. Get File Content

View content of a specific file.

```http
GET /v1/autonomous/runs/{runId}/files/{filePath}
```

Example: `GET /v1/autonomous/runs/5763fbf3-c9d5-49ab-b64b-65288b1bff6e/files/backend/package.json`

**Response:**
```json
{
  "runId": "5763fbf3-c9d5-49ab-b64b-65288b1bff6e",
  "filePath": "backend/package.json",
  "content": "{\n  \"name\": \"my-project\",\n  ...\n}"
}
```

---

### 6. Download Project as ZIP

Download all generated files as a ZIP archive.

```http
GET /v1/autonomous/runs/{runId}/download
```

**Response:** Binary ZIP file

**Headers:**
```
Content-Type: application/zip
Content-Disposition: attachment; filename="project-5763fbf3.zip"
```

---

## WebSocket Events (Real-time)

### Connection

```javascript
const socket = io('http://localhost:3000', {
  transports: ['websocket']
});

socket.on('connect', () => {
  // Join a run room to receive events
  socket.emit('join_run', { runId: '5763fbf3-c9d5-49ab-b64b-65288b1bff6e' });
});
```

### Incoming Events

All events are sent on `agent_event` channel with this structure:

```javascript
socket.on('agent_event', (event) => {
  // event structure:
  {
    runId: "5763fbf3-c9d5-49ab-b64b-65288b1bff6e",
    agentRunId: "autonomous",
    role: "pm",
    seq: 1709100000000,
    eventType: "agent.started",
    payload: {
      message: "PM is typing...",
      agentName: "PM",
      agentEmoji: "📋",
      timestamp: "2026-02-28T07:00:00.000Z"
    }
  }
});
```

---

### Event Types

#### 1. Agent Started (`agent.started`)

Sent when an agent starts responding.

```json
{
  "eventType": "agent.started",
  "payload": {
    "message": "PM is typing...",
    "agentName": "PM",
    "agentEmoji": "📋",
    "phase": "round_1"
  }
}
```

#### 2. Agent Delta (`agent.delta`)

Streaming response chunks from agent.

```json
{
  "eventType": "agent.delta",
  "payload": {
    "message": "new chunk",
    "accumulated": "full text so far...",
    "agentName": "PM",
    "agentEmoji": "📋"
  }
}
```

#### 3. Agent Done (`agent.done`)

Sent when agent finishes responding.

```json
{
  "eventType": "agent.done",
  "payload": {
    "message": "full response text",
    "agentName": "PM",
    "agentEmoji": "📋"
  }
}
```

#### 4. File Created (`agent.delta` with phase)

Sent when a file is created during code generation.

```json
{
  "eventType": "agent.delta",
  "payload": {
    "message": "📁 Created: backend/package.json",
    "phase": "file_created",
    "fileEvent": {
      "runId": "5763fbf3...",
      "action": "created",
      "filePath": "backend/package.json",
      "agentName": "BE_SC",
      "timestamp": "2026-02-28T07:10:00.000Z"
    },
    "agentName": "PM"
  }
}
```

#### 5. Run Complete (`run.done`)

**Discussion Complete - Awaiting Approval:**
```json
{
  "eventType": "run.done",
  "payload": {
    "message": "Discussion complete - Ready to build",
    "phase": "awaiting_approval",
    "projectName": "Build_a_Solana_NFT_marketplace",
    "discussionSummary": [...],
    "pmFinalDecision": "..."
  }
}
```

**Code Generation Complete:**
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
    "fileList": ["README.md", "backend/package.json", ...],
    "downloadUrl": "/v1/autonomous/runs/5763fbf3-c9d5-49ab-b64b-65288b1bff6e/download"
  }
}
```

---

### Phases (in payload.phase)

**Discussion Phase:**
- `round_1` - Initial thoughts from all agents
- `round_2` - Debate and responses
- `round_3` - Final positions
- `final` - PM synthesizes decision
- `awaiting_approval` - Discussion complete

**Code Generation Phase:**
- `code_generation` - Starting code generation
- `phase_1_docs` - Researcher creating documentation
- `phase_2_backend` - BE_SC creating backend code
- `phase_3_frontend` - FE creating frontend code
- `phase_4_deploy` - PM creating deployment configs
- `file_created` - Individual file creation events
- `completed` - All done

---

## Frontend Integration Guide

### Step 1: Start Discussion

```javascript
async function startProject(idea) {
  const res = await fetch('http://localhost:3000/v1/autonomous/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idea, source: 'chat' })
  });
  
  const data = await res.json();
  return data.id; // runId
}
```

### Step 2: Connect WebSocket & Listen

```javascript
import { io } from 'socket.io-client';

function connectToRun(runId, handlers) {
  const socket = io('http://localhost:3000', {
    transports: ['websocket']
  });
  
  socket.on('connect', () => {
    socket.emit('join_run', { runId });
    handlers.onConnect?.();
  });
  
  socket.on('agent_event', (event) => {
    const { eventType, payload } = event;
    
    switch (eventType) {
      case 'agent.started':
        handlers.onAgentStarted?.(payload);
        break;
        
      case 'agent.delta':
        if (payload.phase === 'file_created') {
          handlers.onFileCreated?.(payload.fileEvent);
        } else {
          handlers.onAgentMessage?.(payload);
        }
        break;
        
      case 'agent.done':
        handlers.onAgentDone?.(payload);
        break;
        
      case 'run.done':
        if (payload.phase === 'awaiting_approval') {
          handlers.onAwaitingApproval?.(payload);
        } else if (payload.phase === 'completed') {
          handlers.onCompleted?.(payload);
        }
        break;
    }
  });
  
  return socket;
}
```

### Step 3: Show Approval UI

```javascript
function showApprovalUI(payload, onContinue) {
  // Show "Continue to Build" button
  const approved = confirm('Discussion complete. Start building?');
  
  fetch(`http://localhost:3000/v1/autonomous/runs/${payload.runId}/continue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved })
  });
}
```

### Step 4: Show File Explorer

```javascript
async function loadFiles(runId) {
  const res = await fetch(
    `http://localhost:3000/v1/autonomous/runs/${runId}/files`
  );
  const data = await res.json();
  return data.files;
}

function downloadProject(runId) {
  window.open(
    `http://localhost:3000/v1/autonomous/runs/${runId}/download`,
    '_blank'
  );
}
```

---

## Complete Example (React)

```jsx
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

function AgentChat({ runId }) {
  const [messages, setMessages] = useState([]);
  const [phase, setPhase] = useState('');
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [files, setFiles] = useState([]);
  
  useEffect(() => {
    const socket = io('http://localhost:3000');
    
    socket.on('connect', () => {
      socket.emit('join_run', { runId });
    });
    
    socket.on('agent_event', (event) => {
      const { eventType, payload } = event;
      
      if (payload.phase) setPhase(payload.phase);
      
      switch (eventType) {
        case 'agent.delta':
          if (payload.phase === 'file_created') {
            setMessages(prev => [...prev, { 
              type: 'file', 
              text: payload.message 
            }]);
          }
          break;
          
        case 'run.done':
          if (payload.phase === 'awaiting_approval') {
            setAwaitingApproval(true);
          } else if (payload.phase === 'completed') {
            setCompleted(true);
            loadFiles();
          }
          break;
      }
    });
    
    return () => socket.disconnect();
  }, [runId]);
  
  const handleContinue = async (approved) => {
    await fetch(`/v1/autonomous/runs/${runId}/continue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved })
    });
    setAwaitingApproval(false);
  };
  
  const loadFiles = async () => {
    const res = await fetch(`/v1/autonomous/runs/${runId}/files`);
    const data = await res.json();
    setFiles(data.files);
  };
  
  return (
    <div>
      <div>Phase: {phase}</div>
      
      {messages.map((m, i) => (
        <div key={i} className={m.type}>
          {m.text}
        </div>
      ))}
      
      {awaitingApproval && (
        <div>
          <button onClick={() => handleContinue(true)}>
            ✅ Start Building
          </button>
          <button onClick={() => handleContinue(false)}>
            ❌ Cancel
          </button>
        </div>
      )}
      
      {completed && (
        <div>
          <FileTree files={files} />
          <button onClick={() => downloadProject(runId)}>
            ⬇️ Download ZIP
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## Error Handling

### Common Errors

**404 - Run not found:**
```json
{
  "status": 404,
  "code": "NOT_FOUND",
  "message": "Run not found",
  "data": null
}
```

**500 - Code generation failed:**
```json
{
  "status": 500,
  "code": "SYSTEM_ERROR",
  "message": "Failed to generate code: OpenClaw Gateway unreachable",
  "data": null
}
```

**503 - Gateway unavailable:**
Occurs when OpenClaw Gateway is not running on port 18789.

---

## Project Structure on VPS

Files are stored at:
```
/root/.openclaw/workspace/claw-cartel-projects/{runId}/
├── README.md
├── research/
│   ├── market-analysis.md
│   └── competitor-report.md
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── api/routes.ts
│   │   ├── models/schema.prisma
│   │   └── contracts/main.sol
│   └── README.md
├── frontend/
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/Layout.tsx
│   │   ├── pages/Home.tsx
│   │   ├── hooks/useApi.ts
│   │   └── index.css
│   └── README.md
├── deployment/
│   ├── docker-compose.yml
│   └── deploy.sh
└── docs/
    ├── ARCHITECTURE.md
    ├── GETTING_STARTED.md
    └── project-requirements.md
```

---

## Environment Variables

```bash
# Workspace location
WORKSPACE_ROOT=/root/.openclaw/workspace/claw-cartel-projects

# OpenClaw Gateway
OPENCLAW_AGENT_ENABLED=true
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_GATEWAY_WS_URL=ws://127.0.0.1:18789
```

---

## Architecture Flow

```
User Input
    ↓
POST /v1/autonomous/runs
    ↓
Discussion Phase (3 rounds)
  ├─ Round 1: Initial thoughts
  ├─ Round 2: Debate
  └─ Round 3: Final positions
    ↓
PM Final Decision
    ↓
WebSocket: run.done (awaiting_approval)
    ↓
User clicks "Continue"
    ↓
POST /v1/autonomous/runs/{runId}/continue
    ↓
Code Generation Phase (4 phases)
  ├─ Phase 1: Researcher - Documentation
  ├─ Phase 2: BE_SC - Backend
  ├─ Phase 3: FE - Frontend
  └─ Phase 4: PM - Deployment
    ↓
WebSocket: run.done (completed)
    ↓
GET /v1/autonomous/runs/{runId}/files
GET /v1/autonomous/runs/{runId}/download
```

---

## Support

For issues:
1. Check OpenClaw Gateway is running on port 18789
2. Verify `/workspace/projects` directory exists and is writable
3. Check server logs for detailed error messages
