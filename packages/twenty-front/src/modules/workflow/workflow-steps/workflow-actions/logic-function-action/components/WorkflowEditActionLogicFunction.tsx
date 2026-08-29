import { useIsThirdPartyApplication } from '@/applications/hooks/useIsThirdPartyApplication';
import { LogicFunctionExecutionResult } from '@/logic-functions/components/LogicFunctionExecutionResult';
import { LogicFunctionLogs } from '@/logic-functions/components/LogicFunctionLogs';
import { LogicFunctionTestInputInitEffect } from '@/logic-functions/components/LogicFunctionTestInputInitEffect';
import { useExecuteLogicFunction } from '@/logic-functions/hooks/useExecuteLogicFunction';
import { useGetOneLogicFunction } from '@/logic-functions/hooks/useGetOneLogicFunction';
import { InputLabel } from '@/ui/input/components/InputLabel';
import { TabList } from '@/ui/layout/tab-list/components/TabList';
import { activeTabIdComponentState } from '@/ui/layout/tab-list/states/activeTabIdComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { type WorkflowLogicFunctionAction } from '@/workflow/types/Workflow';
import { WorkflowExpectedOutputBodyInput } from '@/workflow/workflow-steps/components/WorkflowExpectedOutputBodyInput';
import { WorkflowStepBody } from '@/workflow/workflow-steps/components/WorkflowStepBody';
import { WorkflowStepCmdEnterButton } from '@/workflow/workflow-steps/components/WorkflowStepCmdEnterButton';
import { WorkflowStepFooter } from '@/workflow/workflow-steps/components/WorkflowStepFooter';
import { WorkflowEditActionCodeFields } from '@/workflow/workflow-steps/workflow-actions/code-action/components/WorkflowEditActionCodeFields';
import { mergeDefaultFunctionInputAndFunctionInput } from '@/workflow/workflow-steps/workflow-actions/code-action/utils/mergeDefaultFunctionInputAndFunctionInput';
import { setNestedValue } from '@/workflow/workflow-steps/workflow-actions/code-action/utils/setNestedValue';
import { WORKFLOW_LOGIC_FUNCTION_ACTION_TAB_LIST_COMPONENT_ID } from '@/workflow/workflow-steps/workflow-actions/logic-function-action/constants/WorkflowLogicFunctionActionTabListComponentId';
import {
  getOutreachNativeLogicFunctionSampleOutput,
  isNativeOutreachLogicFunction,
} from '@/workflow/workflow-steps/workflow-actions/logic-function-action/constants/outreachNativeLogicFunctionSampleOutput';
import { WorkflowLogicFunctionAiModelSelect } from '@/workflow/workflow-steps/workflow-actions/logic-function-action/components/WorkflowLogicFunctionAiModelSelect';
import {
  applyOutreachNativeLogicFunctionInputSchema,
  getOutreachNativeLogicFunctionFormFields,
  normalizeOutreachNativeLogicFunctionInput,
} from '@/workflow/workflow-steps/workflow-actions/logic-function-action/utils/applyOutreachNativeLogicFunctionInputSchema';
import { shouldDefaultLogicFunctionSampleOutput } from '@/workflow/workflow-steps/workflow-actions/logic-function-action/utils/shouldDefaultLogicFunctionSampleOutput';
import { WorkflowVariablePicker } from '@/workflow/workflow-variables/components/WorkflowVariablePicker';
import { useAvailableVariablesInWorkflowStep } from '@/workflow/workflow-variables/hooks/useAvailableVariablesInWorkflowStep';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { isObject } from '@sniptt/guards';
import { useEffect, useMemo, useRef } from 'react';
import { getOutputSchemaFromValue } from 'twenty-shared/logic-function';
import { isDefined } from 'twenty-shared/utils';
import { getFunctionInputFromInputSchema } from 'twenty-shared/workflow';
import { Callout } from 'twenty-ui/feedback';
import { IconPlayerPlay, IconSettingsAutomation } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useDebouncedCallback } from 'use-debounce';

const INPUT_TAB_ID = 'input';
const TEST_TAB_ID = 'test';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
`;

const StyledTabListContainer = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  padding-left: ${themeCssVariables.spacing[2]};
`;

const StyledResultContainer = styled.div`
  display: flex;
  flex-direction: column;
  position: relative;
`;

type WorkflowEditActionLogicFunctionProps = {
  action: WorkflowLogicFunctionAction;
  actionOptions:
    | {
        readonly: true;
      }
    | {
        readonly?: false;
        onActionUpdate: (action: WorkflowLogicFunctionAction) => void;
      };
};

