import { buildCompactLearnToolsEntry } from 'src/engine/core-modules/tool-provider/utils/build-compact-learn-tools-entry.util';

describe('buildCompactLearnToolsEntry', () => {
  it('keeps name and description when there is no schema', () => {
    expect(
      buildCompactLearnToolsEntry({
        name: 'find_many_people',
        description: 'Search people',
      }),
    ).toEqual({
      name: 'find_many_people',
      description: 'Search people',
    });
  });

  it('lists top-level arg keys and composite filter hints', () => {
    const compactEntry = buildCompactLearnToolsEntry({
      name: 'find_many_people',
      description: 'Search people',
      inputSchema: {
        type: 'object',
        $defs: {
          fullName: {
            type: 'object',
            properties: {
              firstName: {
                type: 'object',
                properties: { ilike: { type: 'string' } },
              },
              lastName: {
                type: 'object',
                properties: { ilike: { type: 'string' } },
              },
            },
          },
        },
        properties: {
          limit: { type: 'number' },
          select: { type: 'array' },
          name: { $ref: '#/$defs/fullName' },
          jobTitle: {
            type: 'object',
            properties: { ilike: { type: 'string' } },
          },
          emails: {
            type: 'object',
            properties: {
              primaryEmail: {
                type: 'object',
                properties: { ilike: { type: 'string' } },
              },
            },
          },
          and: { type: 'array' },
        },
      },
    });

    expect(compactEntry.inputArgKeys).toEqual([
      'limit',
      'select',
      'name',
      'jobTitle',
      'emails',
      'and',
    ]);
    expect(compactEntry.compositeFilterHints).toEqual({
      name: expect.stringContaining('firstName|lastName'),
      emails: expect.stringContaining('primaryEmail'),
    });
    expect(compactEntry.compositeFilterHints?.name).toContain(
      'never { name: { ilike } }',
    );
    expect(compactEntry.compositeFilterHints?.jobTitle).toBeUndefined();
    expect(compactEntry).not.toHaveProperty('inputSchema');
  });
});
