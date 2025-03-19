import { contextStoreCurrentObjectMetadataItemComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemComponentState';
import { contextStoreCurrentViewIdComponentState } from '@/context-store/states/contextStoreCurrentViewIdComponentState';
import { ContextStoreComponentInstanceContext } from '@/context-store/states/contexts/ContextStoreComponentInstanceContext';
import { RecordIndexContainerGater } from '@/object-record/record-index/components/RecordIndexContainerGater';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { isNonEmptyString, isUndefined } from '@sniptt/guards';

export const RecordIndexPage = () => {
  const contextStoreCurrentViewId = useRecoilComponentValueV2(
    contextStoreCurrentViewIdComponentState,
    'main-context-store',
  );
  console.log(
    'contextStoreCurrentViewIdComponentState',
    contextStoreCurrentViewIdComponentState,
  );
  console.log('contextStoreCurrentViewId', contextStoreCurrentViewId);

  const objectMetadataItem = useRecoilComponentValueV2(
    contextStoreCurrentObjectMetadataItemComponentState,
    'main-context-store',
  );
  console.log(
    'contextStoreCurrentObjectMetadataItemComponentState',
    contextStoreCurrentObjectMetadataItemComponentState,
  );
  console.log('objectMetadataItem', objectMetadataItem);

  if (
    isUndefined(objectMetadataItem) ||
    !isNonEmptyString(contextStoreCurrentViewId)
  ) {
    return null;
  }

  return (
    <PageContainer>
      <ContextStoreComponentInstanceContext.Provider
        value={{
          instanceId: 'main-context-store',
        }}
      >
        <RecordIndexContainerGater />
      </ContextStoreComponentInstanceContext.Provider>
    </PageContainer>
  );
};
