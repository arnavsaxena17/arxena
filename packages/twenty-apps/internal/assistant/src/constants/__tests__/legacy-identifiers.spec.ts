import { describe, expect, it } from 'vitest';

import { getLegacyObjectUniversalIdentifier } from 'src/constants/legacy-identifiers';

describe('getLegacyObjectUniversalIdentifier', () => {
  it('returns a stable uuid for assistantThread', () => {
    const first = getLegacyObjectUniversalIdentifier('assistantThread');
    const second = getLegacyObjectUniversalIdentifier('assistantThread');

    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(first).toBe(second);
    expect(first).not.toBe(getLegacyObjectUniversalIdentifier('project'));
  });
});
