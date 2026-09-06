import { searchResultsState } from '@/candidate-search/states/searchResultsState';
import { tableStateAtom } from '@/candidate-table/states/states';
import { MAIN_CONTEXT_STORE_INSTANCE_ID } from '@/context-store/constants/MainContextStoreInstanceId';
import { contextStoreCurrentObjectMetadataItemIdComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemIdComponentState';
import { contextStoreCurrentPageTypeComponentState } from '@/context-store/states/contextStoreCurrentPageTypeComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useUpsertRecordsInStore } from '@/object-record/record-store/hooks/useUpsertRecordsInStore';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { useEffect } from 'react';
import { ContextStorePageType } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

// HotTable selection uses a project-scoped context store instance. Side panel /
// Cmd+K always read MAIN, and CMI filters need selectedRecords from the record
// store (noneDefined(selectedRecords, "deletedAt")) — HotTable never loads via
// the CRM record index path, so we bridge both gaps here.
export const HotTableContextStoreEffect = ({
  tableId,
}: {
  tableId: string;
}) => {
  const { objectMetadataItems } = useObjectMetadataItems();
  const { upsertRecordsInStore } = useUpsertRecordsInStore();
  const tableState = useAtomStateValue(tableStateAtom);
  const searchResults = useAtomStateValue(searchResultsState);

  const contextStoreTargetedRecordsRule = useAtomComponentStateValue(
    contextStoreTargetedRecordsRuleComponentState,
    tableId,
  );
  const contextStoreNumberOfSelectedRecords = useAtomComponentStateValue(
    contextStoreNumberOfSelectedRecordsComponentState,
    tableId,
  );

  // Project-scoped HotTable instance
  const setTableContextStoreCurrentObjectMetadataItemId =
    useSetAtomComponentState(
      contextStoreCurrentObjectMetadataItemIdComponentState,
      tableId,
    );
  const setTableContextStoreCurrentPageType = useSetAtomComponentState(
    contextStoreCurrentPageTypeComponentState,
    tableId,
  );

  // MAIN instance (side panel / Cmd+K)
  const setContextStoreTargetedRecordsRule = useSetAtomComponentState(
    contextStoreTargetedRecordsRuleComponentState,
    MAIN_CONTEXT_STORE_INSTANCE_ID,
  );
  const setContextStoreNumberOfSelectedRecords = useSetAtomComponentState(
    contextStoreNumberOfSelectedRecordsComponentState,
    MAIN_CONTEXT_STORE_INSTANCE_ID,
  );
  const setContextStoreCurrentObjectMetadataItemId = useSetAtomComponentState(
    contextStoreCurrentObjectMetadataItemIdComponentState,
    MAIN_CONTEXT_STORE_INSTANCE_ID,
  );
  const setContextStoreCurrentPageType = useSetAtomComponentState(
    contextStoreCurrentPageTypeComponentState,
    MAIN_CONTEXT_STORE_INSTANCE_ID,
  );

  const candidateObjectMetadataItem = objectMetadataItems.find(
    (objectMetadataItem) => objectMetadataItem.nameSingular === 'candidate',
  );

  useEffect(() => {
    if (!isDefined(candidateObjectMetadataItem)) {
      return;
    }

    setTableContextStoreCurrentObjectMetadataItemId(
      candidateObjectMetadataItem.id,
    );
    setTableContextStoreCurrentPageType(ContextStorePageType.Index);
    setContextStoreCurrentObjectMetadataItemId(candidateObjectMetadataItem.id);
    setContextStoreCurrentPageType(ContextStorePageType.Index);

    return () => {
      setTableContextStoreCurrentObjectMetadataItemId(undefined);
      setTableContextStoreCurrentPageType(null);
      setContextStoreCurrentObjectMetadataItemId(undefined);
      setContextStoreCurrentPageType(null);
      setContextStoreNumberOfSelectedRecords(0);
      setContextStoreTargetedRecordsRule({
        mode: 'selection',
        selectedRecordIds: [],
      });
    };
  }, [
    candidateObjectMetadataItem,
    setContextStoreCurrentObjectMetadataItemId,
    setContextStoreCurrentPageType,
    setContextStoreNumberOfSelectedRecords,
    setContextStoreTargetedRecordsRule,
    setTableContextStoreCurrentObjectMetadataItemId,
    setTableContextStoreCurrentPageType,
  ]);

  // Keep MAIN in sync so side panel / Cmd+K see HotTable selection live
  useEffect(() => {
    setContextStoreTargetedRecordsRule(contextStoreTargetedRecordsRule);
    setContextStoreNumberOfSelectedRecords(contextStoreNumberOfSelectedRecords);
  }, [
    contextStoreNumberOfSelectedRecords,
    contextStoreTargetedRecordsRule,
    setContextStoreNumberOfSelectedRecords,
    setContextStoreTargetedRecordsRule,
  ]);

  // Seed record store so noneDefined(selectedRecords, "deletedAt") can pass
  useEffect(() => {
    const selectedRecordIds =
      contextStoreTargetedRecordsRule.mode === 'selection'
        ? contextStoreTargetedRecordsRule.selectedRecordIds
        : [];

    if (selectedRecordIds.length === 0) {
      return;
    }

    const selectedIdsSet = new Set(selectedRecordIds);
    const candidatesById = new Map<string, ObjectRecord>();

    for (const candidate of tableState.rawData) {
      if (isDefined(candidate?.id) && selectedIdsSet.has(candidate.id)) {
        candidatesById.set(candidate.id, {
          ...candidate,
          __typename: 'Candidate',
          deletedAt: null,
        } as ObjectRecord);
      }
    }

    for (const candidate of searchResults) {
      const candidateId = candidate?.id;
      const candidateTempId = candidate?.tempId;

      if (isDefined(candidateId) && selectedIdsSet.has(candidateId)) {
        candidatesById.set(candidateId, {
          ...candidate,
          id: candidateId,
          __typename: 'Candidate',
          deletedAt: null,
        } as ObjectRecord);
      } else if (
        isDefined(candidateTempId) &&
        selectedIdsSet.has(candidateTempId)
      ) {
        candidatesById.set(candidateTempId, {
          ...candidate,
          id: candidateTempId,
          __typename: 'Candidate',
          deletedAt: null,
        } as ObjectRecord);
      }
    }

    // Fallback stubs for IDs not found in HotTable/search data
    for (const selectedRecordId of selectedRecordIds) {
      if (!candidatesById.has(selectedRecordId)) {
        candidatesById.set(selectedRecordId, {
          id: selectedRecordId,
          __typename: 'Candidate',
          deletedAt: null,
        });
      }
    }

    upsertRecordsInStore({
      partialRecords: Array.from(candidatesById.values()),
    });
  }, [
    searchResults,
    tableState.rawData,
    contextStoreTargetedRecordsRule,
    upsertRecordsInStore,
  ]);

  return null;
};
