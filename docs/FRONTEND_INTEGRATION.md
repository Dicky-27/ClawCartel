# Frontend Integration: WebSocket & API Contract

This document describes the event shapes and API responses so the frontend can integrate with the ClawCartel backend for PRD upload, chat, room/agent messaging, and PM-led discussions.

---

## Base URL

- **REST API**: `GET/POST /v1/...` (e.g. `http://localhost:3000/v1`)
- **WebSocket**: Same origin as API (Socket.IO)

---

## 1. WebSocket (Socket.IO)

### Connect

```ts
import { io } from 'socket.io-client'

const socket = io(BACKEND_URL, {
  transports: ['websocket'],
  reconnection: true,
})
```

### Join a run room (required to receive events)

Emit:

- **Event**: `join_run`
- **Payload**: `{ runId: string }` or `{ runId: string, fromSeq?: number }` (optional `fromSeq` for replay from a given sequence)

You will receive:

1. `joined_run` — `{ runId: string }`
2. `run_replay` — historical events (same shape as below)

### Leave a run

- **Event**: `leave_run`
- **Payload**: `runId: string`

---

## 2. Event: `agent_event` (live stream)

Emitted to room `run:<runId>` for every agent activity.

**Payload shape (same for live and replay):**

```ts
interface AgentEvent {
  runId: string
  agentRunId: string
  role: 'pm' | 'fe' | 'be_sc' | 'bd_research'
  seq: number
  eventType: 'agent.started' | 'agent.delta' | 'agent.done' | 'agent.error' | 'run.done'
  payload: Record<string, unknown>
  createdAt?: Date
}
```

**Use `event.role` and `event.payload` for display.** Replay events also include `role` so you can use one handler for both live and replay.

### `payload` by event type

| eventType        | payload fields (typical) | Frontend use |
|------------------|-------------------------|--------------|
| `agent.started`  | `message`, `agentName`, `agentEmoji`, `characterName`, `characterEmoji` | Show “Agent started” / avatar |
| `agent.delta`    | `message` (chunk), `accumulated?`, `state?`, `characterName`, `characterEmoji` | Append to streaming message; update agent state |
| `agent.done`     | `message` (full text), `state?`, `phase?`, `characterName`, `characterEmoji` | Finalize message; optional phase (e.g. `initial_brief`, `final_decision`) |
| `agent.error`    | `message` | Show error |
| `run.done`       | `message`, `pmBrief?`, `researcherResponse?`, … | Run complete; optional summary fields |

**Display names:** Prefer `payload.characterName` and `payload.characterEmoji` for UI (same as `agentName` / `agentEmoji`).

**Agent state:** If `payload.state` is present, it is one of: `idle` | `discussing` | `planning` | `doing` | `completed` | `error`. Use it for agent “pixel” or status indicator.

---

## 3. Event: `run_replay`

When the client emits `join_run`, the server sends:

- **Event**: `run_replay`
- **Payload**: `ReplayEventsResponse`

```ts
interface ReplayEventsResponse {
  runId: string
  totalEvents: number
  events: Array<{
    seq: string
    eventType: EventType
    payload: Record<string, unknown>
    role: AgentRole
    agentId: string
    createdAt: Date
  }>
}
```

**Process `events` with the same `displayEvent(event)` logic as live `agent_event`.** Each item has `role` and `eventType` and `payload` in the same shape as a live event.

---

## 4. Event: `agent_state` (optional)

Emitted when an agent’s state changes (e.g. discussing → planning).

```ts
{
  runId: string
  agentRunId: string
  role: AgentRole
  state: AgentState
  agentName?: string
  agentEmoji?: string
}
```

Use this to update agent status without waiting for `agent.delta` / `agent.done`.

---

## 5. REST API (relevant for frontend)

### Start a run (squad or autonomous)

- **POST** `/v1/agent/runs` or **POST** `/v1/autonomous/runs`
- **Body**: `{ idea?: string, prdText?: string, source?: 'chat' | 'prd', mode?: 'single' | 'squad', ... }`
- **Response**: `202` with run object `{ id, status, inputType, inputText, createdAt, updatedAt }`

After 202, join the run room with `run.id` and listen for `agent_event` and `run_replay`.

### Get run

- **GET** `/v1/runs/:runId`  
- Returns run with current `status` (e.g. `planning`, `executing`, `awaiting_approval`, `completed`, `failed`).

### Get events (HTTP)

- **GET** `/v1/runs/:runId/events` — paginated list of stored events (squad mode only; autonomous does not persist events).
- **GET** `/v1/runs/:runId/replay?fromSeq=0` — same shape as `run_replay`; use for initial load or sync.

### Run status and “go to dev” flow

- **Status values**: `created` | `planning` | `executing` | `awaiting_approval` | `completed` | `failed`
- When PM (and user) decide to proceed to development, backend can set run to e.g. `awaiting_approval` then `executing` when FE/BE/SC start building.
- Frontend can show “Approve for development” when status is `awaiting_approval` and call an (existing or new) API to move to dev stage.

---

## 6. Summary: frontend checklist

1. **Connect** Socket.IO to backend URL.
2. **Start run** via `POST /v1/agent/runs` or `POST /v1/autonomous/runs`; get `run.id`.
3. **Emit** `join_run` with `{ runId: run.id }`.
4. **On** `joined_run` and `run_replay`, handle replay `events` with the same logic as live events.
5. **On** `agent_event`, use `event.role`, `event.eventType`, and `event.payload`; use `payload.characterName` / `payload.characterEmoji` and `payload.message` for display; use `payload.state` for agent status.
6. **Poll or use** `GET /v1/runs/:runId` to show run status and drive “go to dev” / “building” UI.
7. **(Later)** User chat to room or each agent: use the same run and room; backend can emit `agent_event` for user messages and agent replies so the same UI works.

The current structure is suitable for frontend integration: one event shape for live and replay, consistent payload fields, and run status for controlling the discussion → development flow.

---

## 7. Making agent conversations better (ideas)

- **Structured phases in payload**: Use `payload.phase` (e.g. `initial_brief`, `squad_discussion`, `final_decision`) so the UI can show sections or steps.
- **User messages in the stream**: When the user chats to the room or an agent, emit a dedicated event type (e.g. `user.message`) with the same `runId`/room so the timeline stays linear.
- **Decision flag**: In `run.done` or a final PM message, include a structured `decision: { approved: boolean, reason?: string }` so the frontend can show “Go to development” vs “Needs more discussion” and call the right API.
- **Token/usage in payload**: Optional `payload.usage` for analytics or limits.
- **Message IDs**: Add `messageId` or `eventId` in payload for optimistic updates and de-duplication.
- **Richer agent briefs**: Keep briefs in the backend (as now) but consider a short “displayTitle” per phase so the UI can show e.g. “PM – Initial brief” vs “PM – Final decision”.
