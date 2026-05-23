import { describe, it, expect } from 'vitest';
import { inviteCodes } from '../../src/db/schema.js';

describe('inviteCodes schema', () => {
  it('exports inviteCodes with the expected columns', () => {
    expect(inviteCodes).toBeDefined();
    expect(inviteCodes.id).toBeDefined();
    expect(inviteCodes.code).toBeDefined();
    expect(inviteCodes.createdById).toBeDefined();
    expect(inviteCodes.claimedByUserId).toBeDefined();
    expect(inviteCodes.claimedAt).toBeDefined();
    expect(inviteCodes.note).toBeDefined();
    expect(inviteCodes.createdAt).toBeDefined();
  });
});
