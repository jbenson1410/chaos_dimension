// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../../../src/db/client.js';
import { inviteCodes, users } from '../../../src/db/schema.js';
import { getSession } from '../../../src/lib/requireAuth.js';
import { assertOwner, getOwnerId } from '../../../src/lib/requireOwner.js';
import { createInvite, inviteLink } from '../../../src/lib/invites.js';
import { withErrors, methodNotAllowed } from '../../../src/lib/apiHandler.js';

const MAX_NOTE = 1000;

export async function handleList({ db }) {
  const claimer = users; // alias for readability
  const rows = await db
    .select({
      id: inviteCodes.id,
      code: inviteCodes.code,
      note: inviteCodes.note,
      createdAt: inviteCodes.createdAt,
      claimedAt: inviteCodes.claimedAt,
      claimedByUserId: inviteCodes.claimedByUserId,
      claimedByEmail: claimer.email,
    })
    .from(inviteCodes)
    .leftJoin(claimer, eq(claimer.id, inviteCodes.claimedByUserId))
    .orderBy(desc(inviteCodes.createdAt));
  return { status: 200, body: rows.map((r) => ({ ...r, status: r.claimedAt ? 'claimed' : 'open' })) };
}

export async function handleMint({ db, body, ownerEmail }) {
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, MAX_NOTE) : '';
  const ownerId = await getOwnerId({ db, ownerEmail });
  if (!ownerId) return { status: 500, body: { error: 'owner row not found' } };
  const row = await createInvite({ db, createdById: ownerId, note });
  return { status: 201, body: { id: row.id, code: row.code, note: row.note, link: inviteLink(row.code) } };
}

export default withErrors(async function handle(req, res) {
  const db = getDb();
  const session = await getSession(req, res);
  const ownerEmail = process.env.CHAOS_OWNER_EMAIL;
  const denied = await assertOwner({ db, session, ownerEmail });
  if (denied) return res.status(denied.status).json(denied.body);

  if (req.method === 'GET') {
    const out = await handleList({ db });
    return res.status(out.status).json(out.body);
  }
  if (req.method === 'POST') {
    const out = await handleMint({ db, body: req.body, ownerEmail });
    return res.status(out.status).json(out.body);
  }
  return methodNotAllowed(res, 'GET, POST');
});
