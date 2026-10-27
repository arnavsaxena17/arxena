import { UpsertOutreachTargetPeopleTool } from 'src/engine/core-modules/tool/tools/outreach-target-people-tool/upsert-outreach-target-people-tool';

describe('UpsertOutreachTargetPeopleTool', () => {
  it('should link people with an empty companyId to the Companies-tab row', async () => {
    const set = jest.fn().mockResolvedValue(undefined);
    const tool = new UpsertOutreachTargetPeopleTool(
      { get: jest.fn().mockResolvedValue(undefined), set } as never,
      {
        get: jest.fn().mockResolvedValue({
          companies: [{ id: 'company-1', name: 'Monginis' }],
        }),
      } as never,
      { syncPeopleFound: jest.fn().mockResolvedValue({ updated: 0 }) } as never,
      { append: jest.fn().mockResolvedValue(undefined) } as never,
    );

    // the shape outreach_list attach sends: companyId is always ''
    await tool.execute(
      {
        projectId: 'project-1',
        mode: 'merge',
        people: [
          {
            name: 'Amruta Kawre',
            companyId: '',
            companyName: 'Monginis Foods Pvt. Ltd.',
          },
        ],
      },
      { workspaceId: 'workspace-1' } as never,
    );

    expect(set.mock.calls[0][2][0].companyId).toBe('company-1');
  });
});
