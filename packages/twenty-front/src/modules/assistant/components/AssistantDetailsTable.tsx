import styled from '@emotion/styled';
import { HotTable } from '@handsontable/react-wrapper';
import '@/candidate-table/initHandsontable';
import Handsontable from 'handsontable';
import { useMemo } from 'react';

const StyledTableWrapper = styled.div`
  width: 100%;
  margin-top: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  overflow: hidden;
  background: ${({ theme }) => theme.background.primary};

  .handsontable {
    font-size: ${({ theme }) => theme.font.size.sm};
  }

  .handsontable th {
    background-color: ${({ theme }) => theme.background.secondary};
    font-weight: ${({ theme }) => theme.font.weight.medium};
  }

  .handsontable td {
    max-width: 200px;
  }
`;

const TRUNCATED_CELL_STYLE: React.CSSProperties = {
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

export type AssistantTableData = {
  columns: string[];
  rows: Record<string, unknown>[];
  tableId?: string;
  tableType?: string;
  label?: string;
};

type AssistantDetailsTableProps = {
  data: AssistantTableData;
  maxHeight?: number;
  selectedRowIndex?: number;
  onSelectRow?: (rowIndex: number) => void;
};

const DEFAULT_MAX_HEIGHT = 320;

export const AssistantDetailsTable = ({
  data,
  maxHeight = DEFAULT_MAX_HEIGHT,
  selectedRowIndex,
  onSelectRow,
}: AssistantDetailsTableProps) => {
  const { columns, data: tableData } = useMemo(() => {
    if (!data.rows?.length || !data.columns?.length) {
      return { columns: [], data: [] };
    }
    const cols = data.columns.map((key) => ({
      data: key,
      title: key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
      readOnly: true,
      renderer: truncatedRenderer,
    }));
    const rows = data.rows.map((row) => {
      const out: Record<string, unknown> = {};
      data.columns.forEach((key) => {
        out[key] = row[key] ?? '';
      });
      return out;
    });
    return { columns: cols, data: rows };
  }, [data]);

  if (columns.length === 0 || tableData.length === 0) return null;

  const handleSelection = useMemo(() => {
    if (!onSelectRow) return undefined;
    return (row: number) => {
      if (row >= 0 && row < tableData.length) onSelectRow(row);
    };
  }, [onSelectRow, tableData.length]);

  return (
    <StyledTableWrapper>
      <HotTable
        data={tableData}
        columns={columns}
        colHeaders={columns.map((c) => c.title)}
        rowHeaders={true}
        height={Math.min(maxHeight, 30 * tableData.length + 30)}
        themeName="ht-theme-main"
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
            ? (row: number, _col: number) => handleSelection(row)
            : undefined
        }
      />
    </StyledTableWrapper>
  );
};
