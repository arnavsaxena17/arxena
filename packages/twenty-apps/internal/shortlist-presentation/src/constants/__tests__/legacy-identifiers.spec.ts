import { describe, expect, it } from 'vitest';

import { getLegacyObjectUniversalIdentifier } from 'src/constants/legacy-identifiers';

describe('getLegacyObjectUniversalIdentifier', () => {
  it('returns a stable uuid for shortlist', () => {
    const first = getLegacyObjectUniversalIdentifier('shortlist');
    const second = getLegacyObjectUniversalIdentifier('shortlist');

    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(first).toBe(second);
    expect(first).not.toBe(getLegacyObjectUniversalIdentifier('candidate'));
  });
});
