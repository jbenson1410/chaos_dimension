// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '../../src/db/client.js';
import { users, tasks, oauthClients, agentTokens, agents } from '../../src/db/schema.js';
import { requireAuth } from '../../src/lib/requireAuth.js';
import { withErrors, methodNotAllowed } from '../../src/lib/apiHandler.js';
import { withUserContext } from '../../src/lib/userContext.js';

async function readState(db, userId) {
  // users is not RLS-scoped; plain query.
  const [userRow] = await db
    .select({ coachDismissed: users.coachDismissed })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // oauth_clients is explicitly NOT RLS-scoped (see migrate-multi-tenant.js).
  const [{ count: oauthCount }] = await db
    .select({ count: sql`count(*)`.mapWith(Number) })
    .from(oauthClients)
    .where(eq(oauthClients.userId, userId));

  // agent_tokens isn't RLS-scoped, but the join to agents (which IS RLS-scoped)
  // requires app.current_user_id to be set. Wrap in withUserContext.
  const agentTokenCount = await withUserContext(db, userId, async (tx) => {
    const [{ count }] = await tx
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(agentTokens)
      .innerJoin(agents, eq(agentTokens.agentId, agents.id))
      .where(and(eq(agents.userId, userId), eq(agentTokens.revoked, false)));
    return count;
  });

  // tasks is RLS-scoped. Must run inside withUserContext.
  const mcpTaskCount = await withUserContext(db, userId, async (tx) => {
    const [{ count }] = await tx
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.createdVia, 'mcp')));
    return count;
  });

  return {
    coach_dismissed: !!userRow?.coachDismissed,
    has_connected_ai: oauthCount > 0 || agentTokenCount > 0,
    has_mcp_created_task: mcpTaskCount > 0,
  };
}

export default withErrors(async function handleOnboarding(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;
  const db = getDb();

  if (req.method === 'GET') {
    const state = await readState(db, session.userId);
    return res.status(200).json(state);
  }

  if (req.method === 'POST') {
    const action = req.body?.action;
    if (action === 'dismiss') {
      await db.update(users).set({ coachDismissed: true, updatedAt: new Date() }).where(eq(users.id, session.userId));
      return res.status(200).json({ ok: true });
    }
    if (action === 'reset') {
      await db.update(users).set({ coachDismissed: false, updatedAt: new Date() }).where(eq(users.id, session.userId));
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'invalid action', message: 'action must be "dismiss" or "reset"' });
  }

  return methodNotAllowed(res, 'GET, POST');
});
