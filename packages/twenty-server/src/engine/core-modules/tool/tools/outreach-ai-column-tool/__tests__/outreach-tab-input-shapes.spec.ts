import { GetOutreachTabInputZodSchema } from 'src/engine/core-modules/tool/tools/outreach-ai-column-tool/outreach-ai-column-tool.schema';

const parse = (input: Record<string, unknown>) =>
  GetOutreachTabInputZodSchema.safeParse({
    projectId: 'p',
    tab: 'companies',
    ...input,
  });

describe('get_outreach_tab sort and filter shapes', () => {
  it('should accept the { field, order } form a model writes first', () => {
    const parsed = parse({ sort: { field: 'employees', order: 'desc' } });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.sort).toEqual([
      { columnId: 'employees', direction: 'desc' },
    ]);
  });

  it('should accept the canonical array form', () => {
    const parsed = parse({
      sort: [
        { columnId: 'employees', direction: 'desc' },
        { field: 'name', order: 'asc' },
      ],
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.sort).toEqual([
      { columnId: 'employees', direction: 'desc' },
      { columnId: 'name', direction: 'asc' },
    ]);
  });

  it('should default the sort direction to desc', () => {
    const parsed = parse({ sort: { field: 'employees' } });

    expect(parsed.success && parsed.data.sort).toEqual([
      { columnId: 'employees', direction: 'desc' },
    ]);
  });

  it('should reject a sort with no column at all', () => {
    expect(parse({ sort: {} }).success).toBe(false);
  });

  it('should accept the shorthand { column: { gte: n } } filter', () => {
    const parsed = parse({ filter: { employees: { gte: 500 } } });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.filter).toEqual([
      {
        columnId: 'employees',
        kind: 'condition',
        operator: 'greaterThanOrEqual',
        value: '500',
      },
    ]);
  });

  it('should accept the canonical filter array', () => {
    const parsed = parse({
      filter: [
        {
          columnId: 'industry',
          kind: 'condition',
          operator: 'contains',
          value: 'pharma',
        },
      ],
    });

    expect(parsed.success).toBe(true);
    expect(Array.isArray(parsed.success && parsed.data.filter)).toBe(true);
  });
});
