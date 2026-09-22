import { isNonEmptyString } from '@sniptt/guards';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  buildDefaultOutreachConfig,
  resolveOutreachConfigExperimentConfigString,
  resolveOutreachConfigIcpSpecString,
  resolveOutreachConfigInMailFallbackEnabled,
  resolveOutreachConfigMaxPersonasPerCompany,
  resolveOutreachConfigSendTimezone,
  resolveOutreachConfigSendWindowDays,
  resolveOutreachConfigSendWindowEnd,
  resolveOutreachConfigSendWindowStart,
} from 'twenty-shared/arx';
import { ConnectedAccountProvider } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useProjectRefetch } from '@/candidate-table/hooks/useProjectRefetch';
import {
  formatLastInboundMessage,
  formatMessagesExchanged,
  resolveLastInboundChat,
} from '@/candidate-table/utils/formatMessagesExchanged';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import {
  OUTREACH_PROJECT_ID_QUERY_PARAM,
  OUTREACH_WORKFLOW_SEQUENCER_NAME,
} from '@/outreach-home/constants/outreach-command.constants';
import { mapCrmStageToOutreachStage } from '@/outreach-home/constants/outreach-stages';
import { useOutreachCacheSocket } from '@/outreach-home/hooks/useOutreachCacheSocket';
import { useOutreachProjectJourneySummary } from '@/outreach-home/hooks/useOutreachProjectJourneySummary';
import {
  type OutreachCompanyRow,
  type OutreachMainTab,
  type OutreachPersonRow,
  type OutreachProjectOption,
  type OutreachProjectRecord as OutreachProjectRecordFields,
  type OutreachProjectSettings,
  type OutreachSendMode,
  type OutreachStatus,
  type OutreachWorkspaceCompany,
} from '@/outreach-home/types/outreach-home.types';
import {
  fetchOutreachProjectCandidates,
  formatReplyAfterTouch,
  resolveCandidateLastInboundAt,
  resolveCandidateLastOutboundAt,
  resolveCandidateOutreachResumeAt,
  resolveCandidateStartOutreach,
  resolveCandidateStopOutreach,
  type OutreachProjectCandidateRecord,
} from '@/outreach-home/utils/fetch-outreach-project-candidates';
import { isOutreachProject } from '@/outreach-home/utils/is-outreach-project';
import {
  fetchOutreachCompaniesCache,
  persistOutreachCompaniesCache,
} from '@/outreach-home/utils/outreach-companies-cache';
import { resolveEffectiveIcp } from '@/outreach-home/utils/outreach-effective-icp.util';
import {
  fetchOutreachPeopleCache,
  persistOutreachPeopleCache,
} from '@/outreach-home/utils/outreach-people-cache';
import {
  resolveOutreachJourneyStageLabel,
  resolveOutreachJourneyTimelineStageId,
  resolveOutreachNextRetryAt,
  resolveOutreachNextStepLabel,
} from '@/outreach-home/utils/resolveOutreachJourneyLabels';
import { useMyConnectedAccounts } from '@/settings/accounts/hooks/useMyConnectedAccounts';
import { useLoadCurrentUser } from '@/users/hooks/useLoadCurrentUser';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useUnipile } from '@/unipile/contexts/UnipileContext';

type OutreachProjectRecord = ObjectRecord &
  OutreachProjectRecordFields & {
    updatedAt?: string;
  };

type OutreachCandidateRecord = OutreachProjectCandidateRecord;

const normalizeOutreachStatus = (
  value: string | null | undefined,
): OutreachStatus => (value?.toUpperCase() === 'PAUSED' ? 'PAUSED' : 'LIVE');

const normalizeExperimentVariant = (
  value: string | null | undefined,
): 'A' | 'B' | null => {
  if (value === 'A' || value === 'B') {
    return value;
  }

  return null;
};

