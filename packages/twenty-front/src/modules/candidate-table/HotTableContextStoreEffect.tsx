import { contextStoreCurrentObjectMetadataItemIdComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemIdComponentState';
import { contextStoreCurrentPageTypeComponentState } from '@/context-store/states/contextStoreCurrentPageTypeComponentState';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { useEffect } from 'react';
import { ContextStorePageType } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

// HotTable selection uses a project-scoped context store instance; point it at
// the candidate object so command-menu-item filters/actions resolve correctly.
export const HotTableContextStoreEffect = ({
  tableId,
}: {
  tableId: string;
}) => {
  const { objectMetadataItems } = useObjectMetadataItems();
  const setContextStoreCurrentObjectMetadataItemId =
    useSetAtomComponentState(
      contextStoreCurrentObjectMetadataItemIdComponentState,
      tableId,
    );
  const setContextStoreCurrentPageType = useSetAtomComponentState(
    contextStoreCurrentPageTypeComponentState,
    tableId,
  );

  const candidateObjectMetadataItem = objectMetadataItems.find(
    (objectMetadataItem) => objectMetadataItem.nameSingular === 'candidate',
  );

  useEffect(() => {
    if (!isDefined(candidateObjectMetadataItem)) {
      return;
    }

    setContextStoreCurrentObjectMetadataItemId(candidateObjectMetadataItem.id);
    setContextStoreCurrentPageType(ContextStorePageType.Index);
  }, [
    candidateObjectMetadataItem,
    setContextStoreCurrentObjectMetadataItemId,
    setContextStoreCurrentPageType,
  ]);

  return null;
};
