import { isNonEmptyString } from '@sniptt/guards';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ConnectedAccountProvider } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useProjectRefetch } from '@/candidate-table/hooks/useProjectRefetch';
import {
    GTM_OUTREACH_WORKFLOW_B_NAME,
    GTM_PROJECT_ID_QUERY_PARAM,
    GTM_PROJECT_NAME_PREFIX,
} from '@/gtm-home/constants/gtm-command.constants';
import { mapCrmStageToGtmOutreachStage } from '@/gtm-home/constants/gtm-outreach-stages';
import {
    type GtmCompanyRow,
    type GtmMainTab,
    type GtmOutreachSendMode,
    type GtmPersonRow,
    type GtmProjectOption,
    type GtmProjectSettings,
    type GtmWorkspaceCompany,
    type WorkspaceProfileRecord,
} from '@/gtm-home/types/gtm-home.types';
import { resolveEffectiveGtmIcp } from '@/gtm-home/utils/gtm-effective-icp.util';
import {
    fetchGtmCompaniesCache,
    persistGtmCompaniesCache,
} from '@/gtm-home/utils/gtm-companies-cache';
import {
    fetchGtmPeopleCache,
    persistGtmPeopleCache,
} from '@/gtm-home/utils/gtm-people-cache';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { useMyConnectedAccounts } from '@/settings/accounts/hooks/useMyConnectedAccounts';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useUnipile } from '@/unipile/contexts/UnipileContext';

type GtmProjectRecord = ObjectRecord & {
  name?: string;
  gtmRunKey?: string | null;
  outreachWorkflowId?: string | null;
  outreachSendMode?: string | null;
  maxPersonasPerCompany?: number | null;
  inMailFallbackEnabled?: boolean | null;
  sendTimezone?: string | null;
  sendWindowStart?: string | null;
  sendWindowEnd?: string | null;
  icpSegment?: string | null;
  icpSpec?: string | null;
  icpBlurb?: string | null;
  companySearchBlurb?: string | null;
  peopleSearchBlurb?: string | null;
  updatedAt?: string;
};

type GtmCandidateRecord = ObjectRecord & {
  name?: string;
  jobTitle?: string | null;
  jobCompanyName?: string | null;
  gtmRunKey?: string | null;
  campaign?: string | null;
  projectsId?: string | null;
  outreachSequenceStage?: string | null;
  connectionDegree?: number | null;
  personaPriorityScore?: number | null;
  pendingChannel?: string | null;
  linkedinUrl?: { primaryLinkUrl?: string; primaryLinkLabel?: string } | null;
  email?: { primaryEmail?: string } | null;
  peopleId?: string | null;
};

const isGtmProject = (project: GtmProjectRecord): boolean =>
  isNonEmptyString(project.gtmRunKey) ||
  isNonEmptyString(project.outreachWorkflowId) ||
  isNonEmptyString(project.icpSegment) ||
  isNonEmptyString(project.icpSpec) ||
  (project.name ?? '').startsWith(GTM_PROJECT_NAME_PREFIX);

