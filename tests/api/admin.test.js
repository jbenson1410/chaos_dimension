// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import 'dotenv/config';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local' });

import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getDb } from '../../src/db/client.js';
import { users, inviteCodes, waitlist } from '../../src/db/schema.js';
import { verifyPassword } from '../../src/lib/passwords.js';
import { assertOwner } from '../../src/lib/requireOwner.js';
import { handleList as listInvites, handleMint } from '../../api/admin/invites/index.js';
import { handleRevoke } from '../../api/admin/invites/[id].js';
import { handleList as listUsers } from '../../api/admin/users/index.js';
import { handleResetPassword, handleDelete as deleteUser } from '../../api/admin/users/[id].js';
import { handleInvite as inviteFromWaitlist } from '../../api/admin/waitlist/[id].js';

const SKIP = !process.env.DATABASE_URL;
const describeMaybe = SKIP ? describe.skip : describe;

describeMaybe('Admin handlers (live DB)', () => {
  let db;
  let ownerEmail, ownerId, otherId;

  beforeAll(async () => {
    db = getDb();
    ownerEmail = `admin-owner-${createId()}@test.invalid`;
    const [o] = await db.insert(users).values({ email: ownerEmail, name: 'Owner' }).returning();
    const [u] = await db.insert(users).values({ email: `admin-user-${createId()}@test.invalid`, name: 'User' }).returning();
    ownerId = o.id; otherId = u.id;
  }, 30000);

  it('assertOwner gates non-owners (403) and admits the owner', async () => {
    const denied = await assertOwner({ db, session: { authed: true, userId: otherId }, ownerEmail });
    expect(denied?.status).toBe(403);
    const ok = await assertOwner({ db, session: { authed: true, userId: ownerId }, ownerEmail });
    expect(ok).toBeNull();
  }, 30000);

  it('mints, lists, and revokes an invite', async () => {
    const minted = await handleMint({ db, body: { note: 'for tester' }, ownerEmail });
    expect(minted.status).toBe(201);
    expect(minted.body.code).toMatch(/^cd_inv_/);
    expect(minted.body.link).toContain(encodeURIComponent(minted.body.code));

    const listed = await listInvites({ db });
    const row = listed.body.find((i) => i.id === minted.body.id);
    expect(row).toBeTruthy();
    expect(row.status).toBe('open');

    const revoked = await handleRevoke({ db, id: minted.body.id });
    expect(revoked.status).toBe(200);
    const after = await listInvites({ db });
    expect(after.body.find((i) => i.id === minted.body.id)).toBeUndefined();
  }, 30000);

  it('refuses to revoke a claimed invite', async () => {
    const id = createId();
    await db.insert(inviteCodes).values({
      id, code: `cd_inv_claimed_${createId()}`, createdById: ownerId,
      claimedByUserId: otherId, claimedAt: new Date(),
    });
    const out = await handleRevoke({ db, id });
    expect(out.status).toBe(409);
  }, 30000);

  it('lists users and flags the owner row', async () => {
    const out = await listUsers({ db, ownerEmail });
    const owner = out.body.find((u) => u.id === ownerId);
    expect(owner.isOwner).toBe(true);
    expect('passwordHash' in owner).toBe(false);
  }, 30000);

  it('resets a password to a working temporary one', async () => {
    const out = await handleResetPassword({ db, id: otherId, body: {} });
    expect(out.status).toBe(200);
    expect(out.body.generated).toBe(true);
    const rows = await db.select({ h: users.passwordHash }).from(users).where(eq(users.id, otherId)).limit(1);
    expect(await verifyPassword(out.body.password, rows[0].h)).toBe(true);
  }, 30000);

  it('reset rejects a too-short provided password', async () => {
    const out = await handleResetPassword({ db, id: otherId, body: { password: 'short' } });
    expect(out.status).toBe(400);
  }, 30000);

  it('delete refuses the owner but removes a normal user', async () => {
    const refused = await deleteUser({ db, id: ownerId, ownerEmail });
    expect(refused.status).toBe(403);

    const [victim] = await db.insert(users).values({ email: `admin-victim-${createId()}@test.invalid`, name: 'V' }).returning();
    const gone = await deleteUser({ db, id: victim.id, ownerEmail });
    expect(gone.status).toBe(200);
    const check = await db.select().from(users).where(eq(users.id, victim.id)).limit(1);
    expect(check).toHaveLength(0);
  }, 30000);

  it('invites a waitlist entry and marks it invited', async () => {
    const [entry] = await db.insert(waitlist).values({ email: `wl-${createId()}@test.invalid`, name: 'WL' }).returning();
    const out = await inviteFromWaitlist({ db, id: entry.id, ownerEmail });
    expect(out.status).toBe(201);
    expect(out.body.code).toMatch(/^cd_inv_/);
    const rows = await db.select({ invited: waitlist.invited }).from(waitlist).where(eq(waitlist.id, entry.id)).limit(1);
    expect(rows[0].invited).toBe(true);
  }, 30000);
});
