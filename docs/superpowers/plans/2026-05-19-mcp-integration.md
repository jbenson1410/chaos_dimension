# Chaos Dimension v0.4 — MCP Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose Chaos Dimension over the Model Context Protocol so Claude Code (and other MCP clients) can read and write task/workstream state with the user, using per-machine API tokens.

**Architecture:** New `/api/mcp` route speaks the MCP Streamable HTTP transport using `@modelcontextprotocol/sdk`. Auth via `Authorization: Bearer <token>` headers; tokens are hashed at rest in a new `agent_tokens` table tied to the existing `agents` table. Seven tools (3 read, 4 write) wrap the same Drizzle queries used by the REST handlers. Token minting via an npm CLI (v0.4); web UI for management deferred to v0.4.1.

**Tech Stack:** `@modelcontextprotocol/sdk`, Drizzle ORM (existing), Neon Postgres (existing), Node crypto (sha256), iron-session (existing for cookie-auth on management endpoints).

**Spec:** `docs/superpowers/specs/2026-05-19-mcp-integration-design.md`

---

## File Structure

**New files:**
```
api/
  mcp.js                          Streamable HTTP transport handler
  agent-tokens/
    index.js                      POST (mint), GET (list)
    [id].js                       DELETE (revoke)

src/lib/
  agentToken.js                   token gen/hash/verify pure helpers
  mcpTools.js                     Tool registry + dispatch
  mcpAuth.js                      Bearer-token → agent_id resolution

src/db/migrations/                Generated SQL (Task 15)

scripts/
  mint-api-key.js                 CLI: prompts password → mints token

docs/integration/
  README.md                       Setup walkthrough
  CLAUDE.md.snippet               Recommended prompt block

tests/lib/agentToken.test.js
tests/lib/mcpTools.test.js
tests/api/agent-tokens.test.js
```

**Modified files:**
```
src/db/schema.js                  Add agent_tokens table + agents.hostname/createdAt
src/lib/api.js                    Add frontend client methods (only used by v0.4.1 UI; we add stubs now)
package.json                      Add @modelcontextprotocol/sdk dep + mint-api-key script
```

---

## Test Strategy

- **Unit (vitest):**
  - `agentToken.js`: generation produces `cd_<43 chars>`; hash is deterministic; verifyToken returns the agent on match, null otherwise.
  - `mcpTools.js`: each tool's handler is a function `(db, input, ctx) -> output`. Tests inject a small fake db.
- **Integration:**
  - `agent-tokens.test.js`: REST endpoints exercised via the same hand-rolled mock-response pattern used in login.test.js.
- **Manual:**
  - Task 14: end-to-end. Mint a token. Wire `~/.claude/.mcp.json`. Ask Claude to call each tool.

---

## Task 1: Install MCP SDK and add hostname columns to agents schema

**Files:**
- Modify: `package.json`
- Modify: `src/db/schema.js`

- [ ] **Step 1: Install the MCP SDK**

Run: `npm install @modelcontextprotocol/sdk`
Expected: lockfile updates, no errors.

- [ ] **Step 2: Add a script to package.json**

In `package.json` under `"scripts"`, add:

```json
"mint-api-key": "node scripts/mint-api-key.js"
```

(Replaces the existing entry of the same name from v0.2 if it points to a different script; we're co-opting it.)

- [ ] **Step 3: Add hostname + createdAt columns to agents in `src/db/schema.js`**

In the existing `agents = pgTable('agents', { ... })` block, add inside the column object:

```js
  hostname: text('hostname'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
```

- [ ] **Step 4: Add remoteRunnable column to tasks in `src/db/schema.js`**

In the existing `tasks = pgTable('tasks', { ... })` block, add inside the column object (after `agentDispatchable`):

```js
  remoteRunnable: boolean('remote_runnable').notNull().default(false),
```

This field is forward-looking for v0.5 cloud orchestration. v0.4 stores it but doesn't act on it.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/db/schema.js
git commit -m "Add MCP SDK dep, hostname/createdAt on agents, remoteRunnable on tasks"
```

---

## Task 2: Add agent_tokens and runs tables to schema

**Files:**
- Modify: `src/db/schema.js`

- [ ] **Step 1: Add the agent_tokens table**

At the end of `src/db/schema.js`, append:

```js
export const agentTokens = pgTable('agent_tokens', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  label: text('label').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
  revoked: boolean('revoked').notNull().default(false),
});
```

- [ ] **Step 2: Add the runs table (forward-looking for v0.5)**

Append below:

```js
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
```

v0.5 will use this to record cloud-orchestrator execution attempts. v0.4 stores the schema but doesn't write to it.

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.js
git commit -m "Add agent_tokens and runs schema"
```

