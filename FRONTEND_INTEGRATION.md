# Frontend Integration Guide - Quick Start

## Minimal Integration (3 Steps)

### Step 1: Start Discussion

```javascript
const BACKEND_URL = 'http://localhost:3000';

async function startDiscussion(idea) {
  const res = await fetch(`${BACKEND_URL}/v1/autonomous/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idea })
  });
  
  const data = await res.json();
  return data.id; // runId
}
```

### Step 2: Listen to Events

```javascript
import { io } from 'socket.io-client';

function listenToRun(runId, callbacks) {
  const socket = io(BACKEND_URL);
  
  socket.emit('join_run', { runId });
  
  socket.on('agent_event', (event) => {
    const { eventType, payload } = event;
    
    switch (eventType) {
      case 'agent.started':
        callbacks.onTyping?.(payload.agentName);
        break;
        
      case 'agent.delta':
        if (payload.phase === 'file_created') {
          callbacks.onFileCreated?.(payload.fileEvent);
        } else {
          callbacks.onMessage?.(payload);
        }
        break;
        
      case 'run.done':
        if (payload.phase === 'awaiting_approval') {
          callbacks.onNeedsApproval?.();
        } else if (payload.phase === 'completed') {
          callbacks.onComplete?.(payload);
        }
        break;
    }
  });
  
  return socket;
}
```

### Step 3: Approve & Download

```javascript
async function approveAndBuild(runId, approved = true) {
  await fetch(`${BACKEND_URL}/v1/autonomous/runs/${runId}/continue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved })
  });
}

function downloadProject(runId) {
  window.open(`${BACKEND_URL}/v1/autonomous/runs/${runId}/download`);
}
```

---

## Complete Working Example

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
  <style>
    body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .message { padding: 10px; margin: 10px 0; background: #f0f0f0; border-radius: 8px; }
    .pm { border-left: 4px solid #4a9eff; }
    .fe { border-left: 4px solid #ff6b6b; }
    .be_sc { border-left: 4px solid #ffd93d; }
    .researcher { border-left: 4px solid #00ff88; }
    .file { border-left: 4px solid #00cc66; background: #f0fff0; }
    button { padding: 10px 20px; margin: 5px; cursor: pointer; }
    #files { margin-top: 20px; }
  </style>
</head>
<body>
  <h1>🎮 ClawCartel Agent Chat</h1>
  
  <div id="setup">
    <input id="idea" placeholder="Enter your project idea..." style="width: 70%; padding: 10px;">
    <button onclick="start()">Start</button>
  </div>
  
  <div id="chat" style="display: none;">
    <div id="phase">Waiting...</div>
    <div id="messages"></div>
    <div id="actions" style="display: none;">
      <button onclick="approve(true)">✅ Start Building</button>
      <button onclick="approve(false)">❌ Cancel</button>
    </div>
    <div id="download" style="display: none;">
      <button onclick="download()">⬇️ Download Project</button>
    </div>
  </div>

  <script>
    const BACKEND = 'http://localhost:3000';
    let runId = null;
    let socket = null;
    let currentMessages = {};

    async function start() {
      const idea = document.getElementById('idea').value;
      if (!idea) return alert('Enter an idea');
      
      const res = await fetch(`${BACKEND}/v1/autonomous/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea })
      });
      
      const data = await res.json();
      runId = data.id;
      
      document.getElementById('setup').style.display = 'none';
      document.getElementById('chat').style.display = 'block';
      
      connectSocket();
    }

    function connectSocket() {
      socket = io(BACKEND);
      
      socket.on('connect', () => {
        socket.emit('join_run', { runId });
      });
      
      socket.on('agent_event', handleEvent);
    }

    function handleEvent(event) {
      const { eventType, payload } = event;
      const container = document.getElementById('messages');
      
      // Update phase
      if (payload.phase) {
        document.getElementById('phase').textContent = 
          payload.phase.toUpperCase().replace(/_/g, ' ');
      }
      
      switch (eventType) {
        case 'agent.started': {
          const div = document.createElement('div');
          div.className = `message ${payload.agentName.toLowerCase()}`;
          div.id = `msg-${payload.agentName}`;
          div.innerHTML = `<strong>${payload.agentEmoji} ${payload.agentName}</strong><br><span class="typing">typing...</span>`;
          container.appendChild(div);
          currentMessages[payload.agentName] = div;
          break;
        }
        
        case 'agent.delta': {
          if (payload.phase === 'file_created') {
            const div = document.createElement('div');
            div.className = 'message file';
            div.textContent = payload.message;
            container.appendChild(div);
          } else {
            const div = currentMessages[payload.agentName];
            if (div) {
              div.innerHTML = `<strong>${payload.agentEmoji} ${payload.agentName}</strong><br>${payload.accumulated || payload.message}`;
            }
          }
          window.scrollTo(0, document.body.scrollHeight);
          break;
        }
        
        case 'run.done': {
          if (payload.phase === 'awaiting_approval') {
            document.getElementById('actions').style.display = 'block';
          } else if (payload.phase === 'completed') {
            document.getElementById('download').style.display = 'block';
          }
          break;
        }
      }
    }

    async function approve(shouldBuild) {
      await fetch(`${BACKEND}/v1/autonomous/runs/${runId}/continue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: shouldBuild })
      });
      
      document.getElementById('actions').style.display = 'none';
      
      if (!shouldBuild) {
        document.getElementById('phase').textContent = 'CANCELLED';
      }
    }

    function download() {
      window.open(`${BACKEND}/v1/autonomous/runs/${runId}/download`);
    }
  </script>
</body>
</html>
```

---

## Event Payload Reference

### Agent Started
```javascript
{
  eventType: "agent.started",
  payload: {
    agentName: "PM",           // PM, FE, BE_SC, Researcher
    agentEmoji: "📋",
    message: "PM is typing...",
    phase: "round_1"           // Current phase
  }
}
```

### Agent Message (Streaming)
```javascript
{
  eventType: "agent.delta",
  payload: {
    agentName: "PM",
    message: "new chunk",      // This chunk only
    accumulated: "full text",  // Full message so far
  }
}
```

### File Created
```javascript
{
  eventType: "agent.delta",
  payload: {
    phase: "file_created",
    message: "📁 Created: backend/package.json",
    fileEvent: {
      filePath: "backend/package.json",
      agentName: "BE_SC"
    }
  }
}
```

### Discussion Complete
```javascript
{
  eventType: "run.done",
  payload: {
    phase: "awaiting_approval",
    message: "Discussion complete - Ready to build"
  }
}
```

### Build Complete
```javascript
{
  eventType: "run.done",
  payload: {
    phase: "completed",
    stats: { totalFiles: 18, totalSize: 52400 },
    downloadUrl: "/v1/autonomous/runs/.../download"
  }
}
```

---

## Phases Timeline

```
planning
  ↓
executing (round_1, round_2, round_3, final)
  ↓
awaiting_approval  ← Show Continue/Cancel buttons
  ↓ (if Continue clicked)
executing (phase_1_docs, phase_2_backend, phase_3_frontend, phase_4_deploy)
  ↓
completed          ← Show Download button
```

---

## Common Use Cases

### Show Typing Indicator
```javascript
socket.on('agent_event', (event) => {
  if (event.eventType === 'agent.started') {
    showTyping(event.payload.agentName);
  } else if (event.eventType === 'agent.done') {
    hideTyping(event.payload.agentName);
  }
});
```

### Stream Text to UI
```javascript
const messages = {};

socket.on('agent_event', (event) => {
  if (event.eventType === 'agent.delta') {
    const name = event.payload.agentName;
    messages[name] = event.payload.accumulated;
    updateMessage(name, messages[name]);
  }
});
```

### Track File Generation
```javascript
const files = [];

socket.on('agent_event', (event) => {
  if (event.eventType === 'agent.delta' && 
      event.payload.phase === 'file_created') {
    files.push(event.payload.fileEvent.filePath);
    updateFileList(files);
  }
});
```

---

## Troubleshooting

### WebSocket not connecting
- Check backend is running on port 3000
- Use `{ transports: ['websocket'] }` option
- Check firewall settings

### No events received
- Ensure you called `socket.emit('join_run', { runId })`
- Verify runId is correct
- Check browser console for errors

### 500 error on continue
- Check OpenClaw Gateway is running on port 18789
- Verify `/workspace/projects` directory exists
- Check server logs for details

---

## Testing

Use the included test file:
```bash
open tests/test-fe.html
```

Or test with curl:
```bash
# Start discussion
curl -X POST http://localhost:3000/v1/autonomous/runs \
  -H "Content-Type: application/json" \
  -d '{"idea": "Build a todo app"}'

# Continue to build
curl -X POST http://localhost:3000/v1/autonomous/runs/{runId}/continue \
  -H "Content-Type: application/json" \
  -d '{"approved": true}'

# Download
curl http://localhost:3000/v1/autonomous/runs/{runId}/download \
  -o project.zip
```
