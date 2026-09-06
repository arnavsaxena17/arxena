import { styled } from '@linaria/react';
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { isDefined } from 'twenty-shared/utils';
import { Loader } from 'twenty-ui/feedback';
import {
  type IconComponent,
  IconArrowUp,
  IconDatabase,
  IconPlayerStop,
  IconUserPlus,
} from 'twenty-ui/icon';
import { IconButton } from 'twenty-ui/input';
import { AppTooltip, TooltipDelay } from 'twenty-ui/surfaces';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { searchResultsState } from '@/candidate-search/states/searchResultsState';
import { ProjectTopBar } from '@/candidate-table/components/ProjectTopBar';
import { TableContainer } from '@/candidate-table/components/styled';
import { HotTableActionMenu } from '@/candidate-table/HotTableActionMenu';
import { chatSearchQueryState } from '@/candidate-table/states/chatSearchQueryState';
import { dataTableRefreshFunctionState } from '@/candidate-table/states/dataTableRefreshFunctionState';
import { tableStateAtom } from '@/candidate-table/states/states';
import { ContextStoreComponentInstanceContext } from '@/context-store/states/contexts/ContextStoreComponentInstanceContext';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { OutreachSafeDashboardPath } from '@/outreach-home/components/OutreachSafeDashboardPath';
import { useAddOutreachRecordsToCrm } from '@/outreach-home/hooks/useAddOutreachRecordsToCrm';
import { useOutreachEnroll } from '@/outreach-home/hooks/useOutreachEnroll';
import { useOutreachProjectJourneySummary } from '@/outreach-home/hooks/useOutreachProjectJourneySummary';
import { useStopOutreach } from '@/outreach-home/hooks/useStopOutreach';
import {
  type OutreachCompanyRow,
  type OutreachPersonRow,
} from '@/outreach-home/types/outreach-home.types';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';

const DataTable = lazy(() =>
  import('@/candidate-table/DataTable').then((module) => ({
    default: module.DataTable,
  })),
);

const StyledPanel = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  position: relative;
`;

const StyledEmpty = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.5;
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledLoading = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: center;
  min-height: 240px;
  padding: ${themeCssVariables.spacing[6]};
`;

const StyledStageFilters = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
  min-width: 0;
`;

const StyledStageChip = styled.button<{ isActive: boolean }>`
  background: ${({ isActive }) =>
    isActive
      ? themeCssVariables.background.quaternary
      : themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.xs};
  height: 24px;
  padding: ${`${themeCssVariables.spacing[0.5]} ${themeCssVariables.spacing[2]}`};
  white-space: nowrap;

  &:hover {
    border-color: ${themeCssVariables.border.color.medium};
    color: ${themeCssVariables.font.color.primary};
  }
`;

const StyledDashboardLink = styled(Link)`
  color: ${themeCssVariables.color.blue};
  font-size: ${themeCssVariables.font.size.xs};
  padding: ${`${themeCssVariables.spacing[0.5]} ${themeCssVariables.spacing[1]}`};
  text-decoration: none;
  white-space: nowrap;

  &:hover {
    text-decoration: underline;
  }
`;

const StyledActionIcons = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledTooltipAnchor = styled.div`
  display: inline-block;
  position: relative;
`;

const StyledBottomActionMenu = styled.div`
  background-color: ${themeCssVariables.background.primary};
  bottom: 0;
  left: 0;
  position: fixed;
  width: 100%;
  z-index: 1000;
