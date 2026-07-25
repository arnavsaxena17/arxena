import { currentProjectIdState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { MAIN_CONTEXT_STORE_INSTANCE_ID } from '@/context-store/constants/MainContextStoreInstanceId';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';

export const useSelectedRecordForEnrichment = () => {
  const { candidateId } = useParams<{ candidateId: string }>();
  const location = useLocation();
  const isChatsPage =
    location.pathname.includes('/chats') ||
    location.pathname.includes('/project/');
  const setCurrentProjectId = useSetAtomState(currentProjectIdState);

  const contextStoreTargetedRecordsRule = useAtomComponentStateValue(
    contextStoreTargetedRecordsRuleComponentState,
    MAIN_CONTEXT_STORE_INSTANCE_ID,
  );

  useEffect(() => {
    if (location.pathname.includes('/project/')) {
      const pathParts = location.pathname.split('/project/');
      if (pathParts.length > 1) {
        const projectId = pathParts[1].split('/')[0];
        setCurrentProjectId(projectId);
      }
    }
  }, [location.pathname, setCurrentProjectId]);

  const selectedRecordId =
    isChatsPage && candidateId
      ? candidateId
      : contextStoreTargetedRecordsRule.mode === 'selection' &&
          contextStoreTargetedRecordsRule.selectedRecordIds.length > 0
        ? contextStoreTargetedRecordsRule.selectedRecordIds[0]
        : '0';

  return {
    selectedRecordId,
    hasSelectedRecord: selectedRecordId !== '0',
    isChatsPage,
  };
};
