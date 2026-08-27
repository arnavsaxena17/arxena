import { isDefined, isPlainObject, isValidUuid } from 'twenty-shared/utils';

import {
  type WorkflowTrigger,
  WorkflowTriggerType,
} from 'src/modules/workflow/workflow-trigger/types/workflow-trigger.type';

const MAX_RECORD_LABEL_LENGTH = 80;

export type WorkflowRunTriggerRecord = {
  recordId: string;
  objectNameSingular: string;
  recordLabel?: string;
};

const trimToUndefined = (value: string): string | undefined => {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

const truncateRecordLabel = (label: string): string => {
  if (label.length <= MAX_RECORD_LABEL_LENGTH) {
    return label;
  }

  return label.slice(0, MAX_RECORD_LABEL_LENGTH).trimEnd();
};

const extractRecordLabel = (
  record: Record<string, unknown>,
): string | undefined => {
  const name = record.name;

  if (typeof name === 'string') {
    const trimmedName = trimToUndefined(name);

    if (isDefined(trimmedName)) {
      return truncateRecordLabel(trimmedName);
    }
  }

  if (isPlainObject(name)) {
    const firstName =
      typeof name.firstName === 'string' ? name.firstName.trim() : '';
    const lastName =
      typeof name.lastName === 'string' ? name.lastName.trim() : '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ');

    if (fullName.length > 0) {
      return truncateRecordLabel(fullName);
    }
  }

  for (const key of ['title', 'subject', 'displayName'] as const) {
    const value = record[key];

    if (typeof value === 'string') {
      const trimmed = trimToUndefined(value);

      if (isDefined(trimmed)) {
        return truncateRecordLabel(trimmed);
      }
    }
  }

  return undefined;
};

const readUuid = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !isValidUuid(value)) {
    return undefined;
  }

  return value;
};

const readObjectNameSingular = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  return trimToUndefined(value);
};

const extractRecordFromValue = (
  value: unknown,
): { recordId: string; recordLabel?: string } | undefined => {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const recordId = readUuid(value.id) ?? readUuid(value.recordId);

  if (!isDefined(recordId)) {
    return undefined;
  }

  return {
    recordId,
    recordLabel: extractRecordLabel(value),
  };
};

const extractDatabaseEventRecord = (
  triggerPayload: object,
): { recordId: string; recordLabel?: string } | undefined => {
  if (!isPlainObject(triggerPayload)) {
    return undefined;
  }

  const properties = isPlainObject(triggerPayload.properties)
    ? triggerPayload.properties
    : undefined;
  const recordFromProperties =
    extractRecordFromValue(properties?.after) ??
    extractRecordFromValue(properties?.before);
  const recordId =
    readUuid(triggerPayload.recordId) ?? recordFromProperties?.recordId;

  if (!isDefined(recordId)) {
    return undefined;
  }

  return {
    recordId,
    recordLabel: recordFromProperties?.recordLabel,
  };
};

const extractManualRecord = (
  triggerPayload: object,
): { recordId: string; recordLabel?: string } | undefined => {
  const unwrappedPayload =
    isPlainObject(triggerPayload) && isPlainObject(triggerPayload.payload)
      ? triggerPayload.payload
      : triggerPayload;

  return extractRecordFromValue(unwrappedPayload);
};

const getDatabaseEventObjectNameSingular = (
  trigger: WorkflowTrigger,
): string | undefined => {
  if (trigger.type !== WorkflowTriggerType.DATABASE_EVENT) {
    return undefined;
  }

  const eventName = trigger.settings.eventName;

  if (typeof eventName !== 'string' || eventName.length === 0) {
    return undefined;
  }

  return readObjectNameSingular(eventName.split('.')[0]);
};

const getManualObjectNameSingular = (
  trigger: WorkflowTrigger,
): string | undefined => {
  if (trigger.type !== WorkflowTriggerType.MANUAL) {
    return undefined;
  }

  const availability = trigger.settings.availability;

  if (
    isPlainObject(availability) &&
    (availability.type === 'SINGLE_RECORD' ||
      availability.type === 'BULK_RECORDS')
  ) {
    if (availability.type === 'BULK_RECORDS') {
      return undefined;
    }

    return readObjectNameSingular(availability.objectNameSingular);
  }

  return readObjectNameSingular(trigger.settings.objectType);
};

export const extractWorkflowRunTriggerRecord = ({
  trigger,
  triggerPayload,
}: {
  trigger?: WorkflowTrigger | null;
  triggerPayload: object;
}): WorkflowRunTriggerRecord | undefined => {
  if (!isDefined(trigger)) {
    return undefined;
  }

  if (trigger.type === WorkflowTriggerType.DATABASE_EVENT) {
    const objectNameSingular = getDatabaseEventObjectNameSingular(trigger);
    const record = extractDatabaseEventRecord(triggerPayload);

    if (!isDefined(objectNameSingular) || !isDefined(record)) {
      return undefined;
    }

    return {
      ...record,
      objectNameSingular,
    };
  }

  if (trigger.type === WorkflowTriggerType.MANUAL) {
    const objectNameSingular = getManualObjectNameSingular(trigger);
    const record = extractManualRecord(triggerPayload);

    if (!isDefined(objectNameSingular) || !isDefined(record)) {
      return undefined;
    }

    return {
      ...record,
      objectNameSingular,
    };
  }

  return undefined;
};

export const buildWorkflowRunName = ({
  runNumber,
  workflowName,
  recordLabel,
}: {
  runNumber: number;
  workflowName: string;
  recordLabel?: string;
}): string => {
  const workflowPart = trimToUndefined(workflowName) ?? 'Workflow';

  if (isDefined(recordLabel) && recordLabel.length > 0) {
    return `#${runNumber} - ${recordLabel} · ${workflowPart}`;
  }

  return `#${runNumber} - ${workflowPart}`;
};