`;

const PEOPLE_QUEUE_CHIPS = [
  { id: 'queued', label: 'To send' },
  { id: 'connection_sent', label: 'Connect sent' },
  { id: 'awaiting_reply', label: 'Awaiting reply' },
  { id: 'needs_approval', label: 'Needs approval' },
  { id: 'workflow_failed', label: 'Workflow failed' },
  { id: 'intent', label: 'Intent' },
  { id: 'follow_up_due', label: 'Follow-up due' },
  { id: 'meeting_booked', label: 'Meeting booked' },
  { id: 'not_interested', label: 'Not interested' },
  { id: 'snoozed', label: 'Snoozed' },
  { id: 'stopped', label: 'Stopped' },
] as const;

type OutreachPeopleQueueFilter =
  | (typeof PEOPLE_QUEUE_CHIPS)[number]['id']
  | 'all';

const FOLLOW_UP_DUE_MS = 7 * 24 * 60 * 60 * 1000;

const formatChipLabel = (label: string, count: number | null): string =>
  isDefined(count) ? `${label} (${count})` : label;

const isFollowUpDue = (resumeAt: string | null | undefined): boolean => {
  if (!isDefined(resumeAt)) {
    return false;
  }

  const resumeMs = new Date(resumeAt).getTime();

  return Number.isFinite(resumeMs) && resumeMs <= Date.now() + FOLLOW_UP_DUE_MS;
};

const mapOutreachPersonToDataTableRow = (
  person: OutreachPersonRow,
  projectId: string | null | undefined,
): Record<string, unknown> => {
  const nameParts = person.name.trim().split(/\s+/);
  const linkedinUrl = person.linkedinUrl.startsWith('http')
    ? person.linkedinUrl
    : person.linkedinUrl
      ? `https://${person.linkedinUrl}`
      : '';

  return {
    id: person.id,
    tempId: person.id,
    __isFetched: true,
    isOutreachHomeRow: true,
    outreachProjectId: projectId ?? '',
    fullName: person.name,
    name: person.name,
    firstName: nameParts[0] ?? '',
    lastName: nameParts.slice(1).join(' '),
    jobTitle: person.title,
    headline: person.title,
    company: person.companyName,
    jobCompanyName: person.companyName,
    location: '',
    locationName: '',
    linkedinUrl: linkedinUrl
      ? { primaryLinkUrl: linkedinUrl }
      : { primaryLinkUrl: '' },
    phoneNumber: { primaryPhoneNumber: '' },
    email: { primaryEmail: person.email || '' },
    status: '',
    candConversationStatus: '',
    outreachSequenceStage: person.stage,
    outreachConversationStage: person.outreachConversationStage ?? 'NONE',
    workflowRunStatus: person.workflowRunStatus ?? '',
    nextStep: person.nextStepLabel ?? '',
    nextRetry: person.nextRetryAt ?? '',
    needsApproval: person.needsApproval === true,
    replyAfterTouch: person.replyAfterTouch ?? '',
    lastMessage: person.lastInboundCopy ?? '',
    lastInboundAt: person.lastInboundAt ?? '',
    lastOutboundAt: person.lastOutboundAt ?? '',
    nextFollowUp: person.outreachResumeAt ?? '',
    candidateFlags: {
      engagementStatus: Boolean(person.stage),
      startChat: false,
      stopChat: false,
    },
    chatMessages: { edges: [] },
    emailMessages: { edges: [] },
    otherFields: {
      warmPath: person.warmPath,
      companyId: person.companyId,
      candidateId: person.candidateId,
      openOutreachJourneyTab: true,
      pendingChannel: person.pendingChannel ?? '',
      ...(person.experimentVariant
        ? { experimentVariant: person.experimentVariant }
        : {}),
    },
    uniqueStringKey: person.id,
    peopleId: person.id,
    personId: person.id,
    candidateId: person.candidateId,
    updatedAt: '',
    createdAt: '',
    messagesExchanged: person.messagesExchanged ?? '',
  };
};

const TooltipIconButton = ({
  title,
  Icon,
  onClick,
  disabled,
}: {
  title: string;
  Icon: IconComponent;
  onClick?: () => void;
  disabled?: boolean;
}) => {
  const tooltipId = `outreach-people-action-${useId().replace(/:/g, '')}`;

  return (
    <>
      <StyledTooltipAnchor id={tooltipId}>
        <IconButton
          Icon={Icon}
          variant="secondary"
          size="small"
          accent="default"
          ariaLabel={title}
          onClick={onClick}
          disabled={disabled}
        />
      </StyledTooltipAnchor>
      <AppTooltip
        anchorSelect={`#${tooltipId}`}
        content={title}
        place="top"
        delay={TooltipDelay.shortDelay}
        noArrow={false}
        positionStrategy="fixed"
      />
    </>
  );
};

type OutreachPeoplePanelProps = {
  people: OutreachPersonRow[];
  companies: OutreachCompanyRow[];
  projectId: string | null | undefined;
  selectedCompanyId: string | null;
  selectedPersonId: string | null;
  onSelectPersonId: (personId: string | null) => void;
  tableInstanceId: string;
  isLoading?: boolean;
  onRefresh?: () => Promise<void>;
};

