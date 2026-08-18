import { type ToolSet } from 'ai';
import { ToolCategory } from 'twenty-shared/ai';
import { z } from 'zod';

import { executeToolFromToolSet } from 'src/engine/core-modules/tool-provider/utils/execute-tool-from-tool-set.util';

describe('executeToolFromToolSet', () => {
  it('rejects inner args that fail the tool Zod schema', async () => {
    const execute = jest.fn();
    const toolSet = {
      create_complete_workflow: {
        description: 'Create a workflow',
        inputSchema: z.object({
          edges: z.array(
            z.object({
              source: z.string(),
              target: z.string(),
            }),
          ),
        }),
        execute,
      },
    } as unknown as ToolSet;

    const result = await executeToolFromToolSet(
      toolSet,
      'create_complete_workflow',
      { edges: [{ from: 'trigger', to: 'step-1' }] },
      ToolCategory.WORKFLOW,
    );

    expect(execute).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toContain('source');
  });

  it('passes parsed args into execute when the schema succeeds', async () => {
    const execute = jest.fn().mockResolvedValue({ success: true });
    const toolSet = {
      list_workflows: {
        description: 'List',
        inputSchema: z.object({ limit: z.number().optional() }),
        execute,
      },
    } as unknown as ToolSet;

    await executeToolFromToolSet(
      toolSet,
      'list_workflows',
      { limit: 10 },
      ToolCategory.WORKFLOW,
    );

    expect(execute).toHaveBeenCalledWith(
      { limit: 10 },
      { toolCallId: '', messages: [] },
    );
  });
});
