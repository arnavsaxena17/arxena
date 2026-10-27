import { UpsertOutreachTargetCompaniesTool } from 'src/engine/core-modules/tool/tools/outreach-target-companies-tool/upsert-outreach-target-companies-tool';

describe('UpsertOutreachTargetCompaniesTool', () => {
  const buildTool = (existing: Array<Record<string, unknown>>) => {
    const cache = {
      get: jest.fn(async () => ({ companies: existing })),
      set: jest.fn(async () => undefined),
    };
    const chatWrites = { append: jest.fn(async () => undefined) };
    const tool = new UpsertOutreachTargetCompaniesTool(
      cache as never,
      chatWrites as never,
    );

    return { tool, cache, chatWrites };
  };
  const context = { workspaceId: 'ws' } as never;

  it('should keep source data columns sent with a company', async () => {
    const { tool, cache } = buildTool([]);

    await tool.execute(
      {
        projectId: 'p',
        mode: 'merge',
        companies: [
          {
            name: 'Wow! Momo',
            domain: 'wowmomo.com',
            otherFields: {
              linkedinUrl: 'https://www.linkedin.com/company/wow-momo',
            },
          },
        ],
      },
      context,
    );

    const saved = cache.set.mock.calls[0][2] as Array<{
      otherFields?: Record<string, unknown>;
    }>;

    expect(saved[0].otherFields).toEqual({
      linkedinUrl: 'https://www.linkedin.com/company/wow-momo',
    });
  });

  it('should not overwrite AI column answers already on the row when merging', async () => {
    const { tool, cache } = buildTool([
      {
        id: 'a',
        name: 'Wow! Momo',
        domain: 'wowmomo.com',
        industry: '',
        employees: '',
        segment: '',
        icpFit: '',
        status: 'new',
        otherFields: {
          storeCount: 400,
          aiColumns: { storeCount: { status: 'ok' } },
        },
      },
    ]);

    await tool.execute(
      {
        projectId: 'p',
        mode: 'merge',
        companies: [
          {
            name: 'Wow! Momo',
            domain: 'wowmomo.com',
            otherFields: { storeCount: 1, linkedinUrl: 'https://l.in/c/wow' },
          },
        ],
      },
      context,
    );

    const saved = cache.set.mock.calls[0][2] as Array<{
      id: string;
      otherFields: Record<string, unknown>;
    }>;

    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe('a');
    expect(saved[0].otherFields.storeCount).toBe(400);
    expect(saved[0].otherFields.aiColumns).toEqual({
      storeCount: { status: 'ok' },
    });
    expect(saved[0].otherFields.linkedinUrl).toBe('https://l.in/c/wow');
  });
});
