import { ResolveLinkedinUrlTool } from 'src/engine/core-modules/tool/tools/resolve-linkedin-url-tool/resolve-linkedin-url-tool';

const build = (profiles: unknown[], errors: string[] = []) => {
  const resolve = jest.fn().mockResolvedValue({ profiles, spentUsd: 0.002, errors });

  return {
    tool: new ResolveLinkedinUrlTool({ resolve } as never),
    resolve,
  };
};

describe('ResolveLinkedinUrlTool', () => {
  it('should return a current candidate before a past one', async () => {
    const { tool, resolve } = build([
      {
        linkedinUrl: 'https://www.linkedin.com/in/veeramani-m-p',
        title: 'Head of Procurement',
        companyName: 'Akshayakalpa Organic',
        evidence: 'Head of Procurement at Akshayakalpa Organic',
        via: 'bright_data',
        sameNameProfileCount: null,
        companyRelation: 'current',
        derivedFromPost: false,
      },
      {
        linkedinUrl: 'https://www.linkedin.com/in/someone-else',
        title: 'Purchase Specialist',
        companyName: 'CATERSPOINT',
        evidence: 'Purchase Specialist at CATERSPOINT',
        via: 'bright_data',
        sameNameProfileCount: null,
        companyRelation: 'past',
        derivedFromPost: false,
      },
    ]);

    const result = await tool.execute(
      { name: 'Veeramani M P', company: 'Akshayakalpa Organic' },
      {} as never,
    );

    expect(resolve).toHaveBeenCalledWith({
      name: 'Veeramani M P',
      companyNames: ['Akshayakalpa Organic'],
      title: undefined,
    });
    expect(result.success).toBe(true);
    expect(result.result).toMatchObject({
      bestLinkedinUrl: 'https://www.linkedin.com/in/veeramani-m-p',
      currentCount: 1,
      pastCount: 1,
    });
  });

  it('should pass the title through and report a miss', async () => {
    const { tool, resolve } = build([], ['google HTTP 502']);

    const result = await tool.execute(
      {
        name: 'Suresh N',
        company: 'Akshayakalpa',
        alternateCompanies: ['Akshayakalpa Organic'],
        title: 'Purchase Lead',
      },
      {} as never,
    );

    expect(resolve).toHaveBeenCalledWith({
      name: 'Suresh N',
      companyNames: ['Akshayakalpa', 'Akshayakalpa Organic'],
      title: 'Purchase Lead',
    });
    expect(result.success).toBe(true);
    expect(result.result).toMatchObject({
      bestLinkedinUrl: '',
      candidates: [],
      errors: ['google HTTP 502'],
    });
  });
});
