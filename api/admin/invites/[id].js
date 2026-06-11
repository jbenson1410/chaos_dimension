// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { eq } from 'drizzle-orm';
import { getDb } from '../../../src/db/client.js';
import { inviteCodes } from '../../../src/db/schema.js';
import { getSession } from '../../../src/lib/requireAuth.js';
import { assertOwner } from '../../../src/lib/requireOwner.js';
import { withErrors, methodNotAllowed } from '../../../src/lib/apiHandler.js';

// Revoke = delete an UNCLAIMED invite. A claimed invite is part of a real
// account's history, so we refuse rather than delete it.
export async function handleRevoke({ db, id }) {
  const rows = await db.select().from(inviteCodes).where(eq(inviteCodes.id, id)).limit(1);
  if (!rows.length) return { status: 404, body: { error: 'not found', message: 'Invite not found.' } };
  if (rows[0].claimedAt) {
    return { status: 409, body: { error: 'already_claimed', message: 'That invite has already been used and cannot be revoked.' } };
  }
  await db.delete(inviteCodes).where(eq(inviteCodes.id, id));
  return { status: 200, body: { ok: true } };
}

export default withErrors(async function handle(req, res) {
  const db = getDb();
  const session = await getSession(req, res);
  const denied = await assertOwner({ db, session, ownerEmail: process.env.CHAOS_OWNER_EMAIL });
  if (denied) return res.status(denied.status).json(denied.body);

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  if (req.method === 'DELETE') {
    const out = await handleRevoke({ db, id });
    return res.status(out.status).json(out.body);
  }
  return methodNotAllowed(res, 'DELETE');
});
