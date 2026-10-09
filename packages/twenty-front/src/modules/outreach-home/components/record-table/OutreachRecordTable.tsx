import { styled } from '@linaria/react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import {
  IconArrowDown,
  IconArrowUp,
  IconFilter,
  IconGripVertical,
  IconPlus,
  type IconComponent,
} from 'twenty-ui/icon';
import { Checkbox, CheckboxVariant } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { RECORD_TABLE_COLUMN_MIN_WIDTH } from '@/object-record/record-table/constants/RecordTableColumnMinWidth';
import { RECORD_TABLE_ROW_HEIGHT } from '@/object-record/record-table/constants/RecordTableRowHeight';
import { OutreachRecordTableColumnMenu } from '@/outreach-home/components/record-table/OutreachRecordTableColumnMenu';
import {
  type OutreachColumnFilter,
  type OutreachTableColumnLayout,
  filterOutreachRows,
  getOutreachCellText,
  hideColumnInLayout,
  reorderColumnInLayout,
  resizeColumnInLayout,
  resolveVisibleColumns,
  showColumnInLayout,
} from '@/outreach-home/utils/outreach-table-layout.util';
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
  // Present only on columns whose value can be written back to the server
  edit?: {
    getValue: (row: TRow) => string;
    onSave: (row: TRow, value: string) => Promise<void>;
  };
  sortValue?: (row: TRow) => string | number | null | undefined;
  // number: sorted numerically and filtered with comparison operators
  valueType?: 'text' | 'number';
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

const StyledHeaderButton = styled.button`
  align-items: center;
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  display: flex;
  flex: 1;
  font: inherit;
  gap: ${themeCssVariables.spacing[1]};
  min-width: 0;
  padding: 0;
`;

const StyledGrip = styled.span`
  color: ${themeCssVariables.font.color.light};
  cursor: grab;
  display: flex;
  flex-shrink: 0;
`;

const StyledIconButton = styled.button<{ isActive?: boolean }>`
  align-items: center;
  background: transparent;
  border: none;
  color: ${({ isActive }) =>
    isActive
      ? themeCssVariables.color.blue
      : themeCssVariables.font.color.tertiary};
  cursor: pointer;
  display: flex;
  flex-shrink: 0;
  padding: 0;
`;

const StyledResizeHandle = styled.div`
  bottom: 0;
  cursor: col-resize;
  position: absolute;
  right: -1px;
  top: 0;
  width: 8px;
  z-index: 1;
`;

const StyledAddHeaderCell = styled.th`
  background: ${themeCssVariables.background.primary};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  position: sticky;
  top: 0;
  width: 32px;
  z-index: 2;
`;

const StyledAddMenu = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  display: flex;
  flex-direction: column;
  max-height: 280px;
  min-width: 180px;
  overflow: auto;
  padding: ${themeCssVariables.spacing[1]};
  position: fixed;
  z-index: 20;
