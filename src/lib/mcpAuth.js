import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { agentTokens, agents } from '../db/schema.js';
import { hashToken } from './agentToken.js';

export async function authenticateMcpRequest(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/.exec(header);
  if (!match) return null;

  const token = match[1].trim();
  if (!token) return null;

  const db = getDb();
  const rows = await db
    .select({
      agentId: agentTokens.agentId,
      tokenId: agentTokens.id,
      revoked: agentTokens.revoked,
      agentName: agents.name,
    })
    .from(agentTokens)
    .innerJoin(agents, eq(agents.id, agentTokens.agentId))
    .where(and(eq(agentTokens.tokenHash, hashToken(token)), eq(agentTokens.revoked, false)))
    .limit(1);

  if (!rows.length) return null;

  // Best-effort touch lastUsedAt; do not block the request on this.
  db.update(agentTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(agentTokens.id, rows[0].tokenId))
    .catch(() => {});

  return { agentId: rows[0].agentId, agentName: rows[0].agentName };
}