export const OutreachPeoplePanel = ({
  people,
  companies,
  projectId,
  selectedCompanyId,
  selectedPersonId,
  onSelectPersonId,
  tableInstanceId,
  isLoading = false,
  onRefresh,
}: OutreachPeoplePanelProps) => {
  const setSearchResults = useSetAtomState(searchResultsState);
  const setTableStateAtom = useSetAtomState(tableStateAtom);
  const setChatSearchQuery = useSetAtomState(chatSearchQueryState);
  const setDataTableRefreshFunction = useSetAtomState(
    dataTableRefreshFunctionState,
  );
  const [isTableDataReady, setIsTableDataReady] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { isPersisting, addPeopleToCrm } = useAddOutreachRecordsToCrm();
  const { enrollSelectedPeople, promoteDeferredCandidate } =
    useOutreachEnroll();
  const { isStopping, stopOutreachForCandidates } = useStopOutreach();
  const {
    summary: journeySummary,
    isLoading: isJourneySummaryLoading,
    refetch: refetchJourneySummary,
  } = useOutreachProjectJourneySummary(projectId);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const [stageFilter, setStageFilter] =
    useState<OutreachPeopleQueueFilter>('all');

  const stageCounts = useMemo(() => {
    if (isJourneySummaryLoading || !isDefined(journeySummary)) {
      return null;
    }

    const byStage = journeySummary.byStage;
    const byConversation = journeySummary.byConversationStage ?? {};

    return {
      all: journeySummary.totalEnrolled,
      queued: byStage.QUEUED ?? 0,
      connection_sent: byStage.CONNECTION_SENT ?? 0,
      awaiting_reply:
        (byStage.CONNECTION_ACCEPTED ?? 0) + (byStage.WAITING_REPLY ?? 0),
      needs_approval: journeySummary.needsApproval,
      workflow_failed: journeySummary.workflowFailed ?? 0,
      intent: byConversation.INTENT ?? 0,
      follow_up_due: journeySummary.dueThisWeek,
      meeting_booked: byConversation.MEETING_BOOKED ?? 0,
      not_interested: byConversation.NOT_INTERESTED ?? 0,
      snoozed: journeySummary.snoozed,
      stopped: byStage.STOPPED ?? 0,
      dueThisWeek: journeySummary.dueThisWeek,
    };
  }, [isJourneySummaryLoading, journeySummary]);

  const getQueueCount = useCallback(
    (filterId: OutreachPeopleQueueFilter): number | null => {
      if (!isDefined(stageCounts) || filterId === 'all') {
        return stageCounts?.all ?? null;
      }

      return stageCounts[filterId] ?? 0;
    },
    [stageCounts],
  );

  useEffect(() => {
    setChatSearchQuery('');
    setSearchQuery('');

    return () => {
      setChatSearchQuery('');
    };
  }, [setChatSearchQuery, tableInstanceId]);

  const companiesByWorkingSetId = useMemo(() => {
    const map: Record<string, OutreachCompanyRow> = {};

    for (const company of companies) {
      map[company.id] = company;
    }

    return map;
  }, [companies]);

  const filteredPeople = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return people.filter((person) => {
      if (
        isDefined(selectedCompanyId) &&
        person.companyId !== selectedCompanyId
      ) {
        return false;
      }

      if (stageFilter === 'needs_approval') {
        if (person.needsApproval !== true) {
          return false;
        }
      } else if (stageFilter === 'workflow_failed') {
        if (person.workflowRunStatus !== 'FAILED') {
          return false;
        }
      } else if (stageFilter === 'awaiting_reply') {
        if (
          person.stage !== 'connection_accepted' &&
          person.stage !== 'followed_up' &&
          person.stage !== 'followed_up_2' &&
          person.stage !== 'followed_up_3' &&
          person.stage !== 'waiting_reply'
        ) {
          return false;
        }
      } else if (stageFilter === 'intent') {
        if (person.outreachConversationStage !== 'INTENT') {
          return false;
        }
      } else if (stageFilter === 'follow_up_due') {
        if (!isFollowUpDue(person.outreachResumeAt)) {
          return false;
        }
      } else if (stageFilter === 'meeting_booked') {
        if (person.outreachConversationStage !== 'MEETING_BOOKED') {
          return false;
        }
      } else if (stageFilter === 'not_interested') {
        if (person.outreachConversationStage !== 'NOT_INTERESTED') {
          return false;
        }
      } else if (stageFilter === 'snoozed') {
        if (person.outreachConversationStage !== 'SNOOZED') {
          return false;
        }
      } else if (stageFilter !== 'all' && person.stage !== stageFilter) {
        return false;
      }

      if (normalizedQuery.length === 0) {
        return true;
      }

      const haystack =
        `${person.name} ${person.title} ${person.companyName}`.toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [people, searchQuery, selectedCompanyId, stageFilter]);

  const tableRows = useMemo(
    () =>
      filteredPeople.map((person) =>
        mapOutreachPersonToDataTableRow(person, projectId),
      ),
    [filteredPeople, projectId],
  );

  useLayoutEffect(() => {
    setIsTableDataReady(false);
  }, [tableInstanceId]);

  useLayoutEffect(() => {
    if (tableRows.length === 0) {
      setSearchResults((previous) => (previous.length === 0 ? previous : []));
      setTableStateAtom((previous) => ({
        ...previous,
        rawData: [],
        isLoading: false,
      }));
      setIsTableDataReady(true);

      return;
    }

    // Must compare Stage/Next (and related) fields — ID-only equality left
    // Handsontable stuck on stale journey labels after refresh/live refetch.
    setSearchResults((previous) => {
      if (
        previous.length === tableRows.length &&
        previous.every((row, index) => {
          const nextRow = tableRows[index];

          if (!isDefined(nextRow)) {
            return false;
          }

          return (
            (row.tempId || row.id) === nextRow.id &&
            row.outreachSequenceStage === nextRow.outreachSequenceStage &&
            row.nextStep === nextRow.nextStep &&
            row.nextRetry === nextRow.nextRetry &&
            row.outreachConversationStage ===
              nextRow.outreachConversationStage &&
            row.workflowRunStatus === nextRow.workflowRunStatus &&
            row.needsApproval === nextRow.needsApproval &&
            row.messagesExchanged === nextRow.messagesExchanged &&
            row.lastInboundAt === nextRow.lastInboundAt &&
            row.lastOutboundAt === nextRow.lastOutboundAt &&
            row.nextFollowUp === nextRow.nextFollowUp
          );
        })
      ) {
        return previous;
      }

      return tableRows as never[];
    });

    setTableStateAtom((previous) => {
      if (previous.rawData.length === 0 && previous.isLoading === false) {
        return previous;
      }

      return {
        ...previous,
        rawData: [],
        isLoading: false,
      };
    });
    setIsTableDataReady(true);
  }, [setSearchResults, setTableStateAtom, tableRows]);

  useEffect(() => {
    return () => {
      setSearchResults([]);
    };
  }, [setSearchResults]);

  const contextStoreTargetedRecordsRule = useAtomComponentStateValue(
    contextStoreTargetedRecordsRuleComponentState,
    tableInstanceId,
  );

  useEffect(() => {
    if (contextStoreTargetedRecordsRule.mode !== 'selection') {
      return;
    }

    const nextId = contextStoreTargetedRecordsRule.selectedRecordIds[0];

    if (nextId && nextId !== selectedPersonId) {
      onSelectPersonId(nextId);
    }
  }, [onSelectPersonId, selectedPersonId, contextStoreTargetedRecordsRule]);

  const selectedPeople = useMemo(() => {
    if (contextStoreTargetedRecordsRule.mode === 'selection') {
      const selectedIds = new Set(
        contextStoreTargetedRecordsRule.selectedRecordIds,
      );

      if (selectedIds.size > 0) {
        return filteredPeople.filter((person) => selectedIds.has(person.id));
      }
    }

    if (selectedPersonId) {
      return filteredPeople.filter((person) => person.id === selectedPersonId);
    }

    return [];
  }, [filteredPeople, selectedPersonId, contextStoreTargetedRecordsRule]);

  const deferredCandidateId = selectedPeople.find(
    (person) => person.stage === 'deferred' && isDefined(person.candidateId),
  )?.candidateId;

  const stoppableCandidateIds = selectedPeople
    .map((person) => person.candidateId)
    .filter((candidateId): candidateId is string => isDefined(candidateId));

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);

    try {
      await Promise.all([
        onRefresh?.() ?? Promise.resolve(),
        refetchJourneySummary(),
      ]);
      enqueueSuccessSnackBar({ message: 'People list refreshed' });
    } catch {
      enqueueErrorSnackBar({ message: 'Failed to refresh people list' });
    } finally {
      setIsRefreshing(false);
    }
  }, [
    enqueueErrorSnackBar,
    enqueueSuccessSnackBar,
    isRefreshing,
    onRefresh,
    refetchJourneySummary,
  ]);

  // Cmd+K delete (and other actions) call dataTableRefreshFunctionState; point it
  // at the outreach working-set refresh instead of candidate-table project fetch.
  useEffect(() => {
    setDataTableRefreshFunction(() => async () => {
      await Promise.all([
        onRefresh?.() ?? Promise.resolve(),
        refetchJourneySummary(),
      ]);
    });

    return () => {
      setDataTableRefreshFunction(null);
    };
  }, [onRefresh, refetchJourneySummary, setDataTableRefreshFunction]);

  const handleClearFilters = useCallback(() => {
    setStageFilter('all');
    setSearchQuery('');
    setChatSearchQuery('');
  }, [setChatSearchQuery]);

  const stageFilterChips = (
    <StyledStageFilters>
      <StyledStageChip
        type="button"
        isActive={stageFilter === 'all'}
        onClick={() => setStageFilter('all')}
      >
        {formatChipLabel('All stages', getQueueCount('all'))}
      </StyledStageChip>
      {PEOPLE_QUEUE_CHIPS.map((chip) => (
        <StyledStageChip
          key={chip.id}
          type="button"
          isActive={stageFilter === chip.id}
          onClick={() => setStageFilter(chip.id)}
        >
          {formatChipLabel(chip.label, getQueueCount(chip.id))}
        </StyledStageChip>
      ))}
      <OutreachSafeDashboardPath>
        {(dashboardPath) =>
          isDefined(dashboardPath) ? (
            <StyledDashboardLink to={dashboardPath}>
              Open Outreach dashboard
            </StyledDashboardLink>
          ) : null
        }
      </OutreachSafeDashboardPath>
    </StyledStageFilters>
  );

  const outreachActionIcons = (
    <StyledActionIcons>
      <TooltipIconButton
        title={
          selectedPeople.length > 0
            ? `Add selected to CRM (${selectedPeople.length})`
            : 'Add selected to CRM'
        }
        Icon={IconDatabase}
        disabled={selectedPeople.length === 0 || isPersisting}
        onClick={() =>
          addPeopleToCrm({
            people: selectedPeople,
            companiesByWorkingSetId,
          })
        }
      />
      <TooltipIconButton
        title={
          selectedPeople.length > 0
            ? `Enroll in outreach (${selectedPeople.length})`
            : 'Enroll in outreach'
        }
        Icon={IconUserPlus}
        disabled={selectedPeople.length === 0 || isPersisting}
        onClick={() =>
          enrollSelectedPeople(selectedPeople, companiesByWorkingSetId)
        }
      />
      <TooltipIconButton
        title={
          stoppableCandidateIds.length > 0
            ? `Stop outreach (${stoppableCandidateIds.length})`
            : 'Stop outreach'
        }
        Icon={IconPlayerStop}
        disabled={stoppableCandidateIds.length === 0 || isStopping}
        onClick={() => {
          void stopOutreachForCandidates(stoppableCandidateIds);
        }}
      />
      {isDefined(deferredCandidateId) && (
        <TooltipIconButton
          title="Promote deferred"
          Icon={IconArrowUp}
          onClick={() => promoteDeferredCandidate(deferredCandidateId)}
        />
      )}
    </StyledActionIcons>
  );

  if (isLoading && people.length === 0) {
    return (
      <StyledLoading>
        <Loader />
        Loading people…
      </StyledLoading>
    );
  }

  return (
    <StyledPanel>
      <ProjectTopBar
        showSearch={true}
        searchPlaceholder="Search people..."
        onSearch={setSearchQuery}
        showRefetch={true}
        onRefresh={() => {
          void handleRefresh();
        }}
        isRefreshing={isRefreshing}
        showClearAll={true}
        onClearAll={handleClearFilters}
        showJobStatusToggle={false}
        showFilterChips={false}
        showRedirectToObject={false}
        showImportCandidates={false}
        showStatistics={false}
        showAddJob={false}
        showEnrichment={false}
        showSorting={false}
        showValidateJobData={false}
        showBatchActions={false}
        centerComponent={stageFilterChips}
        rightComponent={outreachActionIcons}
      />

      {people.length === 0 ? (
        <StyledEmpty>
          No target people in this project yet. Use Setup → Find people (Ask AI)
          to discover target roles from your ICP at companies on this project.
          They stay on the People tab until you Add to CRM or Enroll, which
          creates Company and Person records (plus enrollment) under this
          Project.
        </StyledEmpty>
      ) : filteredPeople.length === 0 ? (
        <StyledEmpty>
          No people match the current search or stage filter.
        </StyledEmpty>
      ) : (
        <ContextStoreComponentInstanceContext.Provider
          value={{ instanceId: tableInstanceId }}
        >
          <TableContainer>
            {isTableDataReady ? (
              <Suspense fallback={<Loader />}>
                <DataTable projectId={tableInstanceId} />
              </Suspense>
            ) : (
              <Loader />
            )}
          </TableContainer>
          <StyledBottomActionMenu>
            <HotTableActionMenu tableId={tableInstanceId} />
          </StyledBottomActionMenu>
        </ContextStoreComponentInstanceContext.Provider>
      )}
    </StyledPanel>
  );
};
