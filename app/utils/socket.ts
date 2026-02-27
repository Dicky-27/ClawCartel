import { FastifyInstance } from 'fastify'
import { Server } from 'socket.io'

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

    socket.on('join_run', (runId: string) => {
      socket.join(`run:${runId}`)
      socket.emit('joined_run', { runId })
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
