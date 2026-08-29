import { isDefined } from 'twenty-shared/utils';
import { z } from 'zod';

import { GTM_NATIVE_LOGIC_FUNCTION_NAMES } from 'src/engine/core-modules/gtm-command/constants/gtm-logic-function-names.const';
import {
  type WorkflowToolContext,
  type WorkflowToolDependencies,
} from 'src/modules/workflow/workflow-tools/types/workflow-tool-dependencies.type';

const getLogicFunctionSourceSchema = z.object({
  logicFunctionId: z
    .string()
    .uuid()
    .describe(
      'The ID of the logic function to read (from the code step settings.input.logicFunctionId)',
    ),
});

export const createGetLogicFunctionSourceTool = (
  deps: Pick<
    WorkflowToolDependencies,
    'logicFunctionFromSourceService' | 'flatEntityMapsCacheService'
  >,
  context: WorkflowToolContext,
) => ({
  name: 'get_logic_function_source' as const,
  description: `Read TypeScript source of a CODE-step logic function.

Do NOT use this for native GTM workflow actions (kebab-case LFs — distinct from the \`search\` skill: search-people-for-company, search-people, search-companies, search-jobs, search-posts, fetch-linkedin-profile, fetch-linkedin-messages, fetch-company-details, upload-profiles, upsert-companies, enrich-contact, get-calendar-availability) — source is a typed contract only. Use list_logic_function_tools inputSchema instead.`,
  inputSchema: getLogicFunctionSourceSchema,
  execute: async (parameters: { logicFunctionId: string }) => {
    try {
      const { logicFunctionId } = parameters;
      const { workspaceId } = context;

      const { flatLogicFunctionMaps } =
        await deps.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
          {
            workspaceId,
            flatMapsKeys: ['flatLogicFunctionMaps'],
          },
        );

      const logicFunction = Object.values(
        flatLogicFunctionMaps.byUniversalIdentifier,
      ).find((fn) => isDefined(fn) && fn.id === logicFunctionId);

      const sourceHandlerCode =
        await deps.logicFunctionFromSourceService.getSourceCode({
          id: logicFunctionId,
          workspaceId,
        });

      const isNative =
        isDefined(logicFunction) &&
        GTM_NATIVE_LOGIC_FUNCTION_NAMES.has(logicFunction.name);

      if (isNative) {
        return {
          success: true,
          logicFunctionId,
          isNative: true,
          name: logicFunction?.name,
          inputSchema:
            logicFunction?.workflowActionTriggerSettings?.inputSchema ?? null,
          outputSchema:
            logicFunction?.workflowActionTriggerSettings?.outputSchema ?? null,
          sourceHandlerCode,
          message:
            'This is a native GTM logic function. Source is the input contract only. Use inputSchema; do not edit the source.',
        };
      }

      return {
        success: true,
        logicFunctionId,
        isNative: false,
        sourceHandlerCode,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        error: message,
        message: `Failed to read logic function source: ${message}`,
      };
    }
  },
});
