import { getDb } from '../../src/db/client.js';
import { workstreams } from '../../src/db/schema.js';
import { requireAuth } from '../../src/lib/requireAuth.js';
import { eq } from 'drizzle-orm';

function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export default async function handle(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  const db = getDb();

  if (req.method === 'GET') {
    const rows = await db.select().from(workstreams);
    return res.status(200).json(rows);
  }

  if (req.method === 'POST') {
    const { label, color, icon, id: providedId } = req.body ?? {};
    if (!label || !color || !icon) {
      return res.status(400).json({ error: 'label, color, and icon required' });
    }

    let id = providedId ? slugify(providedId) : slugify(label);
    if (!id) {
      return res.status(400).json({ error: 'could not derive a valid id from label' });
    }

    const existing = await db.select().from(workstreams).where(eq(workstreams.id, id));
    if (existing.length) {
      let n = 2;
      while ((await db.select().from(workstreams).where(eq(workstreams.id, `${id}-${n}`))).length) {
        n += 1;
      }
      id = `${id}-${n}`;
    }

    const [row] = await db.insert(workstreams).values({ id, label, color, icon }).returning();
    return res.status(201).json(row);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}
