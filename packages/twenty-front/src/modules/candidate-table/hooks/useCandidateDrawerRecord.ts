import axios from 'axios';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { graphQltoUpdateOneCandidate } from 'twenty-shared/graphql';
import { getCandidateCustomField } from 'twenty-shared/utils';

import { currentProjectIdState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { searchResultsState } from '@/candidate-search/states/searchResultsState';
import { getPermanentId, isUUID } from '@/candidate-table/HotHooks';
import {
  processedDataSelector,
  selectedCandidateIdState,
  tableStateAtom,
} from '@/candidate-table/states/states';
import { getCandidateProfileUrl } from '@/candidate-table/utils/getCandidateProfileUrl';
import { useStartChats } from '@/object-record/hooks/useStartChats';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

// Candidate drawer rows come from several sources (CRM candidate fetch,
// candidate-table rows, outreach working-set rows) with different shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CandidateDrawerData = any;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const firstUuid = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && isUUID(value)) {
      return value;
    }
  }

  return undefined;
};

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

// Outreach people rows use person id as row id; candidate table rows use candidate id.
const resolvePersonAndCandidateIds = ({
  candidateData,
  selectedCandidateId,
}: {
  candidateData: Record<string, unknown>;
  selectedCandidateId: string | null | undefined;
}): { personId?: string; candidateId?: string } => {
  const otherFields = asRecord(candidateData.otherFields);
  const isOutreachHomeRow = candidateData.isOutreachHomeRow === true;

  const personId = firstUuid(
    candidateData.peopleId,
    candidateData.personId,
    isOutreachHomeRow ? selectedCandidateId : undefined,
    isOutreachHomeRow ? candidateData.id : undefined,
    // After candidate fetch replaces an outreach people row, selected id is still the person
    selectedCandidateId !== candidateData.id ? selectedCandidateId : undefined,
  );

  // Never treat the person id as a candidate id (outreach selects by person).
  const explicitCandidateId = firstUuid(
    otherFields?.candidateId,
    candidateData.candidateId,
  );
  const candidateIdFromRecord =
    !isOutreachHomeRow &&
    typeof candidateData.id === 'string' &&
    isUUID(candidateData.id) &&
    candidateData.id !== personId
      ? candidateData.id
      : undefined;

  return {
    personId,
    candidateId: firstUuid(explicitCandidateId, candidateIdFromRecord),
  };
};

const getFieldValue = (
  candidateData: CandidateDrawerData,
  fieldName: string,
) => {
  const value = getCandidateCustomField(candidateData, fieldName);

  if (value === null || value === undefined) {
    return '';
  }

  return typeof value === 'string' ? value : JSON.stringify(value);
};

