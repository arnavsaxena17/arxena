import { CODE_STEP_LOGIC_FUNCTION_NAME } from 'twenty-shared/logic-function';
import { isDefined } from 'twenty-shared/utils';
import { z } from 'zod';

import { OUTREACH_NATIVE_LOGIC_FUNCTION_NAMES } from 'src/engine/core-modules/outreach-command/constants/outreach-logic-function-names.const';
import { type WorkspaceManyOrAllFlatEntityMapsCacheService } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service';
import { type FlatLogicFunction } from 'src/engine/metadata-modules/logic-function/types/flat-logic-function.type';
import { type WorkflowToolContext } from 'src/modules/workflow/workflow-tools/types/workflow-tool-dependencies.type';

const listLogicFunctionToolsSchema = z.object({});

const isNativeLogicFunction = (fn: FlatLogicFunction): boolean =>
  OUTREACH_NATIVE_LOGIC_FUNCTION_NAMES.has(fn.name);

export const createListLogicFunctionToolsTool = (
  deps: {
    flatEntityMapsCacheService: WorkspaceManyOrAllFlatEntityMapsCacheService;
  },
  context: WorkflowToolContext,
) => ({
  name: 'list_logic_function_tools' as const,
  description:
    `List workflow LOGIC_FUNCTION actions with IDs, names, descriptions, and input/output schemas. Native GTM functions (${[...OUTREACH_NATIVE_LOGIC_FUNCTION_NAMES].join(', ')}) include isNative=true — do not read their source; use inputSchema. Search LFs return hits only. Persist people with upload-profiles; persist harvested companies with upsert-companies. enrich-contact and get-calendar-availability are native.`,
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
        fn.name !== CODE_STEP_LOGIC_FUNCTION_NAME &&
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
