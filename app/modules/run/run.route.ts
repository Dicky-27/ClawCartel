import { FastifyInstance } from 'fastify'
import RunController from '#app/modules/run/run.controller'
import RunSchema from '#app/modules/run/run.schema'

export default function (app: FastifyInstance) {
  // Run routes
  app.get('/', { schema: RunSchema.listRuns }, RunController.listRuns)
  app.post('/', { schema: RunSchema.createRun }, RunController.createRun)
  app.get('/:id', { schema: RunSchema.getRun }, RunController.getRun)
  app.put('/:id', { schema: RunSchema.updateRun }, RunController.updateRun)
  app.delete('/:id', { schema: RunSchema.deleteRun }, RunController.deleteRun)

  // Replay events for a run
  app.get('/:runId/replay', { schema: RunSchema.replayEvents }, RunController.replayEvents)
  app.get('/:runId/next-seq', RunController.getNextSeq)

  // Agent Run routes
  app.get('/agent-runs', { schema: RunSchema.listAgentRuns }, RunController.listAgentRuns)
  app.post('/agent-runs', { schema: RunSchema.createAgentRun }, RunController.createAgentRun)
  app.get('/agent-runs/:id', { schema: RunSchema.getAgentRun }, RunController.getAgentRun)
  app.put('/agent-runs/:id', { schema: RunSchema.updateAgentRun }, RunController.updateAgentRun)
  app.delete('/agent-runs/:id', { schema: RunSchema.deleteAgentRun }, RunController.deleteAgentRun)

  // Agent Event routes
  app.get('/events', { schema: RunSchema.listAgentEvents }, RunController.listAgentEvents)
  app.post('/events', { schema: RunSchema.createAgentEvent }, RunController.createAgentEvent)
  app.get('/events/:id', { schema: RunSchema.getAgentEvent }, RunController.getAgentEvent)
  app.delete('/events/:id', { schema: RunSchema.deleteAgentEvent }, RunController.deleteAgentEvent)
}