const dedupeCompaniesById = (
  companies: OutreachCompanyRow[],
): OutreachCompanyRow[] => {
  const seen = new Set<string>();
  const result: OutreachCompanyRow[] = [];

  for (const company of companies) {
    if (seen.has(company.id)) {
      continue;
    }

    seen.add(company.id);
    result.push(company);
  }

  return result;
};

const dedupePeopleById = (people: OutreachPersonRow[]): OutreachPersonRow[] => {
  const seen = new Set<string>();
  const result: OutreachPersonRow[] = [];

  for (const person of people) {
    if (seen.has(person.id)) {
      continue;
    }

    seen.add(person.id);
    result.push(person);
  }

  return result;
};

const normalizePersonLinkedinKey = (linkedinUrl: string): string =>
  linkedinUrl
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
    .split('?')[0];

const personMergeKey = (person: {
  id: string;
  name: string;
  companyName: string;
  linkedinUrl: string;
}): string => {
  const linkedinKey = normalizePersonLinkedinKey(person.linkedinUrl);

  if (isNonEmptyString(linkedinKey)) {
    return `linkedin:${linkedinKey}`;
  }

  return `id:${person.id}`;
};

const outreachCompanySignature = (companies: OutreachCompanyRow[]): string =>
  companies
    .map(
      (company) =>
        `${company.id}:${company.name}:${company.status}:${company.icpFit}`,
    )
    .join('|');

const outreachPersonSignature = (people: OutreachPersonRow[]): string =>
  people
    .map(
      (person) =>
        `${person.id}:${person.stage}:${person.candidateId ?? ''}:${person.name}:${person.title}:${person.companyName}:${person.experimentVariant ?? ''}:${person.recruiterStatus ?? ''}:${person.candConversationStatus ?? ''}:${person.workflowRunStatus ?? ''}:${person.messagesExchanged?.length ?? 0}:${person.outreachConversationStage ?? ''}:${person.needsApproval ? '1' : '0'}:${person.nextStepLabel ?? ''}:${person.nextRetryAt ?? ''}:${person.outreachResumeAt ?? ''}:${person.candidateFlags?.startOutreach ? '1' : '0'}:${person.candidateFlags?.stopOutreach ? '1' : '0'}:${person.createdAt ?? ''}:${person.updatedAt ?? ''}`,
    )
    .join('|');

const mergeEphemeralAndCrmPeople = (
  ephemeralPeople: OutreachPersonRow[],
  crmPeople: OutreachPersonRow[],
): OutreachPersonRow[] => {
  const byKey = new Map<string, OutreachPersonRow>();

  for (const person of ephemeralPeople) {
    byKey.set(personMergeKey(person), person);
  }

  // CRM enrolled rows win on the same LinkedIn / id key
  for (const person of crmPeople) {
    byKey.set(personMergeKey(person), person);
  }

  return [...byKey.values()];
};

