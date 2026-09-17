import { isBulkRecordsManualTrigger } from '@/command-menu-item/record/utils/isBulkRecordsManualTrigger';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { type WorkflowTrigger } from '@/workflow/types/Workflow';
import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import {
  type CommandMenuItemAvailabilityType,
  CommandMenuItemAvailabilityType as CommandMenuItemAvailabilityTypeEnum,
} from '~/generated-metadata/graphql';

// Outreach People rows keep person/working-set id as `id`; Candidate Sequencer
// and other candidate MANUAL workflows need the CRM candidate id.
const toCandidateWorkflowPayload = (
  selectedRecord: ObjectRecord,
): Record<string, unknown> | null => {
  if (selectedRecord.isOutreachHomeRow !== true) {
    return selectedRecord;
  }

  const candidateId = selectedRecord.candidateId;

  if (!isNonEmptyString(candidateId)) {
    return null;
  }

  return {
    ...selectedRecord,
    id: candidateId,
  };
};

export const buildTriggerWorkflowVersionPayloads = ({
  trigger,
  availabilityType,
  availabilityObjectMetadataId,
  objectMetadataItems,
  selectedRecords,
}: {
  trigger: WorkflowTrigger | null;
  availabilityType: CommandMenuItemAvailabilityType;
  availabilityObjectMetadataId?: string | null;
  objectMetadataItems: EnrichedObjectMetadataItem[];
  selectedRecords: ObjectRecord[];
}): Record<string, any>[] => {
  const payloads: Record<string, any>[] = [];

  switch (availabilityType) {
    case CommandMenuItemAvailabilityTypeEnum.RECORD_SELECTION: {
      if (selectedRecords.length === 0) {
        return payloads;
      }

      const objectMetadataItem = objectMetadataItems.find(
        (metadata) => metadata.id === availabilityObjectMetadataId,
      );

      const remappedRecords = selectedRecords
        .map(toCandidateWorkflowPayload)
        .filter((record): record is Record<string, unknown> =>
          isDefined(record),
        );

      if (isDefined(trigger) && isBulkRecordsManualTrigger(trigger)) {
        if (isDefined(objectMetadataItem) && remappedRecords.length > 0) {
          payloads.push({
            [objectMetadataItem.namePlural]: remappedRecords,
          });
        }

        return payloads;
      }

      for (const remappedRecord of remappedRecords) {
        payloads.push(remappedRecord);
      }

      return payloads;
    }
    case CommandMenuItemAvailabilityTypeEnum.GLOBAL:
    case CommandMenuItemAvailabilityTypeEnum.GLOBAL_OBJECT_CONTEXT:
    case CommandMenuItemAvailabilityTypeEnum.FALLBACK: {
      return payloads;
    }
    default: {
      return payloads;
    }
  }
};
