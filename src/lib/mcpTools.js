import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { tasks, agents, workstreams } from '../db/schema.js';

const TOOL_DEFS = [
  {
    name: 'list_workstreams',
    description: 'List all workstreams (id, label, color, icon).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async ({ db }) => {
      return db.select().from(workstreams);
    },
  },
  {
    name: 'list_tasks',
    description: 'List tasks. Optional filters: workstream, column, priority, limit (default 20, max 200).',
    inputSchema: {
      type: 'object',
      properties: {
        workstream: { type: 'string' },
        column: { type: 'string', enum: ['backlog', 'active', 'review', 'done'] },
        priority: { type: 'string', enum: ['high', 'med', 'low'] },
        limit: { type: 'number', minimum: 1, maximum: 200 },
      },
      additionalProperties: false,
    },
    handler: async ({ db, input }) => {
      const conds = [];
      if (input.workstream) conds.push(eq(tasks.workstream, input.workstream));
      if (input.column) conds.push(eq(tasks.column, input.column));
      if (input.priority) conds.push(eq(tasks.priority, input.priority));
      const limit = Math.min(input.limit ?? 20, 200);
      let q = db.select().from(tasks);
      if (conds.length) q = q.where(and(...conds));
      return q.orderBy(desc(tasks.createdAt)).limit(limit);
    },
  },
  {
    name: 'get_task',
    description: 'Fetch one task by id (full detail including notes).',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: async ({ db, input }) => {
      const rows = await db.select().from(tasks).where(eq(tasks.id, input.id)).limit(1);
      if (!rows.length) throw new Error('task not found');
      return rows[0];
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task. Required: title, workstream. Optional: column, priority, notes, agentDispatchable, remoteRunnable.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        workstream: { type: 'string' },
        column: { type: 'string', enum: ['backlog', 'active', 'review', 'done'], default: 'backlog' },
        priority: { type: 'string', enum: ['high', 'med', 'low'], default: 'med' },
        notes: { type: 'string', default: '' },
        agentDispatchable: { type: 'boolean', default: false },
        remoteRunnable: { type: 'boolean', default: false },
      },
      required: ['title', 'workstream'],
      additionalProperties: false,
    },
    handler: async ({ db, input }) => {
      if (!input.title?.trim()) throw new Error('title required');
      if (!input.workstream?.trim()) throw new Error('workstream required');
      const [row] = await db
        .insert(tasks)
        .values({
          title: input.title.trim(),
          workstream: input.workstream,
          column: input.column ?? 'backlog',
          priority: input.priority ?? 'med',
          notes: input.notes ?? '',
          agentDispatchable: input.agentDispatchable ?? false,
          remoteRunnable: input.remoteRunnable ?? false,
        })
        .returning();
      return row;
    },
  },
  {
    name: 'update_task',
    description: 'Update fields on a task. Required: id. Any of title/workstream/column/priority/notes/agentDispatchable/remoteRunnable.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        workstream: { type: 'string' },
        column: { type: 'string', enum: ['backlog', 'active', 'review', 'done'] },
        priority: { type: 'string', enum: ['high', 'med', 'low'] },
        notes: { type: 'string' },
        agentDispatchable: { type: 'boolean' },
        remoteRunnable: { type: 'boolean' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: async ({ db, input }) => {
      if (!input.id) throw new Error('id required');
      const ALLOWED = ['title', 'workstream', 'column', 'priority', 'notes', 'agentDispatchable', 'remoteRunnable'];
      const updates = {};
      for (const k of ALLOWED) {
        if (k in input) updates[k] = input[k];
      }
      if (Object.keys(updates).length === 0) throw new Error('no fields to update');
      updates.updatedAt = new Date();
      const [row] = await db.update(tasks).set(updates).where(eq(tasks.id, input.id)).returning();
      if (!row) throw new Error('task not found');
      return row;
    },
  },
  {
    name: 'claim_task',
    description: 'Move a task to the active column and assign it to the calling agent.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: async ({ db, input, agentId }) => {
      if (!input.id) throw new Error('id required');
      if (!agentId) throw new Error('agent context required');
      const [taskRow] = await db
        .update(tasks)
        .set({ column: 'active', updatedAt: new Date() })
        .where(eq(tasks.id, input.id))
        .returning();
      if (!taskRow) throw new Error('task not found');
      await db
        .update(agents)
        .set({ taskId: input.id, status: 'running', startedAt: new Date() })
        .where(eq(agents.id, agentId))
        .returning();
      return taskRow;
    },
  },
  {
    name: 'report_progress',
    description: 'Append a timestamped progress message to a task\'s notes.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        message: { type: 'string' },
      },
      required: ['id', 'message'],
      additionalProperties: false,
    },
    handler: async ({ db, input }) => {
      if (!input.id || !input.message) throw new Error('id and message required');
      const rows = await db.select().from(tasks).where(eq(tasks.id, input.id)).limit(1);
      if (!rows.length) throw new Error('task not found');
      const stamp = new Date().toISOString().slice(11, 16); // HH:MM
      const appended = rows[0].notes
        ? `${rows[0].notes}\n[${stamp}] ${input.message}`
        : `[${stamp}] ${input.message}`;
      const [row] = await db
        .update(tasks)
        .set({ notes: appended, updatedAt: new Date() })
        .where(eq(tasks.id, input.id))
        .returning();
      return row;
    },
  },
];

export const TOOLS = TOOL_DEFS;
export const TOOLS_BY_NAME = Object.fromEntries(TOOL_DEFS.map(t => [t.name, t]));

export async function runTool(name, input, ctx = {}) {
  const tool = TOOLS_BY_NAME[name];
  if (!tool) throw new Error(`unknown tool: ${name}`);
  const db = ctx.db ?? getDb();
  return tool.handler({ db, input: input ?? {}, agentId: ctx.agentId });
}