`;

const StyledAddMenuButton = styled.button`
  background: transparent;
  border: none;
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  padding: ${themeCssVariables.spacing[1]};
  text-align: left;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledAddMenuInput = styled.input`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  margin: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]};
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

const StyledCellInput = styled.input`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.color.blue};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  height: calc(${RECORD_TABLE_ROW_HEIGHT}px - 6px);
  outline: none;
  padding: 0 ${themeCssVariables.spacing[1]};
  width: 100%;
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
  columnLayout?: OutreachTableColumnLayout[] | null;
  onColumnLayoutChange?: (layout: OutreachTableColumnLayout[]) => void;
  columnFilters?: OutreachColumnFilter[];
  onColumnFiltersChange?: (filters: OutreachColumnFilter[]) => void;
  // A sort set from outside (the agent). A new key applies it; an empty
  // columnId clears the sort.
  externalSort?: {
    columnId: string;
    direction: 'asc' | 'desc';
    key: string;
  } | null;
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
  columnLayout = null,
  onColumnLayoutChange,
  columnFilters = [],
  onColumnFiltersChange,
  externalSort = null,
}: OutreachRecordTableProps<TRow>) => {
  const isMobile = useIsMobile();
  const [sortState, setSortState] = useState<SortState>(null);

  useEffect(() => {
    if (!externalSort) {
      return;
    }

    setSortState(
      externalSort.columnId === ''
        ? null
        : { columnId: externalSort.columnId, direction: externalSort.direction },
    );
  }, [externalSort]);
  const [openMenuColumnId, setOpenMenuColumnId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [rawJsonKey, setRawJsonKey] = useState('');
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    columnId: string;
    draft: string;
  } | null>(null);

  const visibleColumns = useMemo(
    () => resolveVisibleColumns(columns, columnLayout),
    [columnLayout, columns],
  );

  const hiddenColumns = useMemo(() => {
    const visibleIds = new Set(visibleColumns.map((column) => column.id));

    return columns.filter((column) => !visibleIds.has(column.id));
  }, [columns, visibleColumns]);

  const filteredRows = useMemo(
    () => filterOutreachRows(rows, columns, columnFilters),
    [columnFilters, columns, rows],
  );

  useEffect(() => {
    if (!openMenuColumnId && !addMenuOpen) {
      return;
    }

    const closeMenu = () => {
      setOpenMenuColumnId(null);
      setAddMenuOpen(false);
    };

    window.addEventListener('mousedown', closeMenu);

    return () => window.removeEventListener('mousedown', closeMenu);
  }, [addMenuOpen, openMenuColumnId]);

  const sortedRows = useMemo(() => {
    const sortColumn = visibleColumns.find(
      (column) => column.id === sortState?.columnId,
    );

    if (!isDefined(sortState) || !isDefined(sortColumn?.sortValue)) {
      return filteredRows;
    }

    const getSortValue = sortColumn.sortValue;
    const directionMultiplier = sortState.direction === 'asc' ? 1 : -1;

    return [...filteredRows].sort((leftRow, rightRow) => {
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
  }, [filteredRows, sortState, visibleColumns]);

  const selectedRowIdSet = useMemo(
    () => new Set(selectedRowIds),
    [selectedRowIds],
  );

  const visibleRowIds = useMemo(
    () => sortedRows.map(getRowId),
    [getRowId, sortedRows],
  );
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

  const tableWidth =
    CHECKBOX_COLUMN_WIDTH +
    visibleColumns.reduce((total, column) => total + column.width, 0) +
    32;

  return (
    <StyledScrollContainer>
      <StyledTable style={{ width: tableWidth }}>
        <colgroup>
          <col style={{ width: CHECKBOX_COLUMN_WIDTH }} />
          {visibleColumns.map((column) => (
            <col key={column.id} style={{ width: column.width }} />
          ))}
          <col style={{ width: 32 }} />
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
            {visibleColumns.map((column, columnIndex) => {
              const ColumnIcon = column.Icon;
              const columnFilter = columnFilters.find(
                (filter) => filter.columnId === column.id,
              );

              return (
                <StyledHeaderCell
                  key={column.id}
                  isSortable={false}
                  data-sticky={columnIndex === 0 ? 'true' : undefined}
                  onDragOver={(event) => {
                    if (column.id !== 'name') {
                      event.preventDefault();
                    }
                  }}
                  onDrop={() => {
                    if (
                      !draggedColumnId ||
                      draggedColumnId === column.id ||
                      !onColumnLayoutChange
                    ) {
                      return;
                    }

                    onColumnLayoutChange(
                      reorderColumnInLayout(
                        columns,
                        columnLayout,
                        draggedColumnId,
                        column.id,
                      ),
                    );
                    setDraggedColumnId(null);
                  }}
                >
                  <StyledResizeHandle
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const startX = event.clientX;
                      const startWidth = column.width;

                      const handlePointerMove = (moveEvent: PointerEvent) => {
                        const nextWidth = Math.max(
                          RECORD_TABLE_COLUMN_MIN_WIDTH,
                          startWidth + moveEvent.clientX - startX,
                        );

                        onColumnLayoutChange?.(
                          resizeColumnInLayout(
                            columns,
                            columnLayout,
                            column.id,
                            nextWidth,
                          ),
                        );
                      };
                      const handlePointerUp = () => {
                        window.removeEventListener(
                          'pointermove',
                          handlePointerMove,
                        );
                        window.removeEventListener(
                          'pointerup',
                          handlePointerUp,
                        );
                      };

                      window.addEventListener('pointermove', handlePointerMove);
                      window.addEventListener('pointerup', handlePointerUp);
                    }}
                  />
                  <StyledHeaderContent>
                    {column.id !== 'name' && (
                      <StyledGrip
                        draggable
                        aria-label={`Reorder ${column.label}`}
                        onDragStart={() => setDraggedColumnId(column.id)}
                        onDragEnd={() => setDraggedColumnId(null)}
                      >
                        <IconGripVertical size={14} />
                      </StyledGrip>
                    )}
                    <StyledHeaderButton
                      type="button"
                      onClick={() => handleHeaderClick(column)}
                    >
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
                    </StyledHeaderButton>
                    <StyledIconButton
                      type="button"
                      isActive={isDefined(columnFilter)}
                      aria-label={`Filter ${column.label}`}
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        const rect =
                          event.currentTarget.getBoundingClientRect();

                        setAddMenuOpen(false);
                        setMenuPosition({
                          top: rect.bottom,
                          left: rect.left,
                        });
                        setOpenMenuColumnId((current) =>
                          current === column.id ? null : column.id,
                        );
                      }}
                    >
                      <IconFilter size={14} />
                    </StyledIconButton>
                  </StyledHeaderContent>
                  {openMenuColumnId === column.id && (
                    <OutreachRecordTableColumnMenu
                      columnId={column.id}
                      rows={rows}
                      getCellText={(row) => getOutreachCellText(column, row)}
                      filter={columnFilter}
                      canHide={column.id !== 'name'}
                      valueType={column.valueType}
                      top={menuPosition.top}
                      left={menuPosition.left}
                      onHide={() => {
                        onColumnLayoutChange?.(
                          hideColumnInLayout(columns, columnLayout, column.id),
                        );
                        setOpenMenuColumnId(null);
                      }}
                      onFilterChange={(nextFilter) => {
                        onColumnFiltersChange?.(
                          nextFilter
                            ? [
                                ...columnFilters.filter(
                                  (filter) => filter.columnId !== column.id,
                                ),
                                nextFilter,
                              ]
                            : columnFilters.filter(
                                (filter) => filter.columnId !== column.id,
                              ),
                        );
                      }}
                    />
                  )}
                </StyledHeaderCell>
              );
            })}
            <StyledAddHeaderCell>
              <StyledIconButton
                type="button"
                aria-label="Add column"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  const rect = event.currentTarget.getBoundingClientRect();

                  setOpenMenuColumnId(null);
                  // The + sits at the table's right edge, so keep the menu inside the viewport
                  setMenuPosition({
                    top: rect.bottom,
                    left: Math.max(
                      8,
                      Math.min(rect.left, window.innerWidth - 260),
                    ),
                  });
                  setAddMenuOpen((current) => !current);
                }}
              >
                <IconPlus size={14} />
              </StyledIconButton>
              {addMenuOpen && (
                <StyledAddMenu
                  style={{ top: menuPosition.top, left: menuPosition.left }}
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  {hiddenColumns.map((column) => (
                    <StyledAddMenuButton
                      key={column.id}
                      type="button"
                      onClick={() => {
                        onColumnLayoutChange?.(
                          showColumnInLayout(columns, columnLayout, column.id),
                        );
                        setAddMenuOpen(false);
                      }}
                    >
                      {column.label}
                    </StyledAddMenuButton>
                  ))}
                  <StyledAddMenuInput
                    aria-label="Other fields key"
                    placeholder="otherFields key"
                    value={rawJsonKey}
                    onChange={(event) => setRawJsonKey(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' || !onColumnLayoutChange) {
                        return;
                      }

                      const key = rawJsonKey.trim();

                      if (!key) {
                        return;
                      }

                      onColumnLayoutChange(
                        showColumnInLayout(
                          columns,
                          columnLayout,
                          `otherFields.${key}`,
                        ),
                      );
                      setRawJsonKey('');
                      setAddMenuOpen(false);
                    }}
                  />
                </StyledAddMenu>
              )}
            </StyledAddHeaderCell>
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
                {visibleColumns.map((column, columnIndex) => {
                  const isEditing =
                    editingCell?.rowId === rowId &&
                    editingCell.columnId === column.id;
                  const commitEdit = () => {
                    const pendingEdit = editingCell;

                    setEditingCell(null);

                    if (
                      !column.edit ||
                      !pendingEdit ||
                      pendingEdit.draft === column.edit.getValue(row)
                    ) {
                      return;
                    }

                    void column.edit.onSave(row, pendingEdit.draft);
                  };

                  return (
                    <StyledCell
                      key={column.id}
                      data-sticky={columnIndex === 0 ? 'true' : undefined}
                      onClick={
                        column.edit
                          ? (event) => {
                              event.stopPropagation();
                              setEditingCell({
                                rowId,
                                columnId: column.id,
                                draft: column.edit?.getValue(row) ?? '',
                              });
                            }
                          : undefined
                      }
                    >
                      {isEditing ? (
                        <StyledCellInput
                          autoFocus
                          aria-label={`Edit ${column.label}`}
                          value={editingCell.draft}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) =>
                            setEditingCell({
                              rowId,
                              columnId: column.id,
                              draft: event.target.value,
                            })
                          }
                          onBlur={commitEdit}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              commitEdit();
                            } else if (event.key === 'Escape') {
                              setEditingCell(null);
                            }
                          }}
                        />
                      ) : (
                        column.render(row)
                      )}
                    </StyledCell>
                  );
                })}
                <StyledFillerCell />
              </StyledRow>
            );
          })}
        </tbody>
      </StyledTable>
    </StyledScrollContainer>
  );
};
