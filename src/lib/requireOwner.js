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
import { users } from '../db/schema.js';
import { getDb } from '../db/client.js';
import { getSession } from './requireAuth.js';

// There is no role column. The owner is the single user whose email matches
// CHAOS_OWNER_EMAIL (same rule used by scripts/mint-invite.js and the
// migration that seeds the owner row). users is not RLS-scoped, so a plain
// lookup is safe and cheap.
//
// Returns null when the caller IS the owner; otherwise a { status, body }
// error object the caller can hand straight to res. Written as a pure
// function so admin handlers stay unit-testable.
export async function assertOwner({ db, session, ownerEmail }) {
  if (!session?.authed || !session?.userId) {
    return { status: 401, body: { error: 'unauthorized' } };
  }
  if (!ownerEmail) {
    return { status: 500, body: { error: 'CHAOS_OWNER_EMAIL not configured' } };
  }
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, ownerEmail.trim().toLowerCase()))
    .limit(1);
  const ownerId = rows[0]?.id;
  if (!ownerId || session.userId !== ownerId) {
    return { status: 403, body: { error: 'forbidden' } };
  }
  return null;
}

// Resolve the owner's user id (or null). Handy when a handler needs to know
// the owner row beyond the gate (e.g. stamping created_by_id on an invite).
export async function getOwnerId({ db, ownerEmail }) {
  if (!ownerEmail) return null;
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, ownerEmail.trim().toLowerCase()))
    .limit(1);
  return rows[0]?.id ?? null;
}

// Thin req/res wrapper for endpoints that don't need the pure form. Writes the
// error to res and returns null when the caller isn't the owner; otherwise
// returns the session.
export async function requireOwner(req, res, { db = getDb(), ownerEmail = process.env.CHAOS_OWNER_EMAIL } = {}) {
  const session = await getSession(req, res);
  const err = await assertOwner({ db, session, ownerEmail });
  if (err) {
    res.status(err.status).json(err.body);
    return null;
  }
  return session;
}
