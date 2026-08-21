import { isBaseOutputSchemaV2 } from '@/workflow/workflow-variables/types/guards/isBaseOutputSchemaV2';
import { isRecordOutputSchemaV2 } from '@/workflow/workflow-variables/types/guards/isRecordOutputSchemaV2';
import {
  type OutputSchemaV2,
  type StepOutputSchemaV2,
} from '@/workflow/workflow-variables/types/StepOutputSchemaV2';
import { getCurrentSubStepFromPath } from '@/workflow/workflow-variables/utils/getCurrentSubStepFromPath';
import { isDefined } from 'twenty-shared/utils';
import { parseVariablePath } from 'twenty-shared/workflow';

const stripVariableBraces = (stepOutputKey: string) =>
  stepOutputKey.replace(/^\{\{|\}\}$/g, '');

const longestMatchingRecordFieldKey = ({
  fields,
  remainingSegments,
}: {
  fields: Record<string, unknown>;
  remainingSegments: string[];
}): string | undefined => {
  for (let length = remainingSegments.length; length >= 1; length -= 1) {
    const candidate = remainingSegments.slice(0, length).join('.');

    if (isDefined(fields[candidate])) {
      return candidate;
    }
  }

  return undefined;
};

const walkPathMatchingPrefixedRecordKeys = ({
  outputSchema,
  remainingSegments,
}: {
  outputSchema: OutputSchemaV2;
  remainingSegments: string[];
}): string[] => {
  const path: string[] = [];
  let current: OutputSchemaV2 | undefined = outputSchema;
  let index = 0;

  while (index < remainingSegments.length && isDefined(current)) {
    if (isRecordOutputSchemaV2(current)) {
      const matchedKey = longestMatchingRecordFieldKey({
        fields: current.fields,
        remainingSegments: remainingSegments.slice(index),
      });

      if (!isDefined(matchedKey)) {
        break;
      }

      path.push(matchedKey);
      current = current.fields[matchedKey]?.value;
      index += matchedKey.split('.').length;
      continue;
    }

    if (isBaseOutputSchemaV2(current)) {
      const key = remainingSegments[index];

      if (!isDefined(current[key])) {
        break;
      }

      path.push(key);
      current = current[key]?.value;
      index += 1;
      continue;
    }

    break;
  }

  if (path.length === 0 || index < remainingSegments.length) {
    return [];
  }

  return path.slice(0, -1);
};

export const getFilterFieldPickerInitialPath = ({
  step,
  stepOutputKey,
}: {
  step: StepOutputSchemaV2;
  stepOutputKey: string;
}): string[] => {
  const inner = stripVariableBraces(stepOutputKey);

  if (!inner) {
    return [];
  }

  const segments = parseVariablePath(inner);

  if (segments[0] !== step.id || segments.length < 2) {
    return [];
  }

  const walkedPath = walkPathMatchingPrefixedRecordKeys({
    outputSchema: step.outputSchema,
    remainingSegments: segments.slice(1),
  });

  if (
    walkedPath.length > 0 &&
    !isDefined(getCurrentSubStepFromPath(step, walkedPath))
  ) {
    return [];
  }

  return walkedPath;
};
