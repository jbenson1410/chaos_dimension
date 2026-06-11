// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { describe, it, expect } from 'vitest';
import { assertOwner, getOwnerId } from '../../src/lib/requireOwner.js';

// Minimal fake: select().from().where().limit() resolves to the owner row
// (or []). assertOwner only ever queries users by email.
function fakeDb({ ownerRow = null } = {}) {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: async () => (ownerRow ? [ownerRow] : []),
  };
  return { select: () => chain };
}

describe('assertOwner', () => {
  const ownerEmail = 'owner@x.com';

  it('401 when unauthenticated', async () => {
    expect(await assertOwner({ db: fakeDb(), session: null, ownerEmail }))
      .toEqual({ status: 401, body: { error: 'unauthorized' } });
  });

  it('401 when session has no userId', async () => {
    const r = await assertOwner({ db: fakeDb(), session: { authed: true }, ownerEmail });
    expect(r.status).toBe(401);
  });

  it('500 when CHAOS_OWNER_EMAIL is not configured', async () => {
    const r = await assertOwner({ db: fakeDb(), session: { authed: true, userId: 'u1' }, ownerEmail: '' });
    expect(r.status).toBe(500);
  });

  it('403 when the owner row does not exist', async () => {
    const r = await assertOwner({ db: fakeDb({ ownerRow: null }), session: { authed: true, userId: 'u1' }, ownerEmail });
    expect(r.status).toBe(403);
  });

  it('403 for a logged-in non-owner', async () => {
    const r = await assertOwner({
      db: fakeDb({ ownerRow: { id: 'owner-id' } }),
      session: { authed: true, userId: 'someone-else' },
      ownerEmail,
    });
    expect(r.status).toBe(403);
  });

  it('null (allowed) for the owner', async () => {
    const r = await assertOwner({
      db: fakeDb({ ownerRow: { id: 'owner-id' } }),
      session: { authed: true, userId: 'owner-id' },
      ownerEmail,
    });
    expect(r).toBeNull();
  });

  it('matches the owner email case-insensitively', async () => {
    const r = await assertOwner({
      db: fakeDb({ ownerRow: { id: 'owner-id' } }),
      session: { authed: true, userId: 'owner-id' },
      ownerEmail: 'OWNER@X.COM',
    });
    expect(r).toBeNull();
  });
});

describe('getOwnerId', () => {
  it('returns the id when present', async () => {
    expect(await getOwnerId({ db: fakeDb({ ownerRow: { id: 'owner-id' } }), ownerEmail: 'owner@x.com' })).toBe('owner-id');
  });
  it('returns null when missing email or row', async () => {
    expect(await getOwnerId({ db: fakeDb(), ownerEmail: '' })).toBeNull();
    expect(await getOwnerId({ db: fakeDb({ ownerRow: null }), ownerEmail: 'owner@x.com' })).toBeNull();
  });
});
