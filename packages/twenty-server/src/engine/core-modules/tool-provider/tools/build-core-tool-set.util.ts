import { type ToolRegistryService } from 'src/engine/core-modules/tool-provider/services/tool-registry.service';
import { type ToolContext } from 'src/engine/core-modules/tool-provider/types/tool-context.type';
import { createExecuteToolTool } from 'src/engine/core-modules/tool-provider/tools/execute-tool.tool';
import { createLearnToolsTool } from 'src/engine/core-modules/tool-provider/tools/learn-tools.tool';
import { createLoadSkillTool } from 'src/engine/core-modules/tool-provider/tools/load-skill.tool';
import { type SkillService } from 'src/engine/metadata-modules/skill/skill.service';

type BuildCoreToolSetArgs = {
  toolRegistry: ToolRegistryService;
  toolContext: ToolContext;
  skillService: Pick<SkillService, 'findFlatSkillsByNames' | 'findAllFlatSkills'>;
  workspaceId: string;
  excludeTools: Set<string>;
  // Ask AI compacts and spills large outputs; MCP returns them as-is
  outputOptions?: { compactOutput?: boolean; spillLargeOutput?: boolean };
};

// The discovery/execution core shared by Ask AI and the MCP endpoint. Callers add
// their own surface-specific tools (MCP annotations, search/fetch, ask_questions, ...).
export const buildCoreToolSet = ({
  toolRegistry,
  toolContext,
  skillService,
  workspaceId,
  excludeTools,
  outputOptions,
}: BuildCoreToolSetArgs) => ({
  learnTools: createLearnToolsTool(toolRegistry, toolContext, {
    excludeTools,
    spillLargeOutput: outputOptions?.spillLargeOutput,
  }),
  executeTool: createExecuteToolTool(toolRegistry, toolContext, {
    excludeTools,
    compactOutput: outputOptions?.compactOutput,
    spillLargeOutput: outputOptions?.spillLargeOutput,
  }),
  loadSkills: createLoadSkillTool(
    (skillNames) => skillService.findFlatSkillsByNames(skillNames, workspaceId),
    async () => {
      const allSkills = await skillService.findAllFlatSkills(workspaceId);

      return allSkills.map((skill) => skill.name);
    },
  ),
});
