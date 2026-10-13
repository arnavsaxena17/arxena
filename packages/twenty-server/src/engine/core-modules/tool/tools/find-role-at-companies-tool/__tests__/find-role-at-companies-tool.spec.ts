import { FindRoleAtCompaniesTool } from 'src/engine/core-modules/tool/tools/find-role-at-companies-tool/find-role-at-companies-tool';

const buildBrightDataDocument = (data: Record<string, unknown>) => ({
  brightId: `bright-${String(data.name)}`,
  data,
});

const buildTool = ({
  brightDataDocuments,
  organic,
  upsertSucceeds = true,
}: {
  brightDataDocuments: ReturnType<typeof buildBrightDataDocument>[];
  organic: Array<{ title: string; link: string; description?: string }>;
  upsertSucceeds?: boolean;
}) => {
  const searchNaturalLanguage = jest.fn().mockResolvedValue({
    result: { documents: brightDataDocuments, spentUsd: 0.004 },
  });
  const requestSerpGoogleJson = jest.fn().mockResolvedValue({ organic });
  const upsert = jest.fn().mockResolvedValue({
    success: upsertSucceeds,
    message: '',
    error: upsertSucceeds ? undefined : 'write failed',
  });
  // Stands in for the Python job-title taxonomy: CEO, MD and founder titles
  // share one function and grade, everything else is its own function
  const titleClass = (title: string) => {
    const lowered = title.toLowerCase();

    if (/ceo|chief executive|managing director|\bmd\b|founder/.test(lowered)) {
      return { functionId: 'ceo', functionRoot: 'ceo', grade: 'leadership' };
    }

    return lowered.trim() === ''
      ? null
      : { functionId: 'other', functionRoot: 'other', grade: 'leadership' };
  };
  const taxonomy = {
    resolveRoles: jest.fn(async (roles: string[]) => ({
      searchTitles: [...roles.map((role) => role.toLowerCase()), 'chief executive'],
      requestedClasses: roles
        .map((role) => titleClass(role))
        .filter((value) => value !== null),
      taxonomyAvailable: true,
    })),
    classifyTitles: jest.fn(async (titles: string[]) => {
      return new Map(
        titles.map((title) => [title.trim().toLowerCase(), titleClass(title)]),
      );
    }),
  };
  const tool = new FindRoleAtCompaniesTool(
    { searchNaturalLanguage } as never,
    { isConfigured: () => true, requestSerpGoogleJson } as never,
    { execute: upsert } as never,
    taxonomy as never,
  );

  return {
    tool,
    searchNaturalLanguage,
    requestSerpGoogleJson,
    upsert,
    taxonomy,
  };
};

const context = { workspaceId: 'workspace-id' };

