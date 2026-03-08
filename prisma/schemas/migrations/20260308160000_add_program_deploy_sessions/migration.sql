CREATE TYPE "ProgramDeploymentStatus" AS ENUM (
  'preparing',
  'ready',
  'submitting',
  'confirmed',
  'failed',
  'expired',
  'cancelled'
);

CREATE TYPE "ProgramDeploymentTxStatus" AS ENUM (
  'pending',
  'sent',
  'confirmed',
  'failed'
);

CREATE TABLE "program_deployments" (
  "id" UUID NOT NULL,
  "run_id" UUID NOT NULL,
  "user_id" INTEGER NOT NULL,
  "program_name" TEXT NOT NULL,
  "program_id" TEXT NOT NULL,
  "wallet_address" TEXT NOT NULL,
  "rpc_url" TEXT NOT NULL,
  "loader_model" TEXT NOT NULL,
  "last_valid_block_height" BIGINT NOT NULL,
  "max_data_len" INTEGER NOT NULL,
  "binary_size" INTEGER NOT NULL,
  "chunk_size" INTEGER NOT NULL,
  "status" "ProgramDeploymentStatus" NOT NULL DEFAULT 'preparing',
  "error_code" TEXT,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "program_deployments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "program_deployment_txs" (
  "id" UUID NOT NULL,
  "deployment_id" UUID NOT NULL,
  "tx_index" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "tx_base64" TEXT NOT NULL,
  "signature" TEXT,
  "slot" BIGINT,
  "status" "ProgramDeploymentTxStatus" NOT NULL DEFAULT 'pending',
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "program_deployment_txs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "program_deployments_run_id_user_id_status_idx"
ON "program_deployments"("run_id", "user_id", "status");

CREATE UNIQUE INDEX "program_deployment_txs_deployment_id_tx_index_key"
ON "program_deployment_txs"("deployment_id", "tx_index");

CREATE INDEX "program_deployment_txs_deployment_id_tx_index_idx"
ON "program_deployment_txs"("deployment_id", "tx_index");

ALTER TABLE "program_deployments"
ADD CONSTRAINT "program_deployments_run_id_fkey"
FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_deployments"
ADD CONSTRAINT "program_deployments_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_deployment_txs"
ADD CONSTRAINT "program_deployment_txs_deployment_id_fkey"
FOREIGN KEY ("deployment_id") REFERENCES "program_deployments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
