import { describe, it, expect } from 'vitest';
import {
  oauthClients,
  oauthAuthCodes,
  oauthAccessTokens,
  oauthRefreshTokens,
  oauthEvents,
  oauthRateLimits,
} from '../../src/db/schema.js';

describe('oauth schema', () => {
  it('exports all six oauth tables', () => {
    expect(oauthClients).toBeDefined();
    expect(oauthAuthCodes).toBeDefined();
    expect(oauthAccessTokens).toBeDefined();
    expect(oauthRefreshTokens).toBeDefined();
    expect(oauthEvents).toBeDefined();
    expect(oauthRateLimits).toBeDefined();
  });
});
