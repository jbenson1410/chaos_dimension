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
import { createId } from '@paralleldrive/cuid2';
import { inviteCodes } from '../db/schema.js';

// Single source of truth for invite codes — shared by scripts/mint-invite.js
// (CLI) and the admin API. 12 bytes -> 16 base64url chars, ~96 bits entropy.
export function generateInviteCode() {
  return `cd_inv_${randomBytes(12).toString('base64url')}`;
}

// Build the signup link that pre-fills the code.
export function inviteLink(code, baseUrl) {
  const base = (baseUrl || process.env.PUBLIC_SITE_URL || 'https://www.chaosdimension.fyi').replace(/\/$/, '');
  return `${base}/signup?invite=${encodeURIComponent(code)}`;
}

// Insert a fresh invite row attributed to createdById. Works with any drizzle
// client (getDb() or a migration client). Returns the created row.
export async function createInvite({ db, createdById, note = '' }) {
  const [row] = await db
    .insert(inviteCodes)
    .values({
      id: createId(),
      code: generateInviteCode(),
      createdById,
      note: note ?? '',
    })
    .returning();
  return row;
}