export const useCandidateDrawerRecord = (
  propCandidateData: CandidateDrawerData,
) => {
  const selectedCandidateId = useAtomStateValue(selectedCandidateIdState);
  const tokenPair = useAtomStateValue(tokenPairState);
  const processedData = useAtomStateValue(processedDataSelector);
  const searchResults = useAtomStateValue(searchResultsState);
  const { rawData } = useAtomStateValue(tableStateAtom);
  const currentProjectId = useAtomStateValue(currentProjectIdState);
  const navigate = useNavigate();
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const { sendStartChatRequest } = useStartChats({
    onSuccess: () => {
      enqueueSuccessSnackBar({ message: 'Chat started' });
    },
    onError: () => {
      enqueueErrorSnackBar({ message: 'Error starting chat' });
    },
  });

  const findCandidateInTableData = (): CandidateDrawerData => {
    if (!selectedCandidateId) {
      return null;
    }

    const allCandidates = [...searchResults, ...processedData];

    const exactMatch = allCandidates.find(
      (row) => row.id === selectedCandidateId,
    );

    if (exactMatch !== undefined) {
      return exactMatch;
    }

    const permanentIdMatch = allCandidates.find(
      (row) => getPermanentId(row, rawData) === selectedCandidateId,
    );

    if (permanentIdMatch !== undefined) {
      return permanentIdMatch;
    }

    if (isUUID(selectedCandidateId)) {
      return null;
    }

    // Last resort: selectedCandidateId is a LinkedIn id / tempId
    return (
      allCandidates.find((row) => {
        const linkedinUrl: unknown = row.linkedinUrl;
        const linkedinText =
          typeof linkedinUrl === 'string'
            ? linkedinUrl
            : asString(asRecord(linkedinUrl)?.primaryLinkUrl);

        return (
          row.tempId === selectedCandidateId ||
          linkedinText.includes(selectedCandidateId)
        );
      }) ?? null
    );
  };

  const candidateData: CandidateDrawerData =
    propCandidateData ?? findCandidateInTableData();
  const activeCandidateId: string | null =
    selectedCandidateId ?? candidateData?.id ?? null;

  const { personId, candidateId } =
    candidateData !== null && candidateData !== undefined
      ? resolvePersonAndCandidateIds({
          candidateData,
          selectedCandidateId: activeCandidateId,
        })
      : { personId: undefined, candidateId: undefined };

  // Recruiting chat + status endpoints are keyed by candidate id; outreach rows
  // select by person id, so prefer the resolved candidate id.
  const chatTargetId = candidateId ?? activeCandidateId;
  const authorizationHeader = `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token ?? ''}`;

  const copyToClipboard = useCallback(
    (text: string, label: string) => {
      void navigator.clipboard.writeText(text);
      enqueueSuccessSnackBar({ message: `${label} copied to clipboard` });
    },
    [enqueueSuccessSnackBar],
  );

  const openRecord = (
    objectNameSingular: 'person' | 'candidate',
    recordId: string,
  ) => {
    navigate(`/object/${objectNameSingular}/${recordId}`);
  };

  const updateStatus = async (newStatus: string) => {
    try {
      await axios.post(
        `${REACT_APP_SERVER_BASE_URL}/graphql`,
        {
          query: graphQltoUpdateOneCandidate,
          variables: { idToUpdate: chatTargetId, input: { status: newStatus } },
        },
        {
          headers: {
            authorization: authorizationHeader,
            'content-type': 'application/json',
            'x-schema-version': '66',
          },
        },
      );
      enqueueSuccessSnackBar({ message: 'Status updated' });
    } catch {
      enqueueErrorSnackBar({ message: 'Error updating status' });
    }
  };

  const startChat = async (chatType: string) => {
    if (chatTargetId === null) {
      return;
    }

    try {
      if (chatType === 'startChat') {
        await sendStartChatRequest(
          [chatTargetId],
          'candidate',
          currentProjectId ? [currentProjectId] : undefined,
        );
        return;
      }

      await axios.post(
        `${REACT_APP_SERVER_BASE_URL}/arx-chat/start-interim-chat-prompt`,
        { interimChat: chatType, candidateId: chatTargetId },
        { headers: { Authorization: authorizationHeader } },
      );
      enqueueSuccessSnackBar({ message: 'Interim chat started' });
    } catch {
      enqueueErrorSnackBar({ message: 'Error starting chat' });
    }
  };

  const stopChat = async () => {
    try {
      await axios.post(
        `${REACT_APP_SERVER_BASE_URL}/arx-chat/stop-chat`,
        { candidateId: chatTargetId },
        { headers: { Authorization: authorizationHeader } },
      );
      enqueueSuccessSnackBar({ message: 'Chat stopped' });
    } catch {
      enqueueErrorSnackBar({ message: 'Error stopping chat' });
    }
  };

  const fields =
    candidateData !== null && candidateData !== undefined
      ? {
          name: asString(candidateData.name),
          jobTitle:
            getFieldValue(candidateData, 'job_title') ||
            asString(candidateData.people?.jobTitle) ||
            asString(candidateData.jobTitle),
          companyName:
            getFieldValue(candidateData, 'job_company_name') ||
            asString(candidateData.jobCompanyName),
          location:
            getFieldValue(candidateData, 'location_name') ||
            asString(candidateData.locationName),
          experience: getFieldValue(candidateData, 'inferred_years_experience'),
          salary: getFieldValue(candidateData, 'inferred_salary'),
          industry: getFieldValue(candidateData, 'industry'),
          phone: asString(candidateData.people?.phones?.primaryPhoneNumber),
          email:
            asString(candidateData.people?.emails?.primaryEmail) ||
            asString(candidateData.email?.primaryEmail),
          avatarUrl: asString(candidateData.people?.avatarUrl),
          profileUrl: getCandidateProfileUrl(candidateData),
          status: asString(candidateData.status),
          conversationStatus: asString(candidateData.candConversationStatus),
        }
      : null;

  return {
    candidateData,
    activeCandidateId,
    personId,
    candidateId,
    fields,
    copyToClipboard,
    openRecord,
    updateStatus,
    startChat,
    stopChat,
  };
};
