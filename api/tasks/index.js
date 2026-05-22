import { getDb } from '../../src/db/client.js';
import { withUserContext } from '../../src/lib/userContext.js';
import { tasks } from '../../src/db/schema.js';
import { requireAuth } from '../../src/lib/requireAuth.js';
import { withErrors, methodNotAllowed } from '../../src/lib/apiHandler.js';
import { desc } from 'drizzle-orm';

export default withErrors(async function handle(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const rows = await withUserContext(getDb(), session.userId, async (tx) => {
      return tx.select().from(tasks).orderBy(desc(tasks.createdAt));
    });
    return res.status(200).json(rows);
  }

  if (req.method === 'POST') {
    const { title, workstream, column = 'backlog', agentDispatchable = false, priority = 'med', notes = '' } = req.body ?? {};
    if (!title || !workstream) {
      return res.status(400).json({ error: 'title and workstream required', message: 'Title and workstream are required.' });
    }
    const row = await withUserContext(getDb(), session.userId, async (tx) => {
      const [created] = await tx.insert(tasks).values({
        title, workstream, column, agentDispatchable, priority, notes,
        userId: session.userId,
      }).returning();
      return created;
    });
    return res.status(201).json(row);
  }

  return methodNotAllowed(res, 'GET, POST');
});
