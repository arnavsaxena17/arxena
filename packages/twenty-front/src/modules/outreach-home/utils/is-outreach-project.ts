import { isNonEmptyString } from '@sniptt/guards';
import {
  parseOutreachConfig,
  resolveOutreachConfigIcpSpecString,
} from 'twenty-shared/arx';
import { isDefined } from 'twenty-shared/utils';

import { isOutreachProjectName } from '@/outreach-home/constants/outreach-command.constants';
import { type OutreachProjectRecord } from '@/outreach-home/types/outreach-home.types';

// Outreach campaigns are identified by outreachConfig (defaulted on create),
// not by a fixed name prefix. Name / ICP / workflowId remain legacy fallbacks.
export const isOutreachProject = (
  project: OutreachProjectRecord,
): boolean =>
  isDefined(parseOutreachConfig(project.outreachConfig)) ||
  isNonEmptyString(project.outreachWorkflowId) ||
  isNonEmptyString(
    resolveOutreachConfigIcpSpecString(project.outreachConfig, project.icpSpec),
  ) ||
  isOutreachProjectName(project.name);
