import styled from '@emotion/styled';
import { useEffect } from 'react';
import { useRecoilCallback } from 'recoil';

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
import { RecordIndexContainer } from '@/object-record/record-index/components/RecordIndexContainer';
import { RecordIndexContainerContextStoreNumberOfSelectedRecordsEffect } from '@/object-record/record-index/components/RecordIndexContainerContextStoreNumberOfSelectedRecordsEffect';
import { RecordIndexLoadBaseOnContextStoreEffect } from '@/object-record/record-index/components/RecordIndexLoadBaseOnContextStoreEffect';
import { RecordIndexPageHeader } from '@/object-record/record-index/components/RecordIndexPageHeader';
import { RecordIndexContextProvider } from '@/object-record/record-index/contexts/RecordIndexContext';
import { useHandleIndexIdentifierClick } from '@/object-record/record-index/hooks/useHandleIndexIdentifierClick';
import { RecordSortsComponentInstanceContext } from '@/object-record/record-sort/states/context/RecordSortsComponentInstanceContext';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import { PageTitle } from '@/video-interview/interview-response/StyledComponentsInterviewResponse';
import { ViewComponentInstanceContext } from '@/views/states/contexts/ViewComponentInstanceContext';
import { isNonEmptyString, isUndefined } from '@sniptt/guards';
import { FieldMetadataType } from 'twenty-shared';

const StyledIndexContainer = styled.div`
  display: flex;
  height: 100%;
  width: 100%;
`;

// Create a merged metadata object that combines Job and Candidate fields
const mergedObjectMetadata = {
  __typename: 'ObjectMetadataItem',
  id: 'merged-view',
  dataSourceId: 'f2c6b48d-3a82-4a06-9c0b-0524edc2c831', // Use the same dataSourceId as other objects
  nameSingular: 'mergedView',
  namePlural: 'mergedViews',
  labelSingular: 'Merged View',
  labelPlural: 'Merged Views',
  description: 'Combined view of Jobs and Candidates',
  icon: 'IconUsers',
  isCustom: true,
  isRemote: false,
  isActive: true,
  isSystem: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  labelIdentifierFieldMetadataId: 'job-name', // Use one of your field IDs
  imageIdentifierFieldMetadataId: null,
  fields: [
    {
      __typename: 'Field',
      id: 'job-name',
      type: 'TEXT' as FieldMetadataType,
      name: 'jobName',
      label: 'Job Name',
      description: 'Name of the job',
      icon: 'IconBriefcase',
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
      id: 'job-location',
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
      id: 'candidate-name',
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
      id: 'candidate-status',
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
  ],
  indexMetadatas: [], // Add any necessary indexes
} as unknown as ObjectMetadataItem;

// Main component
const CustomLayoutMerged = () => {
  const recordIndexId = 'merged-' + 'unique-id-for-merged-view';
  const { data, loading } = useMergedJobsAndCandidates();

  const setContextStoreCurrentObjectMetadataItem = useSetRecoilComponentStateV2(
    contextStoreCurrentObjectMetadataItemComponentState,
    'main-context-store',
  );

  const setContextStoreCurrentViewId = useSetRecoilComponentStateV2(
    contextStoreCurrentViewIdComponentState,
    'main-context-store',
  );

  const setContextStoreCurrentViewType = useSetRecoilComponentStateV2(
    contextStoreCurrentViewTypeComponentState,
    'main-context-store',
  );

  const contextStoreCurrentViewId = 'merged-view-id';

  const currentObjectMetadataItem = useRecoilComponentValueV2(
    contextStoreCurrentObjectMetadataItemComponentState,
    'main-context-store',
  );

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

  // Initialize context store immediately
  useEffect(() => {
    setContextStoreCurrentObjectMetadataItem(mergedObjectMetadata);
    setContextStoreCurrentViewId(contextStoreCurrentViewId);
    setContextStoreCurrentViewType(ContextStoreViewType.Table);
  }, []);

  if (
    isUndefined(currentObjectMetadataItem) ||
    !isNonEmptyString(contextStoreCurrentViewId)
  ) {
    return null;
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
            <RecordFiltersComponentInstanceContext.Provider
              value={{ instanceId: recordIndexId }}
            >
              <RecordSortsComponentInstanceContext.Provider
                value={{ instanceId: recordIndexId }}
              >
                <ActionMenuComponentInstanceContext.Provider
                  value={{
                    instanceId: getActionMenuIdFromRecordIndexId(recordIndexId),
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
          </ViewComponentInstanceContext.Provider>
        </RecordIndexContextProvider>
      </ContextStoreComponentInstanceContext.Provider>
    </PageContainer>
  );
};

export default CustomLayoutMerged;
