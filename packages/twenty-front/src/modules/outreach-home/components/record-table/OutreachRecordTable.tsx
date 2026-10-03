import { styled } from '@linaria/react';
import { type ReactNode, useMemo, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { IconArrowDown, IconArrowUp, type IconComponent } from 'twenty-ui/icon';
import { Checkbox, CheckboxVariant } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { RECORD_TABLE_ROW_HEIGHT } from '@/object-record/record-table/constants/RecordTableRowHeight';
import {
  type OutreachRecordCard,
  OutreachRecordCardList,
} from '@/outreach-home/components/record-table/OutreachRecordCardList';
import { useIsMobile } from '@/ui/utilities/responsive/hooks/useIsMobile';

// Mirrors the Twenty RecordTable look (32px rows, light cell borders, sticky
// header + label identifier column) for outreach working-set rows, which are
// partly ephemeral (Redis cache) and so cannot go through the metadata-driven
// RecordTable.

const CHECKBOX_COLUMN_WIDTH = 32;

export type OutreachRecordTableColumn<TRow> = {
  id: string;
  label: string;
  Icon?: IconComponent;
  width: number;
  render: (row: TRow) => ReactNode;
  sortValue?: (row: TRow) => string | number | null | undefined;
};

type SortState = { columnId: string; direction: 'asc' | 'desc' } | null;

const StyledScrollContainer = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
`;

const StyledTable = styled.table`
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
`;

const StyledHeaderCell = styled.th<{ isSortable: boolean }>`
  background: ${themeCssVariables.background.primary};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  border-right: 1px solid ${themeCssVariables.border.color.light};
  color: ${themeCssVariables.font.color.tertiary};
  cursor: ${({ isSortable }) => (isSortable ? 'pointer' : 'default')};
  font-weight: ${themeCssVariables.font.weight.medium};
  height: ${RECORD_TABLE_ROW_HEIGHT}px;
  padding: 0;
  position: sticky;
  text-align: left;
  top: 0;
  user-select: none;
  z-index: 2;

  &:hover {
    background: ${({ isSortable }) =>
      isSortable
        ? themeCssVariables.background.secondary
        : themeCssVariables.background.primary};
  }

  &[data-sticky='true'] {
    left: ${CHECKBOX_COLUMN_WIDTH}px;
    z-index: 3;
  }

  &[data-checkbox='true'] {
    left: 0;
    z-index: 3;
  }
`;

const StyledHeaderContent = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  height: ${RECORD_TABLE_ROW_HEIGHT}px;
  overflow: hidden;
  padding: 0 ${themeCssVariables.spacing[2]};
  white-space: nowrap;
`;

const StyledHeaderLabel = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StyledSortIcon = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  margin-left: auto;
`;

const StyledRow = styled.tr<{ isSelected: boolean; isActive: boolean }>`
  cursor: pointer;

  & > td {
    background: ${({ isSelected, isActive }) =>
      isSelected || isActive
        ? themeCssVariables.accent.quaternary
        : themeCssVariables.background.primary};
  }

  &:hover > td {
    background: ${({ isSelected, isActive }) =>
      isSelected || isActive
        ? themeCssVariables.accent.quaternary
        : themeCssVariables.background.secondary};
  }
`;

const StyledCell = styled.td`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  border-right: 1px solid ${themeCssVariables.border.color.light};
  color: ${themeCssVariables.font.color.primary};
  height: ${RECORD_TABLE_ROW_HEIGHT}px;
  max-height: ${RECORD_TABLE_ROW_HEIGHT}px;
  overflow: hidden;
  padding: 0 ${themeCssVariables.spacing[2]};
  text-overflow: ellipsis;
  white-space: nowrap;

  &[data-sticky='true'] {
    left: ${CHECKBOX_COLUMN_WIDTH}px;
    position: sticky;
    z-index: 1;
  }

  &[data-checkbox='true'] {
    left: 0;
    padding: 0;
    position: sticky;
    z-index: 1;
  }
`;

const StyledCheckboxContainer = styled.div`
  align-items: center;
  display: flex;
  height: ${RECORD_TABLE_ROW_HEIGHT}px;
  justify-content: center;
`;

const StyledFillerCell = styled.td`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  width: 100%;
`;

const StyledFillerHeaderCell = styled.th`
  background: ${themeCssVariables.background.primary};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  position: sticky;
  top: 0;
  width: 100%;
  z-index: 2;
`;

const compareSortValues = (
  left: string | number | null | undefined,
  right: string | number | null | undefined,
): number => {
  const isLeftEmpty = !isDefined(left) || left === '';
  const isRightEmpty = !isDefined(right) || right === '';

  // Empty values always sink to the bottom regardless of direction
  if (isLeftEmpty || isRightEmpty) {
    return isLeftEmpty === isRightEmpty ? 0 : isLeftEmpty ? 1 : -1;
  }

  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
};

type OutreachRecordTableProps<TRow> = {
  rows: TRow[];
  columns: OutreachRecordTableColumn<TRow>[];
  getRowId: (row: TRow) => string;
  selectedRowIds: string[];
  activeRowId?: string | null;
  onSelectedRowIdsChange: (rowIds: string[]) => void;
  onRowClick?: (row: TRow) => void;
  // When set, phones get a card list instead of the wide table
  getMobileCard?: (row: TRow) => OutreachRecordCard;
};

export const OutreachRecordTable = <TRow,>({
  rows,
  columns,
  getRowId,
  selectedRowIds,
  activeRowId,
  onSelectedRowIdsChange,
  onRowClick,
  getMobileCard,
}: OutreachRecordTableProps<TRow>) => {
  const isMobile = useIsMobile();
  const [sortState, setSortState] = useState<SortState>(null);

  const sortedRows = useMemo(() => {
    const sortColumn = columns.find(
      (column) => column.id === sortState?.columnId,
    );

    if (!isDefined(sortState) || !isDefined(sortColumn?.sortValue)) {
      return rows;
    }

    const getSortValue = sortColumn.sortValue;
    const directionMultiplier = sortState.direction === 'asc' ? 1 : -1;

    return [...rows].sort((leftRow, rightRow) => {
      const leftValue = getSortValue(leftRow);
      const rightValue = getSortValue(rightRow);
      const isEitherEmpty =
        !isDefined(leftValue) ||
        leftValue === '' ||
        !isDefined(rightValue) ||
        rightValue === '';
      const comparison = compareSortValues(leftValue, rightValue);

      return isEitherEmpty ? comparison : comparison * directionMultiplier;
    });
  }, [columns, rows, sortState]);

  const selectedRowIdSet = useMemo(
    () => new Set(selectedRowIds),
    [selectedRowIds],
  );

  const visibleRowIds = useMemo(() => rows.map(getRowId), [getRowId, rows]);
  const selectedVisibleCount = visibleRowIds.filter((rowId) =>
    selectedRowIdSet.has(rowId),
  ).length;
  const isAllSelected =
    visibleRowIds.length > 0 && selectedVisibleCount === visibleRowIds.length;
  const isPartiallySelected = selectedVisibleCount > 0 && !isAllSelected;

  const handleToggleAll = () => {
    onSelectedRowIdsChange(isAllSelected ? [] : visibleRowIds);
  };

  const handleToggleRow = (rowId: string) => {
    onSelectedRowIdsChange(
      selectedRowIdSet.has(rowId)
        ? selectedRowIds.filter((selectedRowId) => selectedRowId !== rowId)
        : [...selectedRowIds, rowId],
    );
  };

  const handleHeaderClick = (column: OutreachRecordTableColumn<TRow>) => {
    if (!isDefined(column.sortValue)) {
      return;
    }

    setSortState((previous) => {
      if (previous?.columnId !== column.id) {
        return { columnId: column.id, direction: 'asc' };
      }

      return previous.direction === 'asc'
        ? { columnId: column.id, direction: 'desc' }
        : null;
    });
  };

  if (isMobile && isDefined(getMobileCard)) {
    return (
      <OutreachRecordCardList
        rows={sortedRows}
        getRowId={getRowId}
        getCard={getMobileCard}
        selectedRowIds={selectedRowIds}
        activeRowId={activeRowId}
        onSelectedRowIdsChange={onSelectedRowIdsChange}
        onRowClick={onRowClick}
      />
    );
  }

  return (
    <StyledScrollContainer>
      <StyledTable>
        <colgroup>
          <col style={{ width: CHECKBOX_COLUMN_WIDTH }} />
          {columns.map((column) => (
            <col key={column.id} style={{ width: column.width }} />
          ))}
          <col />
        </colgroup>
        <thead>
          <tr>
            <StyledHeaderCell isSortable={false} data-checkbox="true">
              <StyledCheckboxContainer>
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isPartiallySelected}
                  onChange={handleToggleAll}
                  variant={CheckboxVariant.Primary}
                  aria-label="Select all rows"
                />
              </StyledCheckboxContainer>
            </StyledHeaderCell>
            {columns.map((column, columnIndex) => {
              const ColumnIcon = column.Icon;

              return (
                <StyledHeaderCell
                  key={column.id}
                  isSortable={isDefined(column.sortValue)}
                  data-sticky={columnIndex === 0 ? 'true' : undefined}
                  onClick={() => handleHeaderClick(column)}
                >
                  <StyledHeaderContent>
                    {isDefined(ColumnIcon) && (
                      <ColumnIcon size={16} stroke={1.6} />
                    )}
                    <StyledHeaderLabel>{column.label}</StyledHeaderLabel>
                    {sortState?.columnId === column.id && (
                      <StyledSortIcon>
                        {sortState.direction === 'asc' ? (
                          <IconArrowUp size={14} />
                        ) : (
                          <IconArrowDown size={14} />
                        )}
                      </StyledSortIcon>
                    )}
                  </StyledHeaderContent>
                </StyledHeaderCell>
              );
            })}
            <StyledFillerHeaderCell />
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => {
            const rowId = getRowId(row);
            const isSelected = selectedRowIdSet.has(rowId);

            return (
              <StyledRow
                key={rowId}
                isSelected={isSelected}
                isActive={rowId === activeRowId}
                onClick={() => onRowClick?.(row)}
              >
                <StyledCell
                  data-checkbox="true"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleToggleRow(rowId);
                  }}
                >
                  <StyledCheckboxContainer>
                    <Checkbox
                      checked={isSelected}
                      variant={CheckboxVariant.Secondary}
                      aria-label="Select row"
                    />
                  </StyledCheckboxContainer>
                </StyledCell>
                {columns.map((column, columnIndex) => (
                  <StyledCell
                    key={column.id}
                    data-sticky={columnIndex === 0 ? 'true' : undefined}
                  >
                    {column.render(row)}
                  </StyledCell>
                ))}
                <StyledFillerCell />
              </StyledRow>
            );
          })}
        </tbody>
      </StyledTable>
    </StyledScrollContainer>
  );
};
