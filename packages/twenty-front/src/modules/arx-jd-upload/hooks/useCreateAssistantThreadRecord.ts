import { useCallback } from 'react';
import { v4 } from 'uuid';

import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { generateCreateOneRecordMutation } from '@/object-metadata/utils/generateCreateOneRecordMutation';
import { useObjectPermissions } from '@/object-record/hooks/useObjectPermissions';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { getCreateOneRecordMutationResponseField } from '@/object-record/utils/getCreateOneRecordMutationResponseField';
import { getRecordFromRecordNode } from '@/object-record/cache/utils/getRecordFromRecordNode';
import { sanitizeRecordInput } from '@/object-record/utils/sanitizeRecordInput';
import { isDefined } from 'twenty-shared/utils';

// Call-time create so Upload JD can mount when Assistant app / assistantThread
// metadata is not installed (useCreateOneRecord throws on missing metadata).
export const useCreateAssistantThreadRecord = () => {
  const apolloCoreClient = useApolloCoreClient();
  const { objectMetadataItems } = useObjectMetadataItems();
  const { objectPermissionsByObjectMetadataId } = useObjectPermissions();

  const createOneAssistantThreadRecord = useCallback(
    async (recordInput: Partial<ObjectRecord>) => {
      const objectMetadataItem = objectMetadataItems.find(
        (item) => item.nameSingular === 'assistantThread',
      );

      if (!isDefined(objectMetadataItem)) {
        throw new Error(
          'Assistant app is not installed. Install it from Settings → Applications to save search threads.',
        );
      }

      const idForCreation =
        typeof recordInput.id === 'string' && recordInput.id.length > 0
          ? recordInput.id
          : v4();

      const sanitizedInput = {
        ...sanitizeRecordInput({
          objectMetadataItem,
          recordInput,
        }),
        id: idForCreation,
      };

      const createOneRecordMutation = generateCreateOneRecordMutation({
        objectMetadataItem,
        objectMetadataItems,
        objectPermissionsByObjectMetadataId,
      });

      const mutationResponseField =
        getCreateOneRecordMutationResponseField('assistantThread');

      const createdObject = await apolloCoreClient.mutate<{
        [key: string]: ObjectRecord;
      }>({
        mutation: createOneRecordMutation,
        variables: {
          input: sanitizedInput,
        },
      });

      const createdRecord = createdObject.data?.[mutationResponseField];

      if (!isDefined(createdRecord)) {
        throw new Error('Failed to create assistant thread');
      }

      return getRecordFromRecordNode({
        recordNode: createdRecord,
      });
    },
    [
      apolloCoreClient,
      objectMetadataItems,
      objectPermissionsByObjectMetadataId,
    ],
  );

  return { createOneAssistantThreadRecord };
};
