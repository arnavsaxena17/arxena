import { IconComponent } from 'twenty-ui';
import { IconCheckbox, IconSquare } from 'twenty-ui/icons';
import { WorkflowManualTriggerAvailability } from '@/workflow/types/Workflow';

export const MANUAL_TRIGGER_AVAILABILITY_OPTIONS: Array<{
  label: string;
  value: WorkflowManualTriggerAvailability;
  Icon: IconComponent;
}> = [
  {
    label: 'When record(s) are selected',
    value: 'WHEN_RECORD_SELECTED',
    Icon: IconCheckbox,
  },
  {
    label: 'When no record(s) are selected',
    value: 'EVERYWHERE',
    Icon: IconSquare,
  },
];
