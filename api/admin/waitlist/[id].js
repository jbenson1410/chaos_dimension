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
import { waitlist } from '../../../src/db/schema.js';
import { getSession } from '../../../src/lib/requireAuth.js';
import { assertOwner, getOwnerId } from '../../../src/lib/requireOwner.js';
import { createInvite, inviteLink } from '../../../src/lib/invites.js';
import { withErrors, methodNotAllowed } from '../../../src/lib/apiHandler.js';

// Mint an invite for a waitlist entry and mark the row invited. Returns the
// code/link so the owner can share it. The note carries the entry's email for
// traceability on the invites list.
export async function handleInvite({ db, id, ownerEmail }) {
  const rows = await db.select().from(waitlist).where(eq(waitlist.id, id)).limit(1);
  if (!rows.length) return { status: 404, body: { error: 'not found', message: 'Waitlist entry not found.' } };
  const entry = rows[0];

  const ownerId = await getOwnerId({ db, ownerEmail });
  if (!ownerId) return { status: 500, body: { error: 'owner row not found' } };

  const invite = await createInvite({ db, createdById: ownerId, note: `waitlist: ${entry.email}` });
  await db.update(waitlist).set({ invited: true, invitedAt: new Date() }).where(eq(waitlist.id, id));
  return { status: 201, body: { code: invite.code, link: inviteLink(invite.code), email: entry.email } };
}

export async function handleDelete({ db, id }) {
  const deleted = await db.delete(waitlist).where(eq(waitlist.id, id)).returning({ id: waitlist.id });
  if (!deleted.length) return { status: 404, body: { error: 'not found', message: 'Waitlist entry not found.' } };
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

  if (req.method === 'POST') {
    const out = await handleInvite({ db, id, ownerEmail });
    return res.status(out.status).json(out.body);
  }
  if (req.method === 'DELETE') {
    const out = await handleDelete({ db, id });
    return res.status(out.status).json(out.body);
  }
  return methodNotAllowed(res, 'POST, DELETE');
});
