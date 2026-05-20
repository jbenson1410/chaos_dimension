import { describe, it, expect } from 'vitest';
import { handleToken } from '../../api/oauth/token.js';

describe('POST /api/oauth/token', () => {
  it('returns 400 on unsupported grant_type', async () => {
    const out = await handleToken({ db: {}, body: { grant_type: 'password' } });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('unsupported_grant_type');
  });

  it('returns 400 on missing grant_type', async () => {
    const out = await handleToken({ db: {}, body: {} });
    expect(out.status).toBe(400);
  });
});
