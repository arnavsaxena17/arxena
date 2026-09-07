import { applyCandidateJourneySummaryToRow } from '@/candidate-table/ProcessedData';
import { type ProcessedDataItem } from '@/candidate-table/TableColumns';

const buildRow = (overrides?: Partial<ProcessedDataItem>): ProcessedDataItem =>
  ({
    id: 'candidate-1',
    personId: 'person-1',
    name: 'Mock Profile1',
    phone: '',
    email: '',
    remarks: '',
    status: 'No Status',
    candConversationStatus: 'No Conversation',
    outreachSequenceStage: 'QUEUED',
    workflowRunStatus: '',
    nextStep: '',
    checkbox: false,
    startChat: false,
    startChatCompleted: false,
    jobTitle: 'VP Talent',
    updatedAt: '',
    stopChat: false,
    source: 'N/A',
    messagingChannel: '',
    resdexNaukriUrl: '',
    hiringNaukriUrl: '',
    linkedinUrl: '',
    lastMessage: '',
    messagesExchanged: '',
    hasCv: false,
    ...overrides,
  }) as ProcessedDataItem;

describe('applyCandidateJourneySummaryToRow', () => {
  it('copies failed workflow run status and next-step error onto the row', () => {
    const row = applyCandidateJourneySummaryToRow({
      row: buildRow(),
      runSummary: {
        status: 'FAILED',
        currentStepName: 'Send LinkedIn connection',
        currentStepKind: 'FAILED',
        resumeAt: null,
        pendingReason: null,
        needsApproval: false,
        errorMessage: 'LinkedIn account disconnected',
      },
    });

    expect(row.workflowRunStatus).toBe('FAILED');
    expect(row.nextStep).toBe(
      'Send LinkedIn connection · LinkedIn account disconnected',
    );
  });

  it('keeps empty run status when the candidate has no journey summary', () => {
    const row = applyCandidateJourneySummaryToRow({
      row: buildRow(),
      runSummary: undefined,
    });

    expect(row.workflowRunStatus).toBe('');
    expect(row.nextStep).toBe('');
  });
});