---

## Task 3: Token generation, hashing, and lookup helpers (TDD)

**Files:**
- Create: `tests/lib/agentToken.test.js`
- Create: `src/lib/agentToken.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/lib/agentToken.test.js
import { describe, it, expect } from 'vitest';
import { generateToken, hashToken, TOKEN_PREFIX } from '../../src/lib/agentToken.js';

describe('agentToken', () => {
  it('generates a token with the cd_ prefix and ~43 char body', () => {
    const t = generateToken();
    expect(t.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(t.length).toBeGreaterThanOrEqual(40);
    expect(t.length).toBeLessThanOrEqual(64);
  });

  it('generates unique tokens', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
  });

  it('hashes deterministically', () => {
    const t = 'cd_known_token_value_for_test';
    expect(hashToken(t)).toBe(hashToken(t));
  });

  it('hashes to a 64-char hex string', () => {
    const h = hashToken('cd_xyz');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('different tokens hash differently', () => {
    expect(hashToken('cd_a')).not.toBe(hashToken('cd_b'));
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm test`
Expected: FAIL — import resolution error.

- [ ] **Step 3: Implement**

```js
// src/lib/agentToken.js
import { randomBytes, createHash } from 'node:crypto';

export const TOKEN_PREFIX = 'cd_';

export function generateToken() {
  const body = randomBytes(32).toString('base64url');
  return `${TOKEN_PREFIX}${body}`;
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test`
Expected: 5 new passing tests in agentToken.test.js.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agentToken.js tests/lib/agentToken.test.js
git commit -m "Add agent token generate/hash helpers"
```

---

## Task 4: Bearer-token verification middleware

**Files:**
- Create: `src/lib/mcpAuth.js`

- [ ] **Step 1: Implement**

```js
// src/lib/mcpAuth.js
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { agentTokens, agents } from '../db/schema.js';
import { hashToken } from './agentToken.js';

