/**
 * Autonomous Agent Controller
 */

import { FastifyReply, FastifyRequest } from 'fastify'
import { createReadStream } from 'fs'
import AutonomousAgentService from '#app/modules/agent-autonomous/agent-autonomous.service'
import { fileSystem } from '#app/modules/agent-core/agent-core.files'
import { StartRunBody } from '#app/modules/agent-core/agent-core.interface'
import runService from '#app/modules/run/run.service'
import ResponseUtil from '#app/utils/response'
import Logger from '#app/utils/logger'

interface RunParams {
  runId: string
}

const AutonomousController = {
  startRun: async (
    request: FastifyRequest<{ Body: StartRunBody }>,
    reply: FastifyReply
  ) => {
    const run = await AutonomousAgentService.startRun(request.server, request.body)

    return ResponseUtil.accepted(reply, run)
  },

  getRun: async (
    request: FastifyRequest<{ Params: RunParams }>,
    reply: FastifyReply
  ) => {
    const run = await runService.getRun(request.params.runId)
    if (!run) {
      return ResponseUtil.notFound(reply, 'Run')
    }

    return ResponseUtil.success(reply, run)
  },

  continueToDevelopment: async (
    request: FastifyRequest<{ Params: RunParams; Body: { approved: boolean } }>,
    reply: FastifyReply
  ) => {
    const { runId } = request.params
    const { approved } = request.body

    await AutonomousAgentService.continueToDevelopment(request.server, runId, approved)

    return ResponseUtil.success(reply, {
      runId,
      action: approved ? 'development_started' : 'cancelled',
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

      return ResponseUtil.success(reply, { runId, files, stats })
    } catch (error) {
      Logger.error({ runId, error }, 'Failed to list files')

      return ResponseUtil.internalError(reply, 'Failed to list files')
    }
  },

  getFileContent: async (
    request: FastifyRequest<{ Params: RunParams & { '*': string } }>,
    reply: FastifyReply
  ) => {
    const { runId } = request.params
    const filePath = request.params['*'] || ''

    try {
      const content = await fileSystem.readFile(runId, filePath)

      return ResponseUtil.success(reply, { runId, filePath, content })
    } catch (error) {
      return ResponseUtil.notFound(reply, 'File')
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
      reply.header(
        'Content-Disposition',
        `attachment; filename="clawcartel-project-${runId.slice(0, 8)}.zip"`
      )

      return reply.send(stream)
    } catch (error) {
      Logger.error({ runId, error }, 'Failed to create zip')

      return ResponseUtil.internalError(reply, 'Failed to create zip')
    }
  },
}

export default AutonomousController
