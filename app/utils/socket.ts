import { FastifyInstance } from 'fastify'
import { Server } from 'socket.io'
import runService from '#app/modules/run/run.service'

type JoinRunPayload = {
  runId: string
  fromSeq?: number
}

export function registerSocket(app: FastifyInstance) {
  const io = new Server(app.server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })

  io.on('connection', socket => {
    app.log.info({ socketId: socket.id }, 'socket connected')

    socket.on('join_run', async (payload: string | JoinRunPayload) => {
      const runId = typeof payload === 'string' ? payload : payload.runId
      const fromSeq = typeof payload === 'string' ? undefined : payload.fromSeq

      socket.join(`run:${runId}`)
      socket.emit('joined_run', { runId })

      const replay = await runService.replayEvents(runId, {
        fromSeq,
      })

      socket.emit('run_replay', replay)
    })

    socket.on('leave_run', (runId: string) => {
      socket.leave(`run:${runId}`)
      socket.emit('left_run', { runId })
    })

    socket.on('disconnect', () => {
      app.log.info({ socketId: socket.id }, 'socket disconnected')
    })
  })

  app.decorate('io', io)

  return io
}
