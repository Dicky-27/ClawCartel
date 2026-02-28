import { FastifyReply, FastifyRequest } from 'fastify'
import { createReadStream } from 'fs'
import AutonomousAgentService from '#app/modules/agent/autonomous.service'
import { fileSystem } from '#app/modules/agent/file-system.service'
import { StartRunBody, RunParams } from '#app/modules/agent/agent.interface'
import runService from '#app/modules/run/run.service'
import Logger from '#app/utils/logger'

const AutonomousController = {
  startRun: async (
    request: FastifyRequest<{ Body: StartRunBody }>,
    reply: FastifyReply
  ) => {
    const run = await AutonomousAgentService.startRun(request.server, request.body)

    return reply.json(run, 202)
  },

  getRun: async (
    request: FastifyRequest<{ Params: RunParams }>,
    reply: FastifyReply
  ) => {
    const run = await runService.getRun(request.params.runId)

    return reply.json(run)
  },

  continueToDevelopment: async (
    request: FastifyRequest<{ Params: RunParams; Body: { approved: boolean } }>,
    reply: FastifyReply
  ) => {
    const { runId } = request.params
    const { approved } = request.body

    await AutonomousAgentService.continueToDevelopment(request.server, runId, approved)

    return reply.json({
      success: true,
      message: approved ? 'Development phase started' : 'Run cancelled',
      runId
    })
  },

  getFiles: async (
    request: FastifyRequest<{ Params: RunParams }>,
    reply: FastifyReply
  ) => {
    const { runId } = request.params

    try {
      const files = await fileSystem.listDirectory(runId)
      const stats = await fileSystem.getStats(runId)

      return reply.json({
        runId,
        files,
        stats,
      })
    } catch (error) {
      Logger.error({ runId, error }, 'Failed to list files')

      return reply.status(500).json({ error: 'Failed to list files' })
    }
  },

  getFileContent: async (
    request: FastifyRequest<{ Params: RunParams & { filePath: string } }>,
    reply: FastifyReply
  ) => {
    const { runId } = request.params
    const filePath = request.params['*'] || ''

    try {
      const content = await fileSystem.readFile(runId, filePath)

      return reply.json({ runId, filePath, content })
    } catch (error) {
      return reply.status(404).json({ error: 'File not found' })
    }
  },

  downloadProject: async (
    request: FastifyRequest<{ Params: RunParams }>,
    reply: FastifyReply
  ) => {
    const { runId } = request.params

    try {
      const zipPath = await fileSystem.createZip(runId)
      const stream = createReadStream(zipPath)

      reply.header('Content-Type', 'application/zip')
      reply.header('Content-Disposition', `attachment; filename="project-${runId.slice(0, 8)}.zip"`)

      return reply.send(stream)
    } catch (error) {
      Logger.error({ runId, error }, 'Failed to create zip')

      return reply.status(500).json({ error: 'Failed to create download' })
    }
  },
}

export default AutonomousController
