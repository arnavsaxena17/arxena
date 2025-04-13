import { useActionMenu } from '@/action-menu/hooks/useActionMenu';
import { ActionMenuComponentInstanceContext } from '@/action-menu/states/contexts/ActionMenuComponentInstanceContext';
import { getActionBarIdFromActionMenuId } from '@/action-menu/utils/getActionBarIdFromActionMenuId';
import { getActionMenuDropdownIdFromActionMenuId } from '@/action-menu/utils/getActionMenuDropdownIdFromActionMenuId';
import { isCommandMenuOpenedState } from '@/command-menu/states/isCommandMenuOpenedState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { isBottomBarOpenedComponentState } from '@/ui/layout/bottom-bar/states/isBottomBarOpenedComponentState';
import { isDropdownOpenComponentState } from '@/ui/layout/dropdown/states/isDropdownOpenComponentState';
import { useRightDrawer } from '@/ui/layout/right-drawer/hooks/useRightDrawer';
import { useAvailableComponentInstanceIdOrThrow } from '@/ui/utilities/state/component-state/hooks/useAvailableComponentInstanceIdOrThrow';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import { extractComponentState } from '@/ui/utilities/state/component-state/utils/extractComponentState';
import { useEffect } from 'react';
import { useRecoilValue } from 'recoil';

export const RecordIndexActionMenuEffect = () => {
  const contextStoreNumberOfSelectedRecords = useRecoilComponentValueV2(
    contextStoreNumberOfSelectedRecordsComponentState,
  );

  const actionMenuId = useAvailableComponentInstanceIdOrThrow(
    ActionMenuComponentInstanceContext,
  );

  const { openActionBar, closeActionBar } = useActionMenu(actionMenuId);

  const setIsBottomBarOpened = useSetRecoilComponentStateV2(
    isBottomBarOpenedComponentState,
    getActionBarIdFromActionMenuId(actionMenuId),
  );

  const isDropdownOpen = useRecoilValue(
    extractComponentState(
      isDropdownOpenComponentState,
      getActionMenuDropdownIdFromActionMenuId(actionMenuId),
    ),
  );
  const { isRightDrawerOpen } = useRightDrawer();

  const isCommandMenuOpened = useRecoilValue(isCommandMenuOpenedState);

  useEffect(() => {
    if (
      contextStoreNumberOfSelectedRecords > 0 &&
      !isDropdownOpen &&
      !isRightDrawerOpen &&
      !isCommandMenuOpened
    ) {
      openActionBar();
    }
    if (contextStoreNumberOfSelectedRecords === 0 && isDropdownOpen) {
      closeActionBar();
    }
  }, [
    contextStoreNumberOfSelectedRecords,
    openActionBar,
    closeActionBar,
    isDropdownOpen,
    isRightDrawerOpen,
    isCommandMenuOpened,
  ]);

  useEffect(() => {
    if (isRightDrawerOpen || isCommandMenuOpened) {
      setIsBottomBarOpened(false);
    }
  }, [isRightDrawerOpen, isCommandMenuOpened, setIsBottomBarOpened]);

  return null;
};
