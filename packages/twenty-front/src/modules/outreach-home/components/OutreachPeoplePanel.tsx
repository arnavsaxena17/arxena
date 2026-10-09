import { styled } from '@linaria/react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { isDefined } from 'twenty-shared/utils';
import { Loader } from 'twenty-ui/feedback';
import {
  IconArrowUp,
  IconDatabase,
  IconFileImport,
  IconFilterOff,
  IconPlayerPlay,
  IconPlayerStop,
  IconRefresh,
  IconUserPlus,
} from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { searchResultsState } from '@/candidate-search/states/searchResultsState';
import { HotTableActionMenu } from '@/candidate-table/HotTableActionMenu';
import { useOpenCandidateChatDrawer } from '@/candidate-table/hooks/useOpenCandidateChatDrawer';
import { chatSearchQueryState } from '@/candidate-table/states/chatSearchQueryState';
import { dataTableRefreshFunctionState } from '@/candidate-table/states/dataTableRefreshFunctionState';
import { tableStateAtom } from '@/candidate-table/states/states';
import { ContextStoreComponentInstanceContext } from '@/context-store/states/contexts/ContextStoreComponentInstanceContext';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { useOpenObjectRecordsSpreadsheetImportDialog } from '@/object-record/spreadsheet-import/hooks/useOpenObjectRecordsSpreadsheetImportDialog';
import {
  getOutreachPeopleTableColumns,
  getOutreachPersonMobileCard,
} from '@/outreach-home/components/record-table/getOutreachPeopleTableColumns';
import { appendOutreachRawJsonColumns } from '@/outreach-home/components/record-table/appendOutreachRawJsonColumns';
import { OutreachAiViewBar } from '@/outreach-home/components/OutreachAiViewBar';
import { useOutreachAiTableView } from '@/outreach-home/hooks/useOutreachAiTableView';
import { type OutreachTableView } from '@/outreach-home/constants/outreach-cache-realtime.constants';
import { OutreachAiColumnProgressBar } from '@/outreach-home/components/OutreachAiColumnProgressBar';
import { type OutreachAiColumnRunProgress } from '@/outreach-home/constants/outreach-cache-realtime.constants';
import { OutreachRecordTable } from '@/outreach-home/components/record-table/OutreachRecordTable';
import {
  OutreachViewBar,
  OutreachViewBarDivider,
  OutreachViewBarIconAction,
  OutreachViewBarPill,
} from '@/outreach-home/components/record-table/OutreachViewBar';
import { OutreachTableEmptyState } from '@/outreach-home/components/record-table/OutreachTableEmptyState';
import { OutreachAssignMemberSelect } from '@/outreach-home/components/OutreachAssignMemberSelect';
import { useOutreachAssignment } from '@/outreach-home/hooks/useOutreachAssignment';
import { useSaveOutreachTargetsToCrm } from '@/outreach-home/hooks/useSaveOutreachTargetsToCrm';
import { useOutreachTablePresentation } from '@/outreach-home/hooks/useOutreachTablePresentation';
import { useOutreachEnroll } from '@/outreach-home/hooks/useOutreachEnroll';
import { useOutreachProjectJourneySummary } from '@/outreach-home/hooks/useOutreachProjectJourneySummary';
import {
  isSameOutreachContext,
  outreachContextState,
} from '@/outreach-home/states/outreachContextState';
import { useStartOutreachSequencerOnCandidates } from '@/outreach-home/hooks/useStartOutreachSequencerOnCandidates';
import { useStopOutreach } from '@/outreach-home/hooks/useStopOutreach';
import {
  type OutreachCompanyRow,
  type OutreachPersonRow,
} from '@/outreach-home/types/outreach-home.types';
import { mapCrmPersonRecordsToOutreachPersonRows } from '@/outreach-home/utils/map-crm-record-to-outreach-row.util';
import { mapOutreachPersonToTableRow } from '@/outreach-home/utils/mapOutreachPersonToTableRow';
import {
  matchesOutreachPeopleQueueFilter,
  OUTREACH_PEOPLE_QUEUE_FILTERS,
  type OutreachPeopleQueueFilter,
} from '@/outreach-home/utils/outreachPeopleQueueFilter';
import { useOutreachPersonCellEdit } from '@/outreach-home/hooks/useOutreachPersonCellEdit';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';

