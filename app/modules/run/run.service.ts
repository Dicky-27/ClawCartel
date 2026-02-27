import db from '#prisma/prisma'
import {
  CreateRunDto,
  CreateAgentRunDto,
  CreateAgentEventDto,
  UpdateRunDto,
  UpdateAgentRunDto,
  ListRunsQuery,
  ListAgentRunsQuery,
  ListAgentEventsQuery,
  ReplayEventsQuery,
  ReplayEventsResponse,
  Run,
  AgentRun,
  AgentEvent,
} from '#app/modules/run/run.interface'

class RunService {
  // Run operations
  async listRuns(query: ListRunsQuery): Promise<{
    data: Run[]
    total: number
    page: number
    limit: number
    totalPages: number
  }> {
    const page = query.page ?? 1
    const limit = query.limit ?? 25
    const skip = (page - 1) * limit

    const where: any = {}
    if (query.status) where.status = query.status
    if (query.inputType) where.inputType = query.inputType

    const [data, total] = await Promise.all([
      db.run.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
      }),
      db.run.count({ where }),
    ])

    return {
      data: data as Run[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async getRun(id: string): Promise<Run | null> {
    const run = await db.run.findUnique({
      where: { id },
    })

    return run as Run | null
  }

  async getRunWithAgentRuns(id: string): Promise<(Run & { agentRuns: AgentRun[] }) | null> {
    const run = await db.run.findUnique({
      where: { id },
      include: { agentRuns: true },
    })

    return run as (Run & { agentRuns: AgentRun[] }) | null
  }

  async getRunWithEvents(id: string): Promise<(Run & { events: AgentEvent[] }) | null> {
    const run = await db.run.findUnique({
      where: { id },
      include: {
        events: {
          orderBy: { seq: 'asc' },
          include: {
            agentRun: {
              select: { role: true, agentId: true },
            },
          },
        },
      },
    })

    return run as unknown as (Run & { events: AgentEvent[] }) | null
  }

  async createRun(data: CreateRunDto): Promise<Run> {
    const run = await db.run.create({
      data: {
        inputType: data.inputType,
        inputText: data.inputText,
        status: data.status ?? 'created',
      },
    })

    return run as Run
  }

  async updateRun(id: string, data: UpdateRunDto): Promise<Run> {
    const run = await db.run.update({
      where: { id },
      data: {
        ...(data.status && { status: data.status }),
        ...(data.inputText && { inputText: data.inputText }),
      },
    })

    return run as Run
  }

  async deleteRun(id: string): Promise<void> {
    await db.run.delete({ where: { id } })
  }

  // Agent Run operations
  async listAgentRuns(query: ListAgentRunsQuery): Promise<{
    data: AgentRun[]
    total: number
    page: number
    limit: number
    totalPages: number
  }> {
    const page = query.page ?? 1
    const limit = query.limit ?? 25
    const skip = (page - 1) * limit

    const where: any = {}
    if (query.runId) where.runId = query.runId
    if (query.role) where.role = query.role
    if (query.status) where.status = query.status
    if (query.agentId) where.agentId = query.agentId

    const [data, total] = await Promise.all([
      db.agentRun.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
      }),
      db.agentRun.count({ where }),
    ])

    return {
      data: data as unknown as AgentRun[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async getAgentRun(id: string): Promise<AgentRun | null> {
    const agentRun = await db.agentRun.findUnique({
      where: { id },
    })

    return agentRun as AgentRun | null
  }

  async getAgentRunWithEvents(id: string): Promise<(AgentRun & { events: AgentEvent[] }) | null> {
    const agentRun = await db.agentRun.findUnique({
      where: { id },
      include: {
        events: {
          orderBy: { id: 'desc' },
        },
      },
    })

    return agentRun as unknown as (AgentRun & { events: AgentEvent[] }) | null
  }

  async createAgentRun(data: CreateAgentRunDto): Promise<AgentRun> {
    const agentRun = await db.agentRun.create({
      data: {
        runId: data.runId,
        role: data.role,
        agentId: data.agentId,
        sessionKey: data.sessionKey,
        status: data.status ?? 'queued',
      },
    })

    return agentRun as AgentRun
  }

  async updateAgentRun(id: string, data: UpdateAgentRunDto): Promise<AgentRun> {
    const agentRun = await db.agentRun.update({
      where: { id },
      data: {
        ...(data.status && { status: data.status }),
        ...(data.sessionKey !== undefined && { sessionKey: data.sessionKey }),
        ...(data.startedAt && { startedAt: data.startedAt }),
        ...(data.endedAt && { endedAt: data.endedAt }),
      },
    })

    return agentRun as AgentRun
  }

  async deleteAgentRun(id: string): Promise<void> {
    await db.agentRun.delete({ where: { id } })
  }

  // Agent Event operations
  async listAgentEvents(query: ListAgentEventsQuery): Promise<{
    data: AgentEvent[]
    total: number
    page: number
    limit: number
    totalPages: number
  }> {
    const page = query.page ?? 1
    const limit = query.limit ?? 25
    const skip = (page - 1) * limit

    const where: any = {}
    if (query.runId) where.runId = query.runId
    if (query.agentRunId) where.agentRunId = query.agentRunId
    if (query.eventType) where.eventType = query.eventType

    const [data, total] = await Promise.all([
      db.agentEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { seq: 'asc' },
        include: {
          agentRun: {
            select: { role: true, agentId: true },
          },
        },
      }),
      db.agentEvent.count({ where }),
    ])

    return {
      data: data as unknown as AgentEvent[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async getAgentEvent(id: string): Promise<AgentEvent | null> {
    const event = await db.agentEvent.findUnique({
      where: { id },
      include: {
        agentRun: {
          select: { role: true, agentId: true },
        },
      },
    })

    return event as unknown as AgentEvent | null
  }

  async createAgentEvent(data: CreateAgentEventDto): Promise<AgentEvent> {
    const event = await db.agentEvent.create({
      data: {
        runId: data.runId,
        agentRunId: data.agentRunId,
        seq: BigInt(data.seq),
        eventType: data.eventType as any,
        payload: data.payload,
      },
      include: {
        agentRun: {
          select: { role: true, agentId: true },
        },
      },
    })

    return event as unknown as AgentEvent
  }

  async deleteAgentEvent(id: string): Promise<void> {
    await db.agentEvent.delete({ where: { id } })
  }

  // Replay events for a run - ordered by seq
  async replayEvents(
    runId: string,
    query: ReplayEventsQuery
  ): Promise<ReplayEventsResponse> {
    const where: any = { runId }

    if (query.fromSeq !== undefined || query.toSeq !== undefined) {
      where.seq = {}
      if (query.fromSeq !== undefined) where.seq.gte = BigInt(query.fromSeq)
      if (query.toSeq !== undefined) where.seq.lte = BigInt(query.toSeq)
    }

    if (query.eventType) where.eventType = query.eventType

    const events = await db.agentEvent.findMany({
      where,
      orderBy: { seq: 'asc' },
      include: {
        agentRun: {
          select: { role: true, agentId: true },
        },
      },
    })

    return {
      runId,
      totalEvents: events.length,
      events: events.map((e: any) => ({
        seq: e.seq.toString(),
        eventType: e.eventType,
        payload: e.payload as Record<string, unknown>,
        agentRole: e.agentRun.role,
        agentId: e.agentRun.agentId,
        createdAt: e.createdAt,
      })),
    }
  }

  // Get next sequence number for a run
  async getNextSeq(runId: string): Promise<number> {
    const result = await db.agentEvent.aggregate({
      where: { runId },
      _max: { seq: true },
    })

    return Number(result._max.seq ?? 0n) + 1
  }
}

export const runService = new RunService()
export default runService
