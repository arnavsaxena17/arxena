
import { MCP_TOOL_DESCRIPTIONS } from 'src/engine/core-modules/arxena-tools/constants/mcp-tool-descriptions.const';
import {
  createFetchTool,
  createSearchTool,
} from 'src/engine/api/mcp/tools/search-fetch.tool';
import { createListSkillsTool } from 'src/engine/api/mcp/tools/list-skills.tool';
import { createExecuteToolTool } from 'src/engine/core-modules/tool-provider/tools/execute-tool.tool';
import { createLearnToolsTool } from 'src/engine/core-modules/tool-provider/tools/learn-tools.tool';
import { type ToolRegistryService } from 'src/engine/core-modules/tool-provider/services/tool-registry.service';
import { type ToolContext } from 'src/engine/core-modules/tool-provider/types/tool-context.type';
import { type SkillService } from 'src/engine/metadata-modules/skill/skill.service';

describe('shared MCP tool descriptions', () => {
  const toolRegistry = {} as ToolRegistryService;
  const toolContext = { workspaceId: 'workspace-1' } as ToolContext;
  const runArxenaTool = jest.fn();

  it('should use the twenty-shared description for every generic tool', () => {
    expect(
      createExecuteToolTool(toolRegistry, toolContext).description,
    ).toBe(MCP_TOOL_DESCRIPTIONS.execute_tool);
    expect(createLearnToolsTool(toolRegistry, toolContext).description).toBe(
      MCP_TOOL_DESCRIPTIONS.learn_tools,
    );
    expect(
      createListSkillsTool({} as SkillService, 'workspace-1').description,
    ).toBe(MCP_TOOL_DESCRIPTIONS.list_skills);
    expect(createSearchTool(runArxenaTool).description).toBe(
      MCP_TOOL_DESCRIPTIONS.search,
    );
    expect(createFetchTool(runArxenaTool).description).toBe(
      MCP_TOOL_DESCRIPTIONS.fetch,
    );
  });
});