export async function authenticateMcpRequest(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/.exec(header);
  if (!match) return null;

  const token = match[1].trim();
  if (!token) return null;

  const db = getDb();
  const rows = await db
    .select({
      agentId: agentTokens.agentId,
      tokenId: agentTokens.id,
      revoked: agentTokens.revoked,
      agentName: agents.name,
    })
    .from(agentTokens)
    .innerJoin(agents, eq(agents.id, agentTokens.agentId))
    .where(and(eq(agentTokens.tokenHash, hashToken(token)), eq(agentTokens.revoked, false)))
    .limit(1);

  if (!rows.length) return null;

  // Best-effort touch lastUsedAt; do not block the request on this.
  db.update(agentTokens).set({ lastUsedAt: new Date() }).where(eq(agentTokens.id, rows[0].tokenId)).catch(() => {});

  return { agentId: rows[0].agentId, agentName: rows[0].agentName };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/mcpAuth.js
git commit -m "Add MCP bearer-token auth resolver"
```

---

## Task 5: POST /api/agent-tokens — mint a new token

**Files:**
- Create: `api/agent-tokens/index.js`
- Create: `tests/api/agent-tokens.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/api/agent-tokens.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { mintTokenLogic } from '../../api/agent-tokens/index.js';

function makeFakeDb() {
  const state = { agents: [], agentTokens: [] };
  return {
    state,
    select: () => ({
      from: (table) => ({
        where: () => ({
          limit: () => [],
        }),
      }),
    }),
    insert: (table) => ({
      values: (row) => ({
        returning: () => {
          if (table.name === 'agents') {
            state.agents.push(row);
            return [row];
          }
          state.agentTokens.push(row);
          return [row];
        },
      }),
    }),
  };
}

describe('POST /api/agent-tokens (mintTokenLogic)', () => {
  it('returns 400 when label is missing', async () => {
    const result = await mintTokenLogic({ db: makeFakeDb(), body: {} });
    expect(result.status).toBe(400);
  });

  it('mints a token and returns the raw value once', async () => {
    const result = await mintTokenLogic({ db: makeFakeDb(), body: { label: 'macbook' } });
    expect(result.status).toBe(201);
    expect(result.body.token).toMatch(/^cd_/);
    expect(result.body.label).toBe('macbook');
    expect(result.body).toHaveProperty('agentId');
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm test`
Expected: FAIL on import.

- [ ] **Step 3: Implement**

```js
// api/agent-tokens/index.js
import { getDb } from '../../src/db/client.js';
import { agents, agentTokens } from '../../src/db/schema.js';
import { requireAuth } from '../../src/lib/requireAuth.js';
import { withErrors, methodNotAllowed } from '../../src/lib/apiHandler.js';
import { generateToken, hashToken } from '../../src/lib/agentToken.js';
import { eq, desc } from 'drizzle-orm';

export async function mintTokenLogic({ db, body }) {
  const label = typeof body?.label === 'string' ? body.label.trim() : '';
  if (!label) return { status: 400, body: { error: 'label required', message: 'A label is required.' } };

  // Each label gets its own agent row. Reuse if one already exists.
  const existingAgents = await db.select().from(agents).where(eq(agents.name, label)).limit(1);
  let agentId;
  if (existingAgents.length) {
    agentId = existingAgents[0].id;
  } else {
    const [created] = await db.insert(agents).values({ name: label, status: 'idle' }).returning();
    agentId = created.id;
  }

  const raw = generateToken();
  const [tokenRow] = await db
    .insert(agentTokens)
    .values({ agentId, tokenHash: hashToken(raw), label })
    .returning();

  return {
    status: 201,
    body: { token: raw, agentId, tokenId: tokenRow.id, label },
  };
}

export default withErrors(async function handle(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  if (req.method === 'POST') {
    const result = await mintTokenLogic({ db: getDb(), body: req.body });
    return res.status(result.status).json(result.body);
  }

  if (req.method === 'GET') {
    const db = getDb();
    const rows = await db
      .select({
        id: agentTokens.id,
        agentId: agentTokens.agentId,
        label: agentTokens.label,
        createdAt: agentTokens.createdAt,
        lastUsedAt: agentTokens.lastUsedAt,
        revoked: agentTokens.revoked,
      })
      .from(agentTokens)
      .orderBy(desc(agentTokens.createdAt));
    return res.status(200).json(rows);
  }

  return methodNotAllowed(res, 'POST, GET');
});
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test`
Expected: 2 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add api/agent-tokens/index.js tests/api/agent-tokens.test.js
git commit -m "Add POST/GET /api/agent-tokens"
```

---

## Task 6: DELETE /api/agent-tokens/[id] — revoke

**Files:**
- Create: `api/agent-tokens/[id].js`

- [ ] **Step 1: Implement**

```js
// api/agent-tokens/[id].js
import { getDb } from '../../src/db/client.js';
import { agentTokens } from '../../src/db/schema.js';
import { requireAuth } from '../../src/lib/requireAuth.js';
import { withErrors, methodNotAllowed } from '../../src/lib/apiHandler.js';
import { eq } from 'drizzle-orm';

export default withErrors(async function handle(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  if (req.method !== 'DELETE') return methodNotAllowed(res, 'DELETE');

  const db = getDb();
  const [row] = await db
    .update(agentTokens)
    .set({ revoked: true })
    .where(eq(agentTokens.id, id))
    .returning();

  if (!row) return res.status(404).json({ error: 'not found', message: 'Token not found.' });
  return res.status(200).json({ ok: true });
});
```

- [ ] **Step 2: Commit**

```bash
git add api/agent-tokens/[id].js
git commit -m "Add DELETE /api/agent-tokens/[id]"
```

---

## Task 7: MCP tools — list_workstreams + list_tasks + get_task (TDD)

**Files:**
- Create: `tests/lib/mcpTools.test.js`
- Create: `src/lib/mcpTools.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/lib/mcpTools.test.js
import { describe, it, expect } from 'vitest';
import { TOOLS, runTool } from '../../src/lib/mcpTools.js';

function makeFakeDb({ workstreams = [], tasks = [], agents = [] } = {}) {
  return {
    select: () => ({
      from: (table) => ({
        where: () => ({
          orderBy: () => ({
            limit: () => {
              const name = table[Symbol.for('drizzle:Name')] || table.name || '';
              if (name === 'workstreams') return workstreams;
              if (name === 'tasks') return tasks;
              if (name === 'agents') return agents;
              return [];
            },
          }),
          limit: () => {
            const name = table[Symbol.for('drizzle:Name')] || table.name || '';
            if (name === 'tasks') return tasks;
            if (name === 'workstreams') return workstreams;
            return [];
          },
        }),
        orderBy: () => {
          const name = table[Symbol.for('drizzle:Name')] || table.name || '';
          if (name === 'tasks') return tasks;
          if (name === 'workstreams') return workstreams;
          return [];
        },
      }),
    }),
  };
}

describe('mcpTools registry', () => {
  it('exposes the v1 tools', () => {
    const names = TOOLS.map(t => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'list_workstreams',
        'list_tasks',
        'get_task',
        'create_task',
        'update_task',
        'claim_task',
        'report_progress',
      ])
    );
    expect(names).toHaveLength(7);
  });

  it('every tool has name, description, inputSchema, handler', () => {
    for (const tool of TOOLS) {
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
      expect(tool.inputSchema).toBeTruthy();
      expect(typeof tool.handler).toBe('function');
    }
  });
});

describe('list_workstreams tool', () => {
  it('returns rows from the workstreams table', async () => {
    const fake = makeFakeDb({
      workstreams: [{ id: 'legal-ai', label: 'Legal AI', color: '#8B0000', icon: '⚖️' }],
    });
    const out = await runTool('list_workstreams', {}, { db: fake });
    expect(out).toEqual([{ id: 'legal-ai', label: 'Legal AI', color: '#8B0000', icon: '⚖️' }]);
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm test`
Expected: FAIL — `mcpTools.js` not found.

- [ ] **Step 3: Implement the tool registry skeleton + first three tools**

```js
// src/lib/mcpTools.js
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
    description: 'List tasks. Optional filters: workstream, column, priority, limit (default 20).',
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
      const where = conds.length ? and(...conds) : undefined;
      const limit = Math.min(input.limit ?? 20, 200);
      let q = db.select().from(tasks);
      if (where) q = q.where(where);
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
  // create_task, update_task, claim_task, report_progress added in later tasks
];

export const TOOLS = TOOL_DEFS;
export const TOOLS_BY_NAME = Object.fromEntries(TOOL_DEFS.map(t => [t.name, t]));

export async function runTool(name, input, ctx = {}) {
  const tool = TOOLS_BY_NAME[name];
  if (!tool) throw new Error(`unknown tool: ${name}`);
  const db = ctx.db ?? getDb();
  return tool.handler({ db, input: input ?? {}, agentId: ctx.agentId });
}
```

> The "registry has 7 tools" test will FAIL until tasks 8–11 add the remaining four tools. That's intentional — leave it failing; subsequent tasks turn it green incrementally. Skip-mark it for this task:

In the test file, change `it('exposes the v1 tools', ...)` to `it.skip('exposes the v1 tools', ...)` for now. Unskip after Task 11.

- [ ] **Step 4: Run, verify pass**

Run: `npm test`
Expected: `it.skip` test is skipped; `list_workstreams tool` test passes; `every tool has name/description/...` test passes for the 3 tools currently registered.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mcpTools.js tests/lib/mcpTools.test.js
git commit -m "Add MCP tools registry + read tools"
```

---

## Task 8: MCP tool — create_task

**Files:**
- Modify: `src/lib/mcpTools.js`
- Modify: `tests/lib/mcpTools.test.js`

- [ ] **Step 1: Add test**

Append to `tests/lib/mcpTools.test.js`:

```js
describe('create_task tool', () => {
  it('inserts a task and returns the row', async () => {
    const inserted = [];
    const fake = {
      select: () => ({ from: () => ({ where: () => ({ limit: () => [{ id: 'legal-ai' }] }) }) }),
      insert: () => ({
        values: (row) => ({
          returning: () => {
            const created = { id: 't-fake-1', ...row };
            inserted.push(created);
            return [created];
          },
        }),
      }),
    };
    const out = await runTool('create_task', { title: 'Fix it', workstream: 'legal-ai' }, { db: fake });
    expect(out.title).toBe('Fix it');
    expect(out.workstream).toBe('legal-ai');
    expect(inserted).toHaveLength(1);
  });

  it('rejects when title is missing', async () => {
    await expect(runTool('create_task', { workstream: 'legal-ai' }, { db: {} })).rejects.toThrow(/title/);
  });

  it('rejects when workstream is missing', async () => {
    await expect(runTool('create_task', { title: 'x' }, { db: {} })).rejects.toThrow(/workstream/);
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm test`
Expected: FAIL — `unknown tool: create_task`.

- [ ] **Step 3: Add the tool**

In `src/lib/mcpTools.js`, insert into `TOOL_DEFS` (before the closing `]`):

```js
  {
    name: 'create_task',
    description: 'Create a new task. Required: title, workstream. Optional: column, priority, notes, agentDispatchable.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        workstream: { type: 'string' },
        column: { type: 'string', enum: ['backlog', 'active', 'review', 'done'], default: 'backlog' },
        priority: { type: 'string', enum: ['high', 'med', 'low'], default: 'med' },
        notes: { type: 'string', default: '' },
        agentDispatchable: { type: 'boolean', default: false },
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
        })
        .returning();
      return row;
    },
  },
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test`
Expected: 3 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mcpTools.js tests/lib/mcpTools.test.js
git commit -m "Add create_task MCP tool"
```

---

## Task 9: MCP tool — update_task

**Files:**
- Modify: `src/lib/mcpTools.js`
- Modify: `tests/lib/mcpTools.test.js`

- [ ] **Step 1: Add test**

Append to `tests/lib/mcpTools.test.js`:

```js
describe('update_task tool', () => {
  it('patches allowed fields', async () => {
    let updated;
    const fake = {
      update: () => ({
        set: (vals) => ({
          where: () => ({ returning: () => { updated = { id: 't1', ...vals }; return [updated]; } }),
        }),
      }),
    };
    const out = await runTool('update_task', { id: 't1', column: 'active' }, { db: fake });
    expect(out.column).toBe('active');
  });

  it('rejects without id', async () => {
    await expect(runTool('update_task', { column: 'active' }, { db: {} })).rejects.toThrow(/id/);
  });

  it('rejects when no fields to update', async () => {
    await expect(runTool('update_task', { id: 't1' }, { db: {} })).rejects.toThrow(/fields/);
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm test`
Expected: FAIL — `unknown tool: update_task`.

- [ ] **Step 3: Add the tool**

In `src/lib/mcpTools.js`, insert into `TOOL_DEFS`:

```js
  {
    name: 'update_task',
    description: 'Update fields on a task. Required: id. Any of title/workstream/column/priority/notes/agentDispatchable.',
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
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: async ({ db, input }) => {
      if (!input.id) throw new Error('id required');
      const ALLOWED = ['title', 'workstream', 'column', 'priority', 'notes', 'agentDispatchable'];
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
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test`
Expected: 3 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mcpTools.js tests/lib/mcpTools.test.js
git commit -m "Add update_task MCP tool"
```

---

## Task 10: MCP tool — claim_task

**Files:**
- Modify: `src/lib/mcpTools.js`
- Modify: `tests/lib/mcpTools.test.js`

- [ ] **Step 1: Add test**

Append to `tests/lib/mcpTools.test.js`:

```js
describe('claim_task tool', () => {
  it('moves the task to active and assigns this agent', async () => {
    const calls = [];
    const fake = {
      update: (table) => ({
        set: (vals) => ({
          where: () => ({
            returning: () => {
              calls.push({ table, vals });
              return [{ id: vals.id ?? 't1', ...vals }];
            },
          }),
        }),
      }),
    };
    const out = await runTool('claim_task', { id: 't1' }, { db: fake, agentId: 'a1' });
    expect(calls.length).toBe(2); // one for tasks, one for agents
    expect(out.id).toBe('t1');
  });

  it('requires id and agentId context', async () => {
    await expect(runTool('claim_task', {}, { db: {} })).rejects.toThrow(/id/);
    await expect(runTool('claim_task', { id: 't1' }, { db: {} })).rejects.toThrow(/agent/);
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npm test`
Expected: FAIL — `unknown tool: claim_task`.

- [ ] **Step 3: Add the tool**

In `src/lib/mcpTools.js`, insert into `TOOL_DEFS`:

```js
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
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test`
Expected: 2 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mcpTools.js tests/lib/mcpTools.test.js
git commit -m "Add claim_task MCP tool"
```

---

## Task 11: MCP tool — report_progress + unskip the registry-count test

**Files:**
- Modify: `src/lib/mcpTools.js`
- Modify: `tests/lib/mcpTools.test.js`

- [ ] **Step 1: Add test**

Append to `tests/lib/mcpTools.test.js`:

```js
describe('report_progress tool', () => {
  it('appends a timestamped line to task notes', async () => {
    let savedNotes;
    const fake = {
      select: () => ({
        from: () => ({
          where: () => ({ limit: () => [{ id: 't1', notes: 'existing' }] }),
        }),
      }),
      update: (table) => ({
        set: (vals) => ({
          where: () => ({
            returning: () => {
              if ('notes' in vals) savedNotes = vals.notes;
              return [{ id: 't1', notes: vals.notes ?? 'existing' }];
            },
          }),
        }),
      }),
    };
    await runTool('report_progress', { id: 't1', message: 'made progress' }, { db: fake, agentId: 'a1' });
    expect(savedNotes).toMatch(/made progress/);
    expect(savedNotes).toMatch(/existing/);
  });
});
```

- [ ] **Step 2: Unskip the registry-count test**

In `tests/lib/mcpTools.test.js`, find the test `it.skip('exposes the v1 tools', ...)` and change `it.skip` back to `it`.

- [ ] **Step 3: Run, verify failure**

Run: `npm test`
Expected: FAIL — `unknown tool: report_progress`, and the now-unskipped test asserts 7 tools but only 6 are registered.

- [ ] **Step 4: Add the tool**

In `src/lib/mcpTools.js`, insert into `TOOL_DEFS`:

```js
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
```

- [ ] **Step 5: Run, verify pass**

Run: `npm test`
Expected: all mcpTools tests pass; registry count is exactly 7.

- [ ] **Step 6: Commit**

```bash
git add src/lib/mcpTools.js tests/lib/mcpTools.test.js
git commit -m "Add report_progress MCP tool"
```

---

## Task 12: MCP transport handler at /api/mcp

**Files:**
- Create: `api/mcp.js`

- [ ] **Step 1: Implement**

```js
// api/mcp.js
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { authenticateMcpRequest } from '../src/lib/mcpAuth.js';
import { TOOLS, runTool } from '../src/lib/mcpTools.js';

function buildServer(ctx) {
  const server = new Server(
    { name: 'chaos-dimension', version: '0.4.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const result = await runTool(request.params.name, request.params.arguments ?? {}, ctx);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: err?.message || 'tool error' }],
      };
    }
  });

  return server;
}

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const auth = await authenticateMcpRequest(req);
  if (!auth) {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing bearer token.' });
  }

  const server = buildServer({ agentId: auth.agentId, agentName: auth.agentName });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
```

- [ ] **Step 2: Commit**

```bash
git add api/mcp.js
git commit -m "Add MCP Streamable HTTP transport at /api/mcp"
```

---

## Task 13: Mint-api-key CLI script

**Files:**
- Create: `scripts/mint-api-key.js`

- [ ] **Step 1: Implement**

```js
// scripts/mint-api-key.js
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import readline from 'node:readline';
import { verifyPassword } from '../src/lib/passwords.js';
import { mintTokenLogic } from '../api/agent-tokens/index.js';
import { getDb } from '../src/db/client.js';

function prompt(q, { masked = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  if (masked) {
    rl._writeToOutput = () => {};
  }
  return new Promise((res) => rl.question(q, (a) => { rl.close(); if (masked) process.stdout.write('\n'); res(a); }));
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--label' && argv[i + 1]) out.label = argv[i + 1];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const label = args.label || (await prompt('Token label (e.g. macbook): ')).trim();
  if (!label) {
    console.error('Label is required.');
    process.exit(1);
  }

  const password = await prompt('Owner password: ', { masked: true });
  const ok = await verifyPassword(password, process.env.CHAOS_PASSWORD_HASH);
  if (!ok) {
    console.error('Invalid password.');
    process.exit(1);
  }

  const db = getDb();
  const result = await mintTokenLogic({ db, body: { label } });
  if (result.status !== 201) {
    console.error('Mint failed:', result.body);
    process.exit(1);
  }

  console.log('\nMCP API key minted. Add this block to ~/.claude/.mcp.json under mcpServers:\n');
  console.log(JSON.stringify({
    'chaos-dimension': {
      url: 'https://chaosdimension.fyi/api/mcp',
      headers: { Authorization: `Bearer ${result.body.token}` },
    },
  }, null, 2));
  console.log('\nThis token is shown ONCE. Copy it now.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
git add scripts/mint-api-key.js
git commit -m "Add mint-api-key CLI"
```

---

## Task 14: Integration docs (README + CLAUDE.md snippet)

**Files:**
- Create: `docs/integration/README.md`
- Create: `docs/integration/CLAUDE.md.snippet`

- [ ] **Step 1: Create the CLAUDE.md snippet**

```markdown
<!-- docs/integration/CLAUDE.md.snippet -->
## Chaos Dimension tracking

You have access to the `chaos-dimension` MCP server tools. Use them to keep work tracked.

When the user gives you a non-trivial coding instruction:

1. Call `list_workstreams` and `list_tasks` to check whether the work is already tracked.
2. If not, ask the user: "Want me to track this as a task in <inferred workstream>?"
3. If they say yes, call `create_task` then `claim_task` with the new id.
4. While working, call `report_progress` periodically with concise updates (≤ 80 chars).
5. When done, call `update_task` with `column: 'review'` (or `'done'` if no review is needed).

Skip tracking for trivial edits (typos, one-line fixes, exploration).

If `chaos-dimension` tools error or are unreachable, proceed with the user's request without tracking and mention it once: "Couldn't reach Chaos Dimension; this work isn't tracked."

To disable tracking in this project: remove this section from CLAUDE.md.
```

- [ ] **Step 2: Create the setup README**

```markdown
<!-- docs/integration/README.md -->
# Chaos Dimension MCP — Setup

Connect Claude Code (or any MCP client) to your Chaos Dimension deployment.

## One-time per machine

1. **Mint a token.** From a clone of this repo:
   ```bash
   npm run mint-api-key -- --label macbook
   ```
   Enter your owner password when prompted. You'll see a JSON block — copy it.

2. **Open `~/.claude/.mcp.json`** (create the file if it doesn't exist). Merge the printed block into the `mcpServers` section. Example:
   ```json
   {
     "mcpServers": {
       "chaos-dimension": {
         "url": "https://chaosdimension.fyi/api/mcp",
         "headers": {
           "Authorization": "Bearer cd_paste-your-token-here"
         }
       }
     }
   }
   ```

3. **Restart Claude Code.** The seven `chaos-dimension` tools will appear in the available tool list.

## Enabling auto-tracking in a project

Drop the snippet from `docs/integration/CLAUDE.md.snippet` into your project's `CLAUDE.md` (or your global `~/.claude/CLAUDE.md`). Claude will start asking before creating tasks.

## Revoking a token

```bash
# List existing tokens (with their IDs)
curl https://chaosdimension.fyi/api/agent-tokens \
  -H "Cookie: chaos_session=..."  # use a session from your browser, or build a small revoke script

# Revoke one
curl -X DELETE https://chaosdimension.fyi/api/agent-tokens/<id>
```

A dashboard UI for token management is coming in v0.4.1.
```

- [ ] **Step 3: Commit**

```bash
git add docs/integration/
git commit -m "Add MCP integration docs"
```

---

## Task 15 (HANDOFF): Migration + Vercel deploy

The user runs these against the production Neon DB.

- [ ] **Step 1: Generate the migration**

Run from the repo root (with `DATABASE_URL` set in `.env.local`):
```bash
npm run db:generate
```
Expected: a new SQL file appears in `src/db/migrations/` containing `CREATE TABLE "agent_tokens"` and the `ALTER TABLE "agents" ADD COLUMN ...` for `hostname` and `created_at`.

- [ ] **Step 2: Apply the migration**

```bash
npm run db:push
```
Expected: changes applied without errors.

- [ ] **Step 3: Commit the generated migration**

```bash
git add src/db/migrations
git commit -m "Generate v0.4 schema migration"
git push origin main
```

Vercel auto-deploys.

---

## Task 16 (HANDOFF): Manual smoke test

Once Vercel has the new deployment live:

- [ ] **Step 1: Mint a token locally**

```bash
npm run mint-api-key -- --label macbook
```

- [ ] **Step 2: Update `~/.claude/.mcp.json`**

Paste the printed JSON block under `mcpServers`.

- [ ] **Step 3: Restart Claude Code in a fresh terminal**

```bash
cd ~/code/<any-project>
claude
```

- [ ] **Step 4: Verify the tools are loaded**

In the Claude Code chat, ask: "Show me the chaos-dimension tools you have access to." Claude should list all 7.

- [ ] **Step 5: Run through the full lifecycle**

In chat: "Create a test task in any workstream, claim it, post a progress message, then move it to review."

Claude should execute `list_workstreams` → `create_task` → `claim_task` → `report_progress` → `update_task(column: 'review')`. Open chaosdimension.fyi to verify the task appears and progresses through columns.

- [ ] **Step 6: Test auto-tracking**

Paste `docs/integration/CLAUDE.md.snippet` into a test project's `CLAUDE.md`. Start a Claude Code session there. Ask: "Help me refactor a function in this codebase." Claude should ask whether to create a task before doing the work.

---

## Self-Review Notes

- **Spec coverage:**
  - Schema additions (agents.hostname/createdAt, tasks.remoteRunnable, agent_tokens table, runs table) — Tasks 1–2. The remoteRunnable column and runs table are forward-looking for v0.5 cloud orchestration; v0.4 doesn't read or write them.
  - 7-tool surface (list_workstreams, list_tasks, get_task, create_task, update_task, claim_task, report_progress) — Tasks 7–11. Each tool has unit test coverage.
  - Bearer auth + token lookup — Tasks 3, 4.
  - REST management routes (POST/GET/DELETE /api/agent-tokens) — Tasks 5, 6.
  - MCP Streamable HTTP transport — Task 12.
  - Mint CLI — Task 13.
  - CLAUDE.md snippet + setup docs — Task 14.
  - Migration + deploy story — Tasks 15, 16.
  - Graceful degradation (auth fail → 401, tool errors → isError content block, no MCP retries) — Task 12 implements; Task 14 documents.
- **Placeholder scan:** none. Every step has executable code or commands.
- **Type consistency:**
  - `agentId` used consistently (not `agent_id`) at the JS layer; underscored only inside SQL/schema.
  - Tool names match between TOOLS_BY_NAME and the registry-count test.
  - `runTool` signature `(name, input, ctx)` used the same way in every test.
  - `withErrors` reused from existing `src/lib/apiHandler.js`.
- **Out-of-scope (explicitly):** AIM Messenger (Task 28, separate spec), hooks-based passive reporting, SSE/WebSocket push, workstream CRUD via MCP, dashboard UI for token management.
