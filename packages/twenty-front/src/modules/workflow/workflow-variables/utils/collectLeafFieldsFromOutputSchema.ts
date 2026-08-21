import { isLinkOutputSchema } from '@/workflow/workflow-variables/types/guards/isLinkOutputSchema';
import { isRecordOutputSchemaV2 } from '@/workflow/workflow-variables/types/guards/isRecordOutputSchemaV2';
import { type OutputSchemaV2 } from '@/workflow/workflow-variables/types/StepOutputSchemaV2';
import { isObject } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

export type CollectedOutputField = {
  path: string[];
  label: string;
  icon?: string;
  pathLabel: string;
};

const visitField = ({
  key,
  value,
  path,
  pathLabels,
  results,
}: {
  key: string;
  value: unknown;
  path: string[];
  pathLabels: string[];
  results: CollectedOutputField[];
}) => {
  if (!isObject(value)) {
    return;
  }

  const label = typeof value.label === 'string' ? value.label : key;
  const nextPath = [...path, key];
  const nextLabels = [...pathLabels, label];

  if (value.isLeaf === true) {
    results.push({
      path: nextPath,
      label,
      icon: typeof value.icon === 'string' ? value.icon : undefined,
      pathLabel: nextLabels.join(' > '),
    });

    return;
  }

  if ('value' in value) {
    visitSchema({
      schema: value.value,
      path: nextPath,
      pathLabels: nextLabels,
      results,
    });
  }
};

const visitSchema = ({
  schema,
  path,
  pathLabels,
  results,
}: {
  schema: unknown;
  path: string[];
  pathLabels: string[];
  results: CollectedOutputField[];
}) => {
  if (!isObject(schema) || isLinkOutputSchema(schema as OutputSchemaV2)) {
    return;
  }

  if (isRecordOutputSchemaV2(schema as OutputSchemaV2)) {
    for (const [key, field] of Object.entries(schema.fields)) {
      visitField({
        key,
        value: field,
        path,
        pathLabels,
        results,
      });
    }

    return;
  }

  for (const [key, value] of Object.entries(schema)) {
    if (key.startsWith('_')) {
      continue;
    }

    visitField({
      key,
      value,
      path,
      pathLabels,
      results,
    });
  }
};

export const collectLeafFieldsFromOutputSchema = ({
  outputSchema,
  stepName,
}: {
  outputSchema: OutputSchemaV2;
  stepName: string;
}): CollectedOutputField[] => {
  if (!isDefined(outputSchema)) {
    return [];
  }

  const results: CollectedOutputField[] = [];

  visitSchema({
    schema: outputSchema,
    path: [],
    pathLabels: [stepName],
    results,
  });

  return results;
};
