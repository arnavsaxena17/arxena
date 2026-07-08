import { FormTextFieldInput } from '@/object-record/record-field/form-types/components/FormTextFieldInput';
import { Select } from '@/ui/input/components/Select';
import { WorkflowIteratorAction } from '@/workflow/types/Workflow';
import { WorkflowStepBody } from '@/workflow/workflow-steps/components/WorkflowStepBody';
import { WorkflowStepHeader } from '@/workflow/workflow-steps/components/WorkflowStepHeader';
import { getActionIcon } from '@/workflow/workflow-steps/workflow-actions/utils/getActionIcon';
import { WorkflowVariablePicker } from '@/workflow/workflow-variables/components/WorkflowVariablePicker';
import { useTheme } from '@emotion/react';
import { useEffect, useState } from 'react';
import { isDefined } from 'twenty-shared';
import { useIcons } from 'twenty-ui';
import { useDebouncedCallback } from 'use-debounce';

type WorkflowEditActionFormIteratorProps = {
  action: WorkflowIteratorAction;
  actionOptions:
    | {
        readonly: true;
      }
    | {
        readonly?: false;
        onActionUpdate: (action: WorkflowIteratorAction) => void;
      };
};

type IteratorFormData = {
  items: string;
  shouldContinueOnIterationFailure: boolean;
};

export const WorkflowEditActionFormIterator = ({
  action,
  actionOptions,
}: WorkflowEditActionFormIteratorProps) => {
  const theme = useTheme();
  const { getIcon } = useIcons();

  const initialItems = action.settings.input.items;

  const [formData, setFormData] = useState<IteratorFormData>({
    items:
      typeof initialItems === 'string'
        ? initialItems
        : isDefined(initialItems)
          ? JSON.stringify(initialItems)
          : '',
    shouldContinueOnIterationFailure:
      action.settings.input.shouldContinueOnIterationFailure ?? false,
  });

  const saveAction = useDebouncedCallback(
    async (nextFormData: IteratorFormData) => {
      if (actionOptions.readonly === true) {
        return;
      }

      actionOptions.onActionUpdate({
        ...action,
        settings: {
          ...action.settings,
          input: {
            ...action.settings.input,
            items: nextFormData.items,
            shouldContinueOnIterationFailure:
              nextFormData.shouldContinueOnIterationFailure,
          },
        },
      });
    },
    1_000,
  );

  useEffect(() => {
    return () => {
      saveAction.flush();
    };
  }, [saveAction]);

  const headerTitle = isDefined(action.name) ? action.name : 'Iterator';
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
        iconColor={theme.color.blue}
        initialTitle={headerTitle}
        headerType="Iterator"
        disabled={actionOptions.readonly}
      />
      <WorkflowStepBody>
        <FormTextFieldInput
          label="Items"
          placeholder="Provide a list variable to iterate over"
          readonly={actionOptions.readonly}
          defaultValue={formData.items}
          onPersist={(items) => {
            const newFormData = { ...formData, items };

            setFormData(newFormData);
            saveAction(newFormData);
          }}
          VariablePicker={WorkflowVariablePicker}
        />
        <Select
          dropdownId="select-iterator-continue-on-failure"
          label="On iteration failure"
          fullWidth
          value={formData.shouldContinueOnIterationFailure ? 'continue' : 'stop'}
          options={[
            { label: 'Stop the workflow', value: 'stop' },
            { label: 'Continue with next item', value: 'continue' },
          ]}
          onChange={(value) => {
            const newFormData = {
              ...formData,
              shouldContinueOnIterationFailure: value === 'continue',
            };

            setFormData(newFormData);
            saveAction(newFormData);
          }}
          disabled={actionOptions.readonly}
        />
      </WorkflowStepBody>
    </>
  );
};
