import styled from '@emotion/styled';
import { useCallback, useEffect, useMemo } from 'react';
import { useRecoilCallback, useSetRecoilState } from 'recoil';

import { ActionMenuComponentInstanceContext } from '@/action-menu/states/contexts/ActionMenuComponentInstanceContext';
import { getActionMenuIdFromRecordIndexId } from '@/action-menu/utils/getActionMenuIdFromRecordIndexId';
import { contextStoreCurrentObjectMetadataItemComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemComponentState';
import { contextStoreCurrentViewIdComponentState } from '@/context-store/states/contextStoreCurrentViewIdComponentState';
import { contextStoreCurrentViewTypeComponentState } from '@/context-store/states/contextStoreCurrentViewTypeComponentState';
import { ContextStoreComponentInstanceContext } from '@/context-store/states/contexts/ContextStoreComponentInstanceContext';
import { ContextStoreViewType } from '@/context-store/types/ContextStoreViewType';
import { useMergedJobsAndCandidates } from '@/custom-layouts/hooks/useMergedJobsAndCandidates';
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

// Create a merged metadata object that combines Job and Candidate fields
const mergedObjectMetadata = {
  __typename: 'ObjectMetadataItem',
  id: 'candidate',
  dataSourceId: 'f2c6b48d-3a82-4a06-9c0b-0524edc2c831',
  nameSingular: 'candidate',
  namePlural: 'candidates',
  labelSingular: 'Candidate',
  labelPlural: 'Candidates',
  description: 'Combined view of Jobs and Candidates',
  icon: 'IconBriefcase',
  isCustom: true,
  isRemote: false,
  isActive: true,
  isSystem: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  labelIdentifierFieldMetadataId: '479f59bf-d665-4f93-b940-67fda0c76ee2',
  imageIdentifierFieldMetadataId: null,
  fields: [
    {
      __typename: 'Field',
      id: '0aebd4fa-cc94-4ddb-ba95-556748f3c795',
      type: 'TEXT' as FieldMetadataType,
      name: 'id',
      label: 'ID',
      description: 'Unique identifier',
      icon: 'IconId',
      isCustom: true,
      isActive: true,
      isSystem: false,
      isNullable: false,
      isUnique: true,
      defaultValue: null,
      options: null,
      settings: null,
      isLabelSyncedWithName: false,
      relationDefinition: null,
    },
    {
      __typename: 'Field',
      id: 'cf7e0c9d-3b3b-4cbe-9a78-09e5c0d8c702',
      type: 'TEXT' as FieldMetadataType,
      name: 'candidateId',
      label: 'Candidate ID',
      description: 'ID of the candidate',
      icon: 'IconId',
      isCustom: true,
      isActive: true,
      isSystem: false,
      isNullable: false,
      isUnique: false,
      defaultValue: null,
      options: null,
      settings: null,
      isLabelSyncedWithName: false,
      relationDefinition: null,
    },
    {
      __typename: 'Field',
      id: '479f59bf-d665-4f93-b940-67fda0c76ee2',
      type: 'TEXT' as FieldMetadataType,
      name: 'candidateName',
      label: 'Candidate Name',
      description: 'Name of the candidate',
      icon: 'IconUser',
      isCustom: true,
      isActive: true,
      isSystem: false,
      isNullable: false,
      isUnique: false,
      defaultValue: null,
      options: null,
      settings: null,
      isLabelSyncedWithName: false,
      relationDefinition: null,
    },
    {
      __typename: 'Field',
      id: '2ee13729-0c0d-4a27-83e4-16ba2395bab7',
      type: 'TEXT' as FieldMetadataType,
      name: 'candidateEmail',
      label: 'Email',
      description: 'Email of the candidate',
      icon: 'IconMail',
      isCustom: true,
      isActive: true,
      isSystem: false,
      isNullable: true,
      isUnique: false,
      defaultValue: null,
      options: null,
      settings: null,
      isLabelSyncedWithName: false,
      relationDefinition: null,
    },
    {
      __typename: 'Field',
      id: '155c920f-e9e8-4fbf-a7cb-44746ab0364c',
      type: 'TEXT' as FieldMetadataType,
      name: 'candidatePhone',
      label: 'Phone',
      description: 'Phone number of the candidate',
      icon: 'IconPhone',
      isCustom: true,
      isActive: true,
      isSystem: false,
      isNullable: true,
      isUnique: false,
      defaultValue: null,
      options: null,
      settings: null,
      isLabelSyncedWithName: false,
      relationDefinition: null,
    },
    {
      __typename: 'Field',
      id: '537f9c59-dd1f-4f2c-941c-0720e2afe5b7',
      type: 'TEXT' as FieldMetadataType,
      name: 'candidateStatus',
      label: 'Status',
      description: 'Candidate status',
      icon: 'IconStatusChange',
      isCustom: true,
      isActive: true,
      isSystem: false,
      isNullable: true,
      isUnique: false,
      defaultValue: null,
      options: null,
      settings: null,
      isLabelSyncedWithName: false,
      relationDefinition: null,
    },
    {
      __typename: 'Field',
      id: '6adc4785-5384-40c7-9934-e04cfb67c9f4',
      type: 'NUMBER' as FieldMetadataType,
      name: 'chatCount',
      label: 'Chat Count',
      description: 'Number of chats with candidate',
      icon: 'IconMessageNumber',
      isCustom: true,
      isActive: true,
      isSystem: false,
      isNullable: true,
      isUnique: false,
      defaultValue: null,
      options: null,
      settings: null,
      isLabelSyncedWithName: false,
      relationDefinition: null,
    },
    {
      __typename: 'Field',
      id: 'a74f6206-6c54-4360-bbbe-c3fe1c7d8167',
      type: 'TEXT' as FieldMetadataType,
      name: 'jobId',
      label: 'Job ID',
      description: 'ID of the job',
      icon: 'IconId',
      isCustom: true,
      isActive: true,
      isSystem: false,
      isNullable: true,
      isUnique: false,
      defaultValue: null,
      options: null,
      settings: null,
      isLabelSyncedWithName: false,
      relationDefinition: null,
    },
    {
      __typename: 'Field',
      id: 'e513bef3-ddf1-4117-88fb-f7cc4b8e98af',
      type: 'TEXT' as FieldMetadataType,
      name: 'jobName',
      label: 'Job Title',
      description: 'Name of the job',
      icon: 'IconBriefcase',
      isCustom: true,
      isActive: true,
      isSystem: false,
      isNullable: true,
      isUnique: false,
      defaultValue: null,
      options: null,
      settings: null,
      isLabelSyncedWithName: false,
      relationDefinition: null,
    },
    {
      __typename: 'Field',
      id: 'bd6104d7-ea69-4924-8f83-7f81853da996',
      type: 'TEXT' as FieldMetadataType,
      name: 'jobLocation',
      label: 'Job Location',
      description: 'Location of the job',
      icon: 'IconMapPin',
      isCustom: true,
      isActive: true,
      isSystem: false,
      isNullable: true,
      isUnique: false,
      defaultValue: null,
      options: null,
      settings: null,
      isLabelSyncedWithName: false,
      relationDefinition: null,
    },
    {
      __typename: 'Field',
      id: '8356458f-f25b-407f-ae48-c3ca58776c26',
      type: 'TEXT' as FieldMetadataType,
      name: 'jobCode',
      label: 'Job Code',
      description: 'Code of the job',
      icon: 'IconBarcode',
      isCustom: true,
      isActive: true,
      isSystem: false,
      isNullable: true,
      isUnique: false,
      defaultValue: null,
      options: null,
      settings: null,
      isLabelSyncedWithName: false,
      relationDefinition: null,
    },
    {
      __typename: 'Field',
      id: '9f0d32c1-76f8-4093-8c0e-2643f3f167e9',
      type: 'TEXT' as FieldMetadataType,
      name: 'jobActive',
      label: 'Job Status',
      description: 'Active status of the job',
      icon: 'IconCircleCheck',
      isCustom: true,
      isActive: true,
      isSystem: false,
      isNullable: true,
      isUnique: false,
      defaultValue: null,
      options: null,
      settings: null,
      isLabelSyncedWithName: false,
      relationDefinition: null,
    },
    {
      __typename: 'Field',
      id: '14a58ed7-7690-45a2-972c-8901a124d11f',
      type: 'TEXT' as FieldMetadataType,
      name: 'companyName',
      label: 'Company',
      description: 'Company name',
      icon: 'IconBuilding',
      isCustom: true,
      isActive: true,
      isSystem: false,
      isNullable: true,
      isUnique: false,
      defaultValue: null,
      options: null,
      settings: null,
      isLabelSyncedWithName: false,
      relationDefinition: null,
    },
    {
      __typename: 'Field',
      id: 'b8d12f5e-9c45-4b6d-8a1c-789c6e38c52f',
      type: 'TEXT' as FieldMetadataType,
      name: 'currentCtc',
      label: 'Current CTC',
      description: 'Current CTC of the candidate',
      icon: 'IconCurrencyRupee',
      isCustom: true,
      isActive: true,
      isSystem: false,
      isNullable: true,
      isUnique: false,
      defaultValue: null,
      options: null,
      settings: null,
      isLabelSyncedWithName: false,
      relationDefinition: null,
    },
    {
      __typename: 'Field',
      id: '51420608-6347-4076-8d8e-6d7dd4a3f85e',
      type: 'TEXT' as FieldMetadataType,
      name: 'jobActive',
      label: 'Job Status',
      description: 'Active status of the job',
      icon: 'IconCircleCheck',
      isCustom: true,
      isActive: true,
      isSystem: false,
      isNullable: true,
      isUnique: false,
      defaultValue: null,
      options: null,
      settings: null,
      isLabelSyncedWithName: false,
      relationDefinition: null,
    },
  ],
  indexMetadatas: [], // Add any necessary indexes
} as unknown as ObjectMetadataItem;

// Main component
const CustomLayoutMerged = () => {
  const recordIndexId = 'candidates-' + 'f7bf6f2c-e730-4b71-81d6-fc8424a3c365';
  const { loading, error, data: mergedData } = useMergedJobsAndCandidates();

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

  const contextStoreCurrentViewId = 'f7bf6f2c-e730-4b71-81d6-fc8424a3c365';

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
    objectMetadataItem: mergedObjectMetadata,
    recordIndexId,
  });

  // Set the field definitions for the record table columns
  const setFieldDefinitions = useSetRecoilState(
    recordIndexFieldDefinitionsState,
  );

  // Set the view type to Table
  const setRecordIndexViewType = useSetRecoilState(recordIndexViewTypeState);

  // Define column definitions for both states
  const columnDefinitions = useMemo(
    () => [
      {
        fieldId: 'candidate-name',
        fieldMetadataId: '479f59bf-d665-4f93-b940-67fda0c76ee2',
        label: 'Candidate Name',
        type: 'TEXT' as FieldMetadataType,
        iconName: 'IconUser',
        size: 180,
        position: 0,
        isVisible: true,
        metadata: {
          fieldName: 'candidateName',
          fieldId: '479f59bf-d665-4f93-b940-67fda0c76ee2',
          type: 'TEXT' as FieldMetadataType,
        },
      },
      {
        fieldId: 'candidate-email',
        fieldMetadataId: '2ee13729-0c0d-4a27-83e4-16ba2395bab7',
        label: 'Email',
        type: 'TEXT' as FieldMetadataType,
        iconName: 'IconMail',
        size: 180,
        position: 1,
        isVisible: true,
        metadata: {
          fieldName: 'candidateEmail',
          fieldId: '2ee13729-0c0d-4a27-83e4-16ba2395bab7',
          type: 'TEXT' as FieldMetadataType,
        },
      },
      {
        fieldId: 'candidate-phone',
        fieldMetadataId: '155c920f-e9e8-4fbf-a7cb-44746ab0364c',
        label: 'Phone',
        type: 'TEXT' as FieldMetadataType,
        iconName: 'IconPhone',
        size: 150,
        position: 2,
        isVisible: true,
        metadata: {
          fieldName: 'candidatePhone',
          fieldId: '155c920f-e9e8-4fbf-a7cb-44746ab0364c',
          type: 'TEXT' as FieldMetadataType,
        },
      },
      {
        fieldId: 'candidate-status',
        fieldMetadataId: '537f9c59-dd1f-4f2c-941c-0720e2afe5b7',
        label: 'Status',
        type: 'TEXT' as FieldMetadataType,
        iconName: 'IconStatusChange',
        size: 120,
        position: 3,
        isVisible: true,
        metadata: {
          fieldName: 'candidateStatus',
          fieldId: '537f9c59-dd1f-4f2c-941c-0720e2afe5b7',
          type: 'TEXT' as FieldMetadataType,
        },
      },
      {
        fieldId: 'chat-count',
        fieldMetadataId: '6adc4785-5384-40c7-9934-e04cfb67c9f4',
        label: 'Chat Count',
        type: 'NUMBER' as FieldMetadataType,
        iconName: 'IconMessageNumber',
        size: 100,
        position: 4,
        isVisible: true,
        metadata: {
          fieldName: 'chatCount',
          fieldId: '6adc4785-5384-40c7-9934-e04cfb67c9f4',
          type: 'NUMBER' as FieldMetadataType,
        },
      },
      {
        fieldId: 'job-name',
        fieldMetadataId: 'e513bef3-ddf1-4117-88fb-f7cc4b8e98af',
        label: 'Job Title',
        type: 'TEXT' as FieldMetadataType,
        iconName: 'IconBriefcase',
        size: 180,
        position: 5,
        isVisible: true,
        metadata: {
          fieldName: 'jobName',
          fieldId: 'e513bef3-ddf1-4117-88fb-f7cc4b8e98af',
          type: 'TEXT' as FieldMetadataType,
        },
      },
      {
        fieldId: 'current-ctc',
        fieldMetadataId: 'b8d12f5e-9c45-4b6d-8a1c-789c6e38c52f',
        label: 'Current CTC',
        type: 'TEXT' as FieldMetadataType,
        iconName: 'IconCurrencyRupee',
        size: 150,
        position: 10,
        isVisible: true,
        metadata: {
          fieldName: 'currentCtc',
          fieldId: 'b8d12f5e-9c45-4b6d-8a1c-789c6e38c52f',
          type: 'TEXT' as FieldMetadataType,
        },
      },
      {
        fieldId: 'job-location',
        fieldMetadataId: 'bd6104d7-ea69-4924-8f83-7f81853da996',
        label: 'Job Location',
        type: 'TEXT' as FieldMetadataType,
        iconName: 'IconMapPin',
        size: 180,
        position: 6,
        isVisible: true,
        metadata: {
          fieldName: 'jobLocation',
          fieldId: 'bd6104d7-ea69-4924-8f83-7f81853da996',
          type: 'TEXT' as FieldMetadataType,
        },
      },
      {
        fieldId: 'job-code',
        fieldMetadataId: '8356458f-f25b-407f-ae48-c3ca58776c26',
        label: 'Job Code',
        type: 'TEXT' as FieldMetadataType,
        iconName: 'IconBarcode',
        size: 120,
        position: 7,
        isVisible: true,
        metadata: {
          fieldName: 'jobCode',
          fieldId: '8356458f-f25b-407f-ae48-c3ca58776c26',
          type: 'TEXT' as FieldMetadataType,
        },
      },
      {
        fieldId: 'job-active',
        fieldMetadataId: '51420608-6347-4076-8d8e-6d7dd4a3f85e',
        label: 'Job Status',
        type: 'TEXT' as FieldMetadataType,
        iconName: 'IconCircleCheck',
        size: 120,
        position: 8,
        isVisible: true,
        metadata: {
          fieldName: 'jobActive',
          fieldId: '51420608-6347-4076-8d8e-6d7dd4a3f85e',
          type: 'TEXT' as FieldMetadataType,
        },
      },
      {
        fieldId: 'company-name',
        fieldMetadataId: '14a58ed7-7690-45a2-972c-8901a124d11f',
        label: 'Company',
        type: 'TEXT' as FieldMetadataType,
        iconName: 'IconBuilding',
        size: 150,
        position: 9,
        isVisible: true,
        metadata: {
          fieldName: 'companyName',
          fieldId: '14a58ed7-7690-45a2-972c-8901a124d11f',
          type: 'TEXT' as FieldMetadataType,
        },
      },

      {
        fieldId: 'candidate-id',
        fieldMetadataId: 'cf7e0c9d-3b3b-4cbe-9a78-09e5c0d8c702',
        label: 'Candidate ID',
        type: 'TEXT' as FieldMetadataType,
        iconName: 'IconId',
        size: 180,
        position: 11,
        isVisible: true,
        metadata: {
          fieldName: 'candidateId',
          fieldId: 'cf7e0c9d-3b3b-4cbe-9a78-09e5c0d8c702',
          type: 'TEXT' as FieldMetadataType,
        },
      },
      {
        fieldId: 'job-id',
        fieldMetadataId: 'a74f6206-6c54-4360-bbbe-c3fe1c7d8167',
        label: 'Job ID',
        type: 'TEXT' as FieldMetadataType,
        iconName: 'IconId',
        size: 180,
        position: 12,
        isVisible: true,
        metadata: {
          fieldName: 'jobId',
          fieldId: 'a74f6206-6c54-4360-bbbe-c3fe1c7d8167',
          type: 'TEXT' as FieldMetadataType,
        },
      },
    ],
    [],
  );

  // Define the onColumnsChange callback
  const onColumnsChange = useCallback(
    (columns: ColumnDefinition<FieldMetadata>[]) => {
      setFieldDefinitions(columns);
    },
    [setFieldDefinitions],
  );

  // Initialize fields and setup data
  useEffect(() => {
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
