import { describe, it, expect } from 'vitest';
import { validateRegistrationRequest, normalizeRedirectUri, redirectUriAllowed } from '../../src/lib/oauthClients.js';

describe('oauthClients.validateRegistrationRequest', () => {
  it('accepts a minimal valid request', () => {
    const r = validateRegistrationRequest({
      client_name: 'Claude Desktop',
      redirect_uris: ['https://claude.ai/api/mcp/callback'],
      token_endpoint_auth_method: 'none',
    });
    expect(r.ok).toBe(true);
  });

  it('rejects when redirect_uris is missing or empty', () => {
    expect(validateRegistrationRequest({ client_name: 'x', redirect_uris: [] }).ok).toBe(false);
    expect(validateRegistrationRequest({ client_name: 'x' }).ok).toBe(false);
  });

  it('rejects non-https redirect URIs (except localhost)', () => {
    expect(validateRegistrationRequest({ client_name: 'x', redirect_uris: ['http://evil.example/cb'] }).ok).toBe(false);
    expect(validateRegistrationRequest({ client_name: 'x', redirect_uris: ['http://localhost:1234/cb'] }).ok).toBe(true);
    expect(validateRegistrationRequest({ client_name: 'x', redirect_uris: ['http://127.0.0.1/cb'] }).ok).toBe(true);
  });

  it('rejects URIs with a fragment', () => {
    expect(validateRegistrationRequest({ client_name: 'x', redirect_uris: ['https://example.com/cb#frag'] }).ok).toBe(false);
  });

  it('rejects client_name longer than 200 chars', () => {
    expect(validateRegistrationRequest({ client_name: 'x'.repeat(201), redirect_uris: ['https://a/b'] }).ok).toBe(false);
  });
});

describe('redirectUriAllowed', () => {
  it('matches exact registered uris after normalization', () => {
    expect(redirectUriAllowed('https://A.example.com/cb', ['https://a.example.com/cb'])).toBe(true);
    expect(redirectUriAllowed('https://a.example.com/cb', ['https://a.example.com/other'])).toBe(false);
  });

  it('strips trailing slashes during comparison consistently', () => {
    expect(normalizeRedirectUri('https://x.example/cb/')).toBe('https://x.example/cb');
    expect(normalizeRedirectUri('https://x.example/cb')).toBe('https://x.example/cb');
  });
});
