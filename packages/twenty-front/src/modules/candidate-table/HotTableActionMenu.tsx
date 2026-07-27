import { HotTableContextStoreEffect } from '@/candidate-table/HotTableContextStoreEffect';
import { CommandMenuContext } from '@/command-menu-item/contexts/CommandMenuContext';
import { CommandMenuContextProvider } from '@/command-menu-item/contexts/CommandMenuContextProvider';
import { CommandMenuItemRenderer } from '@/command-menu-item/display/components/CommandMenuItemRenderer';
import { CommandMenuComponentInstanceContext } from '@/command-menu/states/contexts/CommandMenuComponentInstanceContext';
import { MAIN_CONTEXT_STORE_INSTANCE_ID } from '@/context-store/constants/MainContextStoreInstanceId';
import { contextStoreCurrentObjectMetadataItemIdComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemIdComponentState';
import { contextStoreCurrentPageTypeComponentState } from '@/context-store/states/contextStoreCurrentPageTypeComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { useSidePanelMenu } from '@/side-panel/hooks/useSidePanelMenu';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useContext, useMemo } from 'react';
import { IconLayoutSidebarRightExpand } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledBottomBar = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.primary};
  border-top: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  min-height: 48px;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
`;

const StyledLabel = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledButton = styled.button`
  align-items: center;
  background: transparent;
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  justify-content: center;
  padding: ${themeCssVariables.spacing[2]};

  &:hover {
    background: ${themeCssVariables.background.tertiary};
  }
`;

const StyledSeparator = styled.div`
  background: ${themeCssVariables.border.color.light};
  height: ${themeCssVariables.spacing[8]};
  margin: 0 ${themeCssVariables.spacing[1]};
  width: 1px;
`;

const StyledPinnedItems = styled.div`
  align-items: center;
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
`;

const HotTableAllActionsButton = ({ tableId }: { tableId: string }) => {
  const { t } = useLingui();
  const { openSidePanelMenu } = useSidePanelMenu();

  const targetedRecordsRule = useAtomComponentStateValue(
    contextStoreTargetedRecordsRuleComponentState,
    tableId,
  );
  const numberOfSelectedRecords = useAtomComponentStateValue(
    contextStoreNumberOfSelectedRecordsComponentState,
    tableId,
  );
  const objectMetadataItemId = useAtomComponentStateValue(
    contextStoreCurrentObjectMetadataItemIdComponentState,
    tableId,
  );
  const pageType = useAtomComponentStateValue(
    contextStoreCurrentPageTypeComponentState,
    tableId,
  );

  const setMainTargetedRecordsRule = useSetAtomComponentState(
    contextStoreTargetedRecordsRuleComponentState,
    MAIN_CONTEXT_STORE_INSTANCE_ID,
  );
  const setMainNumberOfSelectedRecords = useSetAtomComponentState(
    contextStoreNumberOfSelectedRecordsComponentState,
    MAIN_CONTEXT_STORE_INSTANCE_ID,
  );
  const setMainObjectMetadataItemId = useSetAtomComponentState(
    contextStoreCurrentObjectMetadataItemIdComponentState,
    MAIN_CONTEXT_STORE_INSTANCE_ID,
  );
  const setMainPageType = useSetAtomComponentState(
    contextStoreCurrentPageTypeComponentState,
    MAIN_CONTEXT_STORE_INSTANCE_ID,
  );

  // Side panel Command Menu reads MAIN context store, not the HotTable instance
  const handleOpenAllActions = useCallback(() => {
    setMainTargetedRecordsRule(targetedRecordsRule);
    setMainNumberOfSelectedRecords(numberOfSelectedRecords);
    setMainObjectMetadataItemId(objectMetadataItemId);
    setMainPageType(pageType);
    openSidePanelMenu();
  }, [
    numberOfSelectedRecords,
    objectMetadataItemId,
    openSidePanelMenu,
    pageType,
    setMainNumberOfSelectedRecords,
    setMainObjectMetadataItemId,
    setMainPageType,
    setMainTargetedRecordsRule,
    targetedRecordsRule,
  ]);

  return (
    <>
      <StyledSeparator />
      <StyledButton type="button" onClick={handleOpenAllActions}>
        <IconLayoutSidebarRightExpand size={16} />
        {t`All Actions`}
      </StyledButton>
    </>
  );
};

const HotTablePinnedActions = () => {
  const { commandMenuItems } = useContext(CommandMenuContext);

  const pinnedCommandMenuItems = useMemo(
    () => commandMenuItems.filter((item) => item.isPinned === true),
    [commandMenuItems],
  );

  return (
    <StyledPinnedItems>
      {pinnedCommandMenuItems.map((item) => (
        <CommandMenuItemRenderer key={item.id} item={item} />
      ))}
    </StyledPinnedItems>
  );
};

const HotTableActionMenuBar = ({ tableId }: { tableId: string }) => {
  const contextStoreNumberOfSelectedRecords = useAtomComponentStateValue(
    contextStoreNumberOfSelectedRecordsComponentState,
    tableId,
  );

  if (contextStoreNumberOfSelectedRecords === 0) {
    return null;
  }

  return (
    <StyledBottomBar>
      <StyledLabel>{contextStoreNumberOfSelectedRecords} selected</StyledLabel>
      <HotTablePinnedActions />
      <HotTableAllActionsButton tableId={tableId} />
    </StyledBottomBar>
  );
};

export const HotTableActionMenu = ({ tableId }: { tableId: string }) => {
  return (
    <CommandMenuComponentInstanceContext.Provider
      value={{ instanceId: tableId }}
    >
      <HotTableContextStoreEffect tableId={tableId} />
      <CommandMenuContextProvider
        isInSidePanel={false}
        displayType="button"
        containerType="index-page-header"
      >
        <HotTableActionMenuBar tableId={tableId} />
      </CommandMenuContextProvider>
    </CommandMenuComponentInstanceContext.Provider>
  );
};
