// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { getIronSession } from 'iron-session';
import { sessionOptions } from './session.js';

export async function getSession(req, res) {
  const isTestEnv = process.env.NODE_ENV === 'test' && process.env.VITEST === 'true';
  if (isTestEnv && req.__sessionOverride !== undefined) {
    const override = req.__sessionOverride;
    return override === null
      ? { authed: false, save: async () => {} }
      : { ...override, save: async () => {} };
  }
  return getIronSession(req, res, sessionOptions());
}

export async function requireAuth(req, res) {
  const session = await getSession(req, res);
  if (!session.authed) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }
  return session;
}
