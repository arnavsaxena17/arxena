import { read, utils, type CellObject } from 'xlsx';

export type SpreadsheetCell = {
  text: string;
  // Hyperlink target of the cell. "Search LinkedIn" style cells keep the real
  // URL here, not in the visible text.
  link?: string;
};

export type ParsedSpreadsheet = {
  sheetNames: string[];
  sheetName: string;
  headerRowIndex: number;
  headers: string[];
  rows: SpreadsheetCell[][];
};

const HEADER_SCAN_ROWS = 10;
const MIN_HEADER_CELLS = 2;

const cellToText = (cell: CellObject | undefined): string => {
  if (cell === undefined || cell.v === undefined || cell.v === null) {
    return '';
  }

  if (cell.w !== undefined && cell.t === 'n') {
    return cell.w.trim();
  }

  return String(cell.v).trim();
};

// SheetJS reads hyperlink targets as latin1, so UTF-8 characters such as an
// en dash arrive as "â\u0080\u0093".
const repairHyperlinkEncoding = (target: string): string => {
  if (!/[\u00c2-\u00f4][\u0080-\u00bf]/.test(target)) {
    return target;
  }

  const repaired = Buffer.from(target, 'latin1').toString('utf8');

  return repaired.includes('\ufffd') ? target : repaired;
};

const makeHeadersUnique = (rawHeaders: string[]): string[] => {
  const seen = new Map<string, number>();

  return rawHeaders.map((rawHeader, index) => {
    const base = rawHeader === '' ? `Column ${index + 1}` : rawHeader;
    const count = (seen.get(base) ?? 0) + 1;

    seen.set(base, count);

    return count === 1 ? base : `${base} (${count})`;
  });
};

export const parseSpreadsheetBuffer = (
  buffer: Buffer,
  options: { sheetName?: string; headerRow?: number } = {},
): ParsedSpreadsheet => {
  const workbook = read(buffer, { type: 'buffer', cellFormula: false });
  const sheetNames = workbook.SheetNames;
  const sheetName =
    options.sheetName !== undefined && sheetNames.includes(options.sheetName)
      ? options.sheetName
      : sheetNames[0];

  if (sheetName === undefined) {
    throw new Error('The spreadsheet has no sheets');
  }

  const sheet = workbook.Sheets[sheetName];
  const range = utils.decode_range(sheet['!ref'] ?? 'A1:A1');

  const grid: SpreadsheetCell[][] = [];

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex++) {
    const row: SpreadsheetCell[] = [];

    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex++) {
      const cell = sheet[utils.encode_cell({ r: rowIndex, c: columnIndex })] as
        | CellObject
        | undefined;
      const rawLink = cell?.l?.Target;
      const link =
        rawLink === undefined ? undefined : repairHyperlinkEncoding(rawLink);

      row.push({
        text: cellToText(cell),
        ...(link !== undefined && link !== '' ? { link } : {}),
      });
    }

    grid.push(row);
  }

  const countFilled = (row: SpreadsheetCell[]): number =>
    row.filter((cell) => cell.text !== '').length;

  // options.headerRow is 1-based, as the user sees it in Excel
  const detectedHeaderRowIndex = grid
    .slice(0, HEADER_SCAN_ROWS)
    .findIndex((row) => countFilled(row) >= MIN_HEADER_CELLS);
  const headerRowIndex =
    options.headerRow !== undefined
      ? options.headerRow - 1
      : Math.max(detectedHeaderRowIndex, 0);

  const headers = makeHeadersUnique(
    (grid[headerRowIndex] ?? []).map((cell) => cell.text),
  );
  const rows = grid
    .slice(headerRowIndex + 1)
    .filter((row) => countFilled(row) > 0);

  return { sheetNames, sheetName, headerRowIndex, headers, rows };
};
