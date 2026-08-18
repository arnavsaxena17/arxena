import { Injectable } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';
import { type WorkflowActionTriggerSettings } from 'twenty-shared/application';

import { GTM_NATIVE_LOGIC_FUNCTION_NAMES } from 'src/engine/core-modules/gtm-command/constants/gtm-logic-function-names.const';
import { WorkspaceManyOrAllFlatEntityMapsCacheService } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service';
import { findFlatEntityByIdInFlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps.util';
import { LogicFunctionFromSourceService } from 'src/engine/metadata-modules/logic-function/services/logic-function-from-source.service';
import { type PrefilledGtmLogicFunctionDefinition } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-gtm-logic-functions.util';
import { type PrefilledWorkflowCodeStepLogicFunctionDefinition } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-workflow-code-step-logic-functions.util';

const getWorkflowActionTriggerSettings = (
  definition: PrefilledWorkflowCodeStepLogicFunctionDefinition,
): WorkflowActionTriggerSettings | undefined =>
  'workflowActionTriggerSettings' in definition
    ? (definition as PrefilledGtmLogicFunctionDefinition)
        .workflowActionTriggerSettings
    : undefined;

@Injectable()
export class PrefillLogicFunctionService {
  constructor(
    private readonly logicFunctionFromSourceService: LogicFunctionFromSourceService,
    private readonly flatEntityMapsCacheService: WorkspaceManyOrAllFlatEntityMapsCacheService,
  ) {}

  async ensureSeeded({
    workspaceId,
    definitions,
  }: {
    workspaceId: string;
    definitions: PrefilledWorkflowCodeStepLogicFunctionDefinition[];
  }) {
    const { flatLogicFunctionMaps } =
      await this.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
        {
          workspaceId,
          flatMapsKeys: ['flatLogicFunctionMaps'],
        },
      );

    for (const definition of definitions) {
      const existingLogicFunction = findFlatEntityByIdInFlatEntityMaps({
        flatEntityId: definition.id,
        flatEntityMaps: flatLogicFunctionMaps,
      });

      const workflowActionTriggerSettings =
        getWorkflowActionTriggerSettings(definition);

      if (isDefined(existingLogicFunction)) {
        if (GTM_NATIVE_LOGIC_FUNCTION_NAMES.has(definition.name)) {
          await this.logicFunctionFromSourceService.updateOneFromSource({
            workspaceId,
            updateLogicFunctionFromSourceInput: {
              id: definition.id,
              update: {
                description: definition.description,
                sourceHandlerCode: definition.sourceHandlerCode,
                workflowActionTriggerSettings,
              },
            },
          });
        }

        continue;
      }

      await this.logicFunctionFromSourceService.createOneFromSource({
        workspaceId,
        input: {
          id: definition.id,
          name: definition.name,
          description: definition.description,
          workflowActionTriggerSettings,
          source: {
            sourceHandlerCode: definition.sourceHandlerCode,
            handlerName: 'main',
          },
        },
      });
    }
  }
}
