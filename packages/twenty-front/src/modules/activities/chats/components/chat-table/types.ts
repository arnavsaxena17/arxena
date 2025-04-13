import Handsontable from 'handsontable';
import { PersonNode } from 'twenty-shared';

export type TableData = {
  name?: string;
  id?: string;
  candidateStatus?: string;
  startDate?: string;
  status?: string;
  salary?: string;
  city?: string;
  jobTitle?: string;
  checkbox?: boolean;
};

export type UnreadMessages = {
  listOfUnreadMessages: Array<{
    candidateId: string;
    ManyUnreadMessages: any[];
  }>;
};

export interface ChatTableProps {
  individuals: PersonNode[];
  selectedIndividual: string | null;
  unreadMessages: UnreadMessages;
  onIndividualSelect: (id: string) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  onBulkMessage?: (selectedIds: string[]) => void;
  onBulkDelete?: (selectedIds: string[]) => void;
  onBulkAssign?: (selectedIds: string[]) => void;
  onReorder?: (selectedIds: PersonNode[]) => void;
}

export type ColumnRenderer = (
  instance: Handsontable.Core,
  td: HTMLTableCellElement,
  row: number,
  column: number,
  prop: string | number,
  value: any,
  cellProperties: Handsontable.CellProperties
) => HTMLTableCellElement; 