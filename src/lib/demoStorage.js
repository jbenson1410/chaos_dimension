const KEYS = {
  tasks: 'chaos_demo_tasks',
  agents: 'chaos_demo_agents',
  workstreams: 'chaos_demo_workstreams',
};

export function loadDemo(name, fallback) {
  try {
    const raw = localStorage.getItem(KEYS[name]);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore parse / access errors
  }
  return fallback;
}

export function saveDemo(name, value) {
  try {
    localStorage.setItem(KEYS[name], JSON.stringify(value));
  } catch {
    // ignore quota or private-mode errors
  }
}

export function clearDemo() {
  for (const key of Object.values(KEYS)) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

export function localId(prefix = 'demo') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
