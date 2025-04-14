import { RecordActionMenuEntriesSetter } from '@/action-menu/actions/record-actions/components/RecordActionMenuEntriesSetter';
import { MultipleRecordsActionKeys } from '@/action-menu/actions/record-actions/multiple-records/types/MultipleRecordsActionKeys';
import { RecordAgnosticActionMenuEntriesSetter } from '@/action-menu/actions/record-agnostic-actions/components/RecordAgnosticActionMenuEntriesSetter';
import { RunWorkflowRecordAgnosticActionMenuEntriesSetter } from '@/action-menu/actions/record-agnostic-actions/components/RunWorkflowRecordAgnosticActionMenuEntriesSetter';
import { ActionMenuConfirmationModals } from '@/action-menu/components/ActionMenuConfirmationModals';
import { RecordIndexActionMenuBar } from '@/action-menu/components/RecordIndexActionMenuBar';
import { RecordIndexActionMenuDropdown } from '@/action-menu/components/RecordIndexActionMenuDropdown';
import { RecordIndexActionMenuEffect } from '@/action-menu/components/RecordIndexActionMenuEffect';
import { ActionMenuContext } from '@/action-menu/contexts/ActionMenuContext';
import { contextStoreCurrentObjectMetadataItemComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemComponentState';
import { isRecordIndexLoadMoreLockedComponentState } from '@/object-record/record-index/states/isRecordIndexLoadMoreLockedComponentState';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { ReactNode } from 'react';
import { useIsMobile } from 'twenty-ui';
import { FeatureFlagKey } from '~/generated/graphql';

export type RecordIndexActionMenuProps = {
  indexId: string;
  customActionMenuEntriesSetter?: ReactNode;
};

export const RecordIndexActionMenu = ({ 
  indexId,
  customActionMenuEntriesSetter
}: RecordIndexActionMenuProps) => {
  console.log("RecordIndexActionMenu::", indexId)
  const contextStoreCurrentObjectMetadataItem = useRecoilComponentValueV2(
    contextStoreCurrentObjectMetadataItemComponentState,
  );

  const isCommandMenuV2Enabled = useIsFeatureEnabled(
    FeatureFlagKey.IsCommandMenuV2Enabled,
  );

  const isWorkflowEnabled = useIsFeatureEnabled(
    FeatureFlagKey.IsWorkflowEnabled,
  );

  const isMobile = useIsMobile();

  const setIsLoadMoreLocked = useSetRecoilComponentStateV2(
    isRecordIndexLoadMoreLockedComponentState,
    indexId,
  );
  
  console.log("contextStoreCurrentObjectMetadataItem::", contextStoreCurrentObjectMetadataItem)
  console.log("isCommandMenuV2Enabled::", isCommandMenuV2Enabled)
  console.log("isWorkflowEnabled::", isWorkflowEnabled)
  
  return (
    <>
      {contextStoreCurrentObjectMetadataItem && (
        <ActionMenuContext.Provider
          value={{
            isInRightDrawer: false,
            onActionStartedCallback: (action) => {
              if (action.key === MultipleRecordsActionKeys.DELETE) {
                setIsLoadMoreLocked(true);
              }
            },
            onActionExecutedCallback: (action) => {
              if (action.key === MultipleRecordsActionKeys.DELETE) {
                setIsLoadMoreLocked(false);
              }
            },
          }}
        >
          {/* {isCommandMenuV2Enabled ? (
            <>{!isMobile && <RecordIndexActionMenuButtons />}</>
          ) : (
            )} */}
            {/* <RecordIndexActionMenuButtons /> */}
            <RecordIndexActionMenuBar />
          <RecordIndexActionMenuDropdown />
          <ActionMenuConfirmationModals />
          <RecordIndexActionMenuEffect />
          <RecordActionMenuEntriesSetter />
          <RecordAgnosticActionMenuEntriesSetter />
          {customActionMenuEntriesSetter}
          {isWorkflowEnabled && (
            <RunWorkflowRecordAgnosticActionMenuEntriesSetter />
          )}
        </ActionMenuContext.Provider>
      )}
    </>
  );
};
