import { FormBooleanFieldInput } from '@/object-record/record-field/ui/form-types/components/FormBooleanFieldInput';
import { FormNumberFieldInput } from '@/object-record/record-field/ui/form-types/components/FormNumberFieldInput';
import { FormTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormTextFieldInput';
import { type WorkflowSearchLocalBusinessesAction } from '@/workflow/types/Workflow';
import { WorkflowStepBody } from '@/workflow/workflow-steps/components/WorkflowStepBody';
import { WorkflowStepFooter } from '@/workflow/workflow-steps/components/WorkflowStepFooter';
import { useUnipileMessagingForm } from '@/workflow/workflow-steps/workflow-actions/unipile-messaging-action/hooks/useUnipileMessagingForm';
import { WorkflowVariablePicker } from '@/workflow/workflow-variables/components/WorkflowVariablePicker';
import { t } from '@lingui/core/macro';
import { useEffect } from 'react';

type FormData = {
  query: string;
  limit: number;
  lat: number | null;
  lng: number | null;
  zoom: number | null;
  language: string;
  region: string;
  extractEmailsAndContacts: boolean;
  mode: string;
};

type WorkflowEditActionSearchLocalBusinessesProps = {
  action: WorkflowSearchLocalBusinessesAction;
  actionOptions:
    | {
        readonly: true;
      }
    | {
        readonly?: false;
        onActionUpdate: (action: WorkflowSearchLocalBusinessesAction) => void;
      };
};

export const WorkflowEditActionSearchLocalBusinesses = ({
  action,
  actionOptions,
}: WorkflowEditActionSearchLocalBusinessesProps) => {
  const { formData, handleFieldChange, saveAction } = useUnipileMessagingForm({
    initialFormData: {
      query: action.settings.input.query ?? '',
      limit: action.settings.input.limit ?? 20,
      lat: action.settings.input.lat ?? null,
      lng: action.settings.input.lng ?? null,
      zoom: action.settings.input.zoom ?? null,
      language: action.settings.input.language ?? 'en',
      region: action.settings.input.region ?? 'us',
      extractEmailsAndContacts:
        action.settings.input.extractEmailsAndContacts === true,
      mode: action.settings.input.mode ?? 'search',
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
            query: nextFormData.query,
            limit: nextFormData.limit,
            lat: nextFormData.lat ?? undefined,
            lng: nextFormData.lng ?? undefined,
            zoom: nextFormData.zoom ?? undefined,
            language: nextFormData.language,
            region: nextFormData.region,
            extractEmailsAndContacts: nextFormData.extractEmailsAndContacts,
            mode: nextFormData.mode as
              | 'search'
              | 'search-nearby'
              | 'search-in-area',
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
          placeholder={t`Hotels in San Francisco, USA`}
          readonly={actionOptions.readonly}
          defaultValue={formData.query}
          onChange={(value) => handleFieldChange('query', value)}
          VariablePicker={WorkflowVariablePicker}
        />
        <FormTextFieldInput
          label={t`Mode`}
          placeholder={t`search | search-nearby | search-in-area`}
          readonly={actionOptions.readonly}
          defaultValue={formData.mode}
          onChange={(value) => handleFieldChange('mode', value)}
          VariablePicker={WorkflowVariablePicker}
        />
        <FormNumberFieldInput
          label={t`Limit`}
          placeholder="20"
          readonly={actionOptions.readonly}
          defaultValue={formData.limit}
          onChange={(value) =>
            handleFieldChange('limit', typeof value === 'number' ? value : 20)
          }
          VariablePicker={WorkflowVariablePicker}
        />
        <FormNumberFieldInput
          label={t`Latitude`}
          placeholder={t`Optional`}
          readonly={actionOptions.readonly}
          defaultValue={formData.lat ?? undefined}
          onChange={(value) =>
            handleFieldChange('lat', typeof value === 'number' ? value : null)
          }
          VariablePicker={WorkflowVariablePicker}
        />
        <FormNumberFieldInput
          label={t`Longitude`}
          placeholder={t`Optional`}
          readonly={actionOptions.readonly}
          defaultValue={formData.lng ?? undefined}
          onChange={(value) =>
            handleFieldChange('lng', typeof value === 'number' ? value : null)
          }
          VariablePicker={WorkflowVariablePicker}
        />
        <FormNumberFieldInput
          label={t`Zoom`}
          placeholder={t`Optional (for search / search-in-area)`}
          readonly={actionOptions.readonly}
          defaultValue={formData.zoom ?? undefined}
          onChange={(value) =>
            handleFieldChange('zoom', typeof value === 'number' ? value : null)
          }
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
      </WorkflowStepBody>
      <WorkflowStepFooter stepId={action.id} />
    </>
  );
};
