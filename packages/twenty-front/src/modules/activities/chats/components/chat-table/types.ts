import Handsontable from 'handsontable';
import { CandidateNode } from 'twenty-shared';

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
  phoneNumber?: string;
  email?: string;
  candidateFieldValues?: any;
  chatCount?: string | number;
  clientInterview?: any;
  hiringNaukriUrl?: string;
  lastEngagementChatControl?: any;
  jobs?: any;
  people?: any;
  resdexNaukriUrl?: string;
  source?: string;
  startChat?: any;
  startChatCompleted?: any;
  startMeetingSchedulingChat?: any;
  startMeetingSchedulingChatCompleted?: any;
  startVideoInterviewChat?: any;
  startVideoInterviewChatCompleted?: any;
  stopChat?: any;
  stopChatCompleted?: any;
  stopMeetingSchedulingChat?: any;
  stopMeetingSchedulingChatCompleted?: any;
  stopVideoInterviewChat?: any;
  stopVideoInterviewChatCompleted?: any;
};

export type UnreadMessages = {
  listOfUnreadMessages: Array<{
    candidateId: string;
    ManyUnreadMessages: any[];
  }>;
};

export interface ChatTableProps {
  candidates: CandidateNode[];
  selectedCandidate: string | null;
  unreadMessages: UnreadMessages;
  onCandidateSelect: (id: string) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  onBulkMessage?: (selectedIds: string[]) => void;
  onBulkDelete?: (selectedIds: string[]) => void;
  onBulkAssign?: (selectedIds: string[]) => void;
  onReorder?: (selectedIds: CandidateNode[]) => void;
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