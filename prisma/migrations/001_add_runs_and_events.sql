-- Create enum types
CREATE TYPE "RunStatus" AS ENUM ('created', 'planning', 'executing', 'awaiting_approval', 'completed', 'failed');
CREATE TYPE "InputType" AS ENUM ('chat', 'prd');
CREATE TYPE "AgentRole" AS ENUM ('pm', 'fe', 'be_sc', 'marketing');
CREATE TYPE "AgentRunStatus" AS ENUM ('queued', 'running', 'completed', 'failed');
CREATE TYPE "EventType" AS ENUM ('agent.started', 'agent.delta', 'agent.done', 'agent.error', 'run.done');

-- Create runs table
CREATE TABLE "runs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "status" "RunStatus" NOT NULL DEFAULT 'created',
    "input_type" "InputType" NOT NULL,
    "input_text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create agent_runs table
CREATE TABLE "agent_runs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "run_id" UUID NOT NULL REFERENCES "runs"("id") ON DELETE CASCADE,
    "role" "AgentRole" NOT NULL,
    "agent_id" TEXT NOT NULL,
    "session_key" TEXT,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'queued',
    "started_at" TIMESTAMPTZ,
    "ended_at" TIMESTAMPTZ
);

-- Create agent_events table
CREATE TABLE "agent_events" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "run_id" UUID NOT NULL REFERENCES "runs"("id") ON DELETE CASCADE,
    "agent_run_id" UUID NOT NULL REFERENCES "agent_runs"("id") ON DELETE CASCADE,
    "seq" BIGINT NOT NULL,
    "event_type" "EventType" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE ("run_id", "seq")
);

-- Create indexes
CREATE INDEX "idx_agent_events_run_id_seq" ON "agent_events"("run_id", "seq");
CREATE INDEX "idx_agent_events_agent_run_id_created_at" ON "agent_events"("agent_run_id", "created_at");

-- Create updated_at trigger for runs
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_runs_updated_at
    BEFORE UPDATE ON "runs"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
