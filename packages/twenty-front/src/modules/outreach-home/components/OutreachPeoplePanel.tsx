import { styled } from '@linaria/react';
import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { Loader } from 'twenty-ui/feedback';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { searchResultsState } from '@/candidate-search/states/searchResultsState';
import { HotTableActionMenu } from '@/candidate-table/HotTableActionMenu';
import { tableStateAtom } from '@/candidate-table/states/states';
import { ContextStoreComponentInstanceContext } from '@/context-store/states/contexts/ContextStoreComponentInstanceContext';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { useAddOutreachRecordsToCrm } from '@/outreach-home/hooks/useAddOutreachRecordsToCrm';
import { useOutreachEnroll } from '@/outreach-home/hooks/useOutreachEnroll';
import { useStopOutreach } from '@/outreach-home/hooks/useStopOutreach';
import { type OutreachCompanyRow, type OutreachPersonRow } from '@/outreach-home/types/outreach-home.types';
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
  gap: ${themeCssVariables.spacing[3]};
  height: 100%;
  min-height: 0;
`;

const StyledEmpty = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.5;
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledTableWrapper = styled.div`
  align-items: center;
  display: flex;
  flex: 1;
  justify-content: center;
  min-height: 420px;
  position: relative;
`;

const StyledHint = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const mapOutreachPersonToDataTableRow = (
  person: OutreachPersonRow,
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
    fullName: person.name,
    name: person.name,
    firstName: nameParts[0] ?? '',
    lastName: nameParts.slice(1).join(' '),
    jobTitle: person.title,
    headline: `${person.title} at ${person.companyName}`,
    company: person.companyName,
    jobCompanyName: person.companyName,
    location: '',
    locationName: '',
    linkedinUrl: linkedinUrl
      ? { primaryLinkUrl: linkedinUrl }
      : { primaryLinkUrl: '' },
    phoneNumber: { primaryPhoneNumber: '' },
    email: { primaryEmail: person.email || '' },
    candConversationStatus: '',
    status: person.stage,
    candidateFlags: {
      engagementStatus: Boolean(person.stage),
      startChat: false,
      stopChat: false,
    },
    chatMessages: { edges: [] },
    emailMessages: { edges: [] },
    otherFields: {
      warmPath: person.warmPath,
      stage: person.stage,
      companyId: person.companyId,
      candidateId: person.candidateId,
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
  };
};

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

type OutreachPeoplePanelProps = {
  people: OutreachPersonRow[];
  companies: OutreachCompanyRow[];
  selectedCompanyId: string | null;
  selectedPersonId: string | null;
  onSelectPersonId: (personId: string | null) => void;
  tableInstanceId: string;
  isLoading?: boolean;
};

export const OutreachPeoplePanel = ({
  people,
  companies,
  selectedCompanyId,
  selectedPersonId,
  onSelectPersonId,
  tableInstanceId,
  isLoading = false,
}: OutreachPeoplePanelProps) => {
  const setSearchResults = useSetAtomState(searchResultsState);
  const setTableStateAtom = useSetAtomState(tableStateAtom);
  const [isTableDataReady, setIsTableDataReady] = useState(false);
  const { isPersisting, addPeopleToCrm } = useAddOutreachRecordsToCrm();
  const { enrollSelectedPeople, promoteDeferredCandidate } =
    useOutreachEnroll();
  const { isStopping, stopOutreachForCandidates } = useStopOutreach();

  const companiesByWorkingSetId = useMemo(() => {
    const map: Record<string, OutreachCompanyRow> = {};

    for (const company of companies) {
      map[company.id] = company;
    }

    return map;
  }, [companies]);

  const filteredPeople = useMemo(
    () =>
      selectedCompanyId
        ? people.filter((person) => person.companyId === selectedCompanyId)
        : people,
    [people, selectedCompanyId],
  );

  const tableRows = useMemo(
    () => filteredPeople.map(mapOutreachPersonToDataTableRow),
    [filteredPeople],
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

    setSearchResults((previous) => {
      if (
        previous.length === tableRows.length &&
        previous.every(
          (row, index) => (row.tempId || row.id) === tableRows[index]?.id,
        )
      ) {
        return previous;
      }

      return tableRows as never[];
    });

    setTableStateAtom((previous) => ({
      ...previous,
      rawData: [],
      isLoading: false,
    }));
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

  if (isLoading && filteredPeople.length === 0) {
    return (
      <StyledLoading>
        <Loader />
        Loading people…
      </StyledLoading>
    );
  }

  if (filteredPeople.length === 0) {
    return (
      <StyledEmpty>
        No target people in this project yet. Use Setup → Find people (Ask AI)
        to discover target roles from your ICP at companies on this project.
        They stay on the People tab until you Add to CRM or Enroll, which creates
        Company and Person records (plus enrollment) under this Project.
      </StyledEmpty>
    );
  }

  const deferredCandidateId = selectedPeople.find(
    (person) => person.stage === 'deferred' && person.candidateId,
  )?.candidateId;

  const stoppableCandidateIds = selectedPeople
    .map((person) => person.candidateId)
    .filter((candidateId): candidateId is string => isDefined(candidateId));

  return (
    <StyledPanel>
      <StyledHint>
        Working list for this Project, merged with enrolled people. Select
        rows, then Add to CRM / Enroll — Ask AI must not create enrollment
        records until you confirm.
      </StyledHint>
      <StyledActions>
        <Button
          title={
            selectedPeople.length > 0
              ? `Add selected to CRM (${selectedPeople.length})`
              : 'Add selected to CRM'
          }
          size="small"
          variant="secondary"
          disabled={selectedPeople.length === 0 || isPersisting}
          onClick={() =>
            addPeopleToCrm({
              people: selectedPeople,
              companiesByWorkingSetId,
            })
          }
        />
        <Button
          title={
            selectedPeople.length > 0
              ? `Enroll in outreach (${selectedPeople.length})`
              : 'Enroll in outreach'
          }
          size="small"
          variant="primary"
          disabled={selectedPeople.length === 0 || isPersisting}
          onClick={() =>
            enrollSelectedPeople(selectedPeople, companiesByWorkingSetId)
          }
        />
        <Button
          title={
            stoppableCandidateIds.length > 0
              ? `Stop outreach (${stoppableCandidateIds.length})`
              : 'Stop outreach'
          }
          size="small"
          variant="secondary"
          disabled={stoppableCandidateIds.length === 0 || isStopping}
          onClick={() => {
            void stopOutreachForCandidates(stoppableCandidateIds);
          }}
        />
        {deferredCandidateId && (
          <Button
            title="Promote deferred"
            size="small"
            variant="secondary"
            onClick={() => promoteDeferredCandidate(deferredCandidateId)}
          />
        )}
      </StyledActions>
      <ContextStoreComponentInstanceContext.Provider
        value={{ instanceId: tableInstanceId }}
      >
        <HotTableActionMenu tableId={tableInstanceId} />
      </ContextStoreComponentInstanceContext.Provider>
      <StyledTableWrapper>
        {isTableDataReady ? (
          <Suspense fallback={<Loader />}>
            <DataTable projectId={tableInstanceId} />
          </Suspense>
        ) : (
          <Loader />
        )}
      </StyledTableWrapper>
    </StyledPanel>
  );
};
