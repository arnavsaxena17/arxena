import { collectOutreachMutationsFromChatParts } from 'src/engine/core-modules/outreach-command/utils/collect-outreach-mutations-from-chat-parts.util';

describe('collectOutreachMutationsFromChatParts', () => {
  it('collects column keys from run_ai_column and views from apply_table_view', () => {
    const result = collectOutreachMutationsFromChatParts([
      {
        toolName: 'execute_tool',
        toolInput: {
          toolName: 'run_ai_column',
          arguments: {
            projectId: 'project-1',
            subject: 'person',
            previewId: 'preview-1',
          },
        },
        toolOutput: {
          success: true,
          result: { columnKeys: ['isCeo', 'isCeo'] },
        },
      },
      {
        toolName: 'apply_table_view',
        toolInput: {
          projectId: 'project-1',
          tab: 'people',
          filters: [{ columnId: 'otherFields.isCeo', kind: 'values', values: ['Yes'] }],
        },
        toolOutput: { success: true, result: {} },
      },
      {
        toolName: 'apply_table_view',
        toolInput: { projectId: 'project-1', tab: 'people', clear: true },
        toolOutput: { success: true, result: {} },
      },
      {
        toolName: 'run_ai_column',
        toolInput: { projectId: 'project-1', subject: 'person' },
        toolOutput: { success: false, result: { columnKeys: ['ignored'] } },
      },
    ]);

    expect(result.columnRemovals).toEqual([
      {
        projectId: 'project-1',
        subject: 'person',
        columnKeys: ['isCeo'],
      },
    ]);
    expect(result.viewClears).toEqual([
      { projectId: 'project-1', tab: 'people' },
    ]);
  });
});
