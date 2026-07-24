import { LightButton } from 'twenty-ui';
import { IconBriefcase, IconFileText, IconMessage } from 'twenty-ui/icons';
import { ActionMenuComponentInstanceContext } from '@/action-menu/states/contexts/ActionMenuComponentInstanceContext';
import type { AssistantTableData } from '@/assistant/components/AssistantDetailsTable';
import type { OrgChartPreview } from '@/assistant/types/assistant.types';
import { searchResultsState } from '@/candidate-search/states/searchResultsState';
import { HotTableActionMenu } from '@/candidate-table/HotTableActionMenu';
import { selectedCandidateIdState } from '@/candidate-table/states/states';
import { ContextStoreComponentInstanceContext } from '@/context-store/states/contexts/ContextStoreComponentInstanceContext';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { AppPath } from '@/types/AppPath';
import { useRightDrawer } from '@/ui/layout/right-drawer/hooks/useRightDrawer';
import { RightDrawerPages } from '@/ui/layout/right-drawer/types/RightDrawerPages';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import styled from '@emotion/styled';
import { Loader } from 'twenty-ui';
import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetRecoilState } from 'recoil';

import { getAppPath } from '~/utils/navigation/getAppPath';

const LazyArxOrgChart = React.lazy(() =>
  import('@/orgchart/ArxOrgChart').then((m) => ({ default: m.ArxOrgChart })),
);

const DataTable = lazy(() =>
  import('@/candidate-table/DataTable').then((module) => ({
    default: module.DataTable,
  })),
);

const AssistantDetailsTable = lazy(() =>
  import('@/assistant/components/AssistantDetailsTable').then((module) => ({
    default: module.AssistantDetailsTable,
  })),
);

/** Virtual jobId used for assistant-fetched LinkedIn candidates in DataTable. */
export const ASSISTANT_SEARCH_JOB_ID = '__search__';

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

const StyledOrgChartPanel = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 400px;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  overflow: hidden;
  background: ${({ theme }) => theme.background.secondary};
