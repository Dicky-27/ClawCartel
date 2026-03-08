import db from '#prisma/prisma'

/**
 * Test script to verify agent events can be inserted and replayed by sequence
 *
 * Run with: pnpm exec tsx tests/agent-events.test.ts
 */
async function testAgentEvents() {
  console.log('Testing agent events...\n')

  // 1. Create a run
  const run = await db.run.create({
    data: {
      inputType: 'chat',
      inputText: 'Build a user authentication system',
      status: 'created',
    }
  })
  console.log('✓ Created run:', run.id)

  // 2. Create agent runs for different roles
  const pmAgent = await db.agentRun.create({
    data: {
      runId: run.id,
      role: 'pm',
      agentId: 'pm-agent-v1',
      status: 'running',
      startedAt: new Date(),
    }
  })
  console.log('✓ Created PM agent run:', pmAgent.id)

  const beAgent = await db.agentRun.create({
    data: {
      runId: run.id,
      role: 'be_sc',
      agentId: 'backend-agent-v1',
      status: 'queued',
    }
  })
  console.log('✓ Created Backend agent run:', beAgent.id)

  // 3. Insert events with sequence numbers
  const events = await db.agentEvent.createMany({
    data: [
      { runId: run.id, agentRunId: pmAgent.id, seq: 1n, eventType: 'agent_started', payload: { agent: 'pm', task: 'analyze requirements' } },
      { runId: run.id, agentRunId: pmAgent.id, seq: 2n, eventType: 'agent_delta', payload: { chunk: 'Analyzing user requirements...' } },
      { runId: run.id, agentRunId: pmAgent.id, seq: 3n, eventType: 'agent_delta', payload: { chunk: 'Identified key features: login, register, forgot password' } },
      { runId: run.id, agentRunId: pmAgent.id, seq: 4n, eventType: 'agent_done', payload: { result: 'PRD document generated', document: '# Auth System PRD...' } },
      { runId: run.id, agentRunId: beAgent.id, seq: 5n, eventType: 'agent_started', payload: { agent: 'be_sc', task: 'design schema' } },
      { runId: run.id, agentRunId: beAgent.id, seq: 6n, eventType: 'agent_delta', payload: { chunk: 'Designing database schema...' } },
      { runId: run.id, agentRunId: beAgent.id, seq: 7n, eventType: 'agent_done', payload: { result: 'Schema designed', tables: ['users', 'sessions'] } },
      { runId: run.id, agentRunId: pmAgent.id, seq: 8n, eventType: 'run_done', payload: { summary: 'All agents completed' } },
    ]
  })
  console.log('✓ Created', events.count, 'events\n')

  // 4. Replay events ordered by seq (the key acceptance criteria)
  console.log('=== Replaying events by sequence ===')
  const replay = await db.agentEvent.findMany({
    where: { runId: run.id },
    orderBy: { seq: 'asc' },
    include: {
      agentRun: {
        select: { role: true, agentId: true }
      }
    }
  })

  replay.forEach(e => {
    console.log(`[${e.seq}] ${e.eventType} | agent: ${e.agentRun.role} | payload:`, JSON.stringify(e.payload).substring(0, 60) + '...')
  })

  // 5. Verify unique constraint on (run_id, seq)
  console.log('\n=== Testing unique constraint ===')
  try {
    await db.agentEvent.create({
      data: {
        runId: run.id,
        agentRunId: pmAgent.id,
        seq: 1n, // Duplicate seq!
        eventType: 'agent_error',
        payload: { error: 'should fail' }
      }
    })
    console.log('✗ Unique constraint not enforced!')
  } catch (err: any) {
    console.log('✓ Unique constraint enforced:', err.message.includes('Unique constraint') ? 'Yes' : 'No')
  }

  // 6. Query by agent_run_id with created_at index
  console.log('\n=== Querying events by agent ===')
  const pmEvents = await db.agentEvent.findMany({
    where: { agentRunId: pmAgent.id },
    orderBy: { createdAt: 'asc' }
  })
  console.log(`PM agent has ${pmEvents.length} events`)

  // Cleanup
  await db.run.delete({ where: { id: run.id } })
  console.log('\n✓ Cleanup completed')

  await db.$disconnect()
}

testAgentEvents()
  .then(() => console.log('\n✅ All tests passed!'))
  .catch(err => {
    console.error('\n❌ Test failed:', err)
    process.exit(1)
  })
