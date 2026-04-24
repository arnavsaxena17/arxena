import styled from '@emotion/styled';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { useDebouncedCallback } from 'use-debounce';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { useJobRefetch } from '@/candidate-table/hooks/useJobRefetch';
import { ORG_CHART_CANDIDATE_SOURCE_M7KQ } from '@/orgchart/constants/orgChartM7kqSource';
import {
  OrgChartContactInfo,
  orgChartContactsByKeyState,
} from '@/orgchart/states/orgChartContactsByKeyState';
import { orgChartLinkedinCandidateSourceState } from '@/orgchart/states/orgChartLinkedInCandidateSourceState';
import { orgChartLinkedInSearchTypeState } from '@/orgchart/states/orgChartLinkedInSearchTypeState';
import { orgChartSelectedCompanyInfoState } from '@/orgchart/states/orgChartSelectedCompanyInfoState';
import { isOrgChartM7kqCandidateSource } from '@/orgchart/utils/isOrgChartM7kqCandidateSource';
import { AppPath } from '@/types/AppPath';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import {
  ConfirmationModal,
  StyledCenteredButton,
} from '@/ui/layout/modal/components/ConfirmationModal';
import { useUnipile } from '@/unipile/contexts/UnipileContext';
import {
  normalizeCompanyIdForUrl,
  OrgChartDiagram,
  OrgChartDiagramHandle,
  OrgChartSearchControls,
  useCompanyInfoLookup,
  useOrgChartData,
  useOrgChartFilterOptions,
} from 'twenty-orgchart';
import {
  extractOrgData,
  getProxiedImageUrl,
  OrgChartNodeData,
  processOrgChartToNodeData,
  toTitleCase,
} from 'twenty-shared';
import { OrgChartAddToJobModal } from './components/OrgChartAddToJobModal';
import { OrgChartHeader } from './components/OrgChartHeader';
import { OrgChartOutreachModal } from './components/OrgChartOutreachModal';
import { OrgChartQueryGeneratorControl } from './components/OrgChartQueryGeneratorControl';
import { OrgChartResultModal } from './components/OrgChartResultModal';
import { useJobOrgChartData } from './hooks/useJobOrgChartData';
import { useOrgChartActions } from './hooks/useOrgChartActions';
import { extractCompanyDomainFromWebsite } from './utils/orgChartUtils';

export type ArxOrgChartProps = {
  companyId: string;
  companyName?: string;
  website?: string;
  locationName?: string;
  industry?: string;
  profileCount?: number;
  linkedinUrl?: string;
  onBack?: () => void;
  jobId?: string;
};

const ORG_CHART_AGENT_UNAVAILABLE_SNACKBAR =
  'Contact Support. Org chart agent service is not available. Ensure the Python service is running and reachable.';

const leadershipOrgChartPythonFailureMessage = (detail: string) =>
  `Could not create the Leadership Org Chart because the org chart agent (Python service) failed. ${detail}`;

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  min-height: 400px;
  background: ${({ theme }) => theme.background.primary};
`;

const StyledDiagramArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 300px;
  background: ${({ theme }) => theme.background.secondary};
`;

const StyledDiagramBody = styled.div`
  flex: 1;
  min-height: 0;
  position: relative;
`;

const StyledPreviewPersistentBanner = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(1.5)}
    ${({ theme }) => theme.spacing(2)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.tertiary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  text-align: center;
`;

const StyledPreviewBannerSignupButton = styled.button`
  padding: ${({ theme }) => theme.spacing(0.75)}
    ${({ theme }) => theme.spacing(1.5)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: none;
  background: ${({ theme }) => theme.accent.primary};
  color: ${({ theme }) => theme.font.color.inverted};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    opacity: 0.92;
  }

  &:active {
    opacity: 0.85;
  }
`;

const StyledSearchOverlay = styled.div`
  position: absolute;
  bottom: ${({ theme }) => theme.spacing(2)};
  left: ${({ theme }) => theme.spacing(2)};
  z-index: 20;
`;

const StyledTopRightActionsOverlay = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  position: absolute;
  right: ${({ theme }) => theme.spacing(2)};
  top: ${({ theme }) => theme.spacing(2)};
  z-index: 20;
`;

const StyledTopRightActionButton = styled.button`
  padding: ${({ theme }) => theme.spacing(1)}
    ${({ theme }) => theme.spacing(1.5)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xs};
  cursor: pointer;

  &:hover:enabled {
    background: ${({ theme }) => theme.background.transparent.light};
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

const StyledLoadingMessage = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.md};
  height: 100%;
  justify-content: center;
  min-height: 300px;
`;

const StyledProgressBanner = styled.div`
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: ${({ theme }) => theme.border.radius.md};
  box-shadow: ${({ theme }) => theme.boxShadow.light};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  left: 50%;
  max-width: min(720px, calc(100% - ${({ theme }) => theme.spacing(4)}));
  padding: ${({ theme }) => theme.spacing(1.5)}
    ${({ theme }) => theme.spacing(2)};
  position: absolute;
  text-align: center;
  top: ${({ theme }) => theme.spacing(2)};
  transform: translateX(-50%);
  z-index: 25;
`;

const StyledLeadershipLoadingOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing(2)};
  background: ${({ theme }) => theme.background.secondary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  text-align: center;
  padding: ${({ theme }) => theme.spacing(3)};
`;

const StyledLeadershipInfoBanner = styled.div`
  background: ${({ theme }) => theme.background.tertiary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  box-shadow: ${({ theme }) => theme.boxShadow.light};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  left: ${({ theme }) => theme.spacing(2)};
  line-height: 1.45;
  max-width: min(560px, calc(100% - 220px));
  padding: ${({ theme }) => theme.spacing(1.5)}
    ${({ theme }) => theme.spacing(2)};
  position: absolute;
  top: ${({ theme }) => theme.spacing(2)};
  z-index: 22;
`;

const StyledLeadershipBannerLink = styled.button`
  display: inline;
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  color: ${({ theme }) => theme.color.blue};
  font-size: inherit;
  font-family: inherit;
  line-height: inherit;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;

  &:hover {
    opacity: 0.9;
  }
`;

const StyledLeadershipBannerPaidNote = styled.div`
  border-top: 1px dashed ${({ theme }) => theme.border.color.medium};
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.xs};
  line-height: 1.45;
  margin-top: ${({ theme }) => theme.spacing(1)};
  padding-top: ${({ theme }) => theme.spacing(1)};
`;

const StyledLeadershipBannerPaidHighlight = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-weight: 600;
`;

const StyledErrorMessage = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.color.red};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.md};
  height: 100%;
  justify-content: center;
  min-height: 300px;
`;

const StyledTemplateBanner = styled.div`
  align-items: center;
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.xl};
  box-shadow: ${({ theme }) => theme.boxShadow.strong};
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  flex-direction: column;
  font-size: ${({ theme }) => theme.font.size.sm};
  gap: ${({ theme }) => theme.spacing(2)};
  left: 50%;
  max-width: 420px;
  padding: ${({ theme }) => theme.spacing(3)} ${({ theme }) => theme.spacing(4)};
  position: absolute;
  text-align: center;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 25;
`;

const StyledTemplateBannerButton = styled.button`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.md};
  border: none;
  background: ${({ theme }) => theme.background.invertedPrimary};
  color: ${({ theme }) => theme.font.color.inverted};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  transition: opacity 0.15s ease;

  &:hover {
    opacity: 0.9;
  }

  &:active {
    opacity: 0.8;
  }
`;

const StyledSpinner = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid ${({ theme }) => theme.border.color.medium};
  border-top-color: ${({ theme }) => theme.color.blue};
  animation: orgchart-spin 0.8s linear infinite;

  @keyframes orgchart-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

const StyledOrgChartConfirmSummary = styled.div`
  width: 100%;
  max-width: 100%;
  text-align: left;
  align-self: stretch;
`;

const StyledOrgChartConfirmIntro = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: 1.5;
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledOrgChartConfirmRows = styled.dl`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1.5)};
  margin: 0;