`;

const StyledOrgChartLoader = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
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
  onSelectionChange?: (ids: string[]) => void;
  orgChart?: OrgChartPreview | null;
  onDismissOrgChart?: () => void;
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

function parseCompanyFromHeadline(headline: string): string {
  if (!headline) return '';

  const patterns = [
    /at\s+([^|]+)/i,
    /@\s+([^|]+)/i,
    /\|\s*([^|]+)/,
    /-\s*([^-]+)$/,
  ];

  for (const pattern of patterns) {
    const match = headline.match(pattern);
    if (match?.[1]) {
      const company = match[1].trim();
      if (company.length > 0 && company.length < 100) {
        return company;
      }
    }
  }

  return '';
}

/**
 * Transform a raw table row (from MCP table_data events) into a minimal
 * TransformedCandidateForTable-compatible shape that DataTable can display.
 * The key requirement is a unique `tempId` so deduplicateSearchResults keeps
 * the row instead of dropping it.
 */
function transformRowForDataTable(row: Record<string, unknown>): Record<string, unknown> {
  const linkedinUrl = String(row.linkedinUrl ?? row.linkedin_url ?? '');
  const headline = String(row.headline ?? '');
  const companyFromHeadline = parseCompanyFromHeadline(headline);
  // Derive a stable ID from the LinkedIn URL slug; fall back to UUID.
  const slug = linkedinUrl.split('/in/')[1]?.replace(/\/$/, '') ?? '';
  const tempId = String(row.tempId ?? row.id ?? (slug || crypto.randomUUID()));

  const name = String(row.name ?? row.fullName ?? '');
  const nameParts = name.trim().split(/\s+/);

  return {
    ...row,
    id: row.id ?? null,
    tempId,
    __isFetched: true,
    fullName: name,
    firstName: nameParts[0] ?? '',
    lastName: nameParts.slice(1).join(' '),
    jobTitle: String(row.jobTitle ?? row.job_title ?? headline),
    headline,
    company: String(row.company ?? row.jobCompanyName ?? companyFromHeadline),
    jobCompanyName: String(
      row.jobCompanyName ?? row.company ?? companyFromHeadline,
    ),
    location: String(row.location ?? row.locationName ?? ''),
    locationName: String(row.location ?? row.locationName ?? ''),
    // Wrap LinkedIn URL in object format expected by DataTable columns
    linkedinUrl: linkedinUrl ? { primaryLinkUrl: linkedinUrl } : (row.linkedinUrl ?? undefined),
    phoneNumber: row.phoneNumber ?? { primaryPhoneNumber: '' },
    email: row.email ?? { primaryEmail: '' },
    // UI state defaults expected by DataTable
    candConversationStatus: row.candConversationStatus ?? '',
    status: row.status ?? '',
    startChat: false,
    stopChat: false,
    whatsappMessages: row.whatsappMessages ?? { edges: [] },
    emailMessages: row.emailMessages ?? { edges: [] },
    otherFields: row.otherFields ?? {},
    candidateReminders: row.candidateReminders ?? { edges: [] },
    uniqueStringKey: tempId,
    peopleId: row.peopleId ?? null,
    updatedAt: row.updatedAt ?? '',
    createdAt: row.createdAt ?? '',
  };
}

export const AssistantResultsPanel = ({
  tableData,
  maxTableHeight = 600,
  threadId,
  onSync,
  jobIdFromThread,
  onSelectionChange,
  orgChart,
  onDismissOrgChart,
}: AssistantResultsPanelProps) => {
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const navigate = useNavigate();
  const { openRightDrawer } = useRightDrawer();
  const setSelectedCandidateId = useSetRecoilState(selectedCandidateIdState);
  const setSearchResults = useSetRecoilState(searchResultsState);

  useEffect(() => {
    setSelectedRowIndex(null);
  }, [tableData]);

  const jobIdFromRows = getJobIdFromTableData(tableData);
  // Thread job is for navigation (e.g. “View in job”) — not for binding DataTable data.
  // LinkedIn search rows usually omit jobId; falling back to thread jobId made the panel
  // load the job’s GraphQL candidates instead of hydrating these snapshot rows (wrong count).
  const jobIdForThreadActions = jobIdFromRows ?? jobIdFromThread ?? undefined;
  const dataTableJobId = jobIdFromRows ?? ASSISTANT_SEARCH_JOB_ID;

  // When rows are not tied to a CRM job (no jobId on data), push snapshot rows into Recoil
  // so DataTable (__search__) shows the same people as the chat preview.
  useEffect(() => {
    if (
      tableData?.tableType !== 'candidates' ||
      jobIdFromRows ||
      !tableData?.rows?.length
    ) {
      return;
    }
    const transformed = (tableData.rows as Record<string, unknown>[]).map(
      transformRowForDataTable,
    );
    setSearchResults(transformed as any[]);
    return () => {
      setSearchResults([]);
    };
  }, [tableData, jobIdFromRows, setSearchResults]);

  // Read selection from the DataTable's context store for the active jobId instance.
  const activeContextKey = dataTableJobId;
  const searchTableRule = useRecoilComponentValueV2(
    contextStoreTargetedRecordsRuleComponentState,
    activeContextKey,
  );

  useEffect(() => {
    if (!onSelectionChange) return;
    const ids =
      searchTableRule.mode === 'selection'
        ? searchTableRule.selectedRecordIds
        : [];
    onSelectionChange(ids);
  }, [searchTableRule, onSelectionChange]);

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
    if (!jobIdForThreadActions) return;
    openRightDrawer(RightDrawerPages.ClientChat, {
      title: 'Client chat (mock)',
      Icon: IconMessage,
    });
  }, [jobIdForThreadActions, openRightDrawer]);

  const handleOpenInJobs = useCallback(() => {
    navigate(getAppPath(AppPath.Jobs));
  }, [navigate]);
  const handleViewInJob = useCallback(() => {
    if (!jobIdForThreadActions) return;
    navigate(`/job/${jobIdForThreadActions}`);
  }, [navigate, jobIdForThreadActions]);

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

  // Full CRM candidate DataTable only for candidate-shaped tool results; jobs, companies,
  // interviews, etc. use plain Handsontable (AssistantDetailsTable).
  const hasTableRows = Boolean(tableData?.rows?.length && tableData?.columns?.length);
  const showDataTable =
    hasTableRows && tableData?.tableType === 'candidates';

  if (orgChart?.companyId) {
    return (
      <StyledResultsPanel>
        <StyledResultsHeader>
          <StyledResultsTitle>
            Org chart — {orgChart.companyName}
          </StyledResultsTitle>
          {onDismissOrgChart && (
            <StyledActionButton title="Back to table" onClick={onDismissOrgChart} />
          )}
        </StyledResultsHeader>
        <StyledOrgChartPanel>
          <Suspense
            fallback={
              <StyledOrgChartLoader>
                <Loader />
              </StyledOrgChartLoader>
            }
          >
            <LazyArxOrgChart
              companyId={orgChart.companyId}
              companyName={orgChart.companyName}
            />
          </Suspense>
        </StyledOrgChartPanel>
      </StyledResultsPanel>
    );
  }

  if (!hasTableRows) {
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
      {showDataTable && (
        <ContextStoreComponentInstanceContext.Provider
          value={{ instanceId: dataTableJobId }}
        >
          <ActionMenuComponentInstanceContext.Provider
            value={{ instanceId: dataTableJobId }}
          >
            <HotTableActionMenu tableId={dataTableJobId} />
          </ActionMenuComponentInstanceContext.Provider>
        </ContextStoreComponentInstanceContext.Provider>
      )}
      {(jobIdForThreadActions ||
        (hasSelection && tableData?.tableType === 'candidates')) && (
        <StyledActionsBar>
          {hasSelection && tableData?.tableType === 'candidates' && (
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
          {jobIdForThreadActions && (
            <StyledActionButton
              title="View in job"
              onClick={handleViewInJob}
              Icon={IconBriefcase}
            />
          )}
          {jobIdForThreadActions && (
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
        <Suspense fallback={<Loader />}>
          {showDataTable ? (
            <DataTable jobId={dataTableJobId} />
          ) : (
            <AssistantDetailsTable
              data={tableData!}
              maxHeight={maxTableHeight}
              onSelectRow={(index) => setSelectedRowIndex(index)}
            />
          )}
        </Suspense>
      </StyledTableWrapper>
    </StyledResultsPanel>
  );
};
