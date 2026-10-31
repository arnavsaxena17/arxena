import { WriteLinkedinUrlTool } from 'src/engine/core-modules/tool/tools/write-linkedin-url-tool/write-linkedin-url-tool';

const build = (updated: unknown) => {
  const updateEphemeralPersonLinkedinUrl = jest
    .fn()
    .mockResolvedValue(updated);

  return {
    tool: new WriteLinkedinUrlTool({
      updateEphemeralPersonLinkedinUrl,
    } as never),
    updateEphemeralPersonLinkedinUrl,
  };
};

describe('WriteLinkedinUrlTool', () => {
  it('should write the URL and relation onto the row', async () => {
    const { tool, updateEphemeralPersonLinkedinUrl } = build({
      id: 'row-1',
      name: 'Suresh N',
      companyName: 'Akshayakalpa Organic',
      linkedinUrl: 'https://www.linkedin.com/in/suresh-n-693181154',
      otherFields: {
        linkedinResolution: { relation: 'current' },
      },
    });

    const result = await tool.execute(
      {
        personId: 'row-1',
        linkedinUrl: 'https://www.linkedin.com/in/suresh-n-693181154',
        relation: 'current',
        evidence: 'Purchase lead at Akshayakalpa Organic',
        source: 'bright_data',
      },
      { workspaceId: 'workspace-1', projectId: 'project-1' } as never,
    );

    expect(updateEphemeralPersonLinkedinUrl).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      personId: 'row-1',
      linkedinUrl: 'https://www.linkedin.com/in/suresh-n-693181154',
      relation: 'current',
      evidence: 'Purchase lead at Akshayakalpa Organic',
      source: 'bright_data',
    });
    expect(result.success).toBe(true);
    expect(result.result).toMatchObject({
      name: 'Suresh N',
      linkedinUrl: 'https://www.linkedin.com/in/suresh-n-693181154',
    });
  });

  it('should fail when the row no longer exists', async () => {
    const { tool } = build(null);

    const result = await tool.execute(
      {
        personId: 'gone',
        linkedinUrl: 'https://www.linkedin.com/in/gone',
      },
      { workspaceId: 'workspace-1', projectId: 'project-1' } as never,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Row not found');
  });
});
