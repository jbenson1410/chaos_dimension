// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client.js';
import { users } from '../../../src/db/schema.js';
import { getSession } from '../../../src/lib/requireAuth.js';
import { assertOwner, getOwnerId } from '../../../src/lib/requireOwner.js';
import { hashPassword } from '../../../src/lib/passwords.js';
import { withErrors, methodNotAllowed } from '../../../src/lib/apiHandler.js';

const MIN_PASSWORD = 8;

// 12 base64url chars (~72 bits). Shown to the owner once; never stored plain.
function generateTempPassword() {
  return randomBytes(9).toString('base64url');
}

// Reset a user's password. If the owner supplies a password, use it; otherwise
// generate a temporary one and return it once (no email infra to send a link).
export async function handleResetPassword({ db, id, body }) {
  const provided = typeof body?.password === 'string' ? body.password : '';
  if (provided && provided.length < MIN_PASSWORD) {
    return { status: 400, body: { error: 'weak_password', message: `Password must be at least ${MIN_PASSWORD} characters.` } };
  }
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  if (!rows.length) return { status: 404, body: { error: 'not found', message: 'User not found.' } };

  const password = provided || generateTempPassword();
  const passwordHash = await hashPassword(password);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, id));
  return { status: 200, body: { ok: true, password, generated: !provided } };
}

// Delete a user (cascades to their tasks/workstreams/agents/runs/tokens via the
// ON DELETE CASCADE FKs). Refuse to delete the owner — that would lock you out.
export async function handleDelete({ db, id, ownerEmail }) {
  const ownerId = await getOwnerId({ db, ownerEmail });
  if (id === ownerId) {
    return { status: 403, body: { error: 'cannot_delete_owner', message: 'You cannot delete the owner account.' } };
  }
  const deleted = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
  if (!deleted.length) return { status: 404, body: { error: 'not found', message: 'User not found.' } };
  return { status: 200, body: { ok: true } };
}

export default withErrors(async function handle(req, res) {
  const db = getDb();
  const session = await getSession(req, res);
  const ownerEmail = process.env.CHAOS_OWNER_EMAIL;
  const denied = await assertOwner({ db, session, ownerEmail });
  if (denied) return res.status(denied.status).json(denied.body);

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  if (req.method === 'PATCH') {
    const out = await handleResetPassword({ db, id, body: req.body });
    return res.status(out.status).json(out.body);
  }
  if (req.method === 'DELETE') {
    const out = await handleDelete({ db, id, ownerEmail });
    return res.status(out.status).json(out.body);
  }
  return methodNotAllowed(res, 'PATCH, DELETE');
});
