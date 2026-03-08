import db from '#prisma/prisma'

/**
 * Seeder for runs, agent_runs, and agent_events
 * Run with: pnpm exec tsx prisma/seeders/run.seeder.ts
 */
async function seed() {
  console.log('🌱 Seeding runs and agent events...\n')

  // Clean up existing data
  await db.agentEvent.deleteMany()
  await db.agentRun.deleteMany()
  await db.run.deleteMany()
  console.log('✓ Cleaned up existing data')

  // Create runs
  const run1 = await db.run.create({
    data: {
      inputType: 'chat',
      inputText: 'Build a user authentication system with JWT tokens',
      status: 'completed',
    }
  })
  console.log('✓ Created run 1:', run1.id)

  const run2 = await db.run.create({
    data: {
      inputType: 'prd',
      inputText: '# E-commerce Platform PRD\n\n## Features\n- Product catalog\n- Shopping cart\n- Payment integration',
      status: 'executing',
    }
  })
  console.log('✓ Created run 2:', run2.id)

  // Create agent runs for run 1
  const pmAgent = await db.agentRun.create({
    data: {
      runId: run1.id,
      role: 'pm',
      agentId: 'pm-agent-v1',
      status: 'completed',
      sessionKey: 'sess-pm-001',
      startedAt: new Date(Date.now() - 3600000),
      endedAt: new Date(Date.now() - 3000000),
    }
  })
  console.log('✓ Created PM agent run:', pmAgent.id)

  const beAgent = await db.agentRun.create({
    data: {
      runId: run1.id,
      role: 'be_sc',
      agentId: 'backend-agent-v1',
      status: 'completed',
      sessionKey: 'sess-be-001',
      startedAt: new Date(Date.now() - 2900000),
      endedAt: new Date(Date.now() - 2400000),
    }
  })
  console.log('✓ Created Backend agent run:', beAgent.id)

  const feAgent = await db.agentRun.create({
    data: {
      runId: run1.id,
      role: 'fe',
      agentId: 'frontend-agent-v1',
      status: 'completed',
      sessionKey: 'sess-fe-001',
      startedAt: new Date(Date.now() - 2300000),
      endedAt: new Date(Date.now() - 1800000),
    }
  })
  console.log('✓ Created Frontend agent run:', feAgent.id)

  // Create events for run 1 - PM Agent
  const pmEvents = await db.agentEvent.createMany({
    data: [
      { runId: run1.id, agentRunId: pmAgent.id, seq: 1n, eventType: 'agent_started', payload: { task: 'analyze requirements' } },
      { runId: run1.id, agentRunId: pmAgent.id, seq: 2n, eventType: 'agent_delta', payload: { chunk: 'Analyzing authentication requirements...' } },
      { runId: run1.id, agentRunId: pmAgent.id, seq: 3n, eventType: 'agent_delta', payload: { chunk: '\n\nKey features identified:' } },
      { runId: run1.id, agentRunId: pmAgent.id, seq: 4n, eventType: 'agent_delta', payload: { chunk: '\n- User registration\n- User login\n- Password reset\n- JWT token management' } },
      { runId: run1.id, agentRunId: pmAgent.id, seq: 5n, eventType: 'agent_done', payload: { result: 'PRD completed', document: '# Auth System PRD\n\n## Overview...' } },
    ]
  })
  console.log(`✓ Created ${pmEvents.count} PM agent events`)

  // Create events for run 1 - Backend Agent
  const beEvents = await db.agentEvent.createMany({
    data: [
      { runId: run1.id, agentRunId: beAgent.id, seq: 6n, eventType: 'agent_started', payload: { task: 'design database schema' } },
      { runId: run1.id, agentRunId: beAgent.id, seq: 7n, eventType: 'agent_delta', payload: { chunk: 'Designing schema...' } },
      { runId: run1.id, agentRunId: beAgent.id, seq: 8n, eventType: 'agent_delta', payload: { chunk: '\n\nTables: users, sessions, password_resets' } },
      { runId: run1.id, agentRunId: beAgent.id, seq: 9n, eventType: 'agent_done', payload: { result: 'Schema designed', tables: ['users', 'sessions', 'password_resets'] } },
    ]
  })
  console.log(`✓ Created ${beEvents.count} Backend agent events`)

  // Create events for run 1 - Frontend Agent
  const feEvents = await db.agentEvent.createMany({
    data: [
      { runId: run1.id, agentRunId: feAgent.id, seq: 10n, eventType: 'agent_started', payload: { task: 'create UI components' } },
      { runId: run1.id, agentRunId: feAgent.id, seq: 11n, eventType: 'agent_delta', payload: { chunk: 'Creating LoginForm...' } },
      { runId: run1.id, agentRunId: feAgent.id, seq: 12n, eventType: 'agent_delta', payload: { chunk: '\nCreating RegisterForm...' } },
      { runId: run1.id, agentRunId: feAgent.id, seq: 13n, eventType: 'agent_delta', payload: { chunk: '\nCreating PasswordResetForm...' } },
      { runId: run1.id, agentRunId: feAgent.id, seq: 14n, eventType: 'agent_done', payload: { result: 'UI components created', components: ['LoginForm', 'RegisterForm', 'PasswordResetForm'] } },
      { runId: run1.id, agentRunId: pmAgent.id, seq: 15n, eventType: 'run_done', payload: { summary: 'All agents completed successfully' } },
    ]
  })
  console.log(`✓ Created ${feEvents.count} Frontend agent events`)

  // Create agent runs for run 2 (in progress)
  const run2PmAgent = await db.agentRun.create({
    data: {
      runId: run2.id,
      role: 'pm',
      agentId: 'pm-agent-v1',
      status: 'running',
      sessionKey: 'sess-pm-002',
      startedAt: new Date(Date.now() - 600000),
    }
  })
  console.log('✓ Created Run 2 PM agent run:', run2PmAgent.id)

  // Create in-progress events for run 2
  const run2Events = await db.agentEvent.createMany({
    data: [
      { runId: run2.id, agentRunId: run2PmAgent.id, seq: 1n, eventType: 'agent_started', payload: { task: 'analyze PRD' } },
      { runId: run2.id, agentRunId: run2PmAgent.id, seq: 2n, eventType: 'agent_delta', payload: { chunk: 'Reading PRD document...' } },
      { runId: run2.id, agentRunId: run2PmAgent.id, seq: 3n, eventType: 'agent_delta', payload: { chunk: '\n\nIdentifying epics:' } },
    ]
  })
  console.log(`✓ Created ${run2Events.count} Run 2 events`)

  console.log('\n🎉 Seeding completed!')

  // Demo: Replay events for run 1
  console.log('\n📋 Demo: Replaying events for run 1 (ordered by seq):')
  const replay = await db.agentEvent.findMany({
    where: { runId: run1.id },
    orderBy: { seq: 'asc' },
    include: {
      agentRun: { select: { role: true, agentId: true } }
    }
  })

  replay.forEach((e: any) => {
    console.log(`  [${e.seq.toString().padStart(2)}] ${e.eventType.padEnd(15)} | ${e.agentRun.role.padEnd(8)} | ${JSON.stringify(e.payload).substring(0, 50)}...`)
  })

  await db.$disconnect()
}

seed()
  .then(() => console.log('\n✅ Seeder finished'))
  .catch((error) => {
    console.error('\n❌ Seeder failed:', error)
    process.exit(1)
  })
