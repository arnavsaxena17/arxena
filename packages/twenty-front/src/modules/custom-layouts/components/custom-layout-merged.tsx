import styled from '@emotion/styled';
import { useCallback, useEffect, useMemo } from 'react';
import { useRecoilCallback, useRecoilValue, useSetRecoilState } from 'recoil';

import { ActionMenuComponentInstanceContext } from '@/action-menu/states/contexts/ActionMenuComponentInstanceContext';
import { getActionMenuIdFromRecordIndexId } from '@/action-menu/utils/getActionMenuIdFromRecordIndexId';
import { contextStoreCurrentObjectMetadataItemComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemComponentState';
import { contextStoreCurrentViewIdComponentState } from '@/context-store/states/contextStoreCurrentViewIdComponentState';
import { contextStoreCurrentViewTypeComponentState } from '@/context-store/states/contextStoreCurrentViewTypeComponentState';
import { ContextStoreComponentInstanceContext } from '@/context-store/states/contexts/ContextStoreComponentInstanceContext';
import { ContextStoreViewType } from '@/context-store/types/ContextStoreViewType';
import { useMergedJobsAndCandidates } from '@/custom-layouts/hooks/useMergedJobsAndCandidates';
import { mergeObjectMetadata } from '@/custom-layouts/utils/mergeObjectMetadata';
import { useFieldMetadataItemById } from '@/object-metadata/hooks/useFieldMetadataItemById';
import { useGetFieldMetadataItemById } from '@/object-metadata/hooks/useGetFieldMetadataItemById';
import { objectMetadataItemsState } from '@/object-metadata/states/objectMetadataItemsState';
import { ObjectMetadataItem } from '@/object-metadata/types/ObjectMetadataItem';
import { lastShowPageRecordIdState } from '@/object-record/record-field/states/lastShowPageRecordId';
import { RecordFiltersComponentInstanceContext } from '@/object-record/record-filter/states/context/RecordFiltersComponentInstanceContext';
import { RecordIndexPageHeader } from '@/object-record/record-index/components/RecordIndexPageHeader';
import { RecordIndexContextProvider } from '@/object-record/record-index/contexts/RecordIndexContext';
import { useHandleIndexIdentifierClick } from '@/object-record/record-index/hooks/useHandleIndexIdentifierClick';
import { RecordSortsComponentInstanceContext } from '@/object-record/record-sort/states/context/RecordSortsComponentInstanceContext';
import { useRecordTable } from '@/object-record/record-table/hooks/useRecordTable';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import { PageTitle } from '@/video-interview/interview-response/StyledComponentsInterviewResponse';
import { ViewComponentInstanceContext } from '@/views/states/contexts/ViewComponentInstanceContext';
import { isNonEmptyString, isUndefined } from '@sniptt/guards';
import { FieldMetadataType, isDefined } from 'twenty-shared';

// Use the correct available states
import { FieldMetadata } from '@/object-record/record-field/types/FieldMetadata';
import { RecordIndexContainer } from '@/object-record/record-index/components/RecordIndexContainer';
import { RecordIndexContainerContextStoreNumberOfSelectedRecordsEffect } from '@/object-record/record-index/components/RecordIndexContainerContextStoreNumberOfSelectedRecordsEffect';
import { RecordIndexLoadBaseOnContextStoreEffect } from '@/object-record/record-index/components/RecordIndexLoadBaseOnContextStoreEffect';
import { recordIndexFieldDefinitionsState } from '@/object-record/record-index/states/recordIndexFieldDefinitionsState';
import { recordIndexViewTypeState } from '@/object-record/record-index/states/recordIndexViewTypeState';
import { useSetTableColumns } from '@/object-record/record-table/hooks/useSetTableColumns';
import { RecordTableComponentInstanceContext } from '@/object-record/record-table/states/context/RecordTableComponentInstanceContext';
import { ColumnDefinition } from '@/object-record/record-table/types/ColumnDefinition';
import { ViewType } from '@/views/types/ViewType';

const StyledIndexContainer = styled.div`
  display: flex;
  height: 100%;
  width: 100%;
`;

// Main component
const CustomLayoutMerged = () => {
  // const candidateViewID = '29f46927-c997-47b9-978f-2e4f924c6ec1';
  const candidateViewID = '36f705fc-ca20-4844-9844-dc1f048eb148';
  const jobViewID = 'a314b097-d2b6-4893-b2d9-5647391cb45e';
  
  const recordIndexId = 'candidates-' + candidateViewID;
  const { loading, error, data: mergedData } = useMergedJobsAndCandidates();

  // Fetch all object metadata items
  const objectMetadataItems = useRecoilValue(objectMetadataItemsState);
  
  // Get candidate and job metadata
  const candidateMetadata = objectMetadataItems.find(
    (item) => item.nameSingular === 'candidate',
  );
  const jobMetadata = objectMetadataItems.find(
    (item) => item.nameSingular === 'job',
  );

  // Create merged metadata using our utility function
  const mergedObjectMetadata = useMemo(() => {
    if (!candidateMetadata || !jobMetadata) {
      return null;
    }

    return mergeObjectMetadata(
      {
        __typename: 'ObjectEdge',
        node: {
          __typename: 'ObjectMetadataItem',
          ...candidateMetadata,
          dataSourceId: '907755c0-f471-4e08-a8b8-5d840c25f88b',
          fieldsList: candidateMetadata.fields,
          description: candidateMetadata.description ?? '',
          icon: candidateMetadata.icon ?? 'IconUsers',
          imageIdentifierFieldMetadataId: candidateMetadata.imageIdentifierFieldMetadataId ?? null,
        },
      },
      {
        __typename: 'ObjectEdge',
        node: {
          __typename: 'ObjectMetadataItem',
          ...jobMetadata,
          dataSourceId: '907755c0-f471-4e08-a8b8-5d840c25f88b',
          fieldsList: jobMetadata.fields,
          description: jobMetadata.description ?? '',
          icon: jobMetadata.icon ?? 'IconBriefcase',
          imageIdentifierFieldMetadataId: jobMetadata.imageIdentifierFieldMetadataId ?? null,
        },
      },
    );
  }, [candidateMetadata, jobMetadata]);
  console.log("mergedObjectMetadata::", mergedObjectMetadata)
  // Example of getting a specific field metadata
  const { fieldMetadataItem: nameFieldMetadata } = useFieldMetadataItemById(candidateViewID);
  console.log("nameFieldMetadata::", nameFieldMetadata)
  // Get the function to fetch field metadata by ID
  const { getFieldMetadataItemById } = useGetFieldMetadataItemById();

  // Example of using the getter function
  const getFieldMetadata = (fieldId: string) => {
    try {
      return getFieldMetadataItemById(fieldId);
    } catch (error) {
      console.error(`Field metadata not found for id ${fieldId}`);
      return null;
    }
  };
  console.log("getFieldMetadata::", getFieldMetadata)

  const setContextStoreCurrentObjectMetadataItem = useSetRecoilComponentStateV2(
    contextStoreCurrentObjectMetadataItemComponentState,
    'main-context-store',
  );

  const setContextStoreCurrentViewId = useSetRecoilComponentStateV2(
    contextStoreCurrentViewIdComponentState,
    'main-context-store',
  );
  const { setTableColumns } = useSetTableColumns();

  const setContextStoreCurrentViewType = useSetRecoilComponentStateV2(
    contextStoreCurrentViewTypeComponentState,
    'main-context-store',
  );

  const contextStoreCurrentViewId = candidateViewID;

  const currentObjectMetadataItem = useRecoilComponentValueV2(
    contextStoreCurrentObjectMetadataItemComponentState,
    'main-context-store',
  );

  // Get the RecordTable hook functions
  const {
    setAvailableTableColumns,
    setRecordTableData,
    setIsRecordTableInitialLoading,
    onColumnsChange: handleColumnsChange,
  } = useRecordTable({
    recordTableId: recordIndexId,
  });

  const handleIndexRecordsLoaded = useRecoilCallback(
    ({ set }) =>
      () => {
        set(lastShowPageRecordIdState, null);
      },
    [],
  );

  const { indexIdentifierUrl } = useHandleIndexIdentifierClick({
    objectMetadataItem: mergedObjectMetadata as ObjectMetadataItem,
    recordIndexId,
  });

  // Set the field definitions for the record table columns
  const setFieldDefinitions = useSetRecoilState(
    recordIndexFieldDefinitionsState,
  );

  // Set the view type to Table
  const setRecordIndexViewType = useSetRecoilState(recordIndexViewTypeState);

  // Define column definitions for both states
  const columnDefinitions = useMemo(() => {
    if (!candidateMetadata || !jobMetadata) return [];

    const candidateFields = candidateMetadata.fields?.map((field) => ({
      fieldId: field.id,
      fieldMetadataId: field.id,
      label: field.name,
      type: field.type as FieldMetadataType,
      iconName: field.icon ?? 'IconAbc',
      size: 180,
      position: 0,
      isVisible: true,
      metadata: {
        fieldName: field.name,
        fieldId: field.id,
        type: field.type as FieldMetadataType,
      },
    })) ?? [];

    const jobFields = jobMetadata.fields?.map((field) => ({
      fieldId: field.id,
      fieldMetadataId: field.id,
      label: field.name,
      type: field.type as FieldMetadataType,
      iconName: field.icon ?? 'IconAbc',
      size: 180,
      position: candidateFields.length,
      isVisible: true,
      metadata: {
        fieldName: field.name,
        fieldId: field.id,
        type: field.type as FieldMetadataType,
      },
    })) ?? [];

    return [...candidateFields, ...jobFields];
  }, [candidateMetadata, jobMetadata]);

  console.log("columnDefinitions::", columnDefinitions)
  // Define the onColumnsChange callback
  const onColumnsChange = useCallback(
    (columns: ColumnDefinition<FieldMetadata>[]) => {
      setFieldDefinitions(columns);
    },
    [setFieldDefinitions],
  );

  // Initialize fields and setup data
  useEffect(() => {
    if (!mergedObjectMetadata) {
      return;
    }

    // Set record field definitions for index
    setFieldDefinitions(columnDefinitions);

    // Set view type for the record index
    setRecordIndexViewType(ViewType.Table);

    // Set table column definitions using the hook from useRecordTable
    setAvailableTableColumns(columnDefinitions);

    // Add this to explicitly set the visible columns
    setTableColumns(columnDefinitions, recordIndexId);

    // Set initial loading state
    setIsRecordTableInitialLoading(true);

    // Initialize context store
    setContextStoreCurrentObjectMetadataItem(mergedObjectMetadata);
    setContextStoreCurrentViewId(contextStoreCurrentViewId);
    setContextStoreCurrentViewType(ContextStoreViewType.Table);
  }, [
    setFieldDefinitions,
    setRecordIndexViewType,
    setAvailableTableColumns,
    setIsRecordTableInitialLoading,
    columnDefinitions,
    setContextStoreCurrentObjectMetadataItem,
    setContextStoreCurrentViewId,
    setContextStoreCurrentViewType,
    setTableColumns,
    mergedObjectMetadata,
  ]);

  // Initialize record data when available
  useEffect(() => {
    if (mergedData && mergedData.length > 0) {
      console.log('Setting merged data:', mergedData);
      // Load the data into the table
      setRecordTableData({
        records: mergedData,
        totalCount: mergedData.length,
      });

      // After data is loaded, set initial loading to false
      setIsRecordTableInitialLoading(false);
    }
  }, [mergedData, setRecordTableData, setIsRecordTableInitialLoading]);

  // Add this line to ensure proper type safety when using error
  type FetchError = { message: string };
  const typedError = error as FetchError | undefined;

  if (
    isUndefined(currentObjectMetadataItem) ||
    !isNonEmptyString(contextStoreCurrentViewId)
  ) {
    return null;
  }

  if (loading) {
    return <div>Loading job and candidate data...</div>;
  }

  if (isDefined(typedError)) {
    return <div>Error loading data: {typedError.message}</div>;
  }

  if (!mergedObjectMetadata) {
    return <div>Error: Could not load metadata</div>;
  }

  return (
    <PageContainer>
      <ContextStoreComponentInstanceContext.Provider
        value={{ instanceId: 'main-context-store' }}
      >
        <RecordIndexContextProvider
          value={{
            recordIndexId,
            objectNamePlural: mergedObjectMetadata.namePlural,
            objectNameSingular: mergedObjectMetadata.nameSingular,
            objectMetadataItem: mergedObjectMetadata,
            onIndexRecordsLoaded: handleIndexRecordsLoaded,
            indexIdentifierUrl,
          }}
        >
          <ViewComponentInstanceContext.Provider
            value={{ instanceId: recordIndexId }}
          >
            <RecordTableComponentInstanceContext.Provider
              value={{
                instanceId: recordIndexId,
                onColumnsChange: onColumnsChange,
              }}
            >
              <RecordFiltersComponentInstanceContext.Provider
                value={{ instanceId: recordIndexId }}
              >
                <RecordSortsComponentInstanceContext.Provider
                  value={{ instanceId: recordIndexId }}
                >
                  <ActionMenuComponentInstanceContext.Provider
                    value={{
                      instanceId:
                        getActionMenuIdFromRecordIndexId(recordIndexId),
                    }}
                  >
                    <PageTitle title="Jobs & Candidates" />
                    <RecordIndexPageHeader />
                    <PageBody>
                      <StyledIndexContainer>
                        <RecordIndexContainerContextStoreNumberOfSelectedRecordsEffect />
                        <RecordIndexContainer />
                      </StyledIndexContainer>
                    </PageBody>
                    <RecordIndexLoadBaseOnContextStoreEffect />
                  </ActionMenuComponentInstanceContext.Provider>
                </RecordSortsComponentInstanceContext.Provider>
              </RecordFiltersComponentInstanceContext.Provider>
            </RecordTableComponentInstanceContext.Provider>
          </ViewComponentInstanceContext.Provider>
        </RecordIndexContextProvider>
      </ContextStoreComponentInstanceContext.Provider>
    </PageContainer>
  );
};

export default CustomLayoutMerged;