# ClawCartel AI Agents System

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│  Backend (3000)  │────▶│  OpenClaw       │
│  (test-fe.html) │◀────│  Fastify + WS    │◀────│  Gateway        │
└─────────────────┘     └──────────────────┘     │  (18789)        │
         │                      │                 └─────────────────┘
         │                      │                          │
         │                      ▼                          │
         │              ┌──────────────────┐              │
         │              │  File System     │              │
         │              │  (/workspace)    │              │
         │              └──────────────────┘              │
         │                      │                         │
         └──────────────────────┴─────────────────────────┘
                    WebSocket Events
```

## Agent Roles

| Role | Emoji | Name | Responsibility |
|------|-------|------|----------------|
| pm | 📋 | PM | Product Lead, orchestrates discussion |
| fe | 🎨 | FE | Frontend Developer (React/TypeScript) |
| be_sc | ⚙️ | BE_SC | Backend + Smart Contract Developer |
| bd_research | 🔬 | Researcher | Market research & competitive analysis |

## Two Modes

### 1. Orchestrated Mode (Legacy)
Backend controls agent execution sequence.

### 2. Autonomous Mode (Current)
PM agent decides flow via multi-round discussion.

## Autonomous Flow

### Phase 1: Discussion (3 Rounds)
```
User Input
    ↓
Round 1: Initial Thoughts
  ├─ PM introduces project
  ├─ Researcher: Market perspective
  ├─ FE: UI/UX approach
  └─ BE_SC: Technical architecture
    ↓
Round 2: Debate
  ├─ PM challenges timeline
  ├─ Agents respond to each other
  └─ Technical feasibility debated
    ↓
Round 3: Final Positions
  ├─ Each agent states bottom line
  └─ Non-negotiables identified
    ↓
PM Final Decision
    ↓
WebSocket: awaiting_approval
```

### Phase 2: Code Generation (4 Phases)
```
User clicks "Continue"
    ↓
Init Project Workspace
    ↓
Phase 1: Researcher
  ├─ research/market-analysis.md
  ├─ research/competitor-report.md
  └─ docs/project-requirements.md
    ↓
Phase 2: BE_SC
  ├─ backend/package.json
  ├─ backend/src/api/routes.ts
  ├─ backend/src/models/schema.prisma
  ├─ backend/src/contracts/main.sol
  └─ backend/README.md
    ↓
Phase 3: FE
  ├─ frontend/package.json
  ├─ frontend/src/App.tsx
  ├─ frontend/src/components/Layout.tsx
  ├─ frontend/src/pages/Home.tsx
  ├─ frontend/src/hooks/useApi.ts
  ├─ frontend/src/index.css
  └─ frontend/README.md
    ↓
Phase 4: PM
  ├─ deployment/docker-compose.yml
  ├─ deployment/deploy.sh
  ├─ docs/ARCHITECTURE.md
  └─ docs/GETTING_STARTED.md
    ↓
WebSocket: completed
```

## File Storage

**Location:** `/root/.openclaw/workspace/claw-cartel-projects/{runId}/`

```
{runId}/
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
│   └── src/
│       ├── App.tsx
│       ├── components/
│       ├── pages/
│       └── hooks/
├── deployment/
│   ├── docker-compose.yml
│   └── deploy.sh
└── docs/
    ├── ARCHITECTURE.md
    └── GETTING_STARTED.md
```

## API Endpoints

### REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/autonomous/runs` | Start discussion |
| GET | `/v1/autonomous/runs/{runId}` | Get run status |
| POST | `/v1/autonomous/runs/{runId}/continue` | Continue to build |
| GET | `/v1/autonomous/runs/{runId}/files` | List files |
| GET | `/v1/autonomous/runs/{runId}/files/*` | Get file content |
| GET | `/v1/autonomous/runs/{runId}/download` | Download ZIP |

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `join_run` | Client → Server | Subscribe to run |
| `agent_event` | Server → Client | All agent events |

**Event Types:**
- `agent.started` - Agent begins responding
- `agent.delta` - Streaming message chunk
- `agent.done` - Agent finished
- `run.done` - Run reached terminal state

## Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb

# OpenClaw Gateway
OPENCLAW_AGENT_ENABLED=true
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_GATEWAY_WS_URL=ws://127.0.0.1:18789

# File System
WORKSPACE_ROOT=/root/.openclaw/workspace/claw-cartel-projects
```

## Configuration

### Agent Prompts

Located in `app/modules/agent/autonomous.service.ts`

Each agent has:
- **Personality** - Character traits (impatient PM, creative FE, etc.)
- **Speaking Style** - How they communicate
- **Quirks** - Unique behaviors

### File Generation Format

Agents output files using this format:
```
===FILE:path/to/file.ext===
<file content>
===ENDFILE===
```

Backend extracts and writes to disk.

## Database Schema

### Run
```sql
id UUID PRIMARY KEY
status RunStatus -- created | planning | executing | awaiting_approval | completed | failed | cancelled
input_type InputType -- chat | prd
input_text TEXT
created_at TIMESTAMP
updated_at TIMESTAMP
```

### AgentRun
```sql
id UUID PRIMARY KEY
run_id UUID REFERENCES runs(id)
role AgentRole -- pm | fe | be_sc | bd_research
agent_id TEXT
status AgentRunStatus -- queued | running | completed | failed
started_at TIMESTAMP
ended_at TIMESTAMP
```

### AgentEvent
```sql
id UUID PRIMARY KEY
run_id UUID REFERENCES runs(id)
agent_run_id UUID REFERENCES agent_runs(id)
seq BIGINT
event_type EventType -- agent.started | agent.delta | agent.done | agent.error | run.done
payload JSONB
created_at TIMESTAMP
```

## Development

### Run Server
```bash
npm run dev
```

### Test Frontend
```bash
open tests/test-fe.html
```

### Check Gateway
```bash
curl http://localhost:3000/v1/agent/health
```

### Database Reset
```bash
npm run db:reset
```

## Troubleshooting

### Gateway Unreachable
- Check OpenClaw running on port 18789
- Verify SSH tunnel if using VPS

### Files Not Created
- Ensure `/workspace/projects` exists
- Check write permissions

### WebSocket Not Connecting
- Check firewall settings
- Try `{ transports: ['websocket'] }`

## Documentation

- `AUTONOMOUS_API.md` - Full API reference
- `FRONTEND_INTEGRATION.md` - Quick start guide
- `WEBSOCKET_PROTOCOL.md` - WebSocket specification

## Future Enhancements

- [ ] Git integration (commits per phase)
- [ ] Code execution (npm install, test)
- [ ] Live preview deployment
- [ ] Agent memory across runs
- [ ] Custom agent definitions
