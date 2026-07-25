import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { styled } from '@linaria/react';
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

export const HotTableActionMenu = ({ tableId }: { tableId: string }) => {
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
    </StyledBottomBar>
  );
};
