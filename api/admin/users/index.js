// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { desc } from 'drizzle-orm';
import { getDb } from '../../../src/db/client.js';
import { users } from '../../../src/db/schema.js';
import { getSession } from '../../../src/lib/requireAuth.js';
import { assertOwner } from '../../../src/lib/requireOwner.js';
import { withErrors, methodNotAllowed } from '../../../src/lib/apiHandler.js';

// List users. Never selects password_hash. Flags the owner row so the UI can
// disable destructive actions on it.
export async function handleList({ db, ownerEmail }) {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));
  const owner = (ownerEmail || '').trim().toLowerCase();
  return { status: 200, body: rows.map((u) => ({ ...u, isOwner: u.email.toLowerCase() === owner })) };
}

export default withErrors(async function handle(req, res) {
  const db = getDb();
  const session = await getSession(req, res);
  const ownerEmail = process.env.CHAOS_OWNER_EMAIL;
  const denied = await assertOwner({ db, session, ownerEmail });
  if (denied) return res.status(denied.status).json(denied.body);

  if (req.method === 'GET') {
    const out = await handleList({ db, ownerEmail });
    return res.status(out.status).json(out.body);
  }
  return methodNotAllowed(res, 'GET');
});
