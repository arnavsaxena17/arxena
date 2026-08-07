import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { ConnectedAccountProvider } from 'twenty-shared/types';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import {
  GTM_PROJECT_ID_QUERY_PARAM,
  GTM_PROJECT_NAME_PREFIX,
} from '@/gtm-home/constants/gtm-command.constants';
import { mapCrmStageToGtmOutreachStage } from '@/gtm-home/constants/gtm-outreach-stages';
import {
  type GtmCompanyRow,
  type GtmMarketSegment,
  type GtmOutreachSendMode,
  type GtmPersonRow,
  type GtmProjectOption,
  type GtmProjectSettings,
  type GtmWorkspaceCompany,
} from '@/gtm-home/types/gtm-home.types';
import {
  fetchGtmCompaniesCache,
  persistGtmCompaniesCache,
} from '@/gtm-home/utils/gtm-companies-cache';
import { isLinkedinUnipileConnectedSelector } from '@/linkedin-unipile/states/linkedinUnipileAccountsState';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { useMyConnectedAccounts } from '@/settings/accounts/hooks/useMyConnectedAccounts';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { isWhatsappUnipileConnectedSelector } from '@/whatsapp-unipile/states/whatsappUnipileAccountsState';

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

const parseIcpSpec = (
  icpSpec: string | null | undefined,
): {
  name?: string;
  industries?: string[];
  employeeRange?: string;
  geos?: string[];
  buyerTitles?: string[];
  painSignals?: string[];
  stdFunctions?: string[];
  stdGrades?: string[];
} | null => {
  if (!isNonEmptyString(icpSpec)) {
    return null;
  }

  try {
    return JSON.parse(icpSpec) as {
      name?: string;
      industries?: string[];
      employeeRange?: string;
      geos?: string[];
      buyerTitles?: string[];
      painSignals?: string[];
      stdFunctions?: string[];
      stdGrades?: string[];
    };
  } catch {
    return null;
  }
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

export const useGtmLiveWorkingSet = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectIdFromQuery = searchParams.get(GTM_PROJECT_ID_QUERY_PARAM);

  const currentWorkspace = useAtomStateValue(currentWorkspaceState);
  const [tokenPair] = useAtomState(tokenPairState);
  const accessToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;
  const linkedinConnected = useAtomStateValue(
    isLinkedinUnipileConnectedSelector,
  );
  const whatsappConnected = useAtomStateValue(
    isWhatsappUnipileConnectedSelector,
  );
  const { accounts: connectedAccounts } = useMyConnectedAccounts();
  const gmailConnected = connectedAccounts.some(
    (account) =>
      account.provider === ConnectedAccountProvider.GOOGLE ||
      account.provider === ConnectedAccountProvider.MICROSOFT ||
      account.provider === ConnectedAccountProvider.IMAP_SMTP_CALDAV,
  );

  const [activeTab, setActiveTab] = useState<
    'companies' | 'people' | 'workflow' | 'market_map'
  >('companies');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    null,
  );
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(
    null,
  );
  const [ephemeralCompanies, setEphemeralCompanies] = useState<GtmCompanyRow[]>(
    [],
  );
  const [companiesLoading, setCompaniesLoading] = useState(false);

  const { createOneRecord: createProject } = useCreateOneRecord({
    objectNameSingular: 'project',
  });
  const { updateOneRecord } = useUpdateOneRecord();

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
        updatedAt: true,
      },
    });

  const gtmProjects = useMemo(
    () => allProjects.filter(isGtmProject),
    [allProjects],
  );

  const projectOptions: GtmProjectOption[] = useMemo(
    () =>
      gtmProjects.map((project) => ({
        id: project.id,
        name: project.name ?? 'Untitled GTM run',
        icpSegment: project.icpSegment ?? null,
      })),
    [gtmProjects],
  );

  const activeProjectId =
    projectIdFromQuery &&
    gtmProjects.some((project) => project.id === projectIdFromQuery)
      ? projectIdFromQuery
      : (gtmProjects[0]?.id ?? null);

  const setActiveProjectId = useCallback(
    (projectId: string) => {
      const next = new URLSearchParams(searchParams);

      next.set(GTM_PROJECT_ID_QUERY_PARAM, projectId);
      setSearchParams(next, { replace: true });
      setSelectedCompanyId(null);
      setSelectedPersonId(null);
      setSelectedSegmentId(null);
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    if (!isDefined(activeProjectId)) {
      return;
    }

    if (projectIdFromQuery === activeProjectId) {
      return;
    }

    const next = new URLSearchParams(searchParams);

    next.set(GTM_PROJECT_ID_QUERY_PARAM, activeProjectId);
    setSearchParams(next, { replace: true });
  }, [activeProjectId, projectIdFromQuery, searchParams, setSearchParams]);

  const project = gtmProjects.find(
    (candidate) => candidate.id === activeProjectId,
  );

  const scopeKey = project?.id ?? null;
  const legacyRunKey = project?.gtmRunKey ?? null;

  // Ephemeral companies from Redis (per projectId) — not CRM membership.
  useEffect(() => {
    let cancelled = false;

    if (!isDefined(activeProjectId) || !isDefined(accessToken)) {
      setEphemeralCompanies([]);

      return;
    }

    setCompaniesLoading(true);
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

    return () => {
      cancelled = true;
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

    setActiveProjectId(created.id);
    setEphemeralCompanies([]);

    return created.id;
  }, [createProject, setActiveProjectId, updateOneRecord]);

  const companies = ephemeralCompanies;

  const people: GtmPersonRow[] = useMemo(
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

  const segments: GtmMarketSegment[] = useMemo(() => {
    const counts = companies.reduce<Record<string, number>>(
      (accumulator, company) => {
        const segmentLabel = isNonEmptyString(company.segment)
          ? company.segment
          : 'Unsegmented';

        accumulator[segmentLabel] = (accumulator[segmentLabel] ?? 0) + 1;

        return accumulator;
      },
      {},
    );

    return Object.entries(counts).map(([label, companyCount]) => ({
      id: label.toLowerCase().replace(/\s+/g, '-'),
      label,
      description: `${companyCount} companies in this ICP segment`,
      companyCount,
    }));
  }, [companies]);

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
    icpSegment: project?.icpSegment ?? null,
    icpSpec: project?.icpSpec ?? null,
  };

  const parsedIcp = parseIcpSpec(project?.icpSpec);

  const workspaceCompany: GtmWorkspaceCompany = {
    name: currentWorkspace?.displayName ?? 'Workspace',
    domain:
      currentWorkspace?.workspaceUrls?.customUrl?.replace(/^https?:\/\//, '') ??
      currentWorkspace?.workspaceUrls?.subdomainUrl?.replace(
        /^https?:\/\//,
        '',
      ) ??
      '',
    industry: parsedIcp?.industries?.[0] ?? '',
    summary: isDefined(parsedIcp?.name)
      ? `ICP: ${parsedIcp.name}`
      : 'Use Ask AI to define ICP preferences for this GTM run.',
    employeeRange: parsedIcp?.employeeRange ?? '',
    hq: parsedIcp?.geos?.[0] ?? '',
  };

  return {
    loading: projectsLoading || companiesLoading || candidatesLoading,
    workspaceCompany,
    companies,
    people,
    segments,
    projectSettings,
    projectOptions,
    activeProjectId,
    setActiveProjectId,
    createGtmProject,
    setCompanies,
    appendCompanies,
    parsedIcp,
    linkedinConnected,
    gmailConnected,
    whatsappConnected,
    activeTab,
    setActiveTab,
    selectedCompanyId,
    setSelectedCompanyId,
    selectedPersonId,
    setSelectedPersonId,
    selectedSegmentId,
    setSelectedSegmentId,
    peopleTableInstanceId: activeProjectId
      ? `gtm-people-${activeProjectId}`
      : 'gtm-people-none',
  };
};