export const WorkflowEditActionLogicFunction = ({
  action,
  actionOptions,
}: WorkflowEditActionLogicFunctionProps) => {
  const { t } = useLingui();

  const logicFunctionId = action.settings.input.logicFunctionId;

  const { logicFunction, loading } = useGetOneLogicFunction({
    id: logicFunctionId,
  });

  const isThirdPartyApp = useIsThirdPartyApplication(
    logicFunction?.applicationId,
  );

  const availableVariablesInWorkflowStep = useAvailableVariablesInWorkflowStep({
    shouldDisplayRecordFields: true,
    shouldDisplayRecordObjects: false,
  });
  const actionVariablePicker =
    availableVariablesInWorkflowStep.length > 0
      ? WorkflowVariablePicker
      : undefined;

  const activeTabId = useAtomComponentStateValue(
    activeTabIdComponentState,
    WORKFLOW_LOGIC_FUNCTION_ACTION_TAB_LIST_COMPONENT_ID,
  );

  const inputSchema = useMemo(
    () =>
      applyOutreachNativeLogicFunctionInputSchema(
        logicFunction?.name,
        logicFunction?.workflowActionTriggerSettings?.inputSchema,
      ),
    [
      logicFunction?.name,
      logicFunction?.workflowActionTriggerSettings?.inputSchema,
    ],
  );

  const functionInput = useMemo(() => {
    if (!isDefined(inputSchema)) {
      return normalizeOutreachNativeLogicFunctionInput(
        logicFunction?.name,
        action.settings.input.logicFunctionInput ?? {},
      );
    }

    const defaultInput = getFunctionInputFromInputSchema(inputSchema)[0];

    if (!isObject(defaultInput)) {
      return normalizeOutreachNativeLogicFunctionInput(
        logicFunction?.name,
        action.settings.input.logicFunctionInput ?? {},
      );
    }

    return normalizeOutreachNativeLogicFunctionInput(
      logicFunction?.name,
      mergeDefaultFunctionInputAndFunctionInput({
        newInput: defaultInput,
        oldInput: action.settings.input.logicFunctionInput ?? {},
      }),
    );
  }, [
    inputSchema,
    action.settings.input.logicFunctionInput,
    logicFunction?.name,
  ]);

  const formFields = getOutreachNativeLogicFunctionFormFields({
    logicFunctionName: logicFunction?.name,
    inputSchema,
    functionInput,
  });

  const updateAction = useDebouncedCallback(
    (actionUpdate: Partial<WorkflowLogicFunctionAction>) => {
      if (actionOptions.readonly === true) {
        return;
      }

      actionOptions.onActionUpdate({
        ...action,
        ...actionUpdate,
      });
    },
    500,
  );

  const defaultSampleOutput = useMemo(() => {
    const sampleFromSettings = logicFunction?.workflowActionTriggerSettings
      ?.sampleOutput as Record<string, unknown> | undefined;

    if (isDefined(sampleFromSettings) && Object.keys(sampleFromSettings).length > 0) {
      return sampleFromSettings;
    }

    return getOutreachNativeLogicFunctionSampleOutput(logicFunction?.name);
  }, [
    logicFunction?.name,
    logicFunction?.workflowActionTriggerSettings?.sampleOutput,
  ]);

  const hasAppliedDefaultSample = useRef(false);

  useEffect(() => {
    if (
      actionOptions.readonly === true ||
      hasAppliedDefaultSample.current ||
      !isDefined(defaultSampleOutput)
    ) {
      return;
    }

    if (
      !shouldDefaultLogicFunctionSampleOutput({
        logicFunctionName: logicFunction?.name,
        expectedOutputSchema: action.settings.expectedOutputSchema,
      })
    ) {
      return;
    }

    hasAppliedDefaultSample.current = true;
    actionOptions.onActionUpdate({
      ...action,
      settings: {
        ...action.settings,
        expectedOutputSchema: defaultSampleOutput,
        outputSchema: getOutputSchemaFromValue(defaultSampleOutput),
      },
    });
  }, [
    action,
    actionOptions,
    defaultSampleOutput,
    logicFunction?.name,
  ]);

  const updateOutputSchemaFromTestResult = (testResult: object) => {
    if (actionOptions.readonly === true) {
      return;
    }

    if (isNativeOutreachLogicFunction(logicFunction?.name)) {
      return;
    }

    const newOutputSchema = getOutputSchemaFromValue(testResult);

    updateAction({
      ...action,
      settings: { ...action.settings, outputSchema: newOutputSchema },
    });
  };

  const {
    executeLogicFunction,
    isExecuting,
    logicFunctionTestData,
    updateLogicFunctionInput,
  } = useExecuteLogicFunction({
    logicFunctionId,
    callback: updateOutputSchemaFromTestResult,
  });

  const testInput = normalizeOutreachNativeLogicFunctionInput(
    logicFunction?.name,
    mergeDefaultFunctionInputAndFunctionInput({
      newInput: functionInput,
      oldInput: logicFunctionTestData.input,
    }),
  );

  const testFormFields = getOutreachNativeLogicFunctionFormFields({
    logicFunctionName: logicFunction?.name,
    inputSchema,
    functionInput: testInput,
  });

  const handleInputChange = (value: unknown, path: string[]) => {
    const updatedFunctionInput = setNestedValue(functionInput, path, value);

    updateAction({
      settings: {
        ...action.settings,
        input: {
          ...action.settings.input,
          logicFunctionInput: updatedFunctionInput,
        },
      },
    });
  };

  const handleTestInputChange = (value: unknown, path: string[]) => {
    if (actionOptions.readonly === true) {
      return;
    }

    const updatedTestFunctionInput = setNestedValue(testInput, path, value);

    updateLogicFunctionInput(updatedTestFunctionInput);
  };

  const handleExpectedOutputBodyChange = (
    parsedValue: Record<string, unknown>,
  ) => {
    if (actionOptions.readonly === true) {
      return;
    }

    updateAction({
      settings: {
        ...action.settings,
        expectedOutputSchema: parsedValue,
        outputSchema: getOutputSchemaFromValue(parsedValue),
      },
    });
  };

  const handleTestFunction = async () => {
    if (actionOptions.readonly === true) {
      return;
    }

    await executeLogicFunction();
  };

  if (loading) {
    return null;
  }

  const hasInputFields =
    Object.keys(formFields.functionInput).length > 0 ||
    formFields.showAiModelSelect;

  const isTestTabActive = !isThirdPartyApp && activeTabId === TEST_TAB_ID;

  const tabs = [
    {
      id: INPUT_TAB_ID,
      title: t`Input`,
      Icon: IconSettingsAutomation,
    },
    {
      id: TEST_TAB_ID,
      title: t`Test`,
      Icon: IconPlayerPlay,
    },
  ];

  return (
    <>
      <LogicFunctionTestInputInitEffect logicFunctionId={logicFunctionId} />
      {!isThirdPartyApp && (
        <StyledTabListContainer>
          <TabList
            tabs={tabs}
            behaveAsLinks={false}
            componentInstanceId={
              WORKFLOW_LOGIC_FUNCTION_ACTION_TAB_LIST_COMPONENT_ID
            }
          />
        </StyledTabListContainer>
      )}
      <WorkflowStepBody>
        {isTestTabActive ? (
          <>
            {testFormFields.showAiModelSelect && (
              <WorkflowLogicFunctionAiModelSelect
                dropdownId="workflow-detect-fake-profiles-model-test"
                value={testFormFields.modelId}
                readonly={actionOptions.readonly}
                onChange={(modelId) =>
                  handleTestInputChange(modelId, ['modelId'])
                }
              />
            )}
            <WorkflowEditActionCodeFields
              functionInput={testFormFields.functionInput}
              inputSchema={testFormFields.inputSchema}
              onInputChange={handleTestInputChange}
              readonly={actionOptions.readonly}
            />
            <StyledResultContainer>
              <InputLabel>{t`Result`}</InputLabel>
              <LogicFunctionExecutionResult
                logicFunctionTestData={logicFunctionTestData}
                isTesting={isExecuting}
              />
            </StyledResultContainer>
            {logicFunctionTestData.output.logs.length > 0 && (
              <StyledResultContainer>
                <LogicFunctionLogs
                  componentInstanceId={`workflow-edit-action-logs-${action.id}`}
                  value={isExecuting ? '' : logicFunctionTestData.output.logs}
                />
              </StyledResultContainer>
            )}
          </>
        ) : (
          <StyledContainer>
            {hasInputFields ? (
              <>
                {formFields.showAiModelSelect && (
                  <WorkflowLogicFunctionAiModelSelect
                    dropdownId="workflow-detect-fake-profiles-model-input"
                    value={formFields.modelId}
                    readonly={actionOptions.readonly}
                    onChange={(modelId) =>
                      handleInputChange(modelId, ['modelId'])
                    }
                  />
                )}
                <WorkflowEditActionCodeFields
                  functionInput={formFields.functionInput}
                  inputSchema={formFields.inputSchema}
                  readonly={actionOptions.readonly}
                  onInputChange={handleInputChange}
                  VariablePicker={actionVariablePicker}
                  fullWidth
                />
              </>
            ) : (
              <Callout
                variant={'neutral'}
                title={t`No input fields for this action`}
                description={t`You can see the function logic in your application settings.`}
              />
            )}
            <WorkflowExpectedOutputBodyInput
              key={
                shouldDefaultLogicFunctionSampleOutput({
                  logicFunctionName: logicFunction?.name,
                  expectedOutputSchema: action.settings.expectedOutputSchema,
                })
                  ? 'default-sample'
                  : 'saved-sample'
              }
              defaultValue={
                shouldDefaultLogicFunctionSampleOutput({
                  logicFunctionName: logicFunction?.name,
                  expectedOutputSchema: action.settings.expectedOutputSchema,
                })
                  ? defaultSampleOutput
                  : action.settings.expectedOutputSchema
              }
              onChange={handleExpectedOutputBodyChange}
              readonly={actionOptions.readonly}
            />
          </StyledContainer>
        )}
      </WorkflowStepBody>
      {!actionOptions.readonly && (
        <WorkflowStepFooter
          stepId={action.id}
          additionalActions={
            isTestTabActive
              ? [
                  <WorkflowStepCmdEnterButton
                    title={t`Test`}
                    onClick={handleTestFunction}
                    disabled={isExecuting}
                  />,
                ]
              : []
          }
        />
      )}
    </>
  );
};
