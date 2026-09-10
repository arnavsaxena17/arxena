import { FormDateTimeFieldInput } from '@/object-record/record-field/ui/form-types/components/FormDateTimeFieldInput';
import { FormNumberFieldInput } from '@/object-record/record-field/ui/form-types/components/FormNumberFieldInput';
import { Select } from '@/ui/input/components/Select';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';
import { type WorkflowDelayAction } from '@/workflow/types/Workflow';
import { WorkflowStepBody } from '@/workflow/workflow-steps/components/WorkflowStepBody';
import { WorkflowStepFooter } from '@/workflow/workflow-steps/components/WorkflowStepFooter';
import { WorkflowVariablePicker } from '@/workflow/workflow-variables/components/WorkflowVariablePicker';
import { t } from '@lingui/core/macro';
import { useEffect, useState } from 'react';
import { IconCalendar, IconClock, IconHourglassHigh } from 'twenty-ui/icon';
import { type SelectOption } from 'twenty-ui/input';
import { HorizontalSeparator } from 'twenty-ui/layout';

type WorkflowDelayDurationFields = {
  days?: number | string;
  hours?: number | string;
  minutes?: number | string;
  seconds?: number | string;
};

type WorkflowDelayType = 'SCHEDULED_DATE' | 'DURATION' | 'RANDOM_DURATION';

