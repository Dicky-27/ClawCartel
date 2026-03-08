import db from '#prisma/prisma'
import agentLoader from '#app/agents/agent-loader'

async function seedAgents(): Promise<void> {
  // Load agent definitions from agents/ folder
  await agentLoader.loadAll()
  const catalog = agentLoader.getCatalog()

  for (const agent of catalog) {
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
  const catalog = agentLoader.getCatalog()
  console.log(`Seeded ${catalog.length} agents.`)
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
