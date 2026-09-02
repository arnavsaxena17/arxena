import { isNonEmptyString } from '@sniptt/guards';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  buildDefaultOutreachConfig,
  resolveOutreachConfigExperimentConfigString,
  resolveOutreachConfigInMailFallbackEnabled,
  resolveOutreachConfigMaxPersonasPerCompany,
  resolveOutreachConfigSendTimezone,
  resolveOutreachConfigSendWindowDays,
  resolveOutreachConfigSendWindowEnd,
  resolveOutreachConfigSendWindowStart,
} from 'twenty-shared/arx';
import { ConnectedAccountProvider } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useProjectRefetch } from '@/candidate-table/hooks/useProjectRefetch';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import {
    OUTREACH_PROJECT_ID_QUERY_PARAM,
    OUTREACH_PROJECT_NAME_PREFIX,
    OUTREACH_WORKFLOW_B_NAME,
    isOutreachProjectName,
} from '@/outreach-home/constants/outreach-command.constants';
import { mapCrmStageToOutreachStage } from '@/outreach-home/constants/outreach-stages';
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
    type WorkspaceProfileRecord,
} from '@/outreach-home/types/outreach-home.types';
import {
    fetchOutreachCompaniesCache,
    persistOutreachCompaniesCache,
} from '@/outreach-home/utils/outreach-companies-cache';
import { resolveEffectiveIcp } from '@/outreach-home/utils/outreach-effective-icp.util';
import {
    fetchOutreachPeopleCache,
    persistOutreachPeopleCache,
} from '@/outreach-home/utils/outreach-people-cache';
import { useMyConnectedAccounts } from '@/settings/accounts/hooks/useMyConnectedAccounts';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useUnipile } from '@/unipile/contexts/UnipileContext';

type OutreachProjectRecord = ObjectRecord &
  OutreachProjectRecordFields & {
    updatedAt?: string;
  };

type OutreachCandidateRecord = ObjectRecord & {
  name?: string;
  jobTitle?: string | null;
  jobCompanyName?: string | null;
  campaign?: string | null;
  projectsId?: string | null;
  outreachSequenceStage?: string | null;
  pendingChannel?: string | null;
  experimentVariant?: string | null;
  linkedinUrl?: { primaryLinkUrl?: string; primaryLinkLabel?: string } | null;
  email?: { primaryEmail?: string } | null;
  peopleId?: string | null;
};

const normalizeOutreachStatus = (
  value: string | null | undefined,
): OutreachStatus =>
  value?.toUpperCase() === 'PAUSED' ? 'PAUSED' : 'LIVE';

const normalizeExperimentVariant = (
  value: string | null | undefined,
): 'A' | 'B' | null => {
  if (value === 'A' || value === 'B') {
    return value;
  }

  return null;
};

const isOutreachProject = (project: OutreachProjectRecord): boolean =>
  isNonEmptyString(project.outreachWorkflowId) ||
  isNonEmptyString(
    resolveOutreachConfigIcpSpecString(project.outreachConfig, project.icpSpec),
  ) ||
  isOutreachProjectName(project.name);