type WorkflowEditActionDelayProps = {
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

export const WorkflowEditActionDelay = ({
  action,
  actionOptions,
}: WorkflowEditActionDelayProps) => {
  const [localDuration, setLocalDuration] =
    useState<WorkflowDelayDurationFields>(() => ({
      days: action.settings.input.duration?.days,
      hours: action.settings.input.duration?.hours,
      minutes: action.settings.input.duration?.minutes,
      seconds: action.settings.input.duration?.seconds,
    }));
  const [localMinDuration, setLocalMinDuration] =
    useState<WorkflowDelayDurationFields>(() => ({
      days: action.settings.input.minDuration?.days,
      hours: action.settings.input.minDuration?.hours,
      minutes: action.settings.input.minDuration?.minutes,
      seconds: action.settings.input.minDuration?.seconds,
    }));
  const [localMaxDuration, setLocalMaxDuration] =
    useState<WorkflowDelayDurationFields>(() => ({
      days: action.settings.input.maxDuration?.days,
      hours: action.settings.input.maxDuration?.hours,
      minutes: action.settings.input.maxDuration?.minutes,
      seconds: action.settings.input.maxDuration?.seconds,
    }));

  useEffect(() => {
    if (action.settings.input.delayType === 'DURATION') {
      setLocalDuration({
        days: action.settings.input.duration?.days,
        hours: action.settings.input.duration?.hours,
        minutes: action.settings.input.duration?.minutes,
        seconds: action.settings.input.duration?.seconds,
      });

      return;
    }

    setLocalDuration({
      days: undefined,
      hours: undefined,
      minutes: undefined,
      seconds: undefined,
    });
  }, [
    action.settings.input.delayType,
    action.settings.input.duration?.days,
    action.settings.input.duration?.hours,
    action.settings.input.duration?.minutes,
    action.settings.input.duration?.seconds,
  ]);

  useEffect(() => {
    if (action.settings.input.delayType === 'RANDOM_DURATION') {
      setLocalMinDuration({
        days: action.settings.input.minDuration?.days,
        hours: action.settings.input.minDuration?.hours,
        minutes: action.settings.input.minDuration?.minutes,
        seconds: action.settings.input.minDuration?.seconds,
      });
      setLocalMaxDuration({
        days: action.settings.input.maxDuration?.days,
        hours: action.settings.input.maxDuration?.hours,
        minutes: action.settings.input.maxDuration?.minutes,
        seconds: action.settings.input.maxDuration?.seconds,
      });

      return;
    }

    setLocalMinDuration({
      days: undefined,
      hours: undefined,
      minutes: undefined,
      seconds: undefined,
    });
    setLocalMaxDuration({
      days: undefined,
      hours: undefined,
      minutes: undefined,
      seconds: undefined,
    });
  }, [
    action.settings.input.delayType,
    action.settings.input.minDuration?.days,
    action.settings.input.minDuration?.hours,
    action.settings.input.minDuration?.minutes,
    action.settings.input.minDuration?.seconds,
    action.settings.input.maxDuration?.days,
    action.settings.input.maxDuration?.hours,
    action.settings.input.maxDuration?.minutes,
    action.settings.input.maxDuration?.seconds,
  ]);

  const delayOptions: Array<SelectOption<WorkflowDelayType>> = [
    {
      label: t`At a specific date or time`,
      value: 'SCHEDULED_DATE',
      Icon: IconCalendar,
    },
    {
      label: t`After a set amount of time`,
      value: 'DURATION',
      Icon: IconHourglassHigh,
    },
    {
      label: t`After a random amount of time`,
      value: 'RANDOM_DURATION',
      Icon: IconClock,
    },
  ];

  const handleDelayTypeChange = (newDelayType: WorkflowDelayType) => {
    if (
      actionOptions.readonly === true ||
      newDelayType === action.settings.input.delayType
    ) {
      return;
    }

    if (newDelayType === 'SCHEDULED_DATE') {
      actionOptions.onActionUpdate({
        ...action,
        settings: {
          ...action.settings,
          input: {
            delayType: 'SCHEDULED_DATE',
          },
        },
      });

      return;
    }

    if (newDelayType === 'DURATION') {
      actionOptions.onActionUpdate({
        ...action,
        settings: {
          ...action.settings,
          input: {
            delayType: 'DURATION',
            duration: undefined,
          },
        },
      });

      return;
    }

    actionOptions.onActionUpdate({
      ...action,
      settings: {
        ...action.settings,
        input: {
          delayType: 'RANDOM_DURATION',
          minDuration: undefined,
          maxDuration: undefined,
        },
      },
    });
  };

  const handleDateTimeChange = (value: string | null) => {
    if (actionOptions.readonly === true) {
      return;
    }

    actionOptions.onActionUpdate({
      ...action,
      settings: {
        ...action.settings,
        input: {
          delayType: 'SCHEDULED_DATE',
          scheduledDateTime: value ?? '',
        },
      },
    });
  };

  const handleDurationDraftChange = (
    field: keyof WorkflowDelayDurationFields,
    value: number | string | null,
  ) => {
    if (actionOptions.readonly === true) {
      return;
    }

    setLocalDuration((previousDuration) => ({
      ...previousDuration,
      [field]: value ?? undefined,
    }));
  };

  const handleDurationCommit = () => {
    if (actionOptions.readonly === true) {
      return;
    }

    actionOptions.onActionUpdate({
      ...action,
      settings: {
        ...action.settings,
        input: {
          delayType: 'DURATION',
          duration: {
            days: localDuration.days,
            hours: localDuration.hours,
            minutes: localDuration.minutes,
            seconds: localDuration.seconds,
          },
        },
      },
    });
  };

  const handleRandomDurationDraftChange = (
    bound: 'min' | 'max',
    field: keyof WorkflowDelayDurationFields,
    value: number | string | null,
  ) => {
    if (actionOptions.readonly === true) {
      return;
    }

    const setLocalBoundDuration =
      bound === 'min' ? setLocalMinDuration : setLocalMaxDuration;

    setLocalBoundDuration((previousDuration) => ({
      ...previousDuration,
      [field]: value ?? undefined,
    }));
  };

  const handleRandomDurationCommit = () => {
    if (actionOptions.readonly === true) {
      return;
    }

    actionOptions.onActionUpdate({
      ...action,
      settings: {
        ...action.settings,
        input: {
          delayType: 'RANDOM_DURATION',
          minDuration: {
            days: localMinDuration.days,
            hours: localMinDuration.hours,
            minutes: localMinDuration.minutes,
            seconds: localMinDuration.seconds,
          },
          maxDuration: {
            days: localMaxDuration.days,
            hours: localMaxDuration.hours,
            minutes: localMaxDuration.minutes,
            seconds: localMaxDuration.seconds,
          },
        },
      },
    });
  };

  return (
    <>
      <WorkflowStepBody>
        <Select
          dropdownId="workflow-edit-action-delay-type"
          label={t`Resume`}
          options={delayOptions}
          dropdownWidth={GenericDropdownContentWidth.Large}
          value={action.settings.input.delayType}
          onChange={handleDelayTypeChange}
          disabled={actionOptions.readonly}
        />
        <HorizontalSeparator noMargin />

        {action.settings.input.delayType === 'SCHEDULED_DATE' && (
          <FormDateTimeFieldInput
            label={t`Delay until date`}
            defaultValue={action.settings.input.scheduledDateTime ?? undefined}
            onChange={handleDateTimeChange}
            readonly={actionOptions.readonly}
            VariablePicker={WorkflowVariablePicker}
            placeholder={t`Select a date`}
          />
        )}
        {action.settings.input.delayType === 'DURATION' && (
          <>
            <FormNumberFieldInput
              label={t`Days`}
              defaultValue={localDuration.days}
              onChange={(value) => handleDurationDraftChange('days', value)}
              onBlur={handleDurationCommit}
              readonly={actionOptions.readonly}
              VariablePicker={WorkflowVariablePicker}
              placeholder={t`0`}
            />
            <FormNumberFieldInput
              label={t`Hours`}
              defaultValue={localDuration.hours}
              onChange={(value) => handleDurationDraftChange('hours', value)}
              onBlur={handleDurationCommit}
              readonly={actionOptions.readonly}
              VariablePicker={WorkflowVariablePicker}
              placeholder={t`0`}
            />
            <FormNumberFieldInput
              label={t`Minutes`}
              defaultValue={localDuration.minutes}
              onChange={(value) => handleDurationDraftChange('minutes', value)}
              onBlur={handleDurationCommit}
              readonly={actionOptions.readonly}
              VariablePicker={WorkflowVariablePicker}
              placeholder={t`0`}
            />
            <FormNumberFieldInput
              label={t`Seconds`}
              defaultValue={localDuration.seconds}
              onChange={(value) => handleDurationDraftChange('seconds', value)}
              onBlur={handleDurationCommit}
              readonly={actionOptions.readonly}
              VariablePicker={WorkflowVariablePicker}
              placeholder={t`0`}
            />
          </>
        )}
        {action.settings.input.delayType === 'RANDOM_DURATION' && (
          <>
            <FormNumberFieldInput
              label={t`Minimum days`}
              defaultValue={localMinDuration.days}
              onChange={(value) =>
                handleRandomDurationDraftChange('min', 'days', value)
              }
              onBlur={handleRandomDurationCommit}
              readonly={actionOptions.readonly}
              VariablePicker={WorkflowVariablePicker}
              placeholder={t`0`}
            />
            <FormNumberFieldInput
              label={t`Minimum hours`}
              defaultValue={localMinDuration.hours}
              onChange={(value) =>
                handleRandomDurationDraftChange('min', 'hours', value)
              }
              onBlur={handleRandomDurationCommit}
              readonly={actionOptions.readonly}
              VariablePicker={WorkflowVariablePicker}
              placeholder={t`0`}
            />
            <FormNumberFieldInput
              label={t`Minimum minutes`}
              defaultValue={localMinDuration.minutes}
              onChange={(value) =>
                handleRandomDurationDraftChange('min', 'minutes', value)
              }
              onBlur={handleRandomDurationCommit}
              readonly={actionOptions.readonly}
              VariablePicker={WorkflowVariablePicker}
              placeholder={t`0`}
            />
            <FormNumberFieldInput
              label={t`Minimum seconds`}
              defaultValue={localMinDuration.seconds}
              onChange={(value) =>
                handleRandomDurationDraftChange('min', 'seconds', value)
              }
              onBlur={handleRandomDurationCommit}
              readonly={actionOptions.readonly}
              VariablePicker={WorkflowVariablePicker}
              placeholder={t`0`}
            />
            <HorizontalSeparator noMargin />
            <FormNumberFieldInput
              label={t`Maximum days`}
              defaultValue={localMaxDuration.days}
              onChange={(value) =>
                handleRandomDurationDraftChange('max', 'days', value)
              }
              onBlur={handleRandomDurationCommit}
              readonly={actionOptions.readonly}
              VariablePicker={WorkflowVariablePicker}
              placeholder={t`0`}
            />
            <FormNumberFieldInput
              label={t`Maximum hours`}
              defaultValue={localMaxDuration.hours}
              onChange={(value) =>
                handleRandomDurationDraftChange('max', 'hours', value)
              }
              onBlur={handleRandomDurationCommit}
              readonly={actionOptions.readonly}
              VariablePicker={WorkflowVariablePicker}
              placeholder={t`0`}
            />
            <FormNumberFieldInput
              label={t`Maximum minutes`}
              defaultValue={localMaxDuration.minutes}
              onChange={(value) =>
                handleRandomDurationDraftChange('max', 'minutes', value)
              }
              onBlur={handleRandomDurationCommit}
              readonly={actionOptions.readonly}
              VariablePicker={WorkflowVariablePicker}
              placeholder={t`0`}
            />
            <FormNumberFieldInput
              label={t`Maximum seconds`}
              defaultValue={localMaxDuration.seconds}
              onChange={(value) =>
                handleRandomDurationDraftChange('max', 'seconds', value)
              }
              onBlur={handleRandomDurationCommit}
              readonly={actionOptions.readonly}
              VariablePicker={WorkflowVariablePicker}
              placeholder={t`0`}
            />
          </>
        )}
      </WorkflowStepBody>

      <WorkflowStepFooter stepId={action.id} />
    </>
  );
};
