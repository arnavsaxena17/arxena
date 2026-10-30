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

  it('renders a teachable input shape with nested keys, arrays and enums', () => {
    const compactEntry = buildCompactLearnToolsEntry({
      name: 'find_people_by_company',
      inputSchema: {
        type: 'object',
        required: ['roles'],
        properties: {
          roles: {
            type: 'array',
            items: { type: 'string' },
            description: 'Roles the user asked for',
          },
          companies: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name'],
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                alternateNames: { type: 'array', items: { type: 'string' } },
                employees: { type: 'number' },
              },
            },
          },
          maxRung: {
            anyOf: [
              { type: 'number', enum: [1, 2, 3, 4] },
              { type: 'null' },
            ],
          },
          persona: { type: 'string', enum: ['sales', 'exec_search'] },
          pilotSize: { type: 'number', description: 'Look up only this many' },
        },
      },
    });

    expect(compactEntry.inputShape).toContain('roles: string[]');
    expect(compactEntry.inputShape).toContain(
      'companies?: {id?: string, name: string, alternateNames?: string[], employees?: number}[]',
    );
    expect(compactEntry.inputShape).toContain('maxRung?: 1|2|3|4');
    expect(compactEntry.inputShape).toContain('persona?: "sales"|"exec_search"');
    expect(compactEntry.inputShape).toContain('pilotSize?: number — Look up only this many');
    expect(compactEntry.schemaNote).toContain('inputShape above is the call contract');
  });

  it('never renders a shape longer than the compact budget', () => {
    const properties = Object.fromEntries(
      Array.from({ length: 200 }, (_, index) => [
        `argument${index}`,
        {
          type: 'object',
          properties: { nested: { type: 'string', description: 'x'.repeat(60) } },
        },
      ]),
    );
    const compactEntry = buildCompactLearnToolsEntry({
      name: 'huge',
      inputSchema: { type: 'object', properties },
    });

    expect((compactEntry.inputShape ?? '').length).toBeLessThanOrEqual(1801);
  });
});
