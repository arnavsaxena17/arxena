import { isNonEmptyString } from '@sniptt/guards';

import { isOutreachProjectName } from '@/outreach-home/constants/outreach-command.constants';
import { type OutreachProjectRecord } from '@/outreach-home/types/outreach-home.types';

export const isOutreachProject = (project: OutreachProjectRecord): boolean =>
  isNonEmptyString(project.outreachWorkflowId) ||
  isNonEmptyString(project.icpSpec) ||
  isOutreachProjectName(project.name);
