Create migration for:

1) runs
- id (uuid pk)
- status (created|planning|executing|awaiting_approval|completed|failed)
- input_type (chat|prd)
- input_text (text)
- created_at, updated_at

2) agent_runs
- id (uuid pk)
- run_id (fk -> runs)
- role (pm|fe|be_sc|marketing)
- agent_id (text, ex: pm-agent)
- session_key (text, nullable)
- status (queued|running|completed|failed)
- started_at, ended_at

3) agent_events
- id (uuid pk)
- run_id (fk)
- agent_run_id (fk)
- seq (bigint, per run, unique with run_id)
- event_type (agent.started|agent.delta|agent.done|agent.error|run.done)
- payload (jsonb)
- created_at

Indexes:
- (run_id, seq)
- (agent_run_id, created_at)

Acceptance: can insert events and replay ordered by seq.