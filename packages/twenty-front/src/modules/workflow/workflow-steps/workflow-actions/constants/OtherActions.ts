import { IconArrowsSplit2, IconRotateClockwise2, IconClock } from 'twenty-ui';
import { IconSend, IconCode, IconFilter, IconRobot } from 'twenty-ui/icons';
import { WorkflowStepType } from '@/workflow/types/Workflow';

export const OTHER_ACTIONS: Array<{
  label: string;
  type: WorkflowStepType;
  icon: string;
}> = [
  {
    label: 'Send Email',
    type: 'SEND_EMAIL',
    icon: 'IconSend',
  },
  {
    label: 'Code',
    type: 'CODE',
    icon: 'IconCode',
  },
  {
    label: 'Filter',
    type: 'FILTER',
    icon: 'IconFilter',
  },
  {
    label: 'If/Else',
    type: 'IF_ELSE',
    icon: 'IconArrowsSplit2',
  },
  {
    label: 'Iterator',
    type: 'ITERATOR',
    icon: 'IconRotateClockwise2',
  },
  {
    label: 'AI Agent',
    type: 'AI_AGENT',
    icon: 'IconRobot',
  },
  {
    label: 'Delay',
    type: 'DELAY',
    icon: 'IconClock',
  },
];
