import 'dotenv/config';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local' });

import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getMigrationDb } from '../src/db/client.js';

// Tables that get NOT NULL user_id + FK + RLS isolation.
const RLS_TABLES = ['tasks', 'workstreams', 'agents', 'agent_tokens', 'runs'];
// oauth_clients keeps a nullable user_id linkage column (stamped at consent),
// but no RLS — the OAuth register endpoint is unauthenticated and must be able
// to insert a client row before any user exists.

export async function runMigration() {
  const email = process.env.CHAOS_OWNER_EMAIL;
  if (!email) throw new Error('CHAOS_OWNER_EMAIL must be set');

  // DDL (ALTER TABLE, CREATE POLICY) requires the owner role — cd_app can't.
  const db = getMigrationDb();
  return db.transaction(async (tx) => {
    // 1. Insert owner if not present (idempotent via ON CONFLICT).
    const ownerId = createId();
    await tx.execute(sql`
      INSERT INTO users (id, email, name)
      VALUES (${ownerId}, ${email}, 'Owner')
      ON CONFLICT (email) DO NOTHING
    `);
    const rows = await tx.execute(sql`SELECT id FROM users WHERE email = ${email}`);
    const owner = rows.rows?.[0]?.id ?? rows[0]?.id;
    if (!owner) throw new Error('owner row not found after insert');

    // 1b. One-time corrective: an earlier version of this migration RLS-scoped
    //     oauth_clients. Undo that — oauth_clients must stay un-scoped because
    //     POST /api/oauth/register is an unauthenticated Dynamic Client
    //     Registration endpoint with no user session. All three statements are
    //     idempotent (no-op if already in the target state).
    await tx.execute(sql.raw(`ALTER TABLE oauth_clients DISABLE ROW LEVEL SECURITY`));
    await tx.execute(sql.raw(`DROP POLICY IF EXISTS oauth_clients_user_isolation ON oauth_clients`));
    await tx.execute(sql.raw(`ALTER TABLE oauth_clients ALTER COLUMN user_id DROP NOT NULL`));

    // 2. Backfill user_id. RLS tables get it; oauth_clients also gets a
    //    backfill so existing client rows stay linked to the owner — but that
    //    column stays nullable (NULL at registration, stamped at consent).
    for (const table of [...RLS_TABLES, 'oauth_clients']) {
      await tx.execute(sql.raw(`UPDATE ${table} SET user_id = '${owner}' WHERE user_id IS NULL`));
    }

    // 3. Workstream rekey: existing rows have string ids; reissue as cuids.
    //    Skip rows already cuid-shaped so re-running is a no-op.
    const wsRows = await tx.execute(sql`SELECT id FROM workstreams`);
    const wsList = wsRows.rows ?? wsRows;
    for (const ws of wsList) {
      const oldId = ws.id;
      if (/^[a-z0-9]{24}$/.test(oldId)) continue;
      const newId = createId();
      await tx.execute(sql`UPDATE tasks SET workstream = ${newId} WHERE workstream = ${oldId}`);
      await tx.execute(sql`UPDATE workstreams SET id = ${newId} WHERE id = ${oldId}`);
    }

    // 4. Lock NOT NULL + FK on user_id — RLS tables only. oauth_clients keeps a
    //    nullable user_id (see note at top of file). Idempotent guard for the FK.
    for (const table of RLS_TABLES) {
      await tx.execute(sql.raw(`ALTER TABLE ${table} ALTER COLUMN user_id SET NOT NULL`));
      await tx.execute(sql.raw(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = '${table}_user_id_fk'
          ) THEN
            ALTER TABLE ${table} ADD CONSTRAINT ${table}_user_id_fk
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
          END IF;
        END $$;
      `));
    }

    // 4b. oauth_clients gets an optional nullable FK referencing users(id) with
    //     ON DELETE SET NULL (not CASCADE) — deleting a user must not delete the
    //     OAuth client rows. The column itself stays nullable.
    await tx.execute(sql.raw(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'oauth_clients_user_id_fk'
        ) THEN
          ALTER TABLE oauth_clients ADD CONSTRAINT oauth_clients_user_id_fk
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `));

    // 5. Enable RLS + policies — RLS tables only. CREATE POLICY is not idempotent;
    //    guard explicitly. FORCE is required so RLS applies to the table owner role
    //    too — without it, Postgres bypasses RLS for the owner (the Neon role).
    for (const table of RLS_TABLES) {
      await tx.execute(sql.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
      await tx.execute(sql.raw(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`));
      await tx.execute(sql.raw(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = '${table}' AND policyname = '${table}_user_isolation'
          ) THEN
            CREATE POLICY ${table}_user_isolation ON ${table}
              USING (user_id = current_setting('app.current_user_id', true))
              WITH CHECK (user_id = current_setting('app.current_user_id', true));
          END IF;
        END $$;
      `));
    }

    return { ownerId: owner };
  });
}

// CLI entry.
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration()
    .then((r) => { console.log('migration complete', r); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