describe('FindRoleAtCompaniesTool', () => {
  it('should merge a person found by both sources and write them once', async () => {
    const { tool, upsert } = buildTool({
      brightDataDocuments: [
        buildBrightDataDocument({
          name: 'Amruta Kawre',
          current_title: 'Managing Director',
          current_company_name: 'Monginis Foods Pvt. Ltd.',
          url: 'https://in.linkedin.com/in/amruta-kawre',
        }),
      ],
      organic: [
        {
          title: 'Amruta Kawre - Managing Director - Monginis | LinkedIn',
          link: 'https://www.linkedin.com/in/amruta-kawre/',
        },
      ],
    });

    const output = await tool.execute(
      {
        companies: [{ name: 'Monginis' }],
        roles: ['MD'],
        projectId: 'project-id',
      },
      context,
    );
    const company = (output.result as { companies: Array<Record<string, any>> })
      .companies[0];

    expect(company.status).toBe('matched');
    expect(company.people).toHaveLength(1);
    expect(company.people[0].sources).toEqual(['bright_data', 'google']);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0].people).toHaveLength(1);
  });

  it('should reject a person from a different company and say why', async () => {
    const { tool } = buildTool({
      brightDataDocuments: [
        buildBrightDataDocument({
          name: 'Sachin Kesharwani',
          current_title: 'Co-Founder',
          current_company_name: 'HAPPY FACES',
          url: 'https://www.linkedin.com/in/sachin-kesharwani',
        }),
      ],
      organic: [],
    });

    const output = await tool.execute(
      { companies: [{ name: 'FACES CANADA' }], roles: ['founder'] },
      context,
    );
    const company = (output.result as { companies: Array<Record<string, any>> })
      .companies[0];

    expect(company.status).toBe('no_match');
    expect(company.rejected).toEqual([
      expect.objectContaining({
        name: 'Sachin Kesharwani',
        reason: 'company_mismatch',
      }),
    ]);
  });

  it('should report a deputy as a related role only', async () => {
    const { tool } = buildTool({
      brightDataDocuments: [
        buildBrightDataDocument({
          name: 'Keerthi D',
          current_title: 'Deputy CEO',
          current_company_name: 'Hatsun Agro Product Ltd',
          url: 'https://www.linkedin.com/in/keerthi-d-785b21186',
        }),
      ],
      organic: [],
    });

    const output = await tool.execute(
      {
        companies: [
          { name: 'Arun Ice Cream', alternateNames: ['Hatsun Agro Product'] },
        ],
        roles: ['CEO'],
      },
      context,
    );
    const company = (output.result as { companies: Array<Record<string, any>> })
      .companies[0];

    expect(company.status).toBe('related_role_only');
    expect(company.people[0].roleMatch).toBe('related');
  });

  it('should still answer from Google when Bright Data fails', async () => {
    const { tool, searchNaturalLanguage } = buildTool({
      brightDataDocuments: [],
      organic: [
        {
          title: 'Sanjay Goyal - CEO - Baskin Robbins India | LinkedIn',
          link: 'https://www.linkedin.com/in/sanjay-goyal-aaa675196',
        },
      ],
    });

    searchNaturalLanguage.mockRejectedValue(new Error('planner timed out'));

    const output = await tool.execute(
      { companies: [{ name: 'Baskin Robbins India' }], roles: ['CEO'] },
      context,
    );
    const company = (output.result as { companies: Array<Record<string, any>> })
      .companies[0];

    expect(company.status).toBe('matched');
    expect(company.sourceErrors).toEqual(['bright_data: planner timed out']);
  });

  it('should report a failed write without losing the results', async () => {
    const { tool } = buildTool({
      brightDataDocuments: [],
      organic: [
        {
          title: 'Sanjay Goyal - CEO - Baskin Robbins India | LinkedIn',
          link: 'https://www.linkedin.com/in/sanjay-goyal-aaa675196',
        },
      ],
      upsertSucceeds: false,
    });

    const output = await tool.execute(
      {
        companies: [{ name: 'Baskin Robbins India' }],
        roles: ['CEO'],
        projectId: 'project-id',
      },
      context,
    );

    expect(output.success).toBe(true);
    expect((output.result as { writeError?: string }).writeError).toBe(
      'write failed',
    );
  });
});

describe('FindRoleAtCompaniesTool taxonomy use', () => {
  it('should search with the titles the taxonomy supplies', async () => {
    const { tool, searchNaturalLanguage, requestSerpGoogleJson } = buildTool({
      brightDataDocuments: [],
      organic: [],
    });

    await tool.execute(
      { companies: [{ name: 'Acme' }], roles: ['MD'] },
      { workspaceId: 'workspace-id' },
    );

    expect(searchNaturalLanguage.mock.calls[0][0].rawQuery).toContain(
      'md, chief executive of Acme',
    );
    expect(
      decodeURIComponent(requestSerpGoogleJson.mock.calls[0][0].replace(/\+/g, ' ')),
    ).toContain('"chief executive"');
  });

  it('should accept a Managing Director when the taxonomy says it is the requested function', async () => {
    const { tool } = buildTool({
      brightDataDocuments: [
        buildBrightDataDocument({
          name: 'Sanjay Goyal',
          current_title: 'Managing Director',
          current_company_name: 'Graviss Foods Pvt Ltd – Baskin Robbins – India',
          url: 'https://www.linkedin.com/in/sanjay-goyal-aaa675196',
        }),
      ],
      organic: [],
    });

    const output = await tool.execute(
      { companies: [{ name: 'Baskin Robbins India' }], roles: ['CEO'] },
      { workspaceId: 'workspace-id' },
    );
    const company = (output.result as { companies: Array<Record<string, any>> })
      .companies[0];

    expect(company.status).toBe('matched');
    expect(company.people[0].title).toBe('Managing Director');
  });
});
