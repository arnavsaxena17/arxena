import { isNonEmptyString } from '@sniptt/guards';
import {
  OUTREACH_DRAFT_VARIABLES,
  extractOutreachDraftTemplateVariableKeys,
  renderOutreachDraftTemplate,
  type OutreachDraftTemplateValues,
} from 'twenty-shared/arx';
import { isDefined } from 'twenty-shared/utils';
import { type WorkflowEmailFiles } from 'twenty-shared/workflow';

import { type OutreachPersonRow } from '@/outreach-home/types/outreach-home.types';
import { type OutreachDraftSettings } from '@/outreach-home/utils/outreach-draft-templates-api';

// Shared by the Setup preview and its project-wide warnings so both read the
// same values the send-time render will resolve.

export const buildOutreachDraftPreviewValues = ({
  settings,
  person,
}: {
  settings: OutreachDraftSettings;
  person: OutreachPersonRow | undefined;
}): OutreachDraftTemplateValues => {
  const values: OutreachDraftTemplateValues = {};

  for (const variable of OUTREACH_DRAFT_VARIABLES) {
    values[variable.key] = variable.sampleValue;
  }

  // The sender is the real signed-in member; a blank value must surface as missing.
  values['sender.name'] = settings.senderName;
  values['sender.website'] = settings.senderWebsite;

  if (isDefined(person)) {
    const fullName = person.name.trim();

    values['person.firstName'] = fullName.split(/\s+/)[0] ?? '';
    values['person.fullName'] = fullName;
    values['company.name'] = person.companyName.trim();
  }

  return values;
};

export const renderOutreachDraftPreview = (
  template: string,
  values: OutreachDraftTemplateValues,
): string => {
  const valuesWithMarkers: OutreachDraftTemplateValues = {};

  for (const variable of OUTREACH_DRAFT_VARIABLES) {
    const value = values[variable.key];

    valuesWithMarkers[variable.key] = isNonEmptyString(value?.trim())
      ? value
      : `[${variable.label} missing]`;
  }

  return renderOutreachDraftTemplate(template, valuesWithMarkers).message;
};

// Emptiness is whatever the send-time render calls missing, so these counts
// match the runs that stop before sending.
const isVariableEmptyForValues = ({
  variableKey,
  values,
}: {
  variableKey: string;
  values: OutreachDraftTemplateValues;
}): boolean => {
  const probe: OutreachDraftTemplateValues = {};

  probe[variableKey as keyof OutreachDraftTemplateValues] =
    values[variableKey as keyof OutreachDraftTemplateValues];

  return (
    renderOutreachDraftTemplate(`{{${variableKey}}}`, probe).missingVariableKeys
      .length > 0
  );
};

export type OutreachDraftVariableCoverageGap = {
  variableKey: string;
  label: string;
  missingCount: number;
};

// Validating against the preview person says nothing about the other prospects:
// one of them missing a field stops that run at send time.
export const buildOutreachDraftVariableCoverage = ({
  template,
  people,
  settings,
}: {
  template: string;
  people: OutreachPersonRow[];
  settings: OutreachDraftSettings;
}): OutreachDraftVariableCoverageGap[] => {
  const referencedKeys = extractOutreachDraftTemplateVariableKeys(
    template,
  ).filter((key) =>
    OUTREACH_DRAFT_VARIABLES.some((variable) => variable.key === key),
  );

  if (referencedKeys.length === 0 || people.length === 0) {
    return [];
  }

  const missingCountByKey = new Map<string, number>(
    referencedKeys.map((key) => [key, 0]),
  );

  for (const person of people) {
    const values = buildOutreachDraftPreviewValues({ settings, person });

    for (const key of referencedKeys) {
      if (isVariableEmptyForValues({ variableKey: key, values })) {
        missingCountByKey.set(key, (missingCountByKey.get(key) ?? 0) + 1);
      }
    }
  }

  return referencedKeys.flatMap((key) => {
    const missingCount = missingCountByKey.get(key) ?? 0;

    if (missingCount === 0) {
      return [];
    }

    return [
      {
        variableKey: key,
        label:
          OUTREACH_DRAFT_VARIABLES.find((variable) => variable.key === key)
            ?.label ?? key,
        missingCount,
      },
    ];
  });
};

export const getOutreachDraftAttachmentFileNames = (
  files: WorkflowEmailFiles,
): string[] =>
  files.map((file) => (typeof file === 'string' ? file : file.name));
