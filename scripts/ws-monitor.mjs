#!/usr/bin/env node
/* eslint-disable no-undef */
import { io } from 'socket.io-client'

// Parse args, filtering out '--' and node/script paths
const args = process.argv.slice(2).filter(arg => arg !== '--')

const [runIdArg, serverUrlArg, fromSeqArg] = args

if (!runIdArg) {
  console.error('Usage: node scripts/ws-monitor.mjs <runId> [serverUrl] [fromSeq]')
  console.error('Example: node scripts/ws-monitor.mjs 2f7a... http://localhost:3000 0')
  console.error('Or: pnpm run ws:monitor <runId> [serverUrl] [fromSeq]')
  process.exit(1)
}

const runId = runIdArg
const serverUrl = serverUrlArg || 'http://localhost:3000'
const fromSeq = fromSeqArg !== undefined ? Number(fromSeqArg) : 0

if (Number.isNaN(fromSeq) || fromSeq < 0) {
  console.error('fromSeq must be a non-negative number')
  process.exit(1)
}

console.log(`[ws-monitor] connecting to ${serverUrl}`)
console.log(`[ws-monitor] runId=${runId}, fromSeq=${fromSeq}`)

const socket = io(serverUrl, {
  transports: ['websocket', 'polling'],
  timeout: 15000,
})

socket.on('connect', () => {
  console.log(`[ws-monitor] connected: ${socket.id}`)
  socket.emit('join_run', { runId, fromSeq })
})

socket.on('connect_error', (err) => {
  console.error('[ws-monitor] connect_error:', err.message)
})

socket.on('joined_run', (payload) => {
  console.log('[ws-monitor] joined_run:', payload)
})

socket.on('run_replay', (payload) => {
  const total = payload?.totalEvents ?? 0
  console.log(`[ws-monitor] run_replay total=${total}`)

  const events = payload?.events || []
  for (const event of events) {
    const seq = event.seq
    const role = event.agentRole || 'unknown'
    const type = event.eventType
    const message = event.payload?.message || ''
    console.log(`[replay][${seq}] [${role}] ${type} ${message}`)
  }
})

socket.on('agent_event', (event) => {
  const seq = event?.seq ?? '-'
  const role = event?.role ?? 'unknown'
  const type = event?.eventType ?? 'unknown'
  const message = event?.payload?.message || ''
  console.log(`[live][${seq}] [${role}] ${type} ${message}`)
})

socket.on('disconnect', (reason) => {
  console.log('[ws-monitor] disconnected:', reason)
})

process.on('SIGINT', () => {
  console.log('\n[ws-monitor] shutting down...')
  socket.disconnect()
  process.exit(0)
})
