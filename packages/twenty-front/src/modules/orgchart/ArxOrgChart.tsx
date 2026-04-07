import styled from '@emotion/styled';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { useDebouncedCallback } from 'use-debounce';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { useJobRefetch } from '@/candidate-table/hooks/useJobRefetch';
import { AppPath } from '@/types/AppPath';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useUnipile } from '@/unipile/contexts/UnipileContext';
import {
  normalizeCompanyIdForUrl,
  OrgChartDiagram,
  OrgChartSearchControls,
  useCompanyInfoLookup,
  useOrgChartData,
  useOrgChartFilterOptions,
  type OrgChartDiagramHandle,
} from 'twenty-orgchart';
import {
  extractOrgData,
  getProxiedImageUrl,
  processOrgChartToNodeData,
  type OrgChartNodeData,
} from 'twenty-shared';
import { OrgChartAddToJobModal } from './components/OrgChartAddToJobModal';
import { OrgChartHeader } from './components/OrgChartHeader';
import { OrgChartResultModal } from './components/OrgChartResultModal';
import { OrgChartResultsAddToJobModal } from './components/OrgChartResultsAddToJobModal';
import { useJobOrgChartData } from './hooks/useJobOrgChartData';
import { useOrgChartActions } from './hooks/useOrgChartActions';

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
  padding: ${({ theme }) => theme.spacing(1.5)} ${({ theme }) => theme.spacing(2)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.tertiary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  text-align: center;
`;

const StyledPreviewBannerSignupButton = styled.button`
  padding: ${({ theme }) => theme.spacing(0.75)} ${({ theme }) => theme.spacing(1.5)};
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
  position: absolute;
  top: ${({ theme }) => theme.spacing(2)};
  right: ${({ theme }) => theme.spacing(2)};
  z-index: 20;
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledTopRightActionButton = styled.button`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(1.5)};
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
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.md};
`;

const StyledProgressBanner = styled.div`
  position: absolute;
  top: ${({ theme }) => theme.spacing(2)};
  left: 50%;
  transform: translateX(-50%);
  z-index: 25;
  padding: ${({ theme }) => theme.spacing(1.5)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.md};
  background: ${({ theme }) => theme.background.tertiary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  box-shadow: ${({ theme }) => theme.boxShadow.light};
  max-width: min(720px, calc(100% - ${({ theme }) => theme.spacing(4)}));
  text-align: center;
`;

const StyledTheOrgLeadershipLoadingOverlay = styled.div`
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

const StyledTheOrgLeadershipInfoBanner = styled.div`
  position: absolute;
  top: ${({ theme }) => theme.spacing(2)};
  left: ${({ theme }) => theme.spacing(2)};
  z-index: 22;
  max-width: min(560px, calc(100% - 220px));
  padding: ${({ theme }) => theme.spacing(1.5)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.md};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.tertiary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: 1.45;
  box-shadow: ${({ theme }) => theme.boxShadow.light};
`;

const StyledTheOrgLeadershipBannerLink = styled.button`
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

const StyledErrorMessage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
  color: ${({ theme }) => theme.color.red};
  font-size: ${({ theme }) => theme.font.size.md};
`;

const StyledTemplateBanner = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 25;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)} ${({ theme }) => theme.spacing(4)};
  border-radius: ${({ theme }) => theme.border.radius.xl};
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  box-shadow: ${({ theme }) => theme.boxShadow.strong};
  max-width: 420px;
  text-align: center;
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
  const [searchResultCount, setSearchResultCount] = useState<number | null>(null);
  const [businessDivisionQuery, setBusinessDivisionQuery] = useState('');
  const [isTheOrgEnrichedLoading, setIsTheOrgEnrichedLoading] = useState(false);
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
  const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';
  const showNodeCapabilitiesHoverHint =
    process.env.REACT_APP_EXPERIMENTAL_ORGCHART_NODE_HOVER_HINTS === 'true';
  const { isLinkedinConnected } = useUnipile();

  const {
    company: fallbackCompanyInfo,
    lookupByName,
  } = useCompanyInfoLookup({ baseUrl, accessToken });
  const { refetchJobs } = useJobRefetch();
  const { enqueueSnackBar } = useSnackBar();
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
  const linkedinUrlToUse = linkedinUrl ?? fallbackCompanyInfo?.linkedinUrl;
  const actions = useOrgChartActions({
    companyId,
    companyName: effectiveCompanyName,
    website,
    employeeCount: effectiveEmployeeCount,
    linkedinCompanyUrl: linkedinUrlToUse?.trim(),
    linkedinUnipileAccountId:
      process.env.REACT_APP_ORGCHART_UNIPILE_ACCOUNT_ID?.trim(),
  });
  const { applyOrgChartOverride } = actions;

  const jobOrgChartHook = useJobOrgChartData(
    { jobId, jobName: companyName ?? effectiveCompanyName },
    { baseUrl, accessToken },
  );

  const classicOrgChartHook = useOrgChartData(
    {
      companyId,
      companyName: effectiveCompanyName ?? companyName,
      website,
      country: selectedCountry,
      functionRoot: selectedFunctionRoot,
      expectedEmployeeCount: expectedEmployeeCountForOrgChart,
    },
    { baseUrl, accessToken },
  );

  const isJobMode = !!jobId;

  const data = (isJobMode ? jobOrgChartHook.data : classicOrgChartHook.data) as
    | Record<string, unknown>
    | null;
  const isLoading = isJobMode
    ? jobOrgChartHook.isLoading
    : classicOrgChartHook.isLoading;
  const error = isJobMode
    ? jobOrgChartHook.error
    : classicOrgChartHook.error;
  const fetchOrgChart = isJobMode
    ? jobOrgChartHook.fetchOrgChart
    : classicOrgChartHook.fetchOrgChart;

  useEffect(() => {
    if (skipNextRefetchRef.current) {
      skipNextRefetchRef.current = false;
      return;
    }
    fetchOrgChart();
  }, [fetchOrgChart]);

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
        ((data?.orgChart as Record<string, unknown> | null) ?? null))
    : actions.latestOrgChart ?? ((data as Record<string, unknown> | null) ?? null);

  const orgData = useMemo(
    () => extractOrgData(orgSource),
    [orgSource],
  );

  const isBlankTemplate =
    typeof (orgSource as Record<string, unknown> | null)?.is_blank_template ===
    'boolean' &&
    (orgSource as Record<string, unknown>).is_blank_template === true;

  const filterOptions = useOrgChartFilterOptions(orgData);

  const hasInitialCompanyInfo =
    companyName ||
    website ||
    locationName ||
    industry ||
    typeof profileCount === 'number' ||
    linkedinUrl;

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
    if (!isLinkedinConnected || !linkedinUrlToUse?.trim() || !baseUrl || !accessToken) {
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
            locations?: Array<{ city?: string; country?: string; area?: string }>;
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
  }, [
    baseUrl,
    accessToken,
    isLinkedinConnected,
    linkedinUrlToUse,
  ]);

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
  }, [
    baseUrl,
    accessToken,
    companyId,
    linkedinUrlToUse,
    isLinkedinConnected,
  ]);

  useEffect(() => {
    const prev = prevCompanyIdForFiltersRef.current;
    const companyChanged =
      prev !== null && prev !== companyId;
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

    return found && typeof found === 'string' ? found : fallback ?? '';
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
        const existingImage = merged[`image_${i}`];
        const mergedImage =
          typeof existingImage === 'string' ? existingImage : undefined;
        const enrichedImage = readImageFromRawCandidate(
          (p.raw as Record<string, unknown>) ?? undefined,
          mergedImage,
        );
        merged[`image_${i}`] = rewriteImage(enrichedImage || '') || enrichedImage;
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
    hasPreviewOrgChartNodes &&
    !isLoading &&
    !error &&
    nodeDataArray.length > 0;

  const theOrgLeadershipBanner = useMemo(() => {
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
      typeof effectiveEmployeeCount === 'number' ? effectiveEmployeeCount : null;
    return { leadershipN, fullN };
  }, [orgSource, effectiveEmployeeCount]);

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
        | 'all_people'
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
        | 'all_people'
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
      void handleGetAllOrgChartSearch();
    },
    onViewAllCandidates: () => {
      void handleViewAllCandidates();
    },
    onGetLeaders: () =>
      actions.executeOrgchartSearch({
        mode: 'leadership',
        origin: 'header',
      }),
  };

  const fetchTheOrgEnrichedOrgChart = useCallback(async () => {
    if (!companyId?.trim() || !baseUrl?.trim()) {
      enqueueSnackBar('Missing company or server URL', {
        variant: SnackBarVariant.Error,
      });
      return;
    }
    setIsTheOrgEnrichedLoading(true);
    try {
      const agentStatus = await fetchLinkedinDataSourcesStatus();
      if (
        agentStatus !== null &&
        !agentStatus.pythonOrgChartAgentAvailable
      ) {
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
            'Invalid response from TheOrg-enriched endpoint',
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
      setIsTheOrgEnrichedLoading(false);
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
    website:
      website ??
      unipileCompanyProfile?.website ??
      fallbackCompanyInfo?.website,
    locationName:
      locationName ??
      unipileLocationName ??
      fallbackCompanyInfo?.locationName,
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
        {isTheOrgEnrichedLoading && (
          <StyledTheOrgLeadershipLoadingOverlay>
            <StyledSpinner />
            <span>Loading Leadership Org Chart from TheOrg…</span>
          </StyledTheOrgLeadershipLoadingOverlay>
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
            {isBlankTemplate && (
              actions.isContextLoading ? (
                <StyledTemplateBanner>
                  <StyledSpinner />
                  <span>{actions.contextProgressMessage || 'Processing...'}</span>
                </StyledTemplateBanner>
              ) : (
                <StyledTemplateBanner>
                  <span>
                    This is a preview template. Generate the full org chart to see
                    all employees.
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
              )
            )}
            <OrgChartDiagram
              ref={diagramHandleRef}
              nodeDataArray={nodeDataArray}
              showNodeCapabilitiesHoverHint={showNodeCapabilitiesHoverHint}
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
              onBackgroundContextAction={actions.handleBackgroundContextAction}
              onNodeDoubleClick={actions.handleNodeDoubleClick}
              onDownloadNode={actions.handleDownloadNode}
              onSimilarPeople={actions.handleSimilarPeople}
            />
            {theOrgLeadershipBanner && (
              <StyledTheOrgLeadershipInfoBanner>
                {theOrgLeadershipBanner.fullN !== null ? (
                  <span>
                    This Leadership Org Chart from TheOrg shows only{' '}
                    {theOrgLeadershipBanner.leadershipN.toLocaleString()}{' '}
                    leadership profile
                    {theOrgLeadershipBanner.leadershipN === 1 ? '' : 's'}. The
                    full company org chart has{' '}
                    {theOrgLeadershipBanner.fullN.toLocaleString()} profiles —
                    click{' '}
                    <StyledTheOrgLeadershipBannerLink
                      type="button"
                      onClick={searchControlsProps.onGetAll}
                    >
                      Full org chart
                    </StyledTheOrgLeadershipBannerLink>{' '}
                    above to load it.
                  </span>
                ) : (
                  <span>
                    This Leadership Org Chart from TheOrg shows only{' '}
                    {theOrgLeadershipBanner.leadershipN.toLocaleString()}{' '}
                    leadership profile
                    {theOrgLeadershipBanner.leadershipN === 1 ? '' : 's'}. Click{' '}
                    <StyledTheOrgLeadershipBannerLink
                      type="button"
                      onClick={searchControlsProps.onGetAll}
                    >
                      Full org chart
                    </StyledTheOrgLeadershipBannerLink>{' '}
                    above to load the full company org chart.
                  </span>
                )}
              </StyledTheOrgLeadershipInfoBanner>
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
                disabled={isTheOrgEnrichedLoading}
                onClick={() => {
                  void fetchTheOrgEnrichedOrgChart();
                }}
              >
                {isTheOrgEnrichedLoading
                  ? 'Loading Leadership Org Chart'
                  : 'Leadership Org Chart'}
              </StyledTopRightActionButton>
              {/* <StyledTopRightActionButton
                type="button"
                onClick={searchControlsProps.onGetLeaders}
              >
                Leaders
              </StyledTopRightActionButton> */}
              {/* <StyledTopRightActionButton
                type="button"
                onClick={() => diagramHandleRef.current?.zoomToFit()}
              >
                Zoom to fit
              </StyledTopRightActionButton> */}
              {/* <StyledTopRightActionButton
                type="button"
                onClick={() => diagramHandleRef.current?.centerContent()}
              >
                Center
              </StyledTopRightActionButton> */}
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
            onClose={actions.closeContextModal}
            onDownloadCsv={
              actions.contextResults.length > 0
                ? actions.downloadContextResultsAsCsv
                : undefined
            }
            onAddToJob={
              actions.contextResults.length > 0
                ? () =>
                    actions.openAddResultsToJobModal(actions.contextResults, {
                      companyName: effectiveCompanyName ?? undefined,
                      contextModalMode: actions.contextModalMode ?? undefined,
                      selectedNodeFunction: actions.selectedNodeFunction,
                      selectedNodeGrade: actions.selectedNodeGrade,
                    })
                : undefined
            }
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
            onClose={actions.closeNodeDetailModal}
            onDownloadCsv={actions.downloadNodeDetailsAsCsv}
            onAddToJob={
              actions.nodeDetailResults.length > 0
                ? () =>
                    actions.openAddResultsToJobModal(
                      actions.nodeDetailResults,
                      {
                        companyName: effectiveCompanyName ?? undefined,
                        contextModalMode: 'current_node',
                        selectedNodeFunction: actions.selectedNodeFunction,
                        selectedNodeGrade: actions.selectedNodeGrade,
                      },
                    )
                : undefined
            }
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

        <OrgChartResultsAddToJobModal
          isOpen={actions.isAddResultsToJobModalOpen}
          onClose={actions.closeAddResultsToJobModal}
          results={actions.addResultsToJobResults}
          companyName={actions.addResultsToJobContext.companyName}
          contextModalMode={actions.addResultsToJobContext.contextModalMode}
          selectedNodeFunction={actions.addResultsToJobContext.selectedNodeFunction}
          selectedNodeGrade={actions.addResultsToJobContext.selectedNodeGrade}
          queueStartChatAfter={true}
          onSuccess={actions.closeAddResultsToJobModal}
        />
        </StyledDiagramBody>
      </StyledDiagramArea>
    </StyledContainer>
  );
};