const StyledPanel = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
`;

const StyledLoading = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: center;
  min-height: 240px;
`;

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
  aiColumnRun?: OutreachAiColumnRunProgress | null;
  aiTableView?: OutreachTableView | null;
  appendPeople?: (peopleToAdd: OutreachPersonRow[]) => Promise<void>;
  updateEphemeralPerson?: (
    personId: string,
    applyPatch: (person: OutreachPersonRow) => OutreachPersonRow,
  ) => Promise<void>;
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
  aiColumnRun,
  aiTableView,
  appendPeople,
  updateEphemeralPerson,
}: OutreachPeoplePanelProps) => {
  const setSearchResults = useSetAtomState(searchResultsState);
  const setTableStateAtom = useSetAtomState(tableStateAtom);
  const setChatSearchQuery = useSetAtomState(chatSearchQueryState);
  const setDataTableRefreshFunction = useSetAtomState(
    dataTableRefreshFunctionState,
  );
  const openCandidateChatDrawer = useOpenCandidateChatDrawer();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] =
    useState<OutreachPeopleQueueFilter>('all');
  const { withEditableCells } = useOutreachPersonCellEdit({
    onRefresh,
    updateEphemeralPerson,
  });
  const { isSaving: isPersisting, saveTargetsToCrm } =
    useSaveOutreachTargetsToCrm();
  const {
    columnLayout,
    persistLayout,
    columnFilters,
    persistFilters,
    clearColumnFilters,
  } = useOutreachTablePresentation(projectId, 'people');
  const { externalSort, activeView, clearAiView } = useOutreachAiTableView({
    projectId,
    tab: 'people',
    view: aiTableView,
    persistFilters,
  });
  const { enrollSelectedPeople, promoteDeferredCandidate } =
    useOutreachEnroll();
  const { isStopping, stopOutreachForCandidates } = useStopOutreach();
  const { isStarting, startSequencerOnCandidateIds } =
    useStartOutreachSequencerOnCandidates();
  const {
    summary: journeySummary,
    isLoading: isJourneySummaryLoading,
    refetch: refetchJourneySummary,
  } = useOutreachProjectJourneySummary(projectId);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const {
    members: assignmentMembers,
    ownerNameByCandidateId,
    isWorking: isAssigning,
    assignToMember,
    splitAcrossTeam,
  } = useOutreachAssignment(projectId);
  const { openObjectRecordsSpreadsheetImportDialog } =
    useOpenObjectRecordsSpreadsheetImportDialog('person');

  // Selection lives in the table-scoped context store so the bottom action
  // bar and Cmd+K record actions keep working exactly as with the old grid.
  const contextStoreTargetedRecordsRule = useAtomComponentStateValue(
    contextStoreTargetedRecordsRuleComponentState,
    tableInstanceId,
  );
  const setContextStoreTargetedRecordsRule = useSetAtomComponentState(
    contextStoreTargetedRecordsRuleComponentState,
    tableInstanceId,
  );
  const setContextStoreNumberOfSelectedRecords = useSetAtomComponentState(
    contextStoreNumberOfSelectedRecordsComponentState,
    tableInstanceId,
  );

  const selectedRowIds = useMemo(
    () =>
      contextStoreTargetedRecordsRule.mode === 'selection'
        ? contextStoreTargetedRecordsRule.selectedRecordIds
        : [],
    [contextStoreTargetedRecordsRule],
  );

  const handleSelectedRowIdsChange = useCallback(
    (rowIds: string[]) => {
      setContextStoreTargetedRecordsRule({
        mode: 'selection',
        selectedRecordIds: rowIds,
      });
      setContextStoreNumberOfSelectedRecords(rowIds.length);
      setTableStateAtom((previous) => ({
        ...previous,
        selectedRowIds: rowIds,
      }));

      if (rowIds.length > 0 && rowIds[0] !== selectedPersonId) {
        onSelectPersonId(rowIds[0]);
      }
    },
    [
      onSelectPersonId,
      selectedPersonId,
      setContextStoreNumberOfSelectedRecords,
      setContextStoreTargetedRecordsRule,
      setTableStateAtom,
    ],
  );

  const handleImportPeople = useCallback(() => {
    openObjectRecordsSpreadsheetImportDialog({
      onRecordsCreated: async (createdRecords) => {
        const mappedPeople =
          mapCrmPersonRecordsToOutreachPersonRows(createdRecords);

        if (mappedPeople.length === 0) {
          return;
        }

        await appendPeople?.(mappedPeople);
        await onRefresh?.();
      },
    });
  }, [appendPeople, onRefresh, openObjectRecordsSpreadsheetImportDialog]);

  const getQueueCount = useCallback(
    (filterId: OutreachPeopleQueueFilter): number | null => {
      if (isJourneySummaryLoading || !isDefined(journeySummary)) {
        return null;
      }

      const byStage = journeySummary.byStage;
      const byConversation = journeySummary.byConversationStage ?? {};

      switch (filterId) {
        case 'all':
          return journeySummary.totalEnrolled;
        case 'awaiting_reply':
          return (
            (byStage.CONNECTION_ACCEPTED ?? 0) + (byStage.WAITING_REPLY ?? 0)
          );
        case 'needs_approval':
          return journeySummary.needsApproval;
        case 'workflow_failed':
          return journeySummary.workflowFailed ?? 0;
        case 'intent':
          return byConversation.INTENT ?? 0;
        case 'follow_up_due':
          return journeySummary.dueThisWeek;
        case 'meeting_booked':
          return byConversation.MEETING_BOOKED ?? 0;
        case 'not_interested':
          return byConversation.NOT_INTERESTED ?? 0;
        case 'snoozed':
          return journeySummary.snoozed;
        default:
          return byStage[filterId] ?? 0;
      }
    },
    [isJourneySummaryLoading, journeySummary],
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

      if (!matchesOutreachPeopleQueueFilter(person, stageFilter)) {
        return false;
      }

      if (normalizedQuery.length === 0) {
        return true;
      }

      return `${person.name} ${person.title} ${person.companyName} ${person.locationName ?? ''}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [people, searchQuery, selectedCompanyId, stageFilter]);

  // The candidate drawer and Cmd+K actions resolve the selected row from
  // searchResultsState, so keep it mirrored to the visible working set.
  useLayoutEffect(() => {
    setSearchResults(
      filteredPeople.map((person) =>
        mapOutreachPersonToTableRow(person, projectId),
      ) as never[],
    );
    setTableStateAtom((previous) =>
      previous.rawData.length === 0 && previous.isLoading === false
        ? previous
        : { ...previous, rawData: [], isLoading: false },
    );
  }, [filteredPeople, projectId, setSearchResults, setTableStateAtom]);

  useEffect(() => {
    return () => {
      setSearchResults([]);
    };
  }, [setSearchResults]);

  const selectedPeople = useMemo(() => {
    if (selectedRowIds.length > 0) {
      const selectedIdSet = new Set(selectedRowIds);

      return filteredPeople.filter((person) => selectedIdSet.has(person.id));
    }

    if (isDefined(selectedPersonId)) {
      return filteredPeople.filter((person) => person.id === selectedPersonId);
    }

    return [];
  }, [filteredPeople, selectedPersonId, selectedRowIds]);

  const setOutreachContext = useSetAtomState(outreachContextState);

  // Ask AI reads the checked rows from the browsing context, so "start
  // outreach" acts on exactly what the user selected.
  useEffect(() => {
    const selectedPersonIds = selectedPeople.map((person) => person.id);
    const selectedCandidateIds = selectedPeople
      .map((person) => person.candidateId)
      .filter(isDefined);

    setOutreachContext((previous) =>
      isSameOutreachContext(previous, {
        ...previous,
        selectedPersonIds,
        selectedCandidateIds,
      })
        ? previous
        : { ...previous, selectedPersonIds, selectedCandidateIds },
    );
  }, [selectedPeople, setOutreachContext]);

  const deferredCandidateId = selectedPeople.find(
    (person) => person.stage === 'DEFERRED' && isDefined(person.candidateId),
  )?.candidateId;

  const selectedCandidateIds = selectedPeople
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

  const handleOpenPerson = useCallback(
    (person: OutreachPersonRow) => {
      onSelectPersonId(person.id);
      localStorage.setItem('candidate-chat-default-tab', 'journey');
      openCandidateChatDrawer({
        candidateId: person.id,
        displayName: person.name,
        seedRow: mapOutreachPersonToTableRow(person, projectId),
      });
    },
    [onSelectPersonId, openCandidateChatDrawer, projectId],
  );

  const columns = useMemo(
    () =>
      withEditableCells(
        appendOutreachRawJsonColumns(
          getOutreachPeopleTableColumns({
            companiesByWorkingSetId,
            ownerNameByCandidateId,
            onOpenPerson: handleOpenPerson,
          }),
          people,
          columnLayout,
        ),
      ),
    [
      withEditableCells,
      columnLayout,
      companiesByWorkingSetId,
      handleOpenPerson,
      ownerNameByCandidateId,
      people,
    ],
  );

  const hasActiveFilter =
    stageFilter !== 'all' || searchQuery.trim().length > 0;

  const handleClearFilters = () => {
    setStageFilter('all');
    setSearchQuery('');
    setChatSearchQuery('');
    clearColumnFilters();
  };

  const withCount = (label: string, count: number) =>
    count > 0 ? `${label} (${count})` : label;

  if (isLoading && people.length === 0) {
    return (
      <StyledLoading>
        <Loader />
        Loading people…
      </StyledLoading>
    );
  }

  const pills = (
    <>
      <OutreachViewBarPill
        label="All"
        count={getQueueCount('all') ?? people.length}
        isActive={stageFilter === 'all'}
        onClick={() => setStageFilter('all')}
      />
      {OUTREACH_PEOPLE_QUEUE_FILTERS.filter(
        (filter) =>
          (getQueueCount(filter.id) ?? 0) > 0 || stageFilter === filter.id,
      ).map((filter) => (
        <OutreachViewBarPill
          key={filter.id}
          label={filter.label}
          count={getQueueCount(filter.id)}
          isActive={stageFilter === filter.id}
          onClick={() => setStageFilter(filter.id)}
        />
      ))}
    </>
  );

  const actions = (
    <>
      {hasActiveFilter && (
        <OutreachViewBarIconAction
          title="Clear filters"
          Icon={IconFilterOff}
          onClick={handleClearFilters}
        />
      )}
      <OutreachViewBarIconAction
        title={isRefreshing ? 'Refreshing…' : 'Refresh'}
        Icon={IconRefresh}
        disabled={isRefreshing}
        onClick={() => {
          void handleRefresh();
        }}
      />
      <OutreachViewBarIconAction
        title="Import people"
        Icon={IconFileImport}
        onClick={handleImportPeople}
      />
      <OutreachViewBarDivider />
      <OutreachViewBarIconAction
        title={withCount('Save selected to CRM', selectedPeople.length)}
        Icon={IconDatabase}
        disabled={selectedPeople.length === 0 || isPersisting}
        onClick={() => {
          void saveTargetsToCrm({
            target: 'people',
            personIds: selectedPeople.map((person) => person.id),
          });
        }}
      />
      <OutreachViewBarIconAction
        title={withCount('Enroll in outreach', selectedPeople.length)}
        Icon={IconUserPlus}
        disabled={selectedPeople.length === 0 || isPersisting}
        onClick={() =>
          enrollSelectedPeople(selectedPeople, companiesByWorkingSetId)
        }
      />
      <OutreachViewBarIconAction
        title={withCount('Start outreach', selectedCandidateIds.length)}
        Icon={IconPlayerPlay}
        disabled={selectedCandidateIds.length === 0 || isStarting}
        onClick={() => {
          void startSequencerOnCandidateIds(selectedCandidateIds);
        }}
      />
      <OutreachViewBarIconAction
        title={withCount('Stop outreach', selectedCandidateIds.length)}
        Icon={IconPlayerStop}
        disabled={selectedCandidateIds.length === 0 || isStopping}
        onClick={() => {
          void stopOutreachForCandidates(selectedCandidateIds);
        }}
      />
      <OutreachAssignMemberSelect
        members={assignmentMembers}
        selectedCount={selectedCandidateIds.length}
        disabled={isAssigning}
        onAssign={(memberId) => {
          void assignToMember(selectedCandidateIds, memberId);
        }}
        onSplit={(mode) => {
          void splitAcrossTeam(selectedCandidateIds, mode);
        }}
      />
      {isDefined(deferredCandidateId) && (
        <OutreachViewBarIconAction
          title="Promote deferred"
          Icon={IconArrowUp}
          onClick={() => promoteDeferredCandidate(deferredCandidateId)}
        />
      )}
    </>
  );

  return (
    <StyledPanel>
      <OutreachViewBar
        pills={pills}
        searchValue={searchQuery}
        searchPlaceholder="Search people"
        onSearchChange={setSearchQuery}
        actions={actions}
      />
      <OutreachAiColumnProgressBar run={aiColumnRun} />
      <OutreachAiViewBar
        view={activeView}
        getColumnLabel={(columnId) =>
          columns.find((column) => column.id === columnId)?.label ?? columnId
        }
        onClear={clearAiView}
      />
      {people.length === 0 ? (
        <OutreachTableEmptyState
          title="No target people yet"
          description="Use Setup → Find people (Ask AI) to discover target roles at companies on this project. They stay here until you Add to CRM or Enroll."
        />
      ) : filteredPeople.length === 0 ? (
        <OutreachTableEmptyState
          title="No people match"
          description="Try another stage filter or search term."
          onClearFilters={handleClearFilters}
        />
      ) : (
        <ContextStoreComponentInstanceContext.Provider
          value={{ instanceId: tableInstanceId }}
        >
          <OutreachRecordTable
            rows={filteredPeople}
            columns={columns}
            getRowId={(person) => person.id}
            selectedRowIds={selectedRowIds}
            activeRowId={selectedPersonId}
            onSelectedRowIdsChange={handleSelectedRowIdsChange}
            onRowClick={handleOpenPerson}
            getMobileCard={getOutreachPersonMobileCard}
            columnLayout={columnLayout}
            onColumnLayoutChange={persistLayout}
            columnFilters={columnFilters}
            onColumnFiltersChange={persistFilters}
            externalSort={externalSort}
          />
          <HotTableActionMenu tableId={tableInstanceId} />
        </ContextStoreComponentInstanceContext.Provider>
      )}
    </StyledPanel>
  );
};
