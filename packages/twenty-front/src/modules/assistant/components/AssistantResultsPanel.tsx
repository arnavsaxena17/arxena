import {
  AssistantDetailsTable,
  AssistantTableData,
} from '@/assistant/components/AssistantDetailsTable';
import { DataTable } from '@/candidate-table/DataTable';
import { selectedCandidateIdState } from '@/candidate-table/states/states';
import { AppPath } from '@/types/AppPath';
import { useRightDrawer } from '@/ui/layout/right-drawer/hooks/useRightDrawer';
import { RightDrawerPages } from '@/ui/layout/right-drawer/types/RightDrawerPages';
import styled from '@emotion/styled';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetRecoilState } from 'recoil';
import {
  IconBriefcase,
  IconFileText,
  IconMessage,
  LightButton,
} from 'twenty-ui';
import { getAppPath } from '~/utils/navigation/getAppPath';

const StyledResultsPanel = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing(4)};
  overflow: auto;
`;

const StyledResultsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const StyledResultsTitle = styled.div`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledResultsEmpty = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledActionsBar = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  flex-wrap: wrap;
`;

const StyledTableWrapper = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
`;

const StyledActionButton = styled(LightButton)`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
`;

type AssistantResultsPanelProps = {
  tableData: AssistantTableData | null;
  maxTableHeight?: number;
  threadId?: string;
  onSync?: () => Promise<void>;
  jobIdFromThread?: string | null;
};

function getRowId(row: Record<string, unknown>): string | undefined {
  const id = row.id ?? row.candidateId ?? row.candidate_id;
  return typeof id === 'string' ? id : undefined;
}

function getJobIdFromRow(row: Record<string, unknown>): string | undefined {
  const jobId = row.jobId ?? row.job_id ?? row.jobsId ?? row.jobs_id;
  return typeof jobId === 'string' ? jobId : undefined;
}

function getJobIdFromTableData(tableData: AssistantTableData | null): string | undefined {
  if (!tableData?.rows?.length) return undefined;
  const first = tableData.rows[0] as Record<string, unknown>;
  return getJobIdFromRow(first);
}

export const AssistantResultsPanel = ({
  tableData,
  maxTableHeight = 600,
  threadId,
  onSync,
  jobIdFromThread,
}: AssistantResultsPanelProps) => {
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const navigate = useNavigate();
  const { openRightDrawer } = useRightDrawer();
  const setSelectedCandidateId = useSetRecoilState(selectedCandidateIdState);

  useEffect(() => {
    setSelectedRowIndex(null);
  }, [tableData]);

  const handleSync = useCallback(async () => {
    if (!onSync) return;
    setSyncing(true);
    try {
      await onSync();
    } finally {
      setSyncing(false);
    }
  }, [onSync]);

  const selectedRow: Record<string, unknown> | null =
    tableData && tableData.rows?.length && selectedRowIndex != null && selectedRowIndex >= 0 && selectedRowIndex < tableData.rows.length
      ? (tableData.rows[selectedRowIndex] as Record<string, unknown>)
      : null;

  const jobIdFromResults = getJobIdFromTableData(tableData);
  // Prefer jobId coming from the table data (e.g. snapshot rows)
  const effectiveJobId = jobIdFromResults ?? jobIdFromThread ?? undefined;

  const handleOpenChat = useCallback(() => {
    if (!selectedRow) return;
    const candidateId = getRowId(selectedRow);
    if (!candidateId) return;
    setSelectedCandidateId(candidateId);
    openRightDrawer(RightDrawerPages.CandidateChat, {
      title: `Chat with ${String(selectedRow.name ?? selectedRow.fullName ?? 'Candidate')}`,
      Icon: IconMessage,
    });
  }, [selectedRow, openRightDrawer, setSelectedCandidateId]);

  const handleOpenClientChat = useCallback(() => {
    if (!effectiveJobId) return;
    openRightDrawer(RightDrawerPages.ClientChat, {
      title: 'Client chat (mock)',
      Icon: IconMessage,
    });
  }, [effectiveJobId, openRightDrawer]);

  const handleOpenInJobs = useCallback(() => {
    navigate(getAppPath(AppPath.Jobs));
  }, [navigate]);
  const handleViewInJob = useCallback(() => {
    if (!effectiveJobId) return;
    navigate(`/job/${effectiveJobId}`);
  }, [navigate, effectiveJobId]);

  const handleViewAttachments = useCallback(() => {
    if (!selectedRow) return;
    const candidateId = getRowId(selectedRow);
    if (!candidateId) return;
    setSelectedCandidateId(candidateId);
    window.dispatchEvent(new CustomEvent('openAttachmentPanel', { detail: { candidateId } }));
    openRightDrawer(RightDrawerPages.CandidateChat, {
      title: `Chat with ${String(selectedRow.name ?? 'Candidate')}`,
      Icon: IconMessage,
    });
  }, [selectedRow, openRightDrawer, setSelectedCandidateId]);

  if (!tableData || !tableData.rows?.length || !tableData.columns?.length) {
    return (
      <StyledResultsPanel>
        <StyledResultsHeader>
          <StyledResultsTitle>Results</StyledResultsTitle>
          {threadId && onSync && (
            <StyledActionButton
              title="Sync"
              onClick={handleSync}
              disabled={syncing}
            />
          )}
        </StyledResultsHeader>
        <StyledResultsEmpty>
          Results will appear here after you run a search or ask for data.
        </StyledResultsEmpty>
      </StyledResultsPanel>
    );
  }

  const hasSelection = selectedRowIndex != null && selectedRowIndex >= 0;

  return (
    <StyledResultsPanel>
      <StyledResultsHeader>
        <StyledResultsTitle>Results</StyledResultsTitle>
        {threadId && onSync && (
          <StyledActionButton
            title={syncing ? 'Syncing…' : 'Sync'}
            onClick={handleSync}
            disabled={syncing}
          />
        )}
      </StyledResultsHeader>
      {(hasSelection || effectiveJobId) && (
        <StyledActionsBar>
          {hasSelection && (
            <>
              <StyledActionButton
                title="View chat"
                onClick={handleOpenChat}
                Icon={IconMessage}
              />
              <StyledActionButton
                title="View CV / Attachments"
                onClick={handleViewAttachments}
                Icon={IconFileText}
              />
            </>
          )}
          {effectiveJobId && (
            <StyledActionButton
              title="View in job"
              onClick={handleViewInJob}
              Icon={IconBriefcase}
            />
          )}
          {effectiveJobId && (
            <StyledActionButton
              title="View client chat"
              onClick={handleOpenClientChat}
              Icon={IconMessage}
            />
          )}
          <StyledActionButton
            title="Open in Jobs"
            onClick={handleOpenInJobs}
            Icon={IconBriefcase}
          />
        </StyledActionsBar>
      )}
      <StyledTableWrapper>
        {effectiveJobId ? (
          <DataTable jobId={effectiveJobId} />
        ) : (
          <AssistantDetailsTable
            data={tableData}
            maxHeight={maxTableHeight}
            onSelectRow={(index) => setSelectedRowIndex(index)}
          />
        )}
      </StyledTableWrapper>
    </StyledResultsPanel>
  );
};