`;

const StyledOrgChartConfirmRow = styled.div`
  align-items: start;
  display: grid;
  font-size: ${({ theme }) => theme.font.size.sm};
  gap: ${({ theme }) => theme.spacing(2)};
  grid-template-columns: minmax(120px, 36%) 1fr;
`;

const StyledOrgChartConfirmDt = styled.dt`
  margin: 0;
  color: ${({ theme }) => theme.font.color.tertiary};
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-size: ${({ theme }) => theme.font.size.xs};
`;

const StyledOrgChartConfirmDd = styled.dd`
  margin: 0;
  color: ${({ theme }) => theme.font.color.primary};
  word-break: break-word;
`;

const PERSON_ROW_HEIGHT = 48;

/** Default filter when switching companies (matches twenty-orgchart filter options). */
const DEFAULT_ORG_CHART_COUNTRY = 'global';
const DEFAULT_ORG_CHART_FUNCTION_ROOT = 'fullcompany';

export const ArxOrgChart = ({
  companyId,
  companyName,
  website,
  locationName,
  industry,
  profileCount,
  linkedinUrl,
  onBack,
  jobId,
}: ArxOrgChartProps) => {
  const navigate = useNavigate();
  const [selectedCountry, setSelectedCountry] = useState<string | undefined>();
  const [selectedFunctionRoot, setSelectedFunctionRoot] = useState<
    string | undefined
  >();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResultCount, setSearchResultCount] = useState<number | null>(
    null,
  );
  const [businessDivisionQuery, setBusinessDivisionQuery] = useState('');
  const [isEnrichedLeadershipLoading, setIsEnrichedLeadershipLoading] =
    useState(false);
  const [exactEmployeeCount, setExactEmployeeCount] = useState<number | null>(
    null,
  );
  const [unipileCompanyProfile, setUnipileCompanyProfile] = useState<{
    employee_count?: number;
    description?: string;
    tagline?: string;
    logo?: string;
    logo_large?: string;
    website?: string;
    name?: string;
    profile_url?: string;
    locations?: Array<{ city?: string; country?: string; area?: string }>;
    industry?: string[];
  } | null>(null);

  const diagramHandleRef = useRef<OrgChartDiagramHandle | null>(null);
  const skipNextRefetchRef = useRef(false);
  const prevCompanyIdForFiltersRef = useRef<string | null>(null);

  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token ?? undefined;

  const orgChartLinkedinCandidateSource = useRecoilValue(
    orgChartLinkedinCandidateSourceState,
  );
  const orgChartLinkedInSearchType = useRecoilValue(
    orgChartLinkedInSearchTypeState,
  );
  const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';
  const showNodeCapabilitiesHoverHint =
    process.env.REACT_APP_EXPERIMENTAL_ORGCHART_NODE_HOVER_HINTS === 'true';
  const { isLinkedinConnected } = useUnipile();
  const setSelectedCompanyInfo = useSetRecoilState(
    orgChartSelectedCompanyInfoState,
  );
  const setContactsByKey = useSetRecoilState(orgChartContactsByKeyState);

  const {
    company: fallbackCompanyInfo,
    isLoading: isCompanyInfoLookupLoading,
    lookupByName,
  } = useCompanyInfoLookup({ baseUrl, accessToken });
  const { refetchJobs } = useJobRefetch();
  const { enqueueSnackBar } = useSnackBar();
  const { t } = useLingui();
  const effectiveEmployeeCount =
    unipileCompanyProfile?.employee_count ??
    exactEmployeeCount ??
    fallbackCompanyInfo?.employeeCount;
  const expectedEmployeeCountForOrgChart = useMemo(() => {
    if (typeof effectiveEmployeeCount === 'number') {
      return effectiveEmployeeCount;
    }
    if (typeof profileCount === 'number') {
      return profileCount;
    }
    return undefined;
  }, [effectiveEmployeeCount, profileCount]);
  const effectiveCompanyName =
    companyName ??
    unipileCompanyProfile?.name ??
    fallbackCompanyInfo?.companyName;
  const effectiveCompanyWebsite =
    website ?? unipileCompanyProfile?.website ?? fallbackCompanyInfo?.website;
  const linkedinUrlToUse = linkedinUrl ?? fallbackCompanyInfo?.linkedinUrl;
  const [pendingPreviewNodePeopleChoice, setPendingPreviewNodePeopleChoice] =
    useState<OrgChartNodeData | null>(null);
  const actions = useOrgChartActions({
    companyId,
    companyName: effectiveCompanyName,
    website: effectiveCompanyWebsite,
    employeeCount: effectiveEmployeeCount,
    linkedinCompanyUrl: linkedinUrlToUse?.trim(),
    linkedinUnipileAccountId:
      process.env.REACT_APP_ORGCHART_UNIPILE_ACCOUNT_ID?.trim(),
    businessDivisionRawQuery: businessDivisionQuery.trim() || undefined,
    onPreviewNodePeopleRequest: (node) =>
      setPendingPreviewNodePeopleChoice(node),
  });
  const { applyOrgChartOverride } = actions;

  const orgChartContextAddToJobContext = useMemo(
    () => ({
      companyName: effectiveCompanyName ?? undefined,
      contextModalMode: actions.contextModalMode ?? undefined,
      selectedNodeFunction: actions.selectedNodeFunction,
      selectedNodeGrade: actions.selectedNodeGrade,
    }),
    [
      effectiveCompanyName,
      actions.contextModalMode,
      actions.selectedNodeFunction,
      actions.selectedNodeGrade,
    ],
  );

  const orgChartNodeDetailAddToJobContext = useMemo(
    () => ({
      companyName: effectiveCompanyName ?? undefined,
      contextModalMode: 'current_node' as const,
      selectedNodeFunction: actions.selectedNodeFunction,
      selectedNodeGrade: actions.selectedNodeGrade,
    }),
    [
      effectiveCompanyName,
      actions.selectedNodeFunction,
      actions.selectedNodeGrade,
    ],
  );

  const jobOrgChartHook = useJobOrgChartData(
    { jobId, jobName: companyName ?? effectiveCompanyName },
    { baseUrl, accessToken },
  );

  const classicOrgChartHook = useOrgChartData(
    {
      companyId,
      companyName: effectiveCompanyName ?? companyName,
      website: effectiveCompanyWebsite,
      country: selectedCountry,
      functionRoot: selectedFunctionRoot,
      expectedEmployeeCount: expectedEmployeeCountForOrgChart,
    },
    { baseUrl, accessToken },
  );

  const isJobMode = !!jobId;

  const data = (
    isJobMode ? jobOrgChartHook.data : classicOrgChartHook.data
  ) as Record<string, unknown> | null;
  const isLoading = isJobMode
    ? jobOrgChartHook.isLoading
    : classicOrgChartHook.isLoading;
  const error = isJobMode ? jobOrgChartHook.error : classicOrgChartHook.error;
  const fetchOrgChart = isJobMode
    ? jobOrgChartHook.fetchOrgChart
    : classicOrgChartHook.fetchOrgChart;

  const orgChartEsTransportError = classicOrgChartHook.orgChartEsTransportError;

  useEffect(() => {
    if (isJobMode || !orgChartEsTransportError) {
      return;
    }
    enqueueSnackBar(t`Org chart search timed out — showing fallback data.`, {
      variant: SnackBarVariant.Warning,
      dedupeKey: `org-chart-es-transport-${companyId ?? ''}`,
      duration: 4000,
    });
  }, [companyId, enqueueSnackBar, isJobMode, orgChartEsTransportError, t]);

  const hasInitialCompanyInfo =
    companyName ||
    website ||
    locationName ||
    industry ||
    typeof profileCount === 'number' ||
    linkedinUrl;

  useEffect(() => {
    if (skipNextRefetchRef.current) {
      skipNextRefetchRef.current = false;
      return;
    }
    if (
      !isJobMode &&
      !hasInitialCompanyInfo &&
      isCompanyInfoLookupLoading === true
    ) {
      // When loading an org chart from a URL slug (e.g. /org-chart/litify),
      // we first lookup the company name/website/headcount. Avoid fetching the
      // org chart twice by waiting for that lookup to finish (success or failure).
      return;
    }
    fetchOrgChart();
  }, [
    fetchOrgChart,
    hasInitialCompanyInfo,
    isCompanyInfoLookupLoading,
    isJobMode,
  ]);

  useEffect(() => {
    if (isJobMode) return;
    actions.clearLatestOrgChart();
  }, [
    actions.clearLatestOrgChart,
    isJobMode,
    companyId,
    selectedCountry,
    selectedFunctionRoot,
  ]);

  useEffect(() => {
    refetchJobs();
  }, [refetchJobs]);

  const orgSource = isJobMode
    ? (actions.latestOrgChart ??
      (data?.orgChart as Record<string, unknown> | null) ??
      null)
    : (actions.latestOrgChart ??
      (data as Record<string, unknown> | null) ??
      null);

  const orgData = useMemo(() => extractOrgData(orgSource), [orgSource]);

  // Hydrate session contact cache from the loaded org chart payload (Redis/S3/ES).
  useEffect(() => {
    if (!orgData) return;
    const raw = orgData.orgchart;
    let nodes: unknown[] = [];
    if (Array.isArray(raw)) {
      nodes = raw;
    } else if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw) as unknown;
        nodes = Array.isArray(parsed) ? parsed : [];
      } catch {
        nodes = [];
      }
    }
    if (nodes.length === 0) return;

    const websiteToUse =
      (orgData as Record<string, unknown>).job_company_website ??
      (orgData as Record<string, unknown>).company_website ??
      effectiveCompanyWebsite ??
      website;
    const domain =
      typeof websiteToUse === 'string'
        ? extractCompanyDomainFromWebsite(websiteToUse)
        : undefined;

    const next: Record<string, OrgChartContactInfo> = {};

    for (const n of nodes) {
      if (!n || typeof n !== 'object') continue;
      const candidatesRaw = (n as Record<string, unknown>).candidates;
      const candidates = Array.isArray(candidatesRaw)
        ? candidatesRaw
        : candidatesRaw && typeof candidatesRaw === 'object'
          ? [candidatesRaw]
          : [];
      for (const c of candidates) {
        if (!c || typeof c !== 'object') continue;
        const row = c as Record<string, unknown>;
        const rawId = typeof row.id === 'string' ? row.id.trim() : '';
        const li =
          typeof row.std_linkedin_url === 'string'
            ? row.std_linkedin_url.trim()
            : typeof row.linkedin_url === 'string'
              ? row.linkedin_url.trim()
              : '';
        const email =
          typeof row.email === 'string' && row.email.trim()
            ? row.email.trim()
            : Array.isArray(row.emails) && typeof row.emails[0] === 'string'
              ? (row.emails[0] as string).trim()
              : '';
        const phone =
          typeof row.phone === 'string' && row.phone.trim()
            ? row.phone.trim()
            : Array.isArray(row.phones) && typeof row.phones[0] === 'string'
              ? (row.phones[0] as string).trim()
              : '';
        const fullName =
          typeof row.full_name === 'string' && row.full_name.trim()
            ? row.full_name.trim()
            : typeof row.fullName === 'string' && row.fullName.trim()
              ? row.fullName.trim()
              : '';

        const hasAny = Boolean(email || phone || li || fullName);
        if (!hasAny) continue;

        const key =
          domain && rawId
            ? `m7kq:${domain.trim().toLowerCase()}:${rawId}`
            : li
              ? `li:${li}`
              : rawId
                ? `id:${rawId}`
                : null;
        if (!key) continue;

        next[key] = {
          fetched: true,
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
          ...(li ? { linkedinUrl: li } : {}),
          ...(fullName ? { fullName } : {}),
        };
      }
    }

    if (Object.keys(next).length === 0) return;
    setContactsByKey((prev) => ({ ...prev, ...next }));
  }, [orgData, effectiveCompanyWebsite, website, setContactsByKey]);

  const isBlankTemplate =
    typeof (orgSource as Record<string, unknown> | null)?.is_blank_template ===
      'boolean' &&
    (orgSource as Record<string, unknown>).is_blank_template === true;

  const filterOptions = useOrgChartFilterOptions(orgData);

  const searchConfirmSummary = useMemo(() => {
    const bd = businessDivisionQuery.trim();
    const fn = selectedFunctionRoot;
    const country = selectedCountry;

    const functionLabel =
      !fn || fn === 'fullcompany'
        ? t`Full company`
        : filterOptions.functionRootPercentLabels[fn]
          ? `${toTitleCase(fn)} (${filterOptions.functionRootPercentLabels[fn]})`
          : toTitleCase(fn);

    const geographyLabel =
      !country || country === 'global'
        ? t`Global`
        : filterOptions.countryPercentLabels[country]
          ? `${toTitleCase(country)} (${filterOptions.countryPercentLabels[country]})`
          : toTitleCase(country);

    const linkedinSearchTypeLabel =
      orgChartLinkedInSearchType === 'sales_navigator'
        ? t`Sales Navigator`
        : orgChartLinkedInSearchType === 'recruiter'
          ? t`LinkedIn Recruiter`
          : t`LinkedIn Classic`;

    const dataSourceLabel =
      orgChartLinkedinCandidateSource === 'unipile'
        ? t`LinkedIn · ${linkedinSearchTypeLabel}`
        : orgChartLinkedinCandidateSource === 'apify'
          ? t`Apify`
          : orgChartLinkedinCandidateSource === 'linkedin_xray'
            ? t`LinkedIn X-Ray`
            : orgChartLinkedinCandidateSource ===
                ORG_CHART_CANDIDATE_SOURCE_M7KQ
              ? t`Directory`
              : t`Unknown data source`;

    return {
      functionLabel,
      levelsLabel: t`All levels`,
      geographyLabel,
      businessDivisionLabel: bd.length > 0 ? bd : t`Not specified`,
      dataSourceLabel,
    };
  }, [
    businessDivisionQuery,
    selectedCountry,
    selectedFunctionRoot,
    filterOptions.countryPercentLabels,
    filterOptions.functionRootPercentLabels,
    orgChartLinkedinCandidateSource,
    orgChartLinkedInSearchType,
    t,
  ]);

  const candidateSearchConfirmSubtitle = useMemo(
    () => (
      <StyledOrgChartConfirmSummary>
        <StyledOrgChartConfirmIntro>
          <Trans>
            The search will use the scope below. Confirm to continue, or cancel
            to adjust filters first.
          </Trans>
        </StyledOrgChartConfirmIntro>
        <StyledOrgChartConfirmRows>
          <StyledOrgChartConfirmRow>
            <StyledOrgChartConfirmDt>
              <Trans>Function</Trans>
            </StyledOrgChartConfirmDt>
            <StyledOrgChartConfirmDd>
              {searchConfirmSummary.functionLabel}
            </StyledOrgChartConfirmDd>
          </StyledOrgChartConfirmRow>
          <StyledOrgChartConfirmRow>
            <StyledOrgChartConfirmDt>
              <Trans>Levels</Trans>
            </StyledOrgChartConfirmDt>
            <StyledOrgChartConfirmDd>
              {searchConfirmSummary.levelsLabel}
            </StyledOrgChartConfirmDd>
          </StyledOrgChartConfirmRow>
          <StyledOrgChartConfirmRow>
            <StyledOrgChartConfirmDt>
              <Trans>Geography</Trans>
            </StyledOrgChartConfirmDt>
            <StyledOrgChartConfirmDd>
              {searchConfirmSummary.geographyLabel}
            </StyledOrgChartConfirmDd>
          </StyledOrgChartConfirmRow>
          <StyledOrgChartConfirmRow>
            <StyledOrgChartConfirmDt>
              <Trans>Business division</Trans>
            </StyledOrgChartConfirmDt>
            <StyledOrgChartConfirmDd>
              {searchConfirmSummary.businessDivisionLabel}
            </StyledOrgChartConfirmDd>
          </StyledOrgChartConfirmRow>
          <StyledOrgChartConfirmRow>
            <StyledOrgChartConfirmDt>
              <Trans>Data source</Trans>
            </StyledOrgChartConfirmDt>
            <StyledOrgChartConfirmDd>
              {searchConfirmSummary.dataSourceLabel}
            </StyledOrgChartConfirmDd>
          </StyledOrgChartConfirmRow>
        </StyledOrgChartConfirmRows>
      </StyledOrgChartConfirmSummary>
    ),
    [searchConfirmSummary],
  );

  const previewNodeChoiceSubtitle = useMemo(
    () => (
      <StyledOrgChartConfirmSummary>
        <StyledOrgChartConfirmIntro>
          <Trans>
            Preview positions do not load people until you generate a real org
            chart. Choose an action using the scope below, or cancel to adjust
            filters first.
          </Trans>
        </StyledOrgChartConfirmIntro>
        <StyledOrgChartConfirmRows>
          <StyledOrgChartConfirmRow>
            <StyledOrgChartConfirmDt>
              <Trans>Function</Trans>
            </StyledOrgChartConfirmDt>
            <StyledOrgChartConfirmDd>
              {searchConfirmSummary.functionLabel}
            </StyledOrgChartConfirmDd>
          </StyledOrgChartConfirmRow>
          <StyledOrgChartConfirmRow>
            <StyledOrgChartConfirmDt>
              <Trans>Levels</Trans>
            </StyledOrgChartConfirmDt>
            <StyledOrgChartConfirmDd>
              {searchConfirmSummary.levelsLabel}
            </StyledOrgChartConfirmDd>
          </StyledOrgChartConfirmRow>
          <StyledOrgChartConfirmRow>
            <StyledOrgChartConfirmDt>
              <Trans>Geography</Trans>
            </StyledOrgChartConfirmDt>
            <StyledOrgChartConfirmDd>
              {searchConfirmSummary.geographyLabel}
            </StyledOrgChartConfirmDd>
          </StyledOrgChartConfirmRow>
          <StyledOrgChartConfirmRow>
            <StyledOrgChartConfirmDt>
              <Trans>Business division</Trans>
            </StyledOrgChartConfirmDt>
            <StyledOrgChartConfirmDd>
              {searchConfirmSummary.businessDivisionLabel}
            </StyledOrgChartConfirmDd>
          </StyledOrgChartConfirmRow>
          <StyledOrgChartConfirmRow>
            <StyledOrgChartConfirmDt>
              <Trans>Data source</Trans>
            </StyledOrgChartConfirmDt>
            <StyledOrgChartConfirmDd>
              {searchConfirmSummary.dataSourceLabel}
            </StyledOrgChartConfirmDd>
          </StyledOrgChartConfirmRow>
        </StyledOrgChartConfirmRows>
      </StyledOrgChartConfirmSummary>
    ),
    [searchConfirmSummary],
  );

  useEffect(() => {
    if (hasInitialCompanyInfo) {
      return;
    }

    const lookupKey = companyName?.trim() || companyId;
    if (lookupKey) {
      lookupByName(lookupKey);
    }
  }, [companyId, companyName, hasInitialCompanyInfo, lookupByName]);

  useEffect(() => {
    if (!fallbackCompanyInfo) return;
    setSelectedCompanyInfo({
      companyId: fallbackCompanyInfo.companyId,
      companyName: fallbackCompanyInfo.companyName,
      website: fallbackCompanyInfo.website,
      locationName: fallbackCompanyInfo.locationName,
      industry: fallbackCompanyInfo.industry,
      profileCount: fallbackCompanyInfo.profileCount,
      linkedinUrl: fallbackCompanyInfo.linkedinUrl,
    });
  }, [fallbackCompanyInfo, setSelectedCompanyInfo]);

  useEffect(() => {
    if (
      !isLinkedinConnected ||
      !linkedinUrlToUse?.trim() ||
      !baseUrl ||
      !accessToken
    ) {
      if (!isLinkedinConnected) {
        setUnipileCompanyProfile(null);
      }
      return;
    }

    let cancelled = false;
    const fetchCompanyProfile = async () => {
      try {
        const params = new URLSearchParams();
        params.set('linkedinUrl', linkedinUrlToUse.trim());
        const res = await fetch(
          `${baseUrl.replace(/\/$/, '')}/org-chart/companies/company-profile?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
        if (cancelled) return;
        const data = (await res.json()) as {
          linkedinConnected?: boolean;
          profile?: {
            employee_count?: number;
            description?: string;
            tagline?: string;
            logo?: string;
            logo_large?: string;
            website?: string;
            name?: string;
            profile_url?: string;
            locations?: Array<{
              city?: string;
              country?: string;
              area?: string;
            }>;
            industry?: string[];
          } | null;
        };
        if (res.ok && data.linkedinConnected && data.profile) {
          setUnipileCompanyProfile(data.profile);
        } else {
          setUnipileCompanyProfile(null);
        }
      } catch {
        if (!cancelled) setUnipileCompanyProfile(null);
      }
    };
    fetchCompanyProfile();
    return () => {
      cancelled = true;
    };
  }, [baseUrl, accessToken, isLinkedinConnected, linkedinUrlToUse]);

  useEffect(() => {
    if (isLinkedinConnected) return;
    const identifier = linkedinUrlToUse ?? companyId;
    if (!identifier?.trim() || !baseUrl) return;

    let cancelled = false;
    const fetchEmployeeCount = async () => {
      try {
        const params = new URLSearchParams();
        if (linkedinUrlToUse?.trim()) {
          params.set('linkedinUrl', linkedinUrlToUse.trim());
        } else {
          params.set('companyId', companyId);
        }
        const res = await fetch(
          `${baseUrl.replace(/\/$/, '')}/org-chart/companies/employee-count?${params.toString()}`,
          {
            headers: accessToken
              ? { Authorization: `Bearer ${accessToken}` }
              : undefined,
          },
        );
        if (cancelled) return;
        const data = (await res.json()) as { employeeCount?: number | null };
        if (res.ok && typeof data.employeeCount === 'number') {
          setExactEmployeeCount(data.employeeCount);
        }
      } catch {
        if (!cancelled) setExactEmployeeCount(null);
      }
    };
    // fetchEmployeeCount();
    return () => {
      cancelled = true;
    };
  }, [baseUrl, accessToken, companyId, linkedinUrlToUse, isLinkedinConnected]);

  useEffect(() => {
    const prev = prevCompanyIdForFiltersRef.current;
    const companyChanged = prev !== null && prev !== companyId;
    prevCompanyIdForFiltersRef.current = companyId;

    if (companyChanged) {
      skipNextRefetchRef.current = true;
      setSelectedCountry(DEFAULT_ORG_CHART_COUNTRY);
      setSelectedFunctionRoot(DEFAULT_ORG_CHART_FUNCTION_ROOT);
      return;
    }

    if (!orgData || !companyId) return;

    setSelectedCountry((current) => {
      if (current) return current;
      skipNextRefetchRef.current = true;
      const initialCountry =
        typeof orgData.country === 'string' ? orgData.country : undefined;
      return initialCountry;
    });

    setSelectedFunctionRoot((current) => {
      if (current) return current;
      skipNextRefetchRef.current = true;
      const initialFunctionRoot =
        typeof (orgData as Record<string, unknown>).type === 'string'
          ? ((orgData as Record<string, unknown>).type as string)
          : undefined;
      return initialFunctionRoot;
    });
  }, [orgData, companyId]);

  const readImageFromRawCandidate = (
    raw?: Record<string, unknown>,
    fallback?: string,
  ): string => {
    if (!raw) return fallback ?? '';

    const candidateImage = raw.image;
    const profilePictureUrl = raw.profile_picture_url;
    const pictureUrl = raw.picture_url;
    const picture = raw.picture;

    const candidates = [candidateImage, profilePictureUrl, pictureUrl, picture];
    const found = candidates.find(
      (value) => typeof value === 'string' && value.trim() !== '',
    );

    return found && typeof found === 'string' ? found : (fallback ?? '');
  };

  const nodeDataArray = useMemo(() => {
    if (!orgData) return [];
    const base = processOrgChartToNodeData(orgData);
    const apiBase = baseUrl.replace(/\/$/, '');
    const rewriteImage = (url: string) => getProxiedImageUrl(url, apiBase);

    if (Object.keys(actions.enrichedNodes).length === 0) {
      return base.map((node) => {
        const out = { ...node } as OrgChartNodeData;
        for (let i = 0; i < 4; i++) {
          const key = `image_${i}` as keyof OrgChartNodeData;
          const val = out[key];
          if (typeof val === 'string' && val) {
            (out as Record<string, string>)[key] = rewriteImage(val);
          }
        }
        if (typeof console !== 'undefined') {
          // console.log('[orgchart/ArxOrgChart/nodeDataArray]', {
          //   headline: out.headline,
          //   key: out.key,
          //   totalPeople: out.total_people,
          //   allCandidatesLength: Array.isArray(
          //     (out as Record<string, unknown>).allCandidates,
          //   )
          //     ? ((out as Record<string, unknown>).allCandidates as unknown[])
          //         .length
          //     : null,
          // });
        }
        return out;
      });
    }

    return base.map((node) => {
      const enriched = actions.enrichedNodes[node.key];
      if (!enriched) {
        const out = { ...node } as OrgChartNodeData;
        for (let i = 0; i < 4; i++) {
          const key = `image_${i}` as keyof OrgChartNodeData;
          const val = out[key];
          if (typeof val === 'string' && val) {
            (out as Record<string, string>)[key] = rewriteImage(val);
          }
        }
        return out;
      }

      const merged = { ...node } as OrgChartNodeData;
      const displayedCount = Math.min(enriched.people.length, 4);
      const totalCount = enriched.people.length;

      enriched.people.slice(0, 4).forEach((p, i) => {
        merged[`name_${i}`] = p.fullName;
        merged[`title_${i}`] = p.headline;
        merged[`linkedin_url_${i}`] = p.linkedinUrl ?? '';
        merged[`email_${i}`] = p.email ?? '';
        merged[`phone_${i}`] = p.phone ?? '';
        const existingImage = merged[`image_${i}`];
        const mergedImage =
          typeof existingImage === 'string' ? existingImage : undefined;
        const enrichedImage = readImageFromRawCandidate(
          (p.raw as Record<string, unknown>) ?? undefined,
          mergedImage,
        );
        merged[`image_${i}`] =
          rewriteImage(enrichedImage || '') || enrichedImage;
      });
      merged.height_0 = displayedCount >= 1 ? PERSON_ROW_HEIGHT : 0;
      merged.height_1 = displayedCount >= 2 ? PERSON_ROW_HEIGHT : 0;
      merged.height_2 = displayedCount >= 3 ? PERSON_ROW_HEIGHT : 0;
      merged.height_3 = displayedCount >= 4 ? PERSON_ROW_HEIGHT : 0;
      merged.nodeState = enriched.nodeState;
      merged.total_people = totalCount;
      if (typeof console !== 'undefined') {
        console.log('[orgchart/ArxOrgChart/nodeDataArray/enriched]', {
          headline: merged.headline,
          key: merged.key,
          totalPeople: merged.total_people,
          allCandidatesLength: Array.isArray(
            (merged as Record<string, unknown>).allCandidates,
          )
            ? ((merged as Record<string, unknown>).allCandidates as unknown[])
                .length
            : null,
        });
      }
      return merged;
    });
  }, [orgData, actions.enrichedNodes, baseUrl]);

  const hasPreviewOrgChartNodes = useMemo(
    () => nodeDataArray.some((n) => n.nodeState === 'preview'),
    [nodeDataArray],
  );

  const showPreviewPersistentBanner =
    hasPreviewOrgChartNodes && !isLoading && !error && nodeDataArray.length > 0;

  const leadershipLayerPreviewBanner = useMemo(() => {
    const src = orgSource as Record<string, unknown> | null;
    if (!src || src.org_enriched !== true) {
      return null;
    }
    const leadershipN =
      typeof src.org_people_count === 'number' ? src.org_people_count : null;
    if (leadershipN === null) {
      return null;
    }
    const fullN =
      typeof effectiveEmployeeCount === 'number'
        ? effectiveEmployeeCount
        : null;
    return { leadershipN, fullN };
  }, [orgSource, effectiveEmployeeCount]);

  /**
   * Count of people rendered in the current org chart nodes. Used as the
   * "fetched" count for the directory (m7kq) preview banner — mirrors what the user
   * actually sees on the diagram (sum of named candidates across nodes).
   */
  const fetchedPeopleInNodeArray = useMemo(() => {
    let count = 0;
    for (const node of nodeDataArray) {
      const total = (node as Record<string, unknown>).total_people;
      if (typeof total === 'number' && total >= 0) {
        count += total;
        continue;
      }
      for (let i = 0; i < 8; i += 1) {
        const name = (node as Record<string, unknown>)[`name_${i}`];
        if (typeof name === 'string' && name.trim().length > 0) {
          count += 1;
        }
      }
    }
    return count;
  }, [nodeDataArray]);

  /**
   * Preview/paid-customers banner when the org chart uses the directory (m7kq) source.
   *
   * Mirrors {@link leadershipLayerPreviewBanner} so the same messaging (small preview,
   * count of people fetched, full details for paid customers) also appears when
   * the org chart is loaded from that source. Kept mutually exclusive with the
   * leadership banner to avoid stacking two absolute-positioned cards.
   */
  const m7kqPreviewOrgChartBanner = useMemo(() => {
    if (leadershipLayerPreviewBanner !== null) {
      return null;
    }
    if (isLoading || !!error || isBlankTemplate || nodeDataArray.length === 0) {
      return null;
    }
    // Only trust the candidateSource stamped onto the orgChart response by
    // useOrgChartActions when an actual fetch completes. Do NOT fall back to
    // the recoil-selected source — it defaults to the m7kq channel value, which would
    // otherwise make the banner appear for ES-cached preview templates that
    // haven't been fetched from the directory source yet.
    const src = orgSource as Record<string, unknown> | null;
    const candidateSourceFromChart =
      typeof src?.candidateSource === 'string'
        ? (src.candidateSource as string)
        : null;
    if (!isOrgChartM7kqCandidateSource(candidateSourceFromChart)) {
      return null;
    }
    // Guard against showing the banner for all-preview charts (e.g. a cached
    // template that happens to have a stale candidateSource stamp but no real
    // people). Require at least one fully-populated (non-preview) node.
    const hasRealLoadedNode = nodeDataArray.some(
      (n) => n.nodeState !== 'preview',
    );
    if (!hasRealLoadedNode) {
      return null;
    }
    const itemCountFromChart =
      typeof src?.itemCount === 'number' ? (src.itemCount as number) : null;
    const fetchedN =
      itemCountFromChart !== null && itemCountFromChart > 0
        ? itemCountFromChart
        : fetchedPeopleInNodeArray;
    if (fetchedN <= 0) {
      return null;
    }
    const fullN =
      typeof effectiveEmployeeCount === 'number'
        ? effectiveEmployeeCount
        : null;
    return { fetchedN, fullN };
  }, [
    leadershipLayerPreviewBanner,
    orgSource,
    isLoading,
    error,
    isBlankTemplate,
    nodeDataArray,
    fetchedPeopleInNodeArray,
    effectiveEmployeeCount,
  ]);

  const isM7kqOrgChartSource = useMemo(() => {
    const src = orgSource as Record<string, unknown> | null;
    const candidateSourceFromChart =
      typeof src?.candidateSource === 'string'
        ? (src.candidateSource as string)
        : null;
    return (
      isOrgChartM7kqCandidateSource(candidateSourceFromChart) ||
      (candidateSourceFromChart === null &&
        orgChartLinkedinCandidateSource === ORG_CHART_CANDIDATE_SOURCE_M7KQ)
    );
  }, [orgSource, orgChartLinkedinCandidateSource]);

  const handleM7kqLockedContactClick = useCallback(
    (
      _node: OrgChartNodeData,
      _personSlotIndex: number,
      _channel: 'email' | 'phone' | 'linkedin',
    ) => {
      enqueueSnackBar(
        t`Contact details and full profiles require a paid plan. Upgrade to unlock emails, phone numbers, and enriched LinkedIn data.`,
        { variant: SnackBarVariant.Info, duration: 6000 },
      );
    },
    [enqueueSnackBar, t],
  );

  const handleSearch = () => {
    const handle = diagramHandleRef.current;
    if (!handle) return;
    const count = handle.search(searchTerm);
    setSearchResultCount(count);
  };

  const handleClearSearch = () => {
    diagramHandleRef.current?.clearSearch();
    setSearchTerm('');
    setSearchResultCount(null);
  };

  const debouncedSetCountry = useDebouncedCallback(
    (country: string | undefined) => setSelectedCountry(country),
    150,
  );
  const debouncedSetFunctionRoot = useDebouncedCallback(
    (fn: string | undefined) => setSelectedFunctionRoot(fn),
    150,
  );

  const resolvedSearchMode =
    selectedFunctionRoot && selectedFunctionRoot !== 'fullcompany'
      ? 'function_grade'
      : 'entire_company';

  const fetchLinkedinDataSourcesStatus = useCallback(async (): Promise<{
    linkedinUnipileConnected: boolean;
    apifyActorConfigured: boolean;
    pythonOrgChartAgentAvailable: boolean;
  } | null> => {
    if (!baseUrl?.trim() || !accessToken) {
      return null;
    }
    try {
      const res = await fetch(
        `${baseUrl.replace(/\/$/, '')}/org-chart/linkedin-data-sources-status`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok) {
        return null;
      }
      const json = (await res.json()) as {
        status?: string;
        linkedinUnipileConnected?: boolean;
        apifyActorConfigured?: boolean;
        pythonOrgChartAgentAvailable?: boolean;
      };
      if (json?.status !== 'ok') {
        return null;
      }
      return {
        linkedinUnipileConnected: !!json.linkedinUnipileConnected,
        apifyActorConfigured: !!json.apifyActorConfigured,
        pythonOrgChartAgentAvailable:
          typeof json.pythonOrgChartAgentAvailable === 'boolean'
            ? json.pythonOrgChartAgentAvailable
            : true,
      };
    } catch {
      return null;
    }
  }, [baseUrl, accessToken]);

  const handleViewAllCandidates = useCallback(async () => {
    await actions.executeOrgchartSearch({
      mode: resolvedSearchMode as
        | 'entire_company'
        | 'function_grade'
        | 'current_node'
        | 'leadership'
        | 'selected_nodes',
      origin: 'view_all_candidates',
      country: selectedCountry,
      functionRoot: selectedFunctionRoot,
    });
  }, [
    actions.executeOrgchartSearch,
    resolvedSearchMode,
    selectedCountry,
    selectedFunctionRoot,
  ]);

  const handleGetAllOrgChartSearch = useCallback(async () => {
    await actions.executeOrgchartSearch({
      mode: resolvedSearchMode as
        | 'entire_company'
        | 'function_grade'
        | 'current_node'
        | 'leadership'
        | 'selected_nodes',
      origin: 'header',
      country: selectedCountry,
      functionRoot: selectedFunctionRoot,
    });
  }, [
    actions.executeOrgchartSearch,
    resolvedSearchMode,
    selectedCountry,
    selectedFunctionRoot,
  ]);

  const handleMapBusinessDivision = useCallback(async () => {
    const trimmed = businessDivisionQuery.trim();
    if (!trimmed) return;
    await actions.executeOrgchartSearch({
      mode: 'business_division_map',
      origin: 'header',
      country: selectedCountry,
      functionRoot: selectedFunctionRoot,
      businessDivisionRawQuery: trimmed,
    });
  }, [
    actions.executeOrgchartSearch,
    businessDivisionQuery,
    selectedCountry,
    selectedFunctionRoot,
  ]);

  const [pendingSearchConfirm, setPendingSearchConfirm] = useState<{
    title: string;
    run: () => void;
  } | null>(null);

  const requestCandidateSearchConfirm = useCallback(
    (title: string, run: () => void) => {
      setPendingSearchConfirm({ title, run });
    },
    [],
  );

  const filtersProps = {
    availableCountries: filterOptions.availableCountries,
    countryPercentLabels: filterOptions.countryPercentLabels,
    selectedCountry,
    onCountryChange: debouncedSetCountry,
    availableFunctionRoots: filterOptions.availableFunctionRoots,
    functionRootPercentLabels: filterOptions.functionRootPercentLabels,
    selectedFunctionRoot,
    onFunctionRootChange: debouncedSetFunctionRoot,
    omitMarginLeft: true,
  };

  const searchControlsProps = {
    searchTerm,
    onSearchTermChange: setSearchTerm,
    searchResultCount,
    onSearch: handleSearch,
    onClearSearch: handleClearSearch,
    diagramHandleRef,
    onGetAll: () => {
      requestCandidateSearchConfirm(t`Confirm full org chart search`, () => {
        void handleGetAllOrgChartSearch();
      });
    },
    onViewAllCandidates: () => {
      requestCandidateSearchConfirm(t`Confirm view all candidates`, () => {
        void handleViewAllCandidates();
      });
    },
    onGetLeaders: () => {
      requestCandidateSearchConfirm(t`Confirm leadership search`, () => {
        void actions.executeOrgchartSearch({
          mode: 'leadership',
          origin: 'header',
          country: selectedCountry,
          functionRoot: selectedFunctionRoot,
        });
      });
    },
  };

  const fetchEnrichedLeadershipOrgChart = useCallback(async () => {
    if (!companyId?.trim() || !baseUrl?.trim()) {
      enqueueSnackBar('Missing company or server URL', {
        variant: SnackBarVariant.Error,
      });
      return;
    }
    setIsEnrichedLeadershipLoading(true);
    try {
      const agentStatus = await fetchLinkedinDataSourcesStatus();
      if (agentStatus !== null && !agentStatus.pythonOrgChartAgentAvailable) {
        enqueueSnackBar(
          leadershipOrgChartPythonFailureMessage(
            ORG_CHART_AGENT_UNAVAILABLE_SNACKBAR,
          ),
          { variant: SnackBarVariant.Error, duration: 12000 },
        );
        return;
      }
      const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
      const canonicalCompanyId = normalizeCompanyIdForUrl(companyId);
      const params = new URLSearchParams();
      const nameToSend = effectiveCompanyName?.trim();
      if (nameToSend) {
        params.set('companyName', nameToSend);
      }
      if (selectedCountry?.trim()) {
        params.set('country', selectedCountry.trim());
      }
      if (selectedFunctionRoot?.trim()) {
        params.set('functionRoot', selectedFunctionRoot.trim());
      }
      const qs = params.toString();
      const url = `${normalizedBaseUrl}/org-chart/${encodeURIComponent(
        canonicalCompanyId,
      )}/enriched${qs ? `?${qs}` : ''}`;
      const res = await fetch(url, {
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });
      const json = (await res.json()) as {
        status?: string;
        result?: Record<string, unknown>;
        message?: string | string[];
      };
      if (!res.ok) {
        const rawMsg = json?.message;
        const msg =
          typeof rawMsg === 'string' && rawMsg
            ? rawMsg
            : Array.isArray(rawMsg)
              ? rawMsg.join(', ')
              : `Request failed (${res.status})`;
        throw new Error(leadershipOrgChartPythonFailureMessage(msg));
      }
      if (json?.status === 'ok' && json.result) {
        applyOrgChartOverride(json.result);
        enqueueSnackBar('Loaded Leadership Org Chart', {
          variant: SnackBarVariant.Success,
          duration: 4000,
        });
        window.setTimeout(() => {
          diagramHandleRef.current?.zoomToFit();
        }, 150);
      } else {
        throw new Error(
          leadershipOrgChartPythonFailureMessage(
            'Invalid response from leadership org chart endpoint',
          ),
        );
      }
    } catch (e) {
      enqueueSnackBar(
        e instanceof Error
          ? e.message
          : leadershipOrgChartPythonFailureMessage('Unknown error'),
        { variant: SnackBarVariant.Error, duration: 10000 },
      );
    } finally {
      setIsEnrichedLeadershipLoading(false);
    }
  }, [
    companyId,
    baseUrl,
    accessToken,
    effectiveCompanyName,
    selectedCountry,
    selectedFunctionRoot,
    applyOrgChartOverride,
    enqueueSnackBar,
    fetchLinkedinDataSourcesStatus,
  ]);

  const unipileLocationName = unipileCompanyProfile?.locations?.[0]
    ? [
        unipileCompanyProfile.locations[0].city,
        unipileCompanyProfile.locations[0].area,
        unipileCompanyProfile.locations[0].country,
      ]
        .filter(Boolean)
        .join(', ')
    : undefined;

  const resolveSafeLogoUrl = (rawLogoUrl?: string): string | undefined => {
    const trimmed = rawLogoUrl?.trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
      return trimmed;
    }
    try {
      const parsed = new URL(trimmed, window.location.origin);
      if (parsed.origin === window.location.origin) {
        return parsed.toString();
      }
    } catch {
      return undefined;
    }
    return undefined;
  };

  const headerProps = {
    companyName: effectiveCompanyName,
    website: effectiveCompanyWebsite,
    locationName:
      locationName ?? unipileLocationName ?? fallbackCompanyInfo?.locationName,
    industry:
      industry ??
      (Array.isArray(unipileCompanyProfile?.industry)
        ? unipileCompanyProfile?.industry?.join(', ')
        : undefined) ??
      fallbackCompanyInfo?.industry,
    profileCount: profileCount ?? fallbackCompanyInfo?.profileCount,
    hideProfileCountWhenUnipile: !!unipileCompanyProfile,
    linkedinUrl:
      linkedinUrl ??
      unipileCompanyProfile?.profile_url ??
      fallbackCompanyInfo?.linkedinUrl,
    employeeCount:
      unipileCompanyProfile?.employee_count ??
      exactEmployeeCount ??
      fallbackCompanyInfo?.employeeCount,
    linkedinDisplayName: fallbackCompanyInfo?.linkedinDisplayName,
    description: unipileCompanyProfile?.description,
    tagline: unipileCompanyProfile?.tagline,
    logoUrl: resolveSafeLogoUrl(
      unipileCompanyProfile?.logo_large ?? unipileCompanyProfile?.logo,
    ),
    onBack,
    hasFilters: !!orgData,
    filtersProps,
    businessDivisionQueryProps: {
      value: businessDivisionQuery,
      onChange: setBusinessDivisionQuery,
      onSubmit: () => {
        void handleMapBusinessDivision();
      },
      isSubmitting: actions.isContextLoading,
    },
    toolbarTrailing: <OrgChartQueryGeneratorControl />,
  };

  return (
    <StyledContainer>
      <OrgChartHeader {...headerProps} />

      <StyledDiagramArea>
        {showPreviewPersistentBanner && (
          <StyledPreviewPersistentBanner>
            <span>
              {accessToken
                ? 'This is a preview of the org chart. Generate the full org chart from the toolbar to see all employees.'
                : 'This is a preview of the org chart. Get the full org chart for free when you sign up.'}
            </span>
            {!accessToken && (
              <StyledPreviewBannerSignupButton
                type="button"
                onClick={() => navigate(AppPath.SignInUp)}
              >
                Sign up free
              </StyledPreviewBannerSignupButton>
            )}
          </StyledPreviewPersistentBanner>
        )}
        <StyledDiagramBody>
          {isEnrichedLeadershipLoading && (
            <StyledLeadershipLoadingOverlay>
              <StyledSpinner />
              <span>Loading Leadership Org Chart from Public Sources</span>
            </StyledLeadershipLoadingOverlay>
          )}
          {isLoading && (
            <StyledLoadingMessage>Loading org chart...</StyledLoadingMessage>
          )}
          {actions.isContextLoading &&
            !actions.isContextModalOpen &&
            actions.contextProgressMessage && (
              <StyledProgressBanner>
                {actions.contextProgressMessage}
              </StyledProgressBanner>
            )}
          {error && <StyledErrorMessage>{error}</StyledErrorMessage>}

          {!isLoading && !error && nodeDataArray.length > 0 && (
            <>
              {isBlankTemplate &&
                (actions.isContextLoading ? (
                  <StyledTemplateBanner>
                    <StyledSpinner />
                    <span>
                      {actions.contextProgressMessage || 'Processing...'}
                    </span>
                  </StyledTemplateBanner>
                ) : (
                  <StyledTemplateBanner>
                    <span>
                      This is a preview template. Generate the full org chart to
                      see all employees.
                    </span>
                    <StyledTemplateBannerButton
                      type="button"
                      onClick={searchControlsProps.onGetAll}
                    >
                      {typeof effectiveEmployeeCount === 'number'
                        ? `Generate full org chart (${effectiveEmployeeCount.toLocaleString()} employees)`
                        : 'Generate full org chart'}
                    </StyledTemplateBannerButton>
                  </StyledTemplateBanner>
                ))}
              <OrgChartDiagram
                ref={diagramHandleRef}
                nodeDataArray={nodeDataArray}
                showNodeCapabilitiesHoverHint={showNodeCapabilitiesHoverHint}
                m7kqContactMode={isM7kqOrgChartSource}
                onLockedContactChannelClick={handleM7kqLockedContactClick}
                nodeCapabilitiesHoverCompanyName={
                  effectiveCompanyName ?? undefined
                }
                iconUrls={{
                  lock: '/img/lock.png',
                  linkedin: '/img/linkedin-icon-png-circle-2.png',
                  download: '/img/download-icon.png',
                  similarItems: '/img/similar-items.png',
                }}
                onNodeContextAction={actions.handleNodeContextAction}
                onBackgroundContextAction={
                  actions.handleBackgroundContextAction
                }
                onNodeDoubleClick={actions.handleNodeDoubleClick}
                onDownloadNode={actions.handleDownloadNode}
                onSimilarPeople={actions.handleSimilarPeople}
              />
              {leadershipLayerPreviewBanner && (
                <StyledLeadershipInfoBanner>
                  {leadershipLayerPreviewBanner.fullN !== null ? (
                    <span>
                      This Leadership Org Chart shows only{' '}
                      {leadershipLayerPreviewBanner.leadershipN.toLocaleString()}{' '}
                      leadership profile
                      {leadershipLayerPreviewBanner.leadershipN === 1
                        ? ''
                        : 's'}
                      . The full company org chart has{' '}
                      {leadershipLayerPreviewBanner.fullN.toLocaleString()}{' '}
                      profiles — click{' '}
                      <StyledLeadershipBannerLink
                        type="button"
                        onClick={searchControlsProps.onGetAll}
                      >
                        Full org chart
                      </StyledLeadershipBannerLink>{' '}
                      above to load it.
                    </span>
                  ) : (
                    <span>
                      This Leadership Org Chart shows only{' '}
                      {leadershipLayerPreviewBanner.leadershipN.toLocaleString()}{' '}
                      leadership profile
                      {leadershipLayerPreviewBanner.leadershipN === 1
                        ? ''
                        : 's'}
                      . Click{' '}
                      <StyledLeadershipBannerLink
                        type="button"
                        onClick={searchControlsProps.onGetAll}
                      >
                        Full org chart
                      </StyledLeadershipBannerLink>{' '}
                      above to load the full company org chart.
                    </span>
                  )}
                  <StyledLeadershipBannerPaidNote>
                    <StyledLeadershipBannerPaidHighlight>
                      Small preview only:
                    </StyledLeadershipBannerPaidHighlight>{' '}
                    {leadershipLayerPreviewBanner.leadershipN.toLocaleString()}{' '}
                    {leadershipLayerPreviewBanner.leadershipN === 1
                      ? 'person'
                      : 'people'}{' '}
                    fetched from public sources. Full profile details (contact
                    info, tenure &amp; more) are available for{' '}
                    <StyledLeadershipBannerPaidHighlight>
                      paid customers
                    </StyledLeadershipBannerPaidHighlight>
                    .
                  </StyledLeadershipBannerPaidNote>
                </StyledLeadershipInfoBanner>
              )}
              {m7kqPreviewOrgChartBanner && (
                <StyledLeadershipInfoBanner>
                  <span>
                    Org chart loaded with{' '}
                    {m7kqPreviewOrgChartBanner.fetchedN.toLocaleString()}{' '}
                    {m7kqPreviewOrgChartBanner.fetchedN === 1
                      ? 'person'
                      : 'people'}{' '}
                    fetched
                    {m7kqPreviewOrgChartBanner.fullN !== null
                      ? ` out of ${m7kqPreviewOrgChartBanner.fullN.toLocaleString()} total employees`
                      : ''}
                    .
                    {m7kqPreviewOrgChartBanner.fullN !== null ? (
                      <>
                        {' '}
                        Click{' '}
                        <StyledLeadershipBannerLink
                          type="button"
                          onClick={searchControlsProps.onGetAll}
                        >
                          Full org chart
                        </StyledLeadershipBannerLink>{' '}
                        above to expand the preview.
                      </>
                    ) : null}
                  </span>
                  <StyledLeadershipBannerPaidNote>
                    <StyledLeadershipBannerPaidHighlight>
                      Small preview only:
                    </StyledLeadershipBannerPaidHighlight>{' '}
                    {m7kqPreviewOrgChartBanner.fetchedN.toLocaleString()}{' '}
                    {m7kqPreviewOrgChartBanner.fetchedN === 1
                      ? 'person'
                      : 'people'}{' '}
                    fetched. Full profile details (verified emails, phone
                    numbers &amp; more) are available for{' '}
                    <StyledLeadershipBannerPaidHighlight>
                      paid customers
                    </StyledLeadershipBannerPaidHighlight>
                    .
                  </StyledLeadershipBannerPaidNote>
                </StyledLeadershipInfoBanner>
              )}
              <StyledTopRightActionsOverlay>
                <StyledTopRightActionButton
                  type="button"
                  onClick={searchControlsProps.onGetAll}
                >
                  {typeof effectiveEmployeeCount === 'number'
                    ? `Full org chart (${effectiveEmployeeCount.toLocaleString()})`
                    : 'All'}
                </StyledTopRightActionButton>
                <StyledTopRightActionButton
                  type="button"
                  onClick={searchControlsProps.onViewAllCandidates}
                >
                  View all candidates
                </StyledTopRightActionButton>
                <StyledTopRightActionButton
                  type="button"
                  disabled={isEnrichedLeadershipLoading}
                  onClick={() => {
                    requestCandidateSearchConfirm(
                      t`Confirm Leadership Org Chart`,
                      () => {
                        void fetchEnrichedLeadershipOrgChart();
                      },
                    );
                  }}
                >
                  {isEnrichedLeadershipLoading
                    ? 'Loading Leadership Org Chart'
                    : 'Leadership Org Chart'}
                </StyledTopRightActionButton>
              </StyledTopRightActionsOverlay>
              <StyledSearchOverlay>
                <OrgChartSearchControls {...searchControlsProps} />
              </StyledSearchOverlay>
            </>
          )}

          {!isLoading && !error && data && nodeDataArray.length === 0 && (
            <StyledLoadingMessage>
              No org chart data available.
            </StyledLoadingMessage>
          )}

          {actions.isContextModalOpen && (
            <OrgChartResultModal
              title={actions.contextModalTitle}
              isLoading={actions.isContextLoading}
              loadingStartedAt={actions.contextLoadingStartedAt}
              loadingProgressMessage={actions.contextProgressMessage}
              loadingPage={actions.contextProgressPage}
              loadingTotalPages={actions.contextProgressTotalPages}
              loadingTotalCandidates={actions.contextProgressTotalCandidates}
              error={actions.contextError}
              results={actions.contextResults}
              booleanKeywordsString={actions.booleanKeywordsString}
              companyWebsite={headerProps.website}
              companyId={companyId}
              onClose={actions.closeContextModal}
              onDownloadCsv={
                actions.contextResults.length > 0
                  ? actions.downloadContextResultsAsCsv
                  : undefined
              }
              addToJobInlineContext={orgChartContextAddToJobContext}
              onStop={actions.cancelOrgchartSearch}
            />
          )}

          {actions.selectedNodeForDetails && (
            <OrgChartResultModal
              title={actions.selectedNodeForDetails.headline}
              isLoading={actions.isNodeDetailLoading}
              error={actions.nodeDetailError}
              results={actions.nodeDetailResults}
              emptyMessage="No people are attached to this node yet."
              companyWebsite={headerProps.website}
              companyId={companyId}
              onClose={actions.closeNodeDetailModal}
              onDownloadCsv={actions.downloadNodeDetailsAsCsv}
              addToJobInlineContext={orgChartNodeDetailAddToJobContext}
              onGetSimilarPeople={() =>
                actions.executeOrgchartSearch({
                  mode: 'function_grade',
                  origin: 'doubleClick',
                  node: actions.selectedNodeForDetails!,
                })
              }
            />
          )}

          <OrgChartAddToJobModal
            isOpen={actions.isAddToJobModalOpen}
            onClose={actions.closeAddToJobModal}
            node={actions.addToJobNode}
            companyName={effectiveCompanyName ?? undefined}
            queueStartChatAfter={actions.addToJobQueueStartChat}
            onSuccess={actions.closeAddToJobModal}
          />

          <OrgChartOutreachModal
            isOpen={actions.isOutreachModalOpen}
            onClose={actions.closeOutreachModal}
            channel={actions.outreachChannel}
            contextItem={actions.outreachContextItem}
            node={actions.outreachNode}
            companyName={effectiveCompanyName ?? undefined}
          />
        </StyledDiagramBody>
      </StyledDiagramArea>

      <ConfirmationModal
        isOpen={pendingSearchConfirm !== null}
        setIsOpen={(open) => {
          if (!open) {
            setPendingSearchConfirm(null);
          }
        }}
        title={pendingSearchConfirm?.title ?? ''}
        subtitle={candidateSearchConfirmSubtitle}
        onConfirmClick={() => {
          pendingSearchConfirm?.run();
        }}
        deleteButtonText={t`Confirm`}
        confirmButtonAccent="blue"
      />

      <ConfirmationModal
        isOpen={pendingPreviewNodePeopleChoice !== null}
        setIsOpen={(open) => {
          if (!open) {
            setPendingPreviewNodePeopleChoice(null);
          }
        }}
        title={t`Preview org chart`}
        subtitle={previewNodeChoiceSubtitle}
        onConfirmClick={() => {
          void handleGetAllOrgChartSearch();
        }}
        deleteButtonText={t`View full org chart`}
        confirmButtonAccent="blue"
        AdditionalButtons={
          <>
            <StyledCenteredButton
              variant="secondary"
              accent="blue"
              title={t`View all candidates in this function`}
              fullWidth
              onClick={() => {
                setPendingPreviewNodePeopleChoice(null);
                void handleViewAllCandidates();
              }}
            />
            <StyledCenteredButton
              variant="secondary"
              accent="blue"
              title={t`Leadership org chart`}
              fullWidth
              onClick={() => {
                setPendingPreviewNodePeopleChoice(null);
                void fetchEnrichedLeadershipOrgChart();
              }}
            />
          </>
        }
      />
    </StyledContainer>
  );
};
