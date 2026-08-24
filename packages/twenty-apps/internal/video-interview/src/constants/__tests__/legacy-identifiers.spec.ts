import { describe, expect, it } from 'vitest';

import { getLegacyObjectUniversalIdentifier } from 'src/constants/legacy-identifiers';

describe('getLegacyObjectUniversalIdentifier', () => {
  it('returns a stable uuid for videoInterview', () => {
    const first = getLegacyObjectUniversalIdentifier('videoInterview');
    const second = getLegacyObjectUniversalIdentifier('videoInterview');

    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(first).toBe(second);
    expect(first).not.toBe(getLegacyObjectUniversalIdentifier('candidate'));
  });
});
