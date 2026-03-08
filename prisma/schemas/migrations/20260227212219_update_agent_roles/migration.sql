-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('created', 'planning', 'executing', 'awaiting_approval', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "InputType" AS ENUM ('chat', 'prd');

-- CreateEnum
CREATE TYPE "AgentRole" AS ENUM ('pm', 'fe', 'be_sc', 'bd_research');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('queued', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('agent.started', 'agent.delta', 'agent.done', 'agent.error', 'run.done');

-- CreateTable
CREATE TABLE "runs" (
    "id" UUID NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'created',
    "input_type" "InputType" NOT NULL,
    "input_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "role" "AgentRole" NOT NULL,
    "agent_id" TEXT NOT NULL,
    "session_key" TEXT,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'queued',
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_events" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "agent_run_id" UUID NOT NULL,
    "seq" BIGINT NOT NULL,
    "event_type" "EventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_events_run_id_seq_idx" ON "agent_events"("run_id", "seq");

-- CreateIndex
CREATE INDEX "agent_events_agent_run_id_created_at_idx" ON "agent_events"("agent_run_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "agent_events_run_id_seq_key" ON "agent_events"("run_id", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
