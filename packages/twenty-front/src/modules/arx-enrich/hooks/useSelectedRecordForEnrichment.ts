import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { mainContextStoreComponentInstanceIdState } from '@/context-store/states/mainContextStoreComponentInstanceId';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useLocation, useParams } from 'react-router-dom';
import { useRecoilValue } from 'recoil';

export const useSelectedRecordForEnrichment = () => {
  // Get URL params - for chat/job pages
  const { candidateId } = useParams<{ candidateId: string }>();
  const location = useLocation();
  const isChatsPage = location.pathname.includes('/chats') || location.pathname.includes('/job/');

  // For record index pages
  const mainContextStoreComponentInstanceId = useRecoilValue(
    mainContextStoreComponentInstanceIdState,
  );

  const contextStoreTargetedRecordsRule = useRecoilComponentValueV2(
    contextStoreTargetedRecordsRuleComponentState,
    mainContextStoreComponentInstanceId,
  );

  // First try to get from URL params (for chats/job pages), then from the contextStore (for record index)
  const selectedRecordId = isChatsPage && candidateId
    ? candidateId
    : (contextStoreTargetedRecordsRule.mode === 'selection' && 
       contextStoreTargetedRecordsRule.selectedRecordIds.length > 0)
      ? contextStoreTargetedRecordsRule.selectedRecordIds[0]
      : '0';

  return {
    selectedRecordId,
    hasSelectedRecord: selectedRecordId !== '0',
    isChatsPage,
  };
}; 