import { FormNumberFieldInput } from '@/object-record/record-field/ui/form-types/components/FormNumberFieldInput';
import { FormTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormTextFieldInput';
import {
  type WorkflowSearchBrightDataCompaniesAction,
  type WorkflowSearchBrightDataPeopleAction,
} from '@/workflow/types/Workflow';
import { WorkflowStepBody } from '@/workflow/workflow-steps/components/WorkflowStepBody';
import { WorkflowStepFooter } from '@/workflow/workflow-steps/components/WorkflowStepFooter';
import { useUnipileMessagingForm } from '@/workflow/workflow-steps/workflow-actions/unipile-messaging-action/hooks/useUnipileMessagingForm';
import { WorkflowVariablePicker } from '@/workflow/workflow-variables/components/WorkflowVariablePicker';
import { t } from '@lingui/core/macro';
import { useEffect } from 'react';

type BrightDataSearchAction =
  | WorkflowSearchBrightDataCompaniesAction
  | WorkflowSearchBrightDataPeopleAction;

type FormData = {
  query: string;
  mode: string;
  limit: number;
  offset: number | null;
  view: string;
  projectId: string;
  maxBudgetUsd: number;
};

type WorkflowEditActionSearchBrightDataBusinessProps = {
  action: BrightDataSearchAction;
  actionOptions:
    | {
        readonly: true;
      }
    | {
        readonly?: false;
        onActionUpdate: (action: BrightDataSearchAction) => void;
      };
};

const normalizeMode = (mode: string): 'ludicrous' | 'smart' | 'instant' => {
  const normalized = mode.trim().toLowerCase();

  return normalized === 'instant' || normalized === 'smart'
    ? normalized
    : 'ludicrous';
};

const normalizeView = (view: string): 'full' | 'summary' | 'id_only' => {
  const normalized = view.trim().toLowerCase();

  if (normalized === 'summary' || normalized === 'id_only') {
    return normalized;
  }

  return 'full';
};

export const WorkflowEditActionSearchBrightDataBusiness = ({
  action,
  actionOptions,
}: WorkflowEditActionSearchBrightDataBusinessProps) => {
  const { formData, handleFieldChange, saveAction } = useUnipileMessagingForm({
    initialFormData: {
      query: action.settings.input.query ?? '',
      mode: action.settings.input.mode ?? 'ludicrous',
      limit: action.settings.input.limit ?? 100,
      maxBudgetUsd: action.settings.input.maxBudgetUsd ?? 1,
      offset: action.settings.input.offset ?? null,
      view: action.settings.input.view ?? 'full',
      projectId: action.settings.input.projectId ?? '',
    },
    readonly: actionOptions.readonly === true,
    onSave: (nextFormData: FormData) => {
      if (actionOptions.readonly === true) {
        return;
      }

      actionOptions.onActionUpdate({
        ...action,
        settings: {
          ...action.settings,
          input: {
            query: nextFormData.query,
            mode: normalizeMode(nextFormData.mode),
            limit: nextFormData.limit,
            offset: nextFormData.offset ?? undefined,
            view: normalizeView(nextFormData.view),
            projectId: nextFormData.projectId || undefined,
            maxBudgetUsd: nextFormData.maxBudgetUsd,
          },
        },
      });
    },
  });

  useEffect(() => {
    return () => {
      saveAction.flush();
    };
  }, [saveAction]);

  return (
    <>
      <WorkflowStepBody>
        <FormTextFieldInput
          label={t`Query`}
          placeholder={t`Apparel brands in India with more than 50 stores`}
          readonly={actionOptions.readonly}
          defaultValue={formData.query}
          onChange={(value) => handleFieldChange('query', value)}
          VariablePicker={WorkflowVariablePicker}
        />
        <FormTextFieldInput
          label={t`Mode`}
          placeholder={t`ludicrous | smart | instant`}
          readonly={actionOptions.readonly}
          defaultValue={formData.mode}
          onChange={(value) => handleFieldChange('mode', value)}
          VariablePicker={WorkflowVariablePicker}
        />
        <FormNumberFieldInput
          label={t`Limit`}
          placeholder="10"
          readonly={actionOptions.readonly}
          defaultValue={formData.limit}
          onChange={(value) =>
            handleFieldChange('limit', typeof value === 'number' ? value : 10)
          }
          VariablePicker={WorkflowVariablePicker}
        />
        <FormNumberFieldInput
          label={t`Max budget (USD)`}
          placeholder="1"
          readonly={actionOptions.readonly}
          defaultValue={formData.maxBudgetUsd}
          onChange={(value) =>
            handleFieldChange(
              'maxBudgetUsd',
              typeof value === 'number'
                ? Math.min(Math.max(value, 0.01), 10)
                : 1,
            )
          }
          VariablePicker={WorkflowVariablePicker}
        />
        <FormNumberFieldInput
          label={t`Offset`}
          placeholder={t`Optional`}
          readonly={actionOptions.readonly}
          defaultValue={formData.offset ?? undefined}
          onChange={(value) =>
            handleFieldChange(
              'offset',
              typeof value === 'number' ? value : null,
            )
          }
          VariablePicker={WorkflowVariablePicker}
        />
        <FormTextFieldInput
          label={t`View`}
          placeholder={t`full | summary | id_only`}
          readonly={actionOptions.readonly}
          defaultValue={formData.view}
          onChange={(value) => handleFieldChange('view', value)}
          VariablePicker={WorkflowVariablePicker}
        />
        <FormTextFieldInput
          label={t`Project ID`}
          placeholder={t`Optional. Writes the Outreach tab when set`}
          readonly={actionOptions.readonly}
          defaultValue={formData.projectId}
          onChange={(value) => handleFieldChange('projectId', value)}
          VariablePicker={WorkflowVariablePicker}
        />
      </WorkflowStepBody>
      <WorkflowStepFooter stepId={action.id} />
    </>
  );
};
