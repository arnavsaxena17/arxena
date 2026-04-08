import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useCreateManyRecords } from '@/object-record/hooks/useCreateManyRecords';
import { getCandidateSpecificImportFields } from '@/object-record/spreadsheet-import/constants/CandidateImportFields';
import { useBuildAvailableFieldsForImport } from '@/object-record/spreadsheet-import/hooks/useBuildAvailableFieldsForImport';
import { buildRecordFromImportedStructuredRow } from '@/object-record/spreadsheet-import/utils/buildRecordFromImportedStructuredRow';
import { useOpenSpreadsheetImportDialog } from '@/spreadsheet-import/hooks/useOpenSpreadsheetImportDialog';
import { SpreadsheetImportDialogOptions } from '@/spreadsheet-import/types';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useCallback, useMemo } from 'react';
import { useIcons } from 'twenty-ui';

import {
  FieldMetadataType,
  RelationDefinitionType,
} from '~/generated-metadata/graphql';

export const useOpenObjectRecordsSpreadsheetImportDialog = (
  objectNameSingular: string,
) => {
  const { openSpreadsheetImportDialog } = useOpenSpreadsheetImportDialog<any>();
  const { enqueueSnackBar } = useSnackBar();
  const { getIcon } = useIcons();

  const { objectMetadataItems } = useObjectMetadataItems();

  const objectMetadataItem = useMemo(() => {
    return objectMetadataItems.find(
      (item) =>
        item.nameSingular === objectNameSingular && item.isActive,
    );
  }, [objectMetadataItems, objectNameSingular]);

  const { createManyRecords } = useCreateManyRecords({
    objectNameSingular,
  });

  const { buildAvailableFieldsForImport } = useBuildAvailableFieldsForImport();

  const showObjectMissingSnack = useCallback(() => {
    enqueueSnackBar(
      `Cannot import records for "${objectNameSingular}". Object not found or not active. Please contact support to set up the required objects.`,
      {
        variant: SnackBarVariant.Error,
      },
    );
  }, [enqueueSnackBar, objectNameSingular]);

  const openObjectRecordsSpreasheetImportDialog = useCallback(
    (
      options?: Omit<
        SpreadsheetImportDialogOptions<any>,
        'fields' | 'isOpen' | 'onClose'
      >,
    ) => {
      if (!objectMetadataItem) {
        showObjectMissingSnack();
        return;
      }

      const availableFieldMetadataItems = objectMetadataItem.fields
        .filter(
          (fieldMetadataItem) =>
            fieldMetadataItem.isActive &&
            (!fieldMetadataItem.isSystem || fieldMetadataItem.name === 'id') &&
            fieldMetadataItem.name !== 'createdAt' &&
            (fieldMetadataItem.type !== FieldMetadataType.RELATION ||
              fieldMetadataItem.relationDefinition?.direction ===
                RelationDefinitionType.MANY_TO_ONE),
        )
        .sort((fieldMetadataItemA, fieldMetadataItemB) =>
          fieldMetadataItemA.name.localeCompare(fieldMetadataItemB.name),
        );

      let availableFields = buildAvailableFieldsForImport(
        availableFieldMetadataItems,
      );

      if (objectNameSingular === 'candidate' || objectNameSingular === 'person') {
        const candidateSpecificFields = getCandidateSpecificImportFields(getIcon);
        const existingFieldKeys = new Set(availableFields.map((field) => field.key));
        const newCandidateFields = candidateSpecificFields.filter(
          (field) => !existingFieldKeys.has(field.key),
        );
        availableFields = [...availableFields, ...newCandidateFields];
      }

      openSpreadsheetImportDialog({
        ...options,
        enableUploadProgressSseWhileOpen: objectNameSingular === 'candidate',
        onSubmit: async (data) => {
          const createInputs = data.validStructuredRows.map((record) => {
            const fieldMapping: Record<string, any> =
              buildRecordFromImportedStructuredRow({
                importedStructuredRow: record,
                fields: availableFieldMetadataItems,
              });

            return fieldMapping;
          });

          try {
            const upsert = true;
            await createManyRecords(createInputs, upsert);
          } catch (error: unknown) {
            let message = 'Something went wrong';
            if (error instanceof Error) {
              message = error.message;
            } else if (typeof error === 'string') {
              message = error;
            }
            enqueueSnackBar(message, {
              variant: SnackBarVariant.Error,
            });
          }
        },
        fields: availableFields,
      });
    },
    [
      objectMetadataItem,
      objectNameSingular,
      buildAvailableFieldsForImport,
      getIcon,
      openSpreadsheetImportDialog,
      createManyRecords,
      enqueueSnackBar,
      showObjectMissingSnack,
    ],
  );

  return {
    openObjectRecordsSpreasheetImportDialog,
  };
};
