import { RecordIndexContextProvider } from '@/object-record/record-index/contexts/RecordIndexContext';

import { ActionMenuComponentInstanceContext } from '@/action-menu/states/contexts/ActionMenuComponentInstanceContext';
import { getActionMenuIdFromRecordIndexId } from '@/action-menu/utils/getActionMenuIdFromRecordIndexId';
import { useContextStoreObjectMetadataItemOrThrow } from '@/context-store/hooks/useContextStoreObjectMetadataItemOrThrow';
import { contextStoreCurrentViewIdComponentState } from '@/context-store/states/contextStoreCurrentViewIdComponentState';
import { mainContextStoreComponentInstanceIdState } from '@/context-store/states/mainContextStoreComponentInstanceId';
import { lastShowPageRecordIdState } from '@/object-record/record-field/states/lastShowPageRecordId';
import { RecordFiltersComponentInstanceContext } from '@/object-record/record-filter/states/context/RecordFiltersComponentInstanceContext';
import { RecordIndexContainer } from '@/object-record/record-index/components/RecordIndexContainer';
import { RecordIndexContainerContextStoreNumberOfSelectedRecordsEffect } from '@/object-record/record-index/components/RecordIndexContainerContextStoreNumberOfSelectedRecordsEffect';
import { RecordIndexLoadBaseOnContextStoreEffect } from '@/object-record/record-index/components/RecordIndexLoadBaseOnContextStoreEffect';
import { RecordIndexPageHeader } from '@/object-record/record-index/components/RecordIndexPageHeader';
import { useHandleIndexIdentifierClick } from '@/object-record/record-index/hooks/useHandleIndexIdentifierClick';
import { RecordSortsComponentInstanceContext } from '@/object-record/record-sort/states/context/RecordSortsComponentInstanceContext';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageTitle } from '@/ui/utilities/page-title/components/PageTitle';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { ViewComponentInstanceContext } from '@/views/states/contexts/ViewComponentInstanceContext';
import styled from '@emotion/styled';
import { useRecoilCallback, useRecoilValue } from 'recoil';
import { capitalize } from 'twenty-shared';

import { ArxEnrichmentModal } from '@/arx-enrich/arxEnrichmentModal';
import { isArxEnrichModalOpenState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import { ArxJDUploadModal } from '@/arx-jd-upload/components/ArxJDUploadModal';
import { isArxUploadJDModalOpenState } from '@/arx-jd-upload/states/arxUploadJDModalOpenState';
import { contextStoreCurrentObjectMetadataItemComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemComponentState';

const StyledIndexContainer = styled.div`
  display: flex;
  height: 100%;
  width: 100%;
`;

export const RecordIndexContainerGater = () => {
  const mainContextStoreComponentInstanceId = useRecoilValue(
    mainContextStoreComponentInstanceIdState,
  );
  console.log(
    'mainContextStoreComponentInstanceId',
    mainContextStoreComponentInstanceId,
  );
  console.log(
    'contextStoreCurrentViewIdComponentState',
    contextStoreCurrentViewIdComponentState,
  );

  const contextStoreCurrentViewId = useRecoilComponentValueV2(
    contextStoreCurrentViewIdComponentState,
    mainContextStoreComponentInstanceId,
  );

  console.log('contextStoreCurrentViewId', contextStoreCurrentViewId);
  console.log(
    'contextStoreCurrentObjectMetadataItemComponentState',
    contextStoreCurrentObjectMetadataItemComponentState,
  );
  console.log(
    'mainContextStoreComponentInstanceId',
    mainContextStoreComponentInstanceId,
  );

  const { objectMetadataItem } = useContextStoreObjectMetadataItemOrThrow();

  const recordIndexId = `${objectMetadataItem.namePlural}-${contextStoreCurrentViewId}`;
  const isArxEnrichModalOpen = useRecoilValue(isArxEnrichModalOpenState);

  const handleIndexRecordsLoaded = useRecoilCallback(
    ({ set }) =>
      () => {
        // TODO: find a better way to reset this state ?
        set(lastShowPageRecordIdState, null);
      },
    [],
  );
  console.log('recordIndexId::', recordIndexId);

  const { indexIdentifierUrl } = useHandleIndexIdentifierClick({
    objectMetadataItem,
    recordIndexId,
  });

  console.log('recordIndexId', recordIndexId);
  console.log('objectMetadataItem', objectMetadataItem);
  console.log('indexIdentifierUrl', indexIdentifierUrl);

  return (
    <>
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
                  title={`${capitalize(objectMetadataItem.namePlural)}`}
                />
                <RecordIndexPageHeader />
                <PageBody>
                  <StyledIndexContainer>
                    <RecordIndexContainerContextStoreNumberOfSelectedRecordsEffect />
                    <RecordIndexContainer />

                    {isArxEnrichModalOpen ? (
                      <ArxEnrichmentModal
                        objectNameSingular={
                          objectMetadataItem.namePlural === 'companies'
                            ? 'company'
                            : objectMetadataItem.namePlural.slice(0, -1)
                        }
                        objectRecordId={'0'}
                      />
                    ) : (
                      <></>
                    )}

                    {isArxUploadJDModalOpenState ? (
                      <ArxJDUploadModal
                        objectNameSingular={objectMetadataItem.nameSingular}
                        objectRecordId={'0'}
                      />
                    ) : (
                      <></>
                    )}
                  </StyledIndexContainer>
                </PageBody>
              </ActionMenuComponentInstanceContext.Provider>
            </RecordSortsComponentInstanceContext.Provider>
          </RecordFiltersComponentInstanceContext.Provider>
          <RecordIndexLoadBaseOnContextStoreEffect />
        </ViewComponentInstanceContext.Provider>
      </RecordIndexContextProvider>
    </>
  );
};
