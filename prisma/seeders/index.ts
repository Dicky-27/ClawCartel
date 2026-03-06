import db from '#prisma/prisma'
import { AGENT_CATALOG } from '#app/modules/agent-core/agent-core.config'

async function seedAgents(): Promise<void> {
  for (const agent of AGENT_CATALOG) {
    await db.agent.upsert({
      where: { id: agent.id },
      update: {
        name: agent.agentName,
        role: agent.role,
        description: agent.description,
        skills: agent.skills,
      },
      create: {
        id: agent.id,
        name: agent.agentName,
        role: agent.role,
        description: agent.description,
        skills: agent.skills,
      },
    })
  }
}

async function seed(): Promise<void> {
  console.log('Start seeding...')
  await seedAgents()
  console.log(`Seeded ${AGENT_CATALOG.length} agents.`)
  console.log('Seeding finished.')
}

seed()
  .catch(error => {
    console.error('Seeding failed.', error)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
