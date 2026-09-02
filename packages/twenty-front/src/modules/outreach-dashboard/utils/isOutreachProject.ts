import { isNonEmptyString } from '@sniptt/guards';
import { resolveOutreachConfigIcpSpecString } from 'twenty-shared/arx';

import { isOutreachProjectName } from '@/outreach-home/constants/outreach-command.constants';
import { type OutreachProjectRecord } from '@/outreach-home/types/outreach-home.types';

export const isOutreachProject = (project: OutreachProjectRecord): boolean =>
  isNonEmptyString(project.outreachWorkflowId) ||
  isNonEmptyString(
    resolveOutreachConfigIcpSpecString(project.outreachConfig, project.icpSpec),
  ) ||
  isOutreachProjectName(project.name);
