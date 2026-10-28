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
  IconArrowBackUp,
  IconArrowUp,
  IconDownload,
  IconFileImport,
  IconFilterOff,
  IconPlayerPlay,
  IconPlayerStop,
  IconRefresh,
  IconTrash,
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
  OUTREACH_PEOPLE_QUEUE_FILTERS,
  resolveOutreachPeopleQueueRows,
  type OutreachPeopleQueueFilter,
} from '@/outreach-home/utils/outreachPeopleQueueFilter';
import { filterOutreachRows } from '@/outreach-home/utils/outreach-table-layout.util';
import { useOutreachPersonCellEdit } from '@/outreach-home/hooks/useOutreachPersonCellEdit';
import { downloadOutreachRowsAsCsv } from '@/outreach-home/utils/download-outreach-rows-as-csv.util';
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

const normalizeCompanyNameKey = (name: string | undefined): string =>
  (name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

type OutreachPeoplePanelProps = {
  people: OutreachPersonRow[];
  companies: OutreachCompanyRow[];
  projectId: string | null | undefined;
  selectedCompanyId: string | null;
  onClearSelectedCompany?: () => void;
  selectedPersonId: string | null;
  onSelectPersonId: (personId: string | null) => void;
  tableInstanceId: string;
  isLoading?: boolean;
  onRefresh?: () => Promise<void>;
  aiColumnRun?: OutreachAiColumnRunProgress | null;
  aiTableView?: OutreachTableView | null;
  appendPeople?: (peopleToAdd: OutreachPersonRow[]) => Promise<void>;
  softDeletePeople?: (personIds: string[]) => Promise<number>;
  undoSoftDeletePeople?: () => Promise<number>;
  undoableDeletedCount?: number;
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
  onClearSelectedCompany,
  selectedPersonId,
  onSelectPersonId,
  tableInstanceId,
  isLoading = false,
  onRefresh,
  aiColumnRun,
  aiTableView,
  appendPeople,
  softDeletePeople,
  undoSoftDeletePeople,
  undoableDeletedCount = 0,
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
    projectId,
    onRefresh,
    updateEphemeralPerson,
  });
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
  const {
    enrollSelectedPeople,
    enrollAndResolveCandidateIds,
    promoteDeferredCandidate,
    isEnrolling,
  } = useOutreachEnroll();
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
      if (filterId === 'all') {
        return people.length;
      }

      if (filterId === 'not_enrolled') {
        if (isDefined(journeySummary)) {
          return Math.max(
            0,
            people.length - (journeySummary.totalEnrolled ?? 0),
          );
        }

        return people.filter((person) => !isDefined(person.candidateId)).length;
      }

      if (isJourneySummaryLoading || !isDefined(journeySummary)) {
        return null;
      }

      const byStage = journeySummary.byStage;
      const byConversation = journeySummary.byConversationStage ?? {};

      switch (filterId) {
        case 'enrolled':
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
    [isJourneySummaryLoading, journeySummary, people],
  );

  useEffect(() => {
    setChatSearchQuery('');
    setSearchQuery('');

    return () => {
      setChatSearchQuery('');
    };
  }, [setChatSearchQuery, tableInstanceId]);

  const companiesByTabId = useMemo(() => {
    const map: Record<string, OutreachCompanyRow> = {};

    for (const company of companies) {
      map[company.id] = company;
    }

    return map;
  }, [companies]);

  const selectedCompany = isDefined(selectedCompanyId)
    ? companiesByTabId[selectedCompanyId]
    : undefined;

  const filteredPeople = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const selectedCompanyNameKey = normalizeCompanyNameKey(
      selectedCompany?.name,
    );

    return resolveOutreachPeopleQueueRows(people, stageFilter).filter(
      (person) => {
        // People saved before they carried a company id match by company name
        if (
          isDefined(selectedCompanyId) &&
          person.companyId !== selectedCompanyId &&
          !(
            person.companyId === '' &&
            selectedCompanyNameKey !== '' &&
            normalizeCompanyNameKey(person.companyName) ===
              selectedCompanyNameKey
          )
        ) {
          return false;
        }

        if (normalizedQuery.length === 0) {
          return true;
        }

        return `${person.name} ${person.title} ${person.companyName} ${person.locationName ?? ''}`
          .toLowerCase()
          .includes(normalizedQuery);
      },
    );
  }, [people, searchQuery, selectedCompany, selectedCompanyId, stageFilter]);

  // The candidate drawer and Cmd+K actions resolve the selected row from
  // searchResultsState, so keep it mirrored to the visible tab.
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

  const handleAssignOwner = useCallback(
    async (memberId: string) => {
      const candidateIds = await enrollAndResolveCandidateIds(
        selectedPeople,
        companiesByTabId,
      );

      if (candidateIds.length === 0) {
        return;
      }

      await assignToMember(candidateIds, memberId);
      await onRefresh?.();
    },
    [
      assignToMember,
      companiesByTabId,
      enrollAndResolveCandidateIds,
      onRefresh,
      selectedPeople,
    ],
  );

  const handleSplitOwners = useCallback(
    async (mode: 'balanced' | 'round_robin') => {
      const candidateIds = await enrollAndResolveCandidateIds(
        selectedPeople,
        companiesByTabId,
      );

      if (candidateIds.length === 0) {
        return;
      }

      await splitAcrossTeam(candidateIds, mode);
      await onRefresh?.();
    },
    [
      companiesByTabId,
      enrollAndResolveCandidateIds,
      onRefresh,
      selectedPeople,
      splitAcrossTeam,
    ],
  );

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
  // at the outreach tab refresh instead of candidate-table project fetch.
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
            companiesByTabId,
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
      companiesByTabId,
      handleOpenPerson,
      ownerNameByCandidateId,
      people,
    ],
  );

  const visiblePeople = useMemo(
    () => filterOutreachRows(filteredPeople, columns, columnFilters),
    [columnFilters, columns, filteredPeople],
  );
  const resultCount = visiblePeople.length;

  // Stale column filters (e.g. Stage=Queued) apply after CRM stages load and
  // wipe the table — clear them instead of leaving a blank grid.
  useEffect(() => {
    if (
      columnFilters.length === 0 ||
      filteredPeople.length === 0 ||
      visiblePeople.length > 0
    ) {
      return;
    }

    clearColumnFilters();
  }, [
    clearColumnFilters,
    columnFilters.length,
    filteredPeople.length,
    visiblePeople.length,
  ]);

  const handleDeleteSelected = async () => {
    const deletedCount = await softDeletePeople?.(
      selectedPeople.map((person) => person.id),
    );

    handleSelectedRowIdsChange([]);

    if (!deletedCount) {
      enqueueErrorSnackBar({
        message: 'Only unsaved people can be deleted here',
      });

      return;
    }

    enqueueSuccessSnackBar({
      message: `Deleted ${deletedCount} ${deletedCount === 1 ? 'person' : 'people'}. Undo is available for 5 minutes.`,
    });
  };

  const handleUndoDelete = async () => {
    const restoredCount = await undoSoftDeletePeople?.();

    if (restoredCount) {
      enqueueSuccessSnackBar({
        message: `Restored ${restoredCount} ${restoredCount === 1 ? 'person' : 'people'}`,
      });
    }
  };

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
      {isDefined(selectedCompanyId) && (
        <OutreachViewBarPill
          label={`Company: ${selectedCompany?.name ?? 'selected'} ✕`}
          isActive
          onClick={() => onClearSelectedCompany?.()}
        />
      )}
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

  const handleDownloadCsv = () => {
    downloadOutreachRowsAsCsv({
      rows: filteredPeople,
      columns: columns,
      columnLayout,
      columnFilters,
      fileName: `outreach-people-${new Date().toISOString().slice(0, 10)}.csv`,
    });
  };

  const actions = (
    <>
      <OutreachViewBarIconAction
        title={withCount('Delete selected', selectedPeople.length)}
        Icon={IconTrash}
        disabled={selectedPeople.length === 0}
        onClick={() => {
          void handleDeleteSelected();
        }}
      />
      {undoableDeletedCount > 0 && (
        <OutreachViewBarIconAction
          title={`Undo delete (${undoableDeletedCount})`}
          Icon={IconArrowBackUp}
          onClick={() => {
            void handleUndoDelete();
          }}
        />
      )}
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
        title="Download CSV (opens in Excel)"
        Icon={IconDownload}
        disabled={filteredPeople.length === 0}
        onClick={handleDownloadCsv}
      />
      <OutreachViewBarIconAction
        title="Import people"
        Icon={IconFileImport}
        onClick={handleImportPeople}
      />
      <OutreachViewBarDivider />
      <OutreachViewBarIconAction
        title={withCount('Enroll in outreach', selectedPeople.length)}
        Icon={IconUserPlus}
        disabled={selectedPeople.length === 0 || isEnrolling}
        onClick={() => {
          void enrollSelectedPeople(selectedPeople, companiesByTabId).then(() =>
            onRefresh?.(),
          );
        }}
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
        selectedCount={selectedPeople.length}
        disabled={isAssigning || isEnrolling}
        onAssign={(memberId) => {
          void handleAssignOwner(memberId);
        }}
        onSplit={(mode) => {
          void handleSplitOwners(mode);
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
        resultCount={resultCount}
        actions={actions}
      />
      <OutreachAiColumnProgressBar
        run={aiColumnRun?.tab === 'companies' ? null : aiColumnRun}
        projectId={projectId}
      />
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
          description="Use Setup → Find people (Ask AI) to discover target roles at companies on this project. They stay here until you Enroll."
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
