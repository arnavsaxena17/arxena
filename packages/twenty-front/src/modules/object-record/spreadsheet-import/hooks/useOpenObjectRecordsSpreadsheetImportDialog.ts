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
  
  // Get object metadata items safely to check if the object exists
  const { objectMetadataItems } = useObjectMetadataItems();
  
  // Memoize the object metadata item to prevent unnecessary recalculations
  const objectMetadataItem = useMemo(() => {
    return objectMetadataItems.find(
      item => item.nameSingular === objectNameSingular && item.isActive
    );
  }, [objectMetadataItems, objectNameSingular]);
  
  // Memoize the error fallback function to prevent recreation on every render
  const errorFallback = useCallback(() => {
    enqueueSnackBar(
      `Cannot import records for "${objectNameSingular}". Object not found or not active. Please contact support to set up the required objects.`,
      {
        variant: SnackBarVariant.Error,
      }
    );
  }, [enqueueSnackBar, objectNameSingular]);
  
  // If object not found, log available objects and return early with safe fallback
  if (!objectMetadataItem) {
    console.warn(`Object metadata item "${objectNameSingular}" not found. Available objects:`, 
      objectMetadataItems.map(item => item.nameSingular).filter(name => name)
    );
    
    // Return a safe fallback that shows error message
    return {
      openObjectRecordsSpreasheetImportDialog: errorFallback,
    };
  }

  const { createManyRecords } = useCreateManyRecords({
    objectNameSingular,
  });

  const { buildAvailableFieldsForImport } = useBuildAvailableFieldsForImport();

  // Memoize the main dialog function to prevent recreation on every render
  const openObjectRecordsSpreasheetImportDialog = useCallback((
    options?: Omit<
      SpreadsheetImportDialogOptions<any>,
      'fields' | 'isOpen' | 'onClose'
    >,
  ) => {

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
    
    // Add candidate-specific fields if this is a candidate import (or person import for candidates)
    if (objectNameSingular === 'candidate' || objectNameSingular === 'person') {
      console.log('Adding candidate-specific fields for objectNameSingular:', objectNameSingular);
      const candidateSpecificFields = getCandidateSpecificImportFields(getIcon);
      console.log('candidateSpecificFields:', candidateSpecificFields);
      // Filter out any duplicate fields
      const existingFieldKeys = new Set(availableFields.map(field => field.key));
      console.log('existingFieldKeys:', existingFieldKeys);
      const newCandidateFields = candidateSpecificFields.filter(field => !existingFieldKeys.has(field.key));
      console.log('newCandidateFields to add:', newCandidateFields);
      availableFields = [...availableFields, ...newCandidateFields];
      console.log('Updated availableFields length:', availableFields.length);
    }
    
    console.log("availableFields", availableFields);

    openSpreadsheetImportDialog({
      ...options,
      enableUploadProgressSseWhileOpen: objectNameSingular === 'candidate',
      onSubmit: async (data) => {
        console.log("data", data);
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
        } catch (error: any) {
          enqueueSnackBar(error?.message || 'Something went wrong', {
            variant: SnackBarVariant.Error,
          });
        }
      },
      fields: availableFields,
    });
  }, [objectMetadataItem, objectNameSingular, buildAvailableFieldsForImport, getIcon, openSpreadsheetImportDialog, createManyRecords, enqueueSnackBar]);

  return {
    openObjectRecordsSpreasheetImportDialog,
  };
};
