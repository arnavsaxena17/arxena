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
import { CandidateObjectFields } from '@/custom-layouts/components/candidate-object-fields';
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
import { FieldMetadataType, capitalize } from 'twenty-shared';
import { RelationDefinitionType } from '~/generated-metadata/graphql';

const StyledIndexContainer = styled.div`
  display: flex;
  height: 100%;
  width: 100%;
`;

// Main component
const CustomLayoutCandidate = () => {
  const recordIndexId = 'candidates-' + 'f7bf6f2c-e730-4b71-81d6-fc8424a3c365';
  const objectMetadataItem = {
    __typename: 'ObjectMetadataItem',
    id: CandidateObjectFields.id,
    dataSourceId: CandidateObjectFields.dataSourceId,
    nameSingular: CandidateObjectFields.nameSingular,
    namePlural: CandidateObjectFields.namePlural,
    labelSingular: CandidateObjectFields.labelSingular,
    labelPlural: CandidateObjectFields.labelPlural,
    description: CandidateObjectFields.description,
    icon: CandidateObjectFields.icon,
    isCustom: CandidateObjectFields.isCustom,
    isRemote: CandidateObjectFields.isRemote,
    isActive: CandidateObjectFields.isActive,
    isSystem: CandidateObjectFields.isSystem,
    createdAt: CandidateObjectFields.createdAt,
    updatedAt: CandidateObjectFields.updatedAt,
    labelIdentifierFieldMetadataId:
      CandidateObjectFields.labelIdentifierFieldMetadataId,
    imageIdentifierFieldMetadataId:
      CandidateObjectFields.imageIdentifierFieldMetadataId,
    fields: CandidateObjectFields.fields.map((field) => ({
      ...field,
      type: field.type as FieldMetadataType,
      options: field.options as any,
      settings: field.settings as any,
      relationDefinition: field.relationDefinition
        ? {
            ...field.relationDefinition,
            direction: field.relationDefinition
              .direction as RelationDefinitionType,
          }
        : undefined,
    })) as any,
    indexMetadatas: CandidateObjectFields.indexMetadatas,
  } as unknown as ObjectMetadataItem;
  console.log('objectMetadataItem', objectMetadataItem);

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

  // const contextStoreCurrentViewId = useRecoilComponentValueV2(
  //   contextStoreCurrentViewIdComponentState,
  //   'main-context-store',
  // );

  const contextStoreCurrentViewId = 'f7bf6f2c-e730-4b71-81d6-fc8424a3c365';

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

  // const indexIdentifierUrl = (recordId: string) => `/candidates/${recordId}`;
  const { indexIdentifierUrl } = useHandleIndexIdentifierClick({
    objectMetadataItem,
    recordIndexId,
  });

  // Initialize context store immediately
  useEffect(() => {
    setContextStoreCurrentObjectMetadataItem(objectMetadataItem);
    setContextStoreCurrentViewId(contextStoreCurrentViewId);
    setContextStoreCurrentViewType(ContextStoreViewType.Table);
  }, []);

  if (
    isUndefined(currentObjectMetadataItem) ||
    !isNonEmptyString(contextStoreCurrentViewId)
  ) {
    return null;
  }

  console.log('currentObjectMetadataItem', currentObjectMetadataItem);

  return (
    <PageContainer>
      <ContextStoreComponentInstanceContext.Provider
        value={{ instanceId: 'main-context-store' }}
      >
        <RecordIndexContextProvider
          value={{
            recordIndexId,
            objectNamePlural: objectMetadataItem.namePlural,
            objectNameSingular: objectMetadataItem.nameSingular,
            objectMetadataItem,
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
                  <PageTitle
                    title={capitalize(objectMetadataItem.labelPlural)}
                  />
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

export default CustomLayoutCandidate;
