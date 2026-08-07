import { Suspense, lazy, useEffect, useMemo } from 'react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { Loader } from 'twenty-ui/feedback';
import { Button } from 'twenty-ui/input';

import { searchResultsState } from '@/candidate-search/states/searchResultsState';
import { HotTableActionMenu } from '@/candidate-table/HotTableActionMenu';
import { tableStateAtom } from '@/candidate-table/states/states';
import { ContextStoreComponentInstanceContext } from '@/context-store/states/contexts/ContextStoreComponentInstanceContext';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { useAddGtmRecordsToCrm } from '@/gtm-home/hooks/useAddGtmRecordsToCrm';
import { useGtmOutreachEnroll } from '@/gtm-home/hooks/useGtmOutreachEnroll';
import { type GtmCompanyRow, type GtmPersonRow } from '@/gtm-home/types/gtm-home.types';
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
  padding: ${themeCssVariables.spacing[4]};
  line-height: 1.5;
`;

const StyledActions = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  flex-wrap: wrap;
`;

const StyledTableWrapper = styled.div`
  position: relative;
  flex: 1;
  min-height: 420px;
`;

const StyledHint = styled.div`
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.secondary};
`;

const mapGtmPersonToDataTableRow = (
  person: GtmPersonRow,
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
    engagementStatus: person.stage,
    startChat: false,
    stopChat: false,
    whatsappMessages: { edges: [] },
    emailMessages: { edges: [] },
    otherFields: {
      warmPath: person.warmPath,
      stage: person.stage,
      companyId: person.companyId,
      candidateId: person.candidateId,
    },
    candidateReminders: { edges: [] },
    uniqueStringKey: person.id,
    peopleId: person.id,
    personId: person.id,
    updatedAt: '',
    createdAt: '',
  };
};

type GtmPeoplePanelProps = {
  people: GtmPersonRow[];
  companies: GtmCompanyRow[];
  selectedCompanyId: string | null;
  selectedPersonId: string | null;
  onSelectPersonId: (personId: string | null) => void;
  tableInstanceId: string;
};

export const GtmPeoplePanel = ({
  people,
  companies,
  selectedCompanyId,
  selectedPersonId,
  onSelectPersonId,
  tableInstanceId,
}: GtmPeoplePanelProps) => {
  const setSearchResults = useSetAtomState(searchResultsState);
  const setTableState = useSetAtomState(tableStateAtom);
  const { isPersisting, addPeopleToCrm } = useAddGtmRecordsToCrm();
  const { enrollSelectedPeople, promoteDeferredCandidate } =
    useGtmOutreachEnroll();

  const companiesByWorkingSetId = useMemo(() => {
    const map: Record<string, GtmCompanyRow> = {};

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
    () => filteredPeople.map(mapGtmPersonToDataTableRow),
    [filteredPeople],
  );

  useEffect(() => {
    if (tableRows.length === 0) {
      setSearchResults([]);
      return;
    }

    setSearchResults(tableRows as never[]);
    setTableState((previous) => ({
      ...previous,
      rawData: [],
      selectedRowIds: [],
    }));

    return () => {
      setSearchResults([]);
    };
  }, [setSearchResults, setTableState, tableRows]);

  const selectionRule = useAtomComponentStateValue(
    contextStoreTargetedRecordsRuleComponentState,
    tableInstanceId,
  );

  useEffect(() => {
    if (selectionRule.mode !== 'selection') {
      return;
    }

    const selectedIds = selectionRule.selectedRecordIds;

    if (selectedIds.length > 0) {
      onSelectPersonId(selectedIds[0]);
    }
  }, [onSelectPersonId, selectionRule]);

  const selectedPeople = useMemo(() => {
    if (selectionRule.mode === 'selection') {
      const selectedIds = new Set(selectionRule.selectedRecordIds);

      if (selectedIds.size > 0) {
        return filteredPeople.filter((person) => selectedIds.has(person.id));
      }
    }

    if (selectedPersonId) {
      return filteredPeople.filter((person) => person.id === selectedPersonId);
    }

    return [];
  }, [filteredPeople, selectedPersonId, selectionRule]);

  if (filteredPeople.length === 0) {
    return (
      <StyledEmpty>
        No candidates for this GTM run yet. Add people via Ask AI / CRM, or seed
        the dashboard. Enroll selected people to set stage{' '}
        <code>QUEUED</code> and trigger Workflow B.
      </StyledEmpty>
    );
  }

  const deferredCandidateId = selectedPeople.find(
    (person) => person.stage === 'deferred' && person.candidateId,
  )?.candidateId;

  return (
    <StyledPanel>
      <StyledHint>
        Candidates for this run. Add to CRM upserts shared Company (if needed) +
        Person + Candidate. Enroll queues outreach (Workflow B).
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
        <Suspense fallback={<Loader />}>
          <DataTable projectId={tableInstanceId} />
        </Suspense>
      </StyledTableWrapper>
    </StyledPanel>
  );
};
