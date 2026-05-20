import { pgTable, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const workstreams = pgTable('workstreams', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  color: text('color').notNull(),
  icon: text('icon').notNull(),
});

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  title: text('title').notNull(),
  workstream: text('workstream').notNull(),
  column: text('column').notNull(),
  agentDispatchable: boolean('agent_dispatchable').notNull().default(false),
  remoteRunnable: boolean('remote_runnable').notNull().default(false),
  priority: text('priority').notNull().default('med'),
  notes: text('notes').notNull().default(''),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const agents = pgTable('agents', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  status: text('status').notNull().default('idle'),
  taskId: text('task_id'),
  startedAt: timestamp('started_at'),
  log: jsonb('log').notNull().default([]),
  hostname: text('hostname'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const agentTokens = pgTable('agent_tokens', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  label: text('label').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
  revoked: boolean('revoked').notNull().default(false),
});

export const runs = pgTable('runs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  agentId: text('agent_id').notNull().references(() => agents.id),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at'),
  status: text('status').notNull().default('running'),
  logUrl: text('log_url'),
  notes: text('notes').notNull().default(''),
});
