import '@/candidate-table/initHandsontable';

import { HotTable } from '@handsontable/react-wrapper';
import { styled } from '@linaria/react';
import type Handsontable from 'handsontable';
import { type CSSProperties, useMemo } from 'react';
import {
  themeCssVariables,
  useThemeColorScheme,
} from 'twenty-ui/theme-constants';

const StyledTableWrapper = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  margin-top: ${themeCssVariables.spacing[2]};
  overflow: hidden;
  width: 100%;

  .handsontable {
    font-size: ${themeCssVariables.font.size.sm};
  }

  .handsontable th {
    background-color: ${themeCssVariables.background.secondary};
    font-weight: ${themeCssVariables.font.weight.medium};
  }

  .handsontable td {
    max-width: 200px;
  }
`;

const TRUNCATED_CELL_STYLE: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  display: 'block',
  width: '100%',
};

type ColumnRenderer = (
  instance: Handsontable.Core,
  td: HTMLTableCellElement,
  row: number,
  column: number,
  prop: string | number,
  value: unknown,
  cellProperties: Handsontable.CellProperties,
) => HTMLTableCellElement;

const truncatedRenderer: ColumnRenderer = (
  _instance,
  td,
  _row,
  _column,
  _prop,
  value,
) => {
  const div = document.createElement('div');
  Object.assign(div.style, TRUNCATED_CELL_STYLE);
  div.textContent =
    value !== undefined && value !== null
      ? Array.isArray(value)
        ? (value as unknown[]).join(', ')
        : String(value)
      : '';
  td.innerHTML = '';
  td.appendChild(div);
  td.title = div.textContent || '';
  return td;
};

export type OutreachTableData = {
  columns: string[];
  rows: Record<string, unknown>[];
  tableId?: string;
  tableType?: string;
  label?: string;
};

type OutreachDetailsTableProps = {
  data: OutreachTableData;
  maxHeight?: number;
  selectedRowIndex?: number;
  onSelectRow?: (rowIndex: number) => void;
};

const DEFAULT_MAX_HEIGHT = 320;

const toColumnTitle = (key: string) =>
  key.replace(/([A-Z])/g, ' $1').replace(/^./, (character) =>
    character.toUpperCase(),
  );

export const OutreachDetailsTable = ({
  data,
  maxHeight = DEFAULT_MAX_HEIGHT,
  onSelectRow,
}: OutreachDetailsTableProps) => {
  const colorScheme = useThemeColorScheme();

  const { columns, tableRows } = useMemo(() => {
    if (!data.rows?.length || !data.columns?.length) {
      return { columns: [], tableRows: [] };
    }

    const mappedColumns = data.columns.map((key) => ({
      data: key,
      title: toColumnTitle(key),
      readOnly: true,
      renderer: truncatedRenderer,
    }));

    const mappedRows = data.rows.map((row) => {
      const mappedRow: Record<string, unknown> = {};

      data.columns.forEach((key) => {
        mappedRow[key] = row[key] ?? '';
      });

      return mappedRow;
    });

    return { columns: mappedColumns, tableRows: mappedRows };
  }, [data]);

  const handleSelection = useMemo(() => {
    if (!onSelectRow) {
      return undefined;
    }

    return (row: number) => {
      if (row >= 0 && row < tableRows.length) {
        onSelectRow(row);
      }
    };
  }, [onSelectRow, tableRows.length]);

  if (columns.length === 0 || tableRows.length === 0) {
    return null;
  }

  return (
    <StyledTableWrapper>
      <HotTable
        data={tableRows}
        columns={columns}
        colHeaders={columns.map((column) => column.title)}
        rowHeaders={true}
        height={Math.min(maxHeight, 30 * tableRows.length + 30)}
        themeName={
          colorScheme === 'dark' ? 'ht-theme-main-dark' : 'ht-theme-main'
        }
        licenseKey="non-commercial-and-evaluation"
        stretchH="all"
        readOnly={true}
        className="htCenter"
        autoWrapRow={false}
        autoWrapCol={false}
        autoRowSize={false}
        rowHeights={30}
        manualColumnResize={true}
        fixedRowsTop={0}
        afterSelection={
          handleSelection
            ? (row: number) => handleSelection(row)
            : undefined
        }
      />
    </StyledTableWrapper>
  );
};
