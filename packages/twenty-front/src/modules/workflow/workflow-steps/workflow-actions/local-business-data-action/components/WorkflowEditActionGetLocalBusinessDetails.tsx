import { FormBooleanFieldInput } from '@/object-record/record-field/ui/form-types/components/FormBooleanFieldInput';
import { FormTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormTextFieldInput';
import { type WorkflowGetLocalBusinessDetailsAction } from '@/workflow/types/Workflow';
import { WorkflowStepBody } from '@/workflow/workflow-steps/components/WorkflowStepBody';
import { WorkflowStepFooter } from '@/workflow/workflow-steps/components/WorkflowStepFooter';
import { useUnipileMessagingForm } from '@/workflow/workflow-steps/workflow-actions/unipile-messaging-action/hooks/useUnipileMessagingForm';
import { WorkflowVariablePicker } from '@/workflow/workflow-variables/components/WorkflowVariablePicker';
import { t } from '@lingui/core/macro';
import { useEffect } from 'react';

type FormData = {
  businessIdsText: string;
  extractEmailsAndContacts: boolean;
  extractShareLink: boolean;
  language: string;
  region: string;
};

type WorkflowEditActionGetLocalBusinessDetailsProps = {
  action: WorkflowGetLocalBusinessDetailsAction;
  actionOptions:
    | {
        readonly: true;
      }
    | {
        readonly?: false;
        onActionUpdate: (action: WorkflowGetLocalBusinessDetailsAction) => void;
      };
};

const parseBusinessIds = (value: string): string[] =>
  value
    .split(',')
    .map((businessId) => businessId.trim())
    .filter((businessId) => businessId.length > 0)
    .slice(0, 20);

export const WorkflowEditActionGetLocalBusinessDetails = ({
  action,
  actionOptions,
}: WorkflowEditActionGetLocalBusinessDetailsProps) => {
  const { formData, handleFieldChange, saveAction } = useUnipileMessagingForm({
    initialFormData: {
      businessIdsText: (action.settings.input.businessIds ?? []).join(', '),
      extractEmailsAndContacts:
        action.settings.input.extractEmailsAndContacts !== false,
      extractShareLink: action.settings.input.extractShareLink === true,
      language: action.settings.input.language ?? 'en',
      region: action.settings.input.region ?? 'us',
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
            ...action.settings.input,
            businessIds: parseBusinessIds(nextFormData.businessIdsText),
            extractEmailsAndContacts: nextFormData.extractEmailsAndContacts,
            extractShareLink: nextFormData.extractShareLink,
            language: nextFormData.language,
            region: nextFormData.region,
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
          label={t`Business IDs`}
          placeholder={t`Comma-separated business_id / place_id values (max 20)`}
          readonly={actionOptions.readonly}
          defaultValue={formData.businessIdsText}
          onChange={(value) => handleFieldChange('businessIdsText', value)}
          VariablePicker={WorkflowVariablePicker}
        />
        <FormTextFieldInput
          label={t`Language`}
          placeholder="en"
          readonly={actionOptions.readonly}
          defaultValue={formData.language}
          onChange={(value) => handleFieldChange('language', value)}
          VariablePicker={WorkflowVariablePicker}
        />
        <FormTextFieldInput
          label={t`Region`}
          placeholder="us"
          readonly={actionOptions.readonly}
          defaultValue={formData.region}
          onChange={(value) => handleFieldChange('region', value)}
          VariablePicker={WorkflowVariablePicker}
        />
        <FormBooleanFieldInput
          label={t`Extract emails and contacts`}
          defaultValue={formData.extractEmailsAndContacts}
          onChange={(value) =>
            handleFieldChange('extractEmailsAndContacts', value === true)
          }
          readonly={actionOptions.readonly}
        />
        <FormBooleanFieldInput
          label={t`Extract share link`}
          defaultValue={formData.extractShareLink}
          onChange={(value) =>
            handleFieldChange('extractShareLink', value === true)
          }
          readonly={actionOptions.readonly}
        />
      </WorkflowStepBody>
      <WorkflowStepFooter stepId={action.id} />
    </>
  );
};
