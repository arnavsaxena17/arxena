import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { BACKEND_BATCH_REQUEST_MAX_COUNT } from '@/object-record/constants/BackendBatchRequestMaxCount';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useSendToWhatsapp } from '@/object-record/hooks/useSendToWhatsapp';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared';

export const useSendToWhatsappAction: ActionHookWithObjectMetadataItem = ({ objectMetadataItem }) => { 
    
  
  const contextStoreNumberOfSelectedRecords = useRecoilComponentValueV2(
    contextStoreNumberOfSelectedRecordsComponentState,
  );
  
  const contextStoreTargetedRecordsRule = useRecoilComponentValueV2(
      contextStoreTargetedRecordsRuleComponentState,
    );
    
    const contextStoreFilters = useRecoilComponentValueV2(
      contextStoreFiltersComponentState,
    );
    
    const { filterValueDependencies } = useFilterValueDependencies();
    
    const graphqlFilter = computeContextStoreFilters(
      contextStoreTargetedRecordsRule,
      contextStoreFilters,
      objectMetadataItem,
      filterValueDependencies,
    );
    
    const { fetchAllRecords: fetchAllRecordIds } = useLazyFetchAllRecords({
      objectNameSingular: objectMetadataItem.nameSingular,
      filter: graphqlFilter,
      limit: DEFAULT_QUERY_PAGE_SIZE,
      recordGqlFields: { id: true },
    });

    const isRemoteObject = objectMetadataItem.isRemote;
    const shouldBeRegistered =
    !isRemoteObject &&
    isDefined(contextStoreNumberOfSelectedRecords) &&
    contextStoreNumberOfSelectedRecords < BACKEND_BATCH_REQUEST_MAX_COUNT &&
    contextStoreNumberOfSelectedRecords > 0;
    
    const [isWhatsappMessageModalOpen, setIsWhatsappMessageModalOpen] = useState(false);
    const { sendToWhatsapp } = useSendToWhatsapp();

    console.log("The objectMetadataItem is::", objectMetadataItem);
    const handleSendToWhatsappClick = useCallback(async () => {
      const recordsToSendToWhatsapp = await fetchAllRecordIds();
      const recordIdsToSendToWhatsapp: string[] = recordsToSendToWhatsapp.map((record) => record.id);
      console.log("Records selected::", recordsToSendToWhatsapp, "Record IDs selected::", recordIdsToSendToWhatsapp);
      await sendToWhatsapp(recordIdsToSendToWhatsapp);
    }, [sendToWhatsapp, fetchAllRecordIds]);

    const onClick = () => {
      if (!shouldBeRegistered) {
      return;
      }
      setIsWhatsappMessageModalOpen(true);
    };

    const confirmationModal = (
      <ConfirmationModal
      isOpen={isWhatsappMessageModalOpen}
      setIsOpen={setIsWhatsappMessageModalOpen}
      title={'Send to WhatsApp Chrome Ext.'}
      subtitle={`Are you sure you want to send contacts to WhatsApp Chrome Extension?`}
      onConfirmClick={handleSendToWhatsappClick}
      deleteButtonText={'Send to WhatsApp Chrome Extension'}
      confirmButtonAccent='blue'
      />
    );

    return {
      shouldBeRegistered,
      onClick,
      ConfirmationModal: confirmationModal,
    };
  };
