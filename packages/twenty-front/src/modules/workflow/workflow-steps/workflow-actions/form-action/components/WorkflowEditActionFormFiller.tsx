import { WorkflowStepCmdEnterButton } from '@/workflow/workflow-steps/components/WorkflowStepCmdEnterButton';
import { useSidePanelHistory } from '@/side-panel/hooks/useSidePanelHistory';
import { FormFieldInput } from '@/object-record/record-field/ui/components/FormFieldInput';
import { FormSingleRecordPicker } from '@/object-record/record-field/ui/form-types/components/FormSingleRecordPicker';
import { type FieldMetadata } from '@/object-record/record-field/ui/types/FieldMetadata';
import { SidePanelFooter } from '@/ui/layout/side-panel/components/SidePanelFooter';
import { useWorkflowRunIdOrThrow } from '@/workflow/hooks/useWorkflowRunIdOrThrow';
import { type WorkflowFormAction } from '@/workflow/types/Workflow';
import { WorkflowRunSSESubscribeEffect } from '@/workflow/workflow-diagram/components/WorkflowRunSSESubscribeEffect';
import { WorkflowStepBody } from '@/workflow/workflow-steps/components/WorkflowStepBody';
import { useUpdateWorkflowRunStep } from '@/workflow/workflow-steps/hooks/useUpdateWorkflowRunStep';
import { WorkflowFormFieldInput } from '@/workflow/workflow-steps/workflow-actions/components/WorkflowFormFieldInput';
import { useSubmitFormStep } from '@/workflow/workflow-steps/workflow-actions/form-action/hooks/useSubmitFormStep';
import { type WorkflowFormActionField } from '@/workflow/workflow-steps/workflow-actions/form-action/types/WorkflowFormActionField';
import { getDefaultFormFieldSettings } from '@/workflow/workflow-steps/workflow-actions/form-action/utils/getDefaultFormFieldSettings';
import { useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { FieldMetadataType } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { useDebouncedCallback } from 'use-debounce';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { Button } from 'twenty-ui/input';

const StyledNotifyChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
  margin-bottom: ${themeCssVariables.spacing[3]};
`;

const StyledChip = styled.span`
  background: ${themeCssVariables.background.transparent.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

const StyledApproveRow = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  margin-bottom: ${themeCssVariables.spacing[3]};
`;


export type WorkflowEditActionFormFillerProps = {
  action: WorkflowFormAction;
  actionOptions: {
    readonly: boolean;
  };
};

type FormData = WorkflowFormActionField[];

export const WorkflowEditActionFormFiller = ({
  action,
  actionOptions,
}: WorkflowEditActionFormFillerProps) => {
  const { t } = useLingui();
  const { submitFormStep } = useSubmitFormStep();
  const [formData, setFormData] = useState<FormData>(action.settings.input);
  const workflowRunId = useWorkflowRunIdOrThrow();
  const { goBackFromSidePanel } = useSidePanelHistory();
  const { updateWorkflowRunStep } = useUpdateWorkflowRunStep();
  const [error, setError] = useState<string | undefined>(undefined);

  const canSubmit = !actionOptions.readonly && !isDefined(error);

  const onFieldUpdate = ({
    fieldId,
    value,
  }: {
    fieldId: string;
    value: any;
  }) => {
    if (actionOptions.readonly === true) {
      return;
    }

    const updatedFormData = formData.map((field) =>
      field.id === fieldId ? { ...field, value } : field,
    );

    setFormData(updatedFormData);

    saveAction(updatedFormData);
  };

  const saveAction = useDebouncedCallback(async (updatedFormData: FormData) => {
    if (actionOptions.readonly === true) {
      return;
    }

    await updateWorkflowRunStep({
      workflowRunId,
      step: {
        ...action,
        settings: { ...action.settings, input: updatedFormData },
      },
    });
  }, 1_000);

  const onSubmit = async () => {
    const response = formData.reduce(
      (acc, field) => {
        acc[field.name] = field.value;
        return acc;
      },
      {} as Record<string, any>,
    );

    await submitFormStep({
      stepId: action.id,
      workflowRunId,
      response,
    });

    goBackFromSidePanel();
  };

  useEffect(() => {
    return () => {
      saveAction.flush();
    };
  }, [saveAction]);

  const notifyOnPending = (
    action.settings as {
      notifyOnPending?: { channels: string[] };
    }
  ).notifyOnPending;

  const booleanField = formData.find(
    (field) => field.type === FieldMetadataType.BOOLEAN,
  );

  const submitBooleanDecision = async (approved: boolean) => {
    if (!booleanField || actionOptions.readonly) {
      return;
    }

    const response = formData.reduce(
      (accumulator, field) => {
        accumulator[field.name] =
          field.id === booleanField.id ? approved : field.value;

        return accumulator;
      },
      {} as Record<string, unknown>,
    );

    await submitFormStep({
      stepId: action.id,
      workflowRunId,
      response,
    });

    goBackFromSidePanel();
  };

  return (
    <>
      <WorkflowRunSSESubscribeEffect workflowRunId={workflowRunId} />
      <WorkflowStepBody>
        {notifyOnPending?.channels?.length ? (
          <StyledNotifyChips>
            {notifyOnPending.channels.map((channel) => (
              <StyledChip key={channel}>
                {t`Notified via`} {channel.replaceAll('_', ' ')}
              </StyledChip>
            ))}
          </StyledNotifyChips>
        ) : null}
        {!actionOptions.readonly && booleanField ? (
          <StyledApproveRow>
            <Button
              title={t`Approve`}
              onClick={() => {
                void submitBooleanDecision(true);
              }}
            />
            <Button
              title={t`Reject`}
              variant="secondary"
              onClick={() => {
                void submitBooleanDecision(false);
              }}
            />
          </StyledApproveRow>
        ) : null}
        {formData.map((field) => {
          if (field.type === 'RECORD') {
            const objectNameSingular = field.settings?.objectName;

            if (!isDefined(objectNameSingular)) {
              return null;
            }

            const recordId = field.value?.id;

            return (
              <FormSingleRecordPicker
                key={field.id}
                label={field.label}
                defaultValue={recordId}
                onChange={(recordId) => {
                  onFieldUpdate({
                    fieldId: field.id,
                    value: {
                      id: recordId,
                    },
                  });
                }}
                objectNameSingulars={[objectNameSingular]}
                disabled={actionOptions.readonly}
              />
            );
          }

          if (field.type === 'SELECT' || field.type === 'MULTI_SELECT') {
            const selectedFieldId = field.settings?.selectedFieldId;

            if (!isDefined(selectedFieldId)) {
              return null;
            }

            return (
              <WorkflowFormFieldInput
                key={field.id}
                fieldMetadataId={selectedFieldId}
                defaultValue={field.value}
                readonly={actionOptions.readonly}
                onChange={(value) => {
                  onFieldUpdate({
                    fieldId: field.id,
                    value,
                  });
                }}
              />
            );
          }

          return (
            <FormFieldInput
              key={field.id}
              field={{
                label: field.label,
                type: field.type,
                metadata: {} as FieldMetadata,
              }}
              onChange={(value) => {
                onFieldUpdate({
                  fieldId: field.id,
                  value,
                });
              }}
              defaultValue={field.value}
              readonly={actionOptions.readonly}
              placeholder={
                field.placeholder ??
                getDefaultFormFieldSettings(field.type).placeholder
              }
              onError={(error) => {
                setError(error);
              }}
            />
          );
        })}
      </WorkflowStepBody>
      {!actionOptions.readonly && (
        <SidePanelFooter
          actions={[
            <WorkflowStepCmdEnterButton
              title={t`Submit`}
              onClick={onSubmit}
              disabled={!canSubmit}
            />,
          ]}
        />
      )}
    </>
  );
};