const dedupeCompaniesById = (companies: GtmCompanyRow[]): GtmCompanyRow[] => {
  const seen = new Set<string>();
  const result: GtmCompanyRow[] = [];

  for (const company of companies) {
    if (seen.has(company.id)) {
      continue;
    }

    seen.add(company.id);
    result.push(company);
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

const mergeEphemeralAndCrmPeople = (
  ephemeralPeople: GtmPersonRow[],
  crmPeople: GtmPersonRow[],
): GtmPersonRow[] => {
  const byKey = new Map<string, GtmPersonRow>();

  for (const person of ephemeralPeople) {
    byKey.set(personMergeKey(person), person);
  }

  // CRM enrolled rows win on the same LinkedIn / id key
  for (const person of crmPeople) {
    byKey.set(personMergeKey(person), person);
  }

  return [...byKey.values()];
};

export const useGtmLiveWorkingSet = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectIdFromQuery = searchParams.get(GTM_PROJECT_ID_QUERY_PARAM);

  const currentWorkspace = useAtomStateValue(currentWorkspaceState);
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

  const [activeTab, setActiveTab] = useState<GtmMainTab>('setup');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    null,
  );
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [ephemeralCompanies, setEphemeralCompanies] = useState<GtmCompanyRow[]>(
    [],
  );
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [ephemeralPeople, setEphemeralPeople] = useState<GtmPersonRow[]>([]);
  const [peopleCacheLoading, setPeopleCacheLoading] = useState(false);
  const [isResolvingProject, setIsResolvingProject] = useState(false);
  const gtmProjectCreateInFlightRef = useRef(false);
  const createGtmProjectRef = useRef<
    (() => Promise<string | null>) | null
  >(null);

  const { createOneRecord: createProject } = useCreateOneRecord({
    objectNameSingular: 'project',
  });
  const { createOneRecord: createWorkflow } = useCreateOneRecord({
    objectNameSingular: 'workflow',
  });
  const { updateOneRecord } = useUpdateOneRecord();
  const { triggerJobsRefetch } = useProjectRefetch();

  const { records: defaultOutreachWorkflows } =
    useFindManyRecords<{ id: string; name?: string }>({
      objectNameSingular: 'workflow',
      filter: {
        name: {
          eq: GTM_OUTREACH_WORKFLOW_B_NAME,
        },
      },
      limit: 1,
      recordGqlFields: {
        id: true,
        name: true,
      },
    });

  const { records: allProjects, loading: projectsLoading } =
    useFindManyRecords<GtmProjectRecord>({
      objectNameSingular: 'project',
      orderBy: [{ updatedAt: 'DescNullsFirst' }],
      limit: 50,
      recordGqlFields: {
        id: true,
        name: true,
        gtmRunKey: true,
        outreachWorkflowId: true,
        outreachSendMode: true,
        maxPersonasPerCompany: true,
        inMailFallbackEnabled: true,
        sendTimezone: true,
        sendWindowStart: true,
        sendWindowEnd: true,
        icpSegment: true,
        icpSpec: true,
        icpBlurb: true,
        companySearchBlurb: true,
        peopleSearchBlurb: true,
        updatedAt: true,
      },
    });

  const { records: workspaceProfiles, loading: workspaceProfilesLoading } =
    useFindManyRecords<WorkspaceProfileRecord>({
      objectNameSingular: 'workspaceProfile',
      orderBy: [{ createdAt: 'AscNullsLast' }],
      limit: 1,
      recordGqlFields: {
        id: true,
        name: true,
        companyName: true,
        companyDomain: true,
        industry: true,
        summary: true,
        employeeRange: true,
        hq: true,
        icpSegment: true,
        icpSpec: true,
        icpBlurb: true,
        companySearchBlurb: true,
        peopleSearchBlurb: true,
      },
    });

  const workspaceProfile = workspaceProfiles[0] ?? null;
  const gtmProjects = useMemo(
    () => allProjects.filter(isGtmProject),
    [allProjects],
  );

  const hasValidProjectIdInQuery =
    isNonEmptyString(projectIdFromQuery) &&
    gtmProjects.some((project) => project.id === projectIdFromQuery);

  // Deep link wins; otherwise stay null until unused-run resolve / create finishes.
  const activeProjectId = hasValidProjectIdInQuery
    ? projectIdFromQuery
    : null;

  const setActiveProjectId = useCallback(
    (projectId: string) => {
      const next = new URLSearchParams(searchParams);

      next.set(GTM_PROJECT_ID_QUERY_PARAM, projectId);
      setSearchParams(next, { replace: true });
      setSelectedCompanyId(null);
      setSelectedPersonId(null);
    },
    [searchParams, setSearchParams],
  );

  const project = gtmProjects.find(
    (candidate) => candidate.id === activeProjectId,
  );

  const scopeKey = project?.id ?? null;
  const legacyRunKey = project?.gtmRunKey ?? null;

  // Ephemeral companies from Redis (per projectId) — not CRM membership.
  // Poll so Ask AI upserts appear on the Companies tab without a full reload.
  useEffect(() => {
    let cancelled = false;

    if (!isDefined(activeProjectId) || !isDefined(accessToken)) {
      setEphemeralCompanies([]);

      return;
    }

    const refreshCompanies = () => {
      fetchGtmCompaniesCache(activeProjectId, accessToken)
        .then((companies) => {
          if (!cancelled) {
            setEphemeralCompanies(companies);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setCompaniesLoading(false);
          }
        });
    };

    setCompaniesLoading(true);
    refreshCompanies();

    const pollIntervalId = window.setInterval(refreshCompanies, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(pollIntervalId);
    };
  }, [accessToken, activeProjectId]);

  // Ephemeral people from Redis (per projectId) — not CRM Candidates until enroll.
  useEffect(() => {
    let cancelled = false;

    if (!isDefined(activeProjectId) || !isDefined(accessToken)) {
      setEphemeralPeople([]);

      return;
    }

    const refreshPeople = () => {
      fetchGtmPeopleCache(activeProjectId, accessToken)
        .then((people) => {
          if (!cancelled) {
            setEphemeralPeople(
              people.map((person) => ({
                ...person,
                stage: mapCrmStageToGtmOutreachStage(person.stage),
                warmPath: person.warmPath || '—',
                email: person.email || '',
                companyId: person.companyId || '',
                companyName: person.companyName || '',
                title: person.title || '',
                linkedinUrl: person.linkedinUrl || '',
                candidateId: undefined,
              })),
            );
          }
        })
        .finally(() => {
          if (!cancelled) {
            setPeopleCacheLoading(false);
          }
        });
    };

    setPeopleCacheLoading(true);
    refreshPeople();

    const pollIntervalId = window.setInterval(refreshPeople, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(pollIntervalId);
    };
  }, [accessToken, activeProjectId]);

  const setCompanies = useCallback(
    async (companies: GtmCompanyRow[]) => {
      const next = dedupeCompaniesById(companies);

      setEphemeralCompanies(next);

      if (isDefined(activeProjectId) && isDefined(accessToken)) {
        await persistGtmCompaniesCache(activeProjectId, next, accessToken);
      }
    },
    [accessToken, activeProjectId],
  );

  const appendCompanies = useCallback(
    async (companiesToAdd: GtmCompanyRow[]) => {
      const next = dedupeCompaniesById([
        ...ephemeralCompanies,
        ...companiesToAdd,
      ]);

      await setCompanies(next);
    },
    [ephemeralCompanies, setCompanies],
  );

  const setPeople = useCallback(
    async (people: GtmPersonRow[]) => {
      setEphemeralPeople(people);

      if (isDefined(activeProjectId) && isDefined(accessToken)) {
        await persistGtmPeopleCache(activeProjectId, people, accessToken);
      }
    },
    [accessToken, activeProjectId],
  );

  const candidateFilter = useMemo(() => {
    if (!isDefined(scopeKey)) {
      return undefined;
    }

    const filters: Array<Record<string, unknown>> = [
      { projectsId: { eq: scopeKey } },
      { gtmRunKey: { eq: scopeKey } },
      { campaign: { eq: scopeKey } },
    ];

    if (isNonEmptyString(legacyRunKey) && legacyRunKey !== scopeKey) {
      filters.push({ gtmRunKey: { eq: legacyRunKey } });
      filters.push({ campaign: { eq: legacyRunKey } });
    }

    return { or: filters };
  }, [legacyRunKey, scopeKey]);

  const { records: candidateRecords, loading: candidatesLoading } =
    useFindManyRecords<GtmCandidateRecord>({
      objectNameSingular: 'candidate',
      filter: candidateFilter,
      limit: 100,
      skip: !isDefined(scopeKey),
      recordGqlFields: {
        id: true,
        name: true,
        jobTitle: true,
        jobCompanyName: true,
        gtmRunKey: true,
        campaign: true,
        projectsId: true,
        outreachSequenceStage: true,
        connectionDegree: true,
        personaPriorityScore: true,
        pendingChannel: true,
        linkedinUrl: true,
        email: true,
        peopleId: true,
      },
    });

  const createGtmProject = useCallback(async () => {
    let outreachWorkflowId = defaultOutreachWorkflows[0]?.id ?? null;

    if (!isDefined(outreachWorkflowId)) {
      const createdWorkflow = await createWorkflow({
        name: GTM_OUTREACH_WORKFLOW_B_NAME,
      });

      outreachWorkflowId = createdWorkflow?.id ?? null;
    }

    const created = await createProject({
      name: `${GTM_PROJECT_NAME_PREFIX} · ${new Date().toLocaleString()}`,
      isActive: true,
      outreachSendMode: 'APPROVAL',
      maxPersonasPerCompany: 2,
      inMailFallbackEnabled: false,
      sendTimezone: 'America/Los_Angeles',
      sendWindowStart: '09:00',
      sendWindowEnd: '17:00',
      maxConnectsPerDay: 25,
      maxCommentsPerDay: 20,
      maxEmailsPerDay: 50,
      complianceCopy:
        'Stop if not interested or unsubscribe. Do not pressure. Respect OOO.',
      ...(isDefined(outreachWorkflowId) ? { outreachWorkflowId } : {}),
    });

    if (!isDefined(created?.id)) {
      return null;
    }

    await updateOneRecord({
      objectNameSingular: 'project',
      idToUpdate: created.id,
      updateOneRecordInput: {
        gtmRunKey: created.id,
      },
    });

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
    updateOneRecord,
  ]);

  createGtmProjectRef.current = createGtmProject;

  const gtmProjectIdsKey = gtmProjects.map((project) => project.id).join(',');

  // On /gtm-home without a valid ?projectId=, reuse the newest unused run
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
    const projectsSnapshot = gtmProjects;

    const resolveActiveProject = async () => {
      setIsResolvingProject(true);

      try {
        const occupancyByProjectId = await Promise.all(
          projectsSnapshot.map(async (project) => {
            const [companies, people] = await Promise.all([
              fetchGtmCompaniesCache(project.id, accessToken),
              fetchGtmPeopleCache(project.id, accessToken),
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

        // projectsSnapshot is updatedAt desc — first unused is the latest empty run
        const unusedProject = occupancyByProjectId.find(
          (occupancy) => occupancy.isUnused,
        );

        if (isDefined(unusedProject)) {
          setActiveProjectId(unusedProject.projectId);

          return;
        }

        if (cancelled || gtmProjectCreateInFlightRef.current) {
          return;
        }

        gtmProjectCreateInFlightRef.current = true;

        try {
          await createGtmProjectRef.current?.();
        } finally {
          gtmProjectCreateInFlightRef.current = false;
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
    // Snapshot gtmProjects when the id set changes; create via ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    accessToken,
    gtmProjectIdsKey,
    hasValidProjectIdInQuery,
    projectsLoading,
    setActiveProjectId,
  ]);

  const companies = ephemeralCompanies;

  const crmPeople: GtmPersonRow[] = useMemo(
    () =>
      candidateRecords.map((candidate) => {
        const linkedinUrl =
          candidate.linkedinUrl?.primaryLinkUrl ??
          candidate.linkedinUrl?.primaryLinkLabel ??
          '';

        return {
          id: candidate.peopleId ?? candidate.id,
          candidateId: candidate.id,
          name: candidate.name ?? 'Untitled',
          title: candidate.jobTitle ?? '',
          companyId: '',
          companyName: candidate.jobCompanyName ?? '',
          linkedinUrl,
          warmPath: '—',
          stage: mapCrmStageToGtmOutreachStage(candidate.outreachSequenceStage),
          email: candidate.email?.primaryEmail ?? '',
          connectionDegree: candidate.connectionDegree ?? undefined,
          personaPriorityScore: candidate.personaPriorityScore ?? undefined,
          pendingChannel: candidate.pendingChannel ?? undefined,
        };
      }),
    [candidateRecords],
  );

  const people = useMemo(
    () => mergeEphemeralAndCrmPeople(ephemeralPeople, crmPeople),
    [crmPeople, ephemeralPeople],
  );

  const effectiveIcp = resolveEffectiveGtmIcp({
    project,
    workspaceProfile,
  });

  const projectOptions: GtmProjectOption[] = useMemo(
    () =>
      gtmProjects.map((gtmProject) => {
        const resolved = resolveEffectiveGtmIcp({
          project: gtmProject,
          workspaceProfile,
        });

        return {
          id: gtmProject.id,
          name: gtmProject.name ?? 'Untitled GTM run',
          icpSegment: resolved.icpSegment,
        };
      }),
    [gtmProjects, workspaceProfile],
  );

  const projectSettings: GtmProjectSettings = {
    projectId: project?.id ?? null,
    projectName: project?.name ?? null,
    gtmRunKey: project?.gtmRunKey ?? project?.id ?? null,
    outreachWorkflowId: project?.outreachWorkflowId ?? null,
    outreachSendMode:
      (project?.outreachSendMode as GtmOutreachSendMode | null) ?? 'APPROVAL',
    maxPersonasPerCompany: project?.maxPersonasPerCompany ?? 2,
    inMailFallbackEnabled: project?.inMailFallbackEnabled ?? false,
    sendTimezone: project?.sendTimezone ?? 'America/Los_Angeles',
    sendWindowStart: project?.sendWindowStart ?? '09:00',
    sendWindowEnd: project?.sendWindowEnd ?? '17:00',
    whatsappConnected,
    icpSegment: effectiveIcp.icpSegment,
    icpSpec: effectiveIcp.icpSpec,
    icpBlurb: effectiveIcp.icpBlurb,
    companySearchBlurb: effectiveIcp.companySearchBlurb,
    peopleSearchBlurb: effectiveIcp.peopleSearchBlurb,
    isIcpRunOverride: effectiveIcp.isIcpRunOverride,
    isIcpBlurbRunOverride: effectiveIcp.isIcpBlurbRunOverride,
    isCompanySearchBlurbRunOverride:
      effectiveIcp.isCompanySearchBlurbRunOverride,
    isPeopleSearchBlurbRunOverride:
      effectiveIcp.isPeopleSearchBlurbRunOverride,
  };

  const parsedIcp = effectiveIcp.parsedIcp;

  const workspaceCompany: GtmWorkspaceCompany = {
    name:
      workspaceProfile?.companyName ??
      currentWorkspace?.displayName ??
      'Workspace',
    domain: workspaceProfile?.companyDomain ?? '',
    industry: workspaceProfile?.industry ?? parsedIcp?.industries?.[0] ?? '',
    summary:
      workspaceProfile?.summary ??
      (isDefined(parsedIcp?.name)
        ? `ICP: ${parsedIcp.name}`
        : 'Use Setup → Refine ICP to define workspace GTM preferences.'),
    employeeRange:
      workspaceProfile?.employeeRange ?? parsedIcp?.employeeRange ?? '',
    hq: workspaceProfile?.hq ?? parsedIcp?.geos?.[0] ?? '',
  };

  return {
    loading:
      projectsLoading ||
      workspaceProfilesLoading ||
      isResolvingProject ||
      companiesLoading ||
      peopleCacheLoading ||
      candidatesLoading,
    workspaceCompany,
    workspaceProfile,
    companies,
    people,
    projectSettings,
    projectOptions,
    activeProjectId,
    setActiveProjectId,
    createGtmProject,
    setCompanies,
    appendCompanies,
    setPeople,
    parsedIcp,
    isIcpRunOverride: effectiveIcp.isIcpRunOverride,
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
      ? `gtm-people-${activeProjectId}`
      : 'gtm-people-none',
  };
};
