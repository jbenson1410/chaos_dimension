import { describe, it, expect } from 'vitest';
import { sessionOptions, SESSION_COOKIE_NAME } from '../../src/lib/session.js';

describe('session config', () => {
  it('exports a cookie name', () => {
    expect(SESSION_COOKIE_NAME).toBe('chaos_session');
  });

  it('reads the session secret from CHAOS_SESSION_SECRET', () => {
    process.env.CHAOS_SESSION_SECRET = 'a'.repeat(32);
    expect(sessionOptions().password).toBe('a'.repeat(32));
  });

  it('configures httpOnly, secure, sameSite cookie', () => {
    process.env.CHAOS_SESSION_SECRET = 'a'.repeat(32);
    const opts = sessionOptions();
    expect(opts.cookieOptions.httpOnly).toBe(true);
    expect(opts.cookieOptions.sameSite).toBe('lax');
    expect(opts.cookieOptions.maxAge).toBe(60 * 60 * 24 * 7);
  });

  it('throws if CHAOS_SESSION_SECRET is missing', () => {
    delete process.env.CHAOS_SESSION_SECRET;
    expect(() => sessionOptions()).toThrow(/CHAOS_SESSION_SECRET/);
  });
});
