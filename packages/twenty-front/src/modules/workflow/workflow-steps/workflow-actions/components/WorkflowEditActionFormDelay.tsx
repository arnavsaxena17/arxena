import { FormTextFieldInput } from '@/object-record/record-field/form-types/components/FormTextFieldInput';
import { Select } from '@/ui/input/components/Select';
import { WorkflowDelayAction } from '@/workflow/types/Workflow';
import { WorkflowStepBody } from '@/workflow/workflow-steps/components/WorkflowStepBody';
import { WorkflowStepHeader } from '@/workflow/workflow-steps/components/WorkflowStepHeader';
import { getActionIcon } from '@/workflow/workflow-steps/workflow-actions/utils/getActionIcon';
import { WorkflowVariablePicker } from '@/workflow/workflow-variables/components/WorkflowVariablePicker';
import { useTheme } from '@emotion/react';
import { useEffect, useState } from 'react';
import { isDefined } from 'twenty-shared';
import { useIcons } from 'twenty-ui';
import { useDebouncedCallback } from 'use-debounce';

type WorkflowEditActionFormDelayProps = {
  action: WorkflowDelayAction;
  actionOptions:
    | {
        readonly: true;
      }
    | {
        readonly?: false;
        onActionUpdate: (action: WorkflowDelayAction) => void;
      };
};

type DelayType = 'DURATION' | 'SCHEDULED_DATE';

type DelayFormData = {
  delayType: DelayType;
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  scheduledDateTime: string;
};

const toNumber = (value: string): number => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
};

export const WorkflowEditActionFormDelay = ({
  action,
  actionOptions,
}: WorkflowEditActionFormDelayProps) => {
  const theme = useTheme();
  const { getIcon } = useIcons();

  const input = action.settings.input;

  const [formData, setFormData] = useState<DelayFormData>({
    delayType: input.delayType,
    days:
      input.delayType === 'DURATION'
        ? String(input.duration.days ?? 0)
        : '0',
    hours:
      input.delayType === 'DURATION'
        ? String(input.duration.hours ?? 0)
        : '0',
    minutes:
      input.delayType === 'DURATION'
        ? String(input.duration.minutes ?? 0)
        : '0',
    seconds:
      input.delayType === 'DURATION'
        ? String(input.duration.seconds ?? 0)
        : '0',
    scheduledDateTime:
      input.delayType === 'SCHEDULED_DATE' ? input.scheduledDateTime : '',
  });

  const saveAction = useDebouncedCallback(async (nextFormData: DelayFormData) => {
    if (actionOptions.readonly === true) {
      return;
    }

    actionOptions.onActionUpdate({
      ...action,
      settings: {
        ...action.settings,
        input:
          nextFormData.delayType === 'DURATION'
            ? {
                delayType: 'DURATION',
                duration: {
                  days: toNumber(nextFormData.days),
                  hours: toNumber(nextFormData.hours),
                  minutes: toNumber(nextFormData.minutes),
                  seconds: toNumber(nextFormData.seconds),
                },
              }
            : {
                delayType: 'SCHEDULED_DATE',
                scheduledDateTime: nextFormData.scheduledDateTime,
              },
      },
    });
  }, 1_000);

  useEffect(() => {
    return () => {
      saveAction.flush();
    };
  }, [saveAction]);

  const handleFieldChange = (
    fieldName: keyof DelayFormData,
    updatedValue: string,
  ) => {
    const newFormData: DelayFormData = {
      ...formData,
      [fieldName]: updatedValue,
    };

    setFormData(newFormData);
    saveAction(newFormData);
  };

  const headerTitle = isDefined(action.name) ? action.name : 'Delay';
  const headerIcon = getActionIcon(action.type);

  return (
    <>
      <WorkflowStepHeader
        onTitleChange={(newName: string) => {
          if (actionOptions.readonly === true) {
            return;
          }

          actionOptions.onActionUpdate({
            ...action,
            name: newName,
          });
        }}
        Icon={getIcon(headerIcon)}
        iconColor={theme.color.gray}
        initialTitle={headerTitle}
        headerType="Delay"
        disabled={actionOptions.readonly}
      />
      <WorkflowStepBody>
        <Select
          dropdownId="select-delay-type"
          label="Delay type"
          fullWidth
          value={formData.delayType}
          options={[
            { label: 'For a duration', value: 'DURATION' },
            { label: 'Until a date', value: 'SCHEDULED_DATE' },
          ]}
          onChange={(delayType) => {
            handleFieldChange('delayType', delayType);
          }}
          disabled={actionOptions.readonly}
        />
        {formData.delayType === 'DURATION' ? (
          <>
            <FormTextFieldInput
              label="Days"
              placeholder="0"
              readonly={actionOptions.readonly}
              defaultValue={formData.days}
              onPersist={(days) => handleFieldChange('days', days)}
              VariablePicker={WorkflowVariablePicker}
            />
            <FormTextFieldInput
              label="Hours"
              placeholder="0"
              readonly={actionOptions.readonly}
              defaultValue={formData.hours}
              onPersist={(hours) => handleFieldChange('hours', hours)}
              VariablePicker={WorkflowVariablePicker}
            />
            <FormTextFieldInput
              label="Minutes"
              placeholder="0"
              readonly={actionOptions.readonly}
              defaultValue={formData.minutes}
              onPersist={(minutes) => handleFieldChange('minutes', minutes)}
              VariablePicker={WorkflowVariablePicker}
            />
            <FormTextFieldInput
              label="Seconds"
              placeholder="0"
              readonly={actionOptions.readonly}
              defaultValue={formData.seconds}
              onPersist={(seconds) => handleFieldChange('seconds', seconds)}
              VariablePicker={WorkflowVariablePicker}
            />
          </>
        ) : (
          <FormTextFieldInput
            label="Scheduled date/time"
            placeholder="2026-01-01T09:00:00.000Z"
            readonly={actionOptions.readonly}
            defaultValue={formData.scheduledDateTime}
            onPersist={(scheduledDateTime) =>
              handleFieldChange('scheduledDateTime', scheduledDateTime)
            }
            VariablePicker={WorkflowVariablePicker}
          />
        )}
      </WorkflowStepBody>
    </>
  );
};
