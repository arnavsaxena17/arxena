import { styled } from '@linaria/react';
import { isNonEmptyString } from '@sniptt/guards';
import { useMemo, useState } from 'react';
import { IconPlus, type IconComponent } from 'twenty-ui/icon';
import { MenuItem } from 'twenty-ui/navigation';

import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { DropdownMenuSearchInput } from '@/ui/layout/dropdown/components/DropdownMenuSearchInput';
import { DropdownMenuSeparator } from '@/ui/layout/dropdown/components/DropdownMenuSeparator';
import { OverlayContainer } from '@/ui/layout/overlay/components/OverlayContainer';

const StyledPositionedOverlay = styled(OverlayContainer)`
  max-height: 360px;
  position: fixed;
  z-index: 20;
`;

type HiddenFieldColumn = {
  id: string;
  label: string;
  Icon?: IconComponent;
};

type OutreachRecordTableHiddenFieldsMenuProps = {
  hiddenColumns: HiddenFieldColumn[];
  top: number;
  left: number;
  onShowColumn: (columnId: string) => void;
};

export const OutreachRecordTableHiddenFieldsMenu = ({
  hiddenColumns,
  top,
  left,
  onShowColumn,
}: OutreachRecordTableHiddenFieldsMenuProps) => {
  const [searchInput, setSearchInput] = useState('');

  const filteredColumns = useMemo(() => {
    const needle = searchInput.trim().toLowerCase();

    if (!isNonEmptyString(needle)) {
      return hiddenColumns;
    }

    return hiddenColumns.filter((column) =>
      column.label.toLowerCase().includes(needle),
    );
  }, [hiddenColumns, searchInput]);

  const otherFieldsKey = searchInput.trim();
  const canAddOtherFieldsKey =
    isNonEmptyString(otherFieldsKey) &&
    filteredColumns.length === 0 &&
    !hiddenColumns.some(
      (column) => column.id === `otherFields.${otherFieldsKey}`,
    );
  const hasHiddenColumns = hiddenColumns.length > 0;

  return (
    <StyledPositionedOverlay style={{ top, left }}>
      <DropdownContent>
        {hasHiddenColumns && (
          <>
            <DropdownMenuSearchInput
              autoFocus
              value={searchInput}
              placeholder="Search fields"
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItemsContainer>
          {filteredColumns.length > 0 ? (
            filteredColumns.map((column) => (
              <MenuItem
                key={column.id}
                LeftIcon={column.Icon}
                text={column.label}
                onClick={() => onShowColumn(column.id)}
              />
            ))
          ) : canAddOtherFieldsKey ? (
            <MenuItem
              LeftIcon={IconPlus}
              text={`Add otherFields.${otherFieldsKey}`}
              onClick={() => onShowColumn(`otherFields.${otherFieldsKey}`)}
            />
          ) : (
            <MenuItem
              disabled
              accent="placeholder"
              text={
                hasHiddenColumns
                  ? 'No results'
                  : 'All fields are already visible'
              }
            />
          )}
        </DropdownMenuItemsContainer>
      </DropdownContent>
    </StyledPositionedOverlay>
  );
};
