import { isNonEmptyString } from '@sniptt/guards';

import { isGtmProjectName } from '@/gtm-home/constants/gtm-command.constants';
import { type GtmProjectRecord } from '@/gtm-home/types/gtm-home.types';

export const isGtmProject = (project: GtmProjectRecord): boolean =>
  isNonEmptyString(project.outreachWorkflowId) ||
  isNonEmptyString(project.icpSpec) ||
  isGtmProjectName(project.name);