export const useOutreachLiveWorkingSet = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectIdFromQuery = searchParams.get(OUTREACH_PROJECT_ID_QUERY_PARAM);

  const currentWorkspace = useAtomStateValue(currentWorkspaceState);
  const { loadCurrentUser } = useLoadCurrentUser();
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const [tokenPair] = useAtomState(tokenPairState);
  const accessToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;
  // Same signal as Projects menu: accounts-list selector OR server member status.
  // Member-bound LinkedIn skips the workspace accounts list, so the selector alone is false.
  const { isLinkedinConnected: linkedinConnected, isWhatsappUnipileConnected } =
    useUnipile();
  const whatsappConnected = isWhatsappUnipileConnected;
  const { accounts: connectedAccounts } = useMyConnectedAccounts();
  const gmailConnected = connectedAccounts.some(
    (account) =>
      account.provider === ConnectedAccountProvider.GOOGLE ||
      account.provider === ConnectedAccountProvider.MICROSOFT ||
      account.provider === ConnectedAccountProvider.IMAP_SMTP_CALDAV,
  );

  const [activeTab, setActiveTab] = useState<OutreachMainTab>('people');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    null,
  );
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [ephemeralCompanies, setEphemeralCompanies] = useState<
    OutreachCompanyRow[]
  >([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [ephemeralPeople, setEphemeralPeople] = useState<OutreachPersonRow[]>(
    [],
  );
  const [peopleCacheLoading, setPeopleCacheLoading] = useState(false);
  const [projectCandidates, setProjectCandidates] = useState<
    OutreachCandidateRecord[]
  >([]);
  const [projectCandidatesLoading, setProjectCandidatesLoading] =
    useState(false);
  const [peopleCacheReady, setPeopleCacheReady] = useState(
    () => !isNonEmptyString(projectIdFromQuery),
  );
  const [isResolvingProject, setIsResolvingProject] = useState(false);
  const outreachProjectCreateInFlightRef = useRef(false);
  const createOutreachProjectRef = useRef<
    (() => Promise<string | null>) | null
  >(null);

  const { createOneRecord: createProject } = useCreateOneRecord({
    objectNameSingular: 'project',
  });
  const { createOneRecord: createWorkflow } = useCreateOneRecord({
    objectNameSingular: 'workflow',
  });
  const { triggerJobsRefetch } = useProjectRefetch();

  const { records: defaultOutreachWorkflows } = useFindManyRecords<{
    id: string;
    name?: string;
  }>({
    objectNameSingular: 'workflow',
    filter: {
      name: {
        eq: OUTREACH_WORKFLOW_SEQUENCER_NAME,
      },
    },
    limit: 1,
    recordGqlFields: {
      id: true,
      name: true,
    },
  });

  const { records: workspaceMembers } = useFindManyRecords({
    objectNameSingular: 'workspaceMember',
    filter: currentWorkspaceMember?.id
      ? { id: { eq: currentWorkspaceMember.id } }
      : undefined,
    limit: 1,
    skip: !isDefined(currentWorkspaceMember?.id),
    recordGqlFields: {
      id: true,
      name: true,
    },
  });

  const workspaceMemberName = workspaceMembers[0]?.name as
    | { firstName?: string | null }
    | null
    | undefined;

  const outboundSenderFirstName =
    workspaceMemberName?.firstName?.trim() ||
    currentWorkspaceMember?.name?.firstName?.trim() ||
    null;

  const {
    records: allProjects,
    loading: projectsLoading,
    refetch: refetchProjects,
  } = useFindManyRecords<OutreachProjectRecord>({
    objectNameSingular: 'project',
    orderBy: [{ updatedAt: 'DescNullsFirst' }],
    limit: 50,
    recordGqlFields: {
      id: true,
      name: true,
      outreachWorkflowId: true,
      outreachStatus: true,
      outreachSendMode: true,
      outreachConfig: true,
      updatedAt: true,
    },
  });

  const refetchWorkspaceCompany = useCallback(async () => {
    await loadCurrentUser();
  }, [loadCurrentUser]);

  const outreachProjects = useMemo(
    () => allProjects.filter(isOutreachProject),
    [allProjects],
  );

  const hasValidProjectIdInQuery =
    isNonEmptyString(projectIdFromQuery) &&
    outreachProjects.some((project) => project.id === projectIdFromQuery);

  // Deep link wins; otherwise stay null until unused-project resolve / create finishes.
  const activeProjectId = hasValidProjectIdInQuery ? projectIdFromQuery : null;

  const setActiveProjectId = useCallback(
    (projectId: string) => {
      const next = new URLSearchParams(searchParams);

      next.set(OUTREACH_PROJECT_ID_QUERY_PARAM, projectId);
      setSearchParams(next, { replace: true });
      setSelectedCompanyId(null);
      setSelectedPersonId(null);
    },
    [searchParams, setSearchParams],
  );

  const project = outreachProjects.find(
    (candidate) => candidate.id === activeProjectId,
  );

  const scopeKey = project?.id ?? null;

  const { summary: journeySummary, refetch: refetchJourneySummary } =
    useOutreachProjectJourneySummary(activeProjectId);

  // Ephemeral companies from Redis (per projectId) — not CRM membership.
  // Ask AI upserts push outreach-cache-updated on /general-socket; no interval poll.
  const companiesCacheRequestIdRef = useRef(0);

  const refreshCompaniesCache = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!isDefined(activeProjectId) || !isDefined(accessToken)) {
        setEphemeralCompanies([]);

        return;
      }

      const requestId = ++companiesCacheRequestIdRef.current;
      const isSilent = options?.silent === true;

      if (!isSilent) {
        setCompaniesLoading(true);
      }

      try {
        const companies = await fetchOutreachCompaniesCache(
          activeProjectId,
          accessToken,
        );

        if (requestId !== companiesCacheRequestIdRef.current) {
          return;
        }

        setEphemeralCompanies((previous) =>
          outreachCompanySignature(previous) ===
          outreachCompanySignature(companies)
            ? previous
            : companies,
        );
      } finally {
        if (requestId === companiesCacheRequestIdRef.current) {
          setCompaniesLoading(false);
        }
      }
    },
    [accessToken, activeProjectId],
  );

  useEffect(() => {
    if (!isDefined(activeProjectId) || !isDefined(accessToken)) {
      setEphemeralCompanies([]);

      return;
    }

    void refreshCompaniesCache();

    return () => {
      companiesCacheRequestIdRef.current += 1;
    };
  }, [accessToken, activeProjectId, refreshCompaniesCache]);

  const refreshCompaniesWorkingSet = useCallback(async () => {
    await refreshCompaniesCache();
  }, [refreshCompaniesCache]);

  // Ephemeral people from Redis (per projectId) — not CRM Candidates until enroll.
  useLayoutEffect(() => {
    if (!isDefined(activeProjectId) || !isDefined(accessToken)) {
      setPeopleCacheReady(true);

      return;
    }

    setPeopleCacheReady(false);
  }, [accessToken, activeProjectId]);

  const peopleCacheRequestIdRef = useRef(0);
  const projectCandidatesRequestIdRef = useRef(0);

  const refreshPeopleCache = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!isDefined(activeProjectId) || !isDefined(accessToken)) {
        setEphemeralPeople([]);
        setPeopleCacheReady(true);

        return;
      }

      const requestId = ++peopleCacheRequestIdRef.current;
      const isSilent = options?.silent === true;

      if (!isSilent) {
        setPeopleCacheLoading(true);
      }

      try {
        const people = await fetchOutreachPeopleCache(
          activeProjectId,
          accessToken,
        );

        if (requestId !== peopleCacheRequestIdRef.current) {
          return;
        }

        const nextPeople = people.map((person) => ({
          ...person,
          stage: mapCrmStageToOutreachStage(person.stage),
          warmPath: person.warmPath || '—',
          email: person.email || '',
          companyId: person.companyId || '',
          companyName: person.companyName || '',
          title: person.title || '',
          headline: person.headline || '',
          summary: person.summary || '',
          linkedinUrl: person.linkedinUrl || '',
          candidateId: undefined,
        }));

        setEphemeralPeople((previous) =>
          outreachPersonSignature(previous) ===
          outreachPersonSignature(nextPeople)
            ? previous
            : nextPeople,
        );
      } finally {
        if (requestId === peopleCacheRequestIdRef.current) {
          setPeopleCacheLoading(false);
          setPeopleCacheReady(true);
        }
      }
    },
    [accessToken, activeProjectId],
  );

  useEffect(() => {
    if (!isDefined(activeProjectId) || !isDefined(accessToken)) {
      setEphemeralPeople([]);
      setPeopleCacheReady(true);

      return;
    }

    void refreshPeopleCache();

    return () => {
      peopleCacheRequestIdRef.current += 1;
    };
  }, [accessToken, activeProjectId, refreshPeopleCache]);

  const handleCompaniesCacheSocketUpdate = useCallback(() => {
    void refreshCompaniesCache({ silent: true });
  }, [refreshCompaniesCache]);

  const setCompanies = useCallback(
    async (companies: OutreachCompanyRow[]) => {
      const next = dedupeCompaniesById(companies);

      setEphemeralCompanies(next);

      if (isDefined(activeProjectId) && isDefined(accessToken)) {
        await persistOutreachCompaniesCache(activeProjectId, next, accessToken);
      }
    },
    [accessToken, activeProjectId],
  );

  const appendCompanies = useCallback(
    async (companiesToAdd: OutreachCompanyRow[]) => {
      const next = dedupeCompaniesById([
        ...ephemeralCompanies,
        ...companiesToAdd,
      ]);

      await setCompanies(next);
    },
    [ephemeralCompanies, setCompanies],
  );

  const setPeople = useCallback(
    async (people: OutreachPersonRow[]) => {
      setEphemeralPeople(people);

      if (isDefined(activeProjectId) && isDefined(accessToken)) {
        await persistOutreachPeopleCache(activeProjectId, people, accessToken);
      }
    },
    [accessToken, activeProjectId],
  );

  const appendPeople = useCallback(
    async (peopleToAdd: OutreachPersonRow[]) => {
      const next = dedupePeopleById([...ephemeralPeople, ...peopleToAdd]);

      await setPeople(next);
    },
    [ephemeralPeople, setPeople],
  );

  // Paginated REST fetch — same source as candidate table (no 100-record cap).
  const refreshProjectCandidates = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!isDefined(scopeKey) || !isDefined(accessToken)) {
        setProjectCandidates([]);

        return;
      }

      const requestId = ++projectCandidatesRequestIdRef.current;
      const isSilent = options?.silent === true;

      if (!isSilent) {
        setProjectCandidatesLoading(true);
      }

      try {
        const candidates = await fetchOutreachProjectCandidates(
          scopeKey,
          accessToken,
        );

        if (requestId !== projectCandidatesRequestIdRef.current) {
          return;
        }

        setProjectCandidates(candidates);
      } catch {
        if (requestId === projectCandidatesRequestIdRef.current) {
          setProjectCandidates([]);
        }
      } finally {
        if (requestId === projectCandidatesRequestIdRef.current) {
          setProjectCandidatesLoading(false);
        }
      }
    },
    [accessToken, scopeKey],
  );

  useEffect(() => {
    void refreshProjectCandidates();

    return () => {
      projectCandidatesRequestIdRef.current += 1;
    };
  }, [refreshProjectCandidates]);

  // Stage/Next come from CRM candidates + journey-summary (not Redis people
  // cache). Refresh both silently so the People table tracks workflow progress.
  const refreshEnrolledProgress = useCallback(
    async (options?: { silent?: boolean }) => {
      await Promise.all([
        refreshProjectCandidates(options),
        refetchJourneySummary(options),
      ]);
    },
    [refreshProjectCandidates, refetchJourneySummary],
  );

  const refreshPeopleWorkingSet = useCallback(async () => {
    await Promise.all([
      refreshPeopleCache(),
      refreshProjectCandidates(),
      refetchJourneySummary(),
    ]);
  }, [refreshPeopleCache, refreshProjectCandidates, refetchJourneySummary]);

  const handlePeopleCacheSocketUpdate = useCallback(() => {
    void refreshPeopleCache({ silent: true });
  }, [refreshPeopleCache]);

  const handleJourneySocketUpdate = useCallback(() => {
    void refreshEnrolledProgress({ silent: true });
  }, [refreshEnrolledProgress]);

  useOutreachCacheSocket({
    projectId: activeProjectId,
    onPeopleUpdated: handlePeopleCacheSocketUpdate,
    onCompaniesUpdated: handleCompaniesCacheSocketUpdate,
    onJourneyUpdated: handleJourneySocketUpdate,
  });

  const createOutreachProject = useCallback(async () => {
    let outreachWorkflowId = defaultOutreachWorkflows[0]?.id ?? null;

    if (!isDefined(outreachWorkflowId)) {
      const createdWorkflow = await createWorkflow({
        name: OUTREACH_WORKFLOW_SEQUENCER_NAME,
      });

      outreachWorkflowId = createdWorkflow?.id ?? null;
    }

    const created = await createProject({
      name: `New Project · ${new Date().toLocaleString()}`,
      isActive: true,
      outreachSendMode: 'APPROVAL',
      outreachConfig: buildDefaultOutreachConfig(),
      ...(isDefined(outreachWorkflowId) ? { outreachWorkflowId } : {}),
    });

    if (!isDefined(created?.id)) {
      return null;
    }

    setActiveTab('setup');
    setEphemeralCompanies([]);
    setEphemeralPeople([]);
    setSelectedCompanyId(null);
    setSelectedPersonId(null);
    triggerJobsRefetch();
    setActiveProjectId(created.id);

    return created.id;
  }, [
    createProject,
    createWorkflow,
    defaultOutreachWorkflows,
    setActiveProjectId,
    triggerJobsRefetch,
  ]);

  createOutreachProjectRef.current = createOutreachProject;

  const outreachProjectIdsKey = outreachProjects
    .map((project) => project.id)
    .join(',');

  // On /outreach-home without a valid ?projectId=, reuse the newest unused project
  // (empty Redis companies + people) or create a new Project.
  useEffect(() => {
    if (hasValidProjectIdInQuery) {
      setIsResolvingProject(false);

      return;
    }

    if (projectsLoading || !isDefined(accessToken)) {
      return;
    }

    let cancelled = false;
    const projectsSnapshot = outreachProjects;

    const resolveActiveProject = async () => {
      setIsResolvingProject(true);

      try {
        const occupancyByProjectId = await Promise.all(
          projectsSnapshot.map(async (project) => {
            const [companies, people] = await Promise.all([
              fetchOutreachCompaniesCache(project.id, accessToken),
              fetchOutreachPeopleCache(project.id, accessToken),
            ]);

            return {
              projectId: project.id,
              isUnused: companies.length === 0 && people.length === 0,
            };
          }),
        );

        if (cancelled) {
          return;
        }

        // projectsSnapshot is updatedAt desc — first unused is the latest empty project
        const unusedProject = occupancyByProjectId.find(
          (occupancy) => occupancy.isUnused,
        );

        if (isDefined(unusedProject)) {
          setActiveProjectId(unusedProject.projectId);

          return;
        }

        if (cancelled || outreachProjectCreateInFlightRef.current) {
          return;
        }

        outreachProjectCreateInFlightRef.current = true;

        try {
          await createOutreachProjectRef.current?.();
        } finally {
          outreachProjectCreateInFlightRef.current = false;
        }
      } finally {
        if (!cancelled) {
          setIsResolvingProject(false);
        }
      }
    };

    void resolveActiveProject();

    return () => {
      cancelled = true;
    };
    // Snapshot outreachProjects when the id set changes; create via ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    accessToken,
    outreachProjectIdsKey,
    hasValidProjectIdInQuery,
    projectsLoading,
    setActiveProjectId,
  ]);

  const companies = ephemeralCompanies;

  const crmPeople: OutreachPersonRow[] = useMemo(
    () =>
      projectCandidates.map((candidate) => {
        const runSummary =
          journeySummary?.byCandidateId?.[candidate.id] ?? null;
        const outreachResumeAt = resolveCandidateOutreachResumeAt(candidate);

        const sequenceStage = candidate.outreachSequenceStage ?? 'QUEUED';
        const followUpCount = candidate.linkedinFollowUpCount ?? 0;
        const conversationStage = candidate.outreachConversationStage ?? 'NONE';
        const displayStageId = resolveOutreachJourneyTimelineStageId({
          outreachSequenceStage: sequenceStage,
          linkedinFollowUpCount: followUpCount,
          outreachConversationStage: conversationStage,
        });
        const nextStepLabel = runSummary
          ? resolveOutreachNextStepLabel({
              currentStepName: runSummary.currentStepName,
              currentStepKind: runSummary.currentStepKind,
              pendingReason: runSummary.pendingReason,
              errorMessage: runSummary.errorMessage,
              status: runSummary.status,
              resumeAt: runSummary.resumeAt,
            })
          : candidate.pendingChannel
            ? `Pending ${candidate.pendingChannel}`
            : outreachResumeAt
              ? `Snoozed until ${new Date(outreachResumeAt).toLocaleDateString()}`
              : resolveOutreachJourneyStageLabel({
                  outreachSequenceStage: sequenceStage,
                  linkedinFollowUpCount: followUpCount,
                  outreachConversationStage: conversationStage,
                });
        const nextRetryAt = runSummary
          ? resolveOutreachNextRetryAt({
              currentStepKind: runSummary.currentStepKind,
              resumeAt: runSummary.resumeAt,
              pendingReason: runSummary.pendingReason,
            })
          : null;

        return {
          id: candidate.peopleId ?? candidate.id,
          candidateId: candidate.id,
          name: candidate.name ?? 'Untitled',
          title: candidate.people?.jobTitle ?? '',
          companyId: '',
          companyName: candidate.people?.jobCompanyName ?? '',
          locationName: candidate.people?.locationName ?? '',
          linkedinUrl: candidate.people?.linkedinLink?.primaryLinkUrl ?? '',
          warmPath: '—',
          stage: mapCrmStageToOutreachStage(displayStageId),
          recruiterStatus: candidate.status ?? undefined,
          candConversationStatus: candidate.candConversationStatus ?? undefined,
          workflowRunStatus: runSummary?.status ?? null,
          email: candidate.people?.emails?.primaryEmail ?? '',
          pendingChannel: candidate.pendingChannel ?? undefined,
          linkedinFollowUpCount: followUpCount,
          outreachResumeAt,
          candidateFlags: {
            startOutreach: resolveCandidateStartOutreach(candidate),
            stopOutreach: resolveCandidateStopOutreach(candidate),
          },
          nextStepLabel,
          nextRetryAt,
          needsApproval: runSummary?.needsApproval ?? false,
          experimentVariant: normalizeExperimentVariant(
            candidate.experimentVariant,
          ),
          messagesExchanged: formatMessagesExchanged(candidate.chatMessages, {
            outboundSenderFirstName,
          }),
          outreachConversationStage: conversationStage,
          lastInboundCopy: formatLastInboundMessage(candidate.chatMessages),
          lastInboundAt:
            resolveCandidateLastInboundAt(candidate) ??
            resolveLastInboundChat(candidate.chatMessages)?.createdAt ??
            null,
          lastOutboundAt: resolveCandidateLastOutboundAt(candidate),
          replyAfterTouch: formatReplyAfterTouch(candidate),
          createdAt: candidate.createdAt ?? null,
          updatedAt: candidate.updatedAt ?? null,
        };
      }),
    [journeySummary?.byCandidateId, outboundSenderFirstName, projectCandidates],
  );

  const crmPeopleSignature = outreachPersonSignature(crmPeople);
  const ephemeralPeopleSignature = outreachPersonSignature(ephemeralPeople);
  const people = useMemo(
    () => mergeEphemeralAndCrmPeople(ephemeralPeople, crmPeople),
    // Ignore array identity from GraphQL/record-store rerenders; selection
    // must not rebuild GTM People rows or Handsontable updateSettings loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [crmPeopleSignature, ephemeralPeopleSignature],
  );

  const effectiveIcp = resolveEffectiveIcp({
    project,
    workspaceCompany: currentWorkspace,
  });

  const projectOptions: OutreachProjectOption[] = useMemo(
    () =>
      outreachProjects.map((outreachProject) => {
        const resolved = resolveEffectiveIcp({
          project: outreachProject,
          workspaceCompany: currentWorkspace,
        });

        return {
          id: outreachProject.id,
          name: outreachProject.name ?? 'Untitled GTM project',
          icpSegment: resolved.parsedIcp?.targetTitles[0] ?? null,
        };
      }),
    [currentWorkspace, outreachProjects],
  );

  // Stable identity — OutreachHomePage syncs this into outreachContextState;
  // a fresh object every render retriggers that effect → max update depth.
  const projectSettings: OutreachProjectSettings = useMemo(
    () => ({
      projectId: project?.id ?? null,
      projectName: project?.name ?? null,
      outreachWorkflowId: project?.outreachWorkflowId ?? null,
      outreachStatus: normalizeOutreachStatus(project?.outreachStatus),
      outreachSendMode:
        (project?.outreachSendMode as OutreachSendMode | null) ?? 'APPROVAL',
      outreachConfig: project?.outreachConfig ?? null,
      maxPersonasPerCompany: resolveOutreachConfigMaxPersonasPerCompany(
        project?.outreachConfig,
      ),
      inMailFallbackEnabled: resolveOutreachConfigInMailFallbackEnabled(
        project?.outreachConfig,
      ),
      sendTimezone: resolveOutreachConfigSendTimezone(project?.outreachConfig),
      sendWindowStart: resolveOutreachConfigSendWindowStart(
        project?.outreachConfig,
      ),
      sendWindowEnd: resolveOutreachConfigSendWindowEnd(
        project?.outreachConfig,
      ),
      sendWindowDays: resolveOutreachConfigSendWindowDays(
        project?.outreachConfig,
      ),
      whatsappConnected,
      icpSpec: effectiveIcp.icpSpec,
      isIcpProjectOverride: effectiveIcp.isIcpProjectOverride,
      experimentConfig: resolveOutreachConfigExperimentConfigString(
        project?.outreachConfig,
      ),
    }),
    [
      effectiveIcp.icpSpec,
      effectiveIcp.isIcpProjectOverride,
      project?.id,
      project?.name,
      project?.outreachConfig,
      project?.outreachSendMode,
      project?.outreachStatus,
      project?.outreachWorkflowId,
      whatsappConnected,
    ],
  );

  const parsedIcp = effectiveIcp.parsedIcp;

  const workspaceCompany: OutreachWorkspaceCompany = {
    name:
      currentWorkspace?.companyName ??
      currentWorkspace?.displayName ??
      'Workspace',
    domain: currentWorkspace?.companyDomain ?? '',
    industry: currentWorkspace?.industry ?? '',
    summary:
      currentWorkspace?.summary ??
      (parsedIcp && parsedIcp.targetTitles.length > 0
        ? `ICP target titles: ${parsedIcp.targetTitles.join(', ')}`
        : 'Use Setup to define workspace GTM buyer titles and locations.'),
    employeeRange: currentWorkspace?.employeeRange ?? '',
    hq: currentWorkspace?.hq ?? '',
  };

  const peopleLoading =
    !peopleCacheReady || peopleCacheLoading || projectCandidatesLoading;

  // Page shell loading only — do not include people/companies fetch flags.
  // Socket-driven cache refreshes are silent so they cannot remount People/Companies tabs.
  return {
    loading: projectsLoading || isResolvingProject,
    peopleLoading,
    companiesLoading,
    workspaceCompany,
    hasWorkspaceCompany: isDefined(currentWorkspace?.id),
    refetchWorkspaceCompany,
    companies,
    people,
    projectSettings,
    projectOptions,
    activeProjectId,
    setActiveProjectId,
    refetchProjects,
    createOutreachProject,
    setCompanies,
    appendCompanies,
    setPeople,
    appendPeople,
    refreshPeopleWorkingSet,
    refreshCompaniesWorkingSet,
    parsedIcp,
    isIcpProjectOverride: effectiveIcp.isIcpProjectOverride,
    linkedinConnected,
    gmailConnected,
    whatsappConnected,
    activeTab,
    setActiveTab,
    selectedCompanyId,
    setSelectedCompanyId,
    selectedPersonId,
    setSelectedPersonId,
    peopleTableInstanceId: activeProjectId
      ? `outreach-people-${activeProjectId}`
      : 'outreach-people-none',
  };
};
