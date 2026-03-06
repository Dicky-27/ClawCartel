import { FastifyReply, FastifyRequest } from 'fastify'
import { createReadStream } from 'fs'
import AutonomousAgentService from '#app/modules/agent-autonomous/agent-autonomous.service'
import { fileSystem } from '#app/modules/agent-core/agent-core.files'
import { StartRunBody } from '#app/modules/agent-core/agent-core.interface'
import runService from '#app/modules/run/run.service'
import ResponseUtil from '#app/utils/response'
import Logger from '#app/utils/logger'
import AppException from '#app/exceptions/app_exception'
import ErrorCodes from '#app/exceptions/error_codes'

interface RunParams {
  runId: string
}

interface FileContentQuery {
  path: string
}

async function getOptionalAuthenticatedUserId(
  request: FastifyRequest
): Promise<number | undefined> {
  const authHeader = request.headers.authorization
  if (!authHeader) {
    return undefined
  }

  try {
    await request.jwtVerify()
  } catch {
    throw new AppException(401, ErrorCodes.UNAUTHORIZED, 'Invalid or expired token')
  }

  return request.user?.sub
}

const AutonomousController = {
  /**
   * Returns available agents
   */
  listAgents: async (_request: FastifyRequest, reply: FastifyReply) => {
    const agents = await AutonomousAgentService.listAgents()

    return ResponseUtil.success(reply, { agents })
  },

  /**
   * Starts a new autonomous run.
   */
  startRun: async (
    request: FastifyRequest<{ Body: StartRunBody }>,
    reply: FastifyReply
  ) => {
    const userId = await getOptionalAuthenticatedUserId(request)
    const run = await AutonomousAgentService.startRun(request.server, request.body, userId)

    return ResponseUtil.accepted(reply, run)
  },

  /**
   * Starts a fresh autonomous thread and returns a new runId.
   */
  startNewThread: async (
    request: FastifyRequest<{ Body: StartRunBody }>,
    reply: FastifyReply
  ) => {
    const userId = await getOptionalAuthenticatedUserId(request)
    const run = await AutonomousAgentService.startNewThread(request.server, request.body, userId)

    return ResponseUtil.accepted(reply, run)
  },

  /**
   * Fetches the persisted run snapshot.
   */
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

  /**
   * Resolves the approval gate for a run.
   * @returns Success response describing the resulting action.
   */
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

  /**
   * Lists generated files and workspace stats for a run.
   *
   * @param request Fastify request with `runId` route params.
   * @param reply Fastify reply used to send the file tree payload.
   * @returns Success response with files and stats, or 500 on failure.
   */
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

  /**
   * Reads one generated file from the run workspace.
   *
   * @param request Fastify request with `runId` and file path query.
   * @param reply Fastify reply used to send file contents.
   * @returns Success response with file contents, or 404 if missing.
   */
  getFileContent: async (
    request: FastifyRequest<{ Params: RunParams; Querystring: FileContentQuery }>,
    reply: FastifyReply
  ) => {
    const { runId } = request.params
    const { path: filePath } = request.query

    try {
      const content = await fileSystem.readFile(runId, filePath)

      return ResponseUtil.success(reply, { runId, filePath, content })
    } catch (error) {
      return ResponseUtil.notFound(reply, 'File')
    }
  },

  /**
   * Streams the generated project as a ZIP download.
   *
   * @param request Fastify request with `runId` route params.
   * @param reply Fastify reply used to stream the archive.
   * @returns ZIP stream response, or 500 if archive creation fails.
   */
  downloadProject: async (
    request: FastifyRequest<{ Params: RunParams }>,
    reply: FastifyReply
  ) => {
    const { runId } = request.params

    try {
      // Create the archive from the current run workspace on demand.
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