const dedupeCompaniesById = (companies: OutreachCompanyRow[]): OutreachCompanyRow[] => {
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
        `${person.id}:${person.stage}:${person.candidateId ?? ''}:${person.name}:${person.title}:${person.companyName}:${person.experimentVariant ?? ''}`,
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

  const [activeTab, setActiveTab] = useState<OutreachMainTab>('setup');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    null,
  );
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [ephemeralCompanies, setEphemeralCompanies] = useState<OutreachCompanyRow[]>(
    [],
  );
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [ephemeralPeople, setEphemeralPeople] = useState<OutreachPersonRow[]>([]);
  const [peopleCacheLoading, setPeopleCacheLoading] = useState(false);
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

  const { records: defaultOutreachWorkflows } =
    useFindManyRecords<{ id: string; name?: string }>({
      objectNameSingular: 'workflow',
      filter: {
        name: {
          eq: OUTREACH_WORKFLOW_B_NAME,
        },
      },
      limit: 1,
      recordGqlFields: {
        id: true,
        name: true,
      },
    });

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

  const { records: workspaceProfiles, loading: workspaceProfilesLoading, refetch: refetchWorkspaceProfiles } =
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
        icpSpec: true,
      },
    });

  const workspaceProfile = workspaceProfiles[0] ?? null;
  const outreachProjects = useMemo(
    () => allProjects.filter(isOutreachProject),
    [allProjects],
  );

  const hasValidProjectIdInQuery =
    isNonEmptyString(projectIdFromQuery) &&
    outreachProjects.some((project) => project.id === projectIdFromQuery);

  // Deep link wins; otherwise stay null until unused-project resolve / create finishes.
  const activeProjectId = hasValidProjectIdInQuery
    ? projectIdFromQuery
    : null;

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

  // Ephemeral companies from Redis (per projectId) — not CRM membership.
  // Poll so Ask AI upserts appear on the Companies tab without a full reload.
  useEffect(() => {
    let cancelled = false;

    if (!isDefined(activeProjectId) || !isDefined(accessToken)) {
      setEphemeralCompanies([]);

      return;
    }

    const refreshCompanies = () => {
      fetchOutreachCompaniesCache(activeProjectId, accessToken)
        .then((companies) => {
          if (cancelled) {
            return;
          }

          setEphemeralCompanies((previous) =>
            outreachCompanySignature(previous) === outreachCompanySignature(companies)
              ? previous
              : companies,
          );
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
  useLayoutEffect(() => {
    if (!isDefined(activeProjectId) || !isDefined(accessToken)) {
      setPeopleCacheReady(true);

      return;
    }

    setPeopleCacheReady(false);
  }, [accessToken, activeProjectId]);

  useEffect(() => {
    let cancelled = false;

    if (!isDefined(activeProjectId) || !isDefined(accessToken)) {
      setEphemeralPeople([]);
      setPeopleCacheReady(true);

      return;
    }

    const refreshPeople = () => {
      fetchOutreachPeopleCache(activeProjectId, accessToken)
        .then((people) => {
          if (cancelled) {
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
            linkedinUrl: person.linkedinUrl || '',
            candidateId: undefined,
          }));

          setEphemeralPeople((previous) =>
            outreachPersonSignature(previous) === outreachPersonSignature(nextPeople)
              ? previous
              : nextPeople,
          );
        })
        .finally(() => {
          if (!cancelled) {
            setPeopleCacheLoading(false);
            setPeopleCacheReady(true);
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

  const candidateFilter = useMemo(() => {
    if (!isDefined(scopeKey)) {
      return undefined;
    }

    return { projectsId: { eq: scopeKey } };
  }, [scopeKey]);

  const { records: candidateRecords, loading: candidatesLoading } =
    useFindManyRecords<OutreachCandidateRecord>({
      objectNameSingular: 'candidate',
      filter: candidateFilter,
      limit: 100,
      skip: !isDefined(scopeKey),
      recordGqlFields: {
        id: true,
        name: true,
        jobTitle: true,
        jobCompanyName: true,
        campaign: true,
        projectsId: true,
        outreachSequenceStage: true,
        pendingChannel: true,
        experimentVariant: true,
        linkedinUrl: true,
        email: true,
        peopleId: true,
      },
    });

  const createOutreachProject = useCallback(async () => {
    let outreachWorkflowId = defaultOutreachWorkflows[0]?.id ?? null;

    if (!isDefined(outreachWorkflowId)) {
      const createdWorkflow = await createWorkflow({
        name: OUTREACH_WORKFLOW_B_NAME,
      });

      outreachWorkflowId = createdWorkflow?.id ?? null;
    }

    const created = await createProject({
      name: `${OUTREACH_PROJECT_NAME_PREFIX} · ${new Date().toLocaleString()}`,
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

  const outreachProjectIdsKey = outreachProjects.map((project) => project.id).join(',');

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
          stage: mapCrmStageToOutreachStage(candidate.outreachSequenceStage),
          email: candidate.email?.primaryEmail ?? '',
          pendingChannel: candidate.pendingChannel ?? undefined,
          experimentVariant: normalizeExperimentVariant(
            candidate.experimentVariant,
          ),
        };
      }),
    [candidateRecords],
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
    workspaceProfile,
  });

  const projectOptions: OutreachProjectOption[] = useMemo(
    () =>
      outreachProjects.map((outreachProject) => {
        const resolved = resolveEffectiveIcp({
          project: outreachProject,
          workspaceProfile,
        });

        return {
          id: outreachProject.id,
          name: outreachProject.name ?? 'Untitled GTM project',
          icpSegment: resolved.parsedIcp?.targetTitles[0] ?? null,
        };
      }),
    [outreachProjects, workspaceProfile],
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
      sendWindowEnd: resolveOutreachConfigSendWindowEnd(project?.outreachConfig),
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
      workspaceProfile?.companyName ??
      currentWorkspace?.displayName ??
      'Workspace',
    domain: workspaceProfile?.companyDomain ?? '',
    industry: workspaceProfile?.industry ?? '',
    summary:
      workspaceProfile?.summary ??
      (parsedIcp && parsedIcp.targetTitles.length > 0
        ? `ICP target titles: ${parsedIcp.targetTitles.join(', ')}`
        : 'Use Setup to define workspace GTM buyer titles and locations.'),
    employeeRange: workspaceProfile?.employeeRange ?? '',
    hq: workspaceProfile?.hq ?? '',
  };

  const peopleLoading =
    !peopleCacheReady || peopleCacheLoading || candidatesLoading;

  return {
    loading:
      projectsLoading ||
      workspaceProfilesLoading ||
      isResolvingProject ||
      companiesLoading ||
      peopleLoading,
    peopleLoading,
    workspaceCompany,
    workspaceProfile,
    refetchWorkspaceProfiles,
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
