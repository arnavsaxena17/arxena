import { isDefined } from 'twenty-shared/utils';
import { z } from 'zod';

import { GTM_NATIVE_LOGIC_FUNCTION_NAMES } from 'src/engine/core-modules/gtm-command/constants/gtm-logic-function-names.const';
import { type WorkspaceManyOrAllFlatEntityMapsCacheService } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service';
import { type FlatLogicFunction } from 'src/engine/metadata-modules/logic-function/types/flat-logic-function.type';
import { type WorkflowToolContext } from 'src/modules/workflow/workflow-tools/types/workflow-tool-dependencies.type';

const listLogicFunctionToolsSchema = z.object({});

const isNativeLogicFunction = (fn: FlatLogicFunction): boolean =>
  GTM_NATIVE_LOGIC_FUNCTION_NAMES.has(fn.name);

export const createListLogicFunctionToolsTool = (
  deps: {
    flatEntityMapsCacheService: WorkspaceManyOrAllFlatEntityMapsCacheService;
  },
  context: WorkflowToolContext,
) => ({
  name: 'list_logic_function_tools' as const,
  description:
    'List workflow LOGIC_FUNCTION actions with IDs, names, descriptions, and input/output schemas. Native GTM functions (search-people-for-company, search-people, search-companies, search-jobs, fetch-linkedin-profile) include isNative=true — do not read their source; use inputSchema. search-people-for-company enrolls Person+Candidate; search-people / search-companies / search-jobs return hits only.',
  inputSchema: listLogicFunctionToolsSchema,
  execute: async () => {
    const { flatLogicFunctionMaps } =
      await deps.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
        {
          workspaceId: context.workspaceId,
          flatMapsKeys: ['flatLogicFunctionMaps'],
        },
      );

    const workflowActionFunctions = Object.values(
      flatLogicFunctionMaps.byUniversalIdentifier,
    ).filter(
      (fn): fn is FlatLogicFunction =>
        isDefined(fn) &&
        isDefined(fn.workflowActionTriggerSettings) &&
        fn.deletedAt === null,
    );

    return {
      success: true,
      logicFunctions: workflowActionFunctions.map((fn) => {
        const isNative = isNativeLogicFunction(fn);

        return {
          id: fn.id,
          name: fn.name,
          displayName: fn.workflowActionTriggerSettings?.label ?? fn.name,
          description: isNative
            ? `${fn.description} Native executor (source is a stub). Use inputSchema; do not call get_logic_function_source.`
            : fn.description,
          isNative,
          inputSchema: fn.workflowActionTriggerSettings?.inputSchema ?? null,
          outputSchema: fn.workflowActionTriggerSettings?.outputSchema ?? null,
        };
      }),
    };
  },
});
