import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildVisibleFunctionRoots,
  formatOrgChartFunctionRootOptionLabel,
} from 'twenty-orgchart';
import { resolveOrgChartCanonicalCompanyId } from 'twenty-shared';
import { Button } from 'twenty-ui';
import { useDebouncedCallback } from 'use-debounce';

import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TextArea } from '@/ui/input/components/TextArea';
import { TextInput } from '@/ui/input/components/TextInput';
import { Modal } from '@/ui/layout/modal/components/Modal';

import {
  buildSuperImposeTargetCompanyFromAutocomplete,
  buildSuperImposeTargetLocationFromAutocomplete,
  isDifferentSuperImposeTargetCompany,
  type SuperImposeAutocompleteItem,
  type SuperImposeTargetCompany,
  type SuperImposeTargetLocation,
} from '../types/superImposeTypes';
import {
  canAppendToExistingSuperImposeChart,
  parseMultilineUrlInput,
} from '../utils/superImposeAppendEligibility';
import { SuperImposeLinkedInFacetAutocomplete } from './SuperImposeLinkedInFacetAutocomplete';

const StyledModal = styled(Modal)`
  border-radius: ${({ theme }) => theme.spacing(1)};
  max-height: 90dvh;
  width: min(720px, calc(100vw - ${({ theme }) => theme.spacing(8)}));
  user-select: text;
`;

const StyledContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  width: 100%;
`;

const StyledTitle = styled.div`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledField = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledFieldLabel = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledSelect = styled.select`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledAdvancedSection = styled.details`
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(2)};
`;

const StyledAdvancedSummary = styled.summary`
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledAdvancedBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme }) => theme.spacing(2)};
`;

const StyledEstimateBadge = styled.div<{ $tone: 'ok' | 'warn' | 'error' }>`
  padding: ${({ theme }) => theme.spacing(1.5)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  background: ${({ theme, $tone }) =>
    $tone === 'error'
      ? theme.background.danger
      : $tone === 'warn'
        ? theme.background.transparent.light
        : theme.background.transparent.blue};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledResolvedList = styled.ul`
  margin: 0;
  padding-left: ${({ theme }) => theme.spacing(3)};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledCheckboxRow = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
`;

type SuperImposeEstimate = {
  estimatedTotal: number;
  estimatedTotalUpperBound: number;
  threshold: number;
  thresholdExceeded: boolean;
  scopeRequired: boolean;
  perSource: Array<{
    slug: string;
    sourceType: string;
    count: number;
    error?: string;
  }>;
};

const buildInitialTargetCompany = (
  companyId: string,
  companyName?: string,
  linkedinCompanyUrl?: string,
): SuperImposeAutocompleteItem | null => {
  const slug = resolveOrgChartCanonicalCompanyId(companyId);
  if (!slug && !companyName?.trim()) {
    return null;
  }

  return {
    id: slug,
    title: companyName?.trim() || slug,
    slug,
    profileUrl:
      linkedinCompanyUrl?.trim() ||
      `https://www.linkedin.com/company/${slug}/`,
  };
};

export type OrgChartSuperImposeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  companyName?: string;
  linkedinCompanyUrl?: string;
  accessToken: string;
  serverBaseUrl: string;
  candidateSource: 'harvest' | 'unipile';
  linkedinUnipileAccountId?: string;
  selectedFunctionRoot?: string;
  businessDivisionRawQuery?: string;
  availableFunctionRoots: string[];
  functionRootPercentLabels: Record<string, string>;
  functionRootCounts?: Record<string, number>;
  isBlankTemplate: boolean;
  firstSourceUsed?: string | null;
  latestOrgChart?: Record<string, unknown> | null;
  itemCount?: number | null;
  onGenerate: (input: {
    linkedinCompanyUrls: string[];
    websiteUrls: string[];
    salesNavigatorSearchUrls: string[];
    linkedinSearchKeywords?: string;
    appendToExistingChart: boolean;
    functionRoot?: string;
    businessDivisionRawQuery?: string;
    leadershipOnly?: boolean;
    targetCompany?: SuperImposeTargetCompany;
    targetLocation?: SuperImposeTargetLocation;
    linkedinLocationId?: string;
    linkedinLocationName?: string;
    linkedinCompanyParameterId?: string;
  }) => void;
  isGenerating: boolean;
};

export const OrgChartSuperImposeModal = ({
  isOpen,
  onClose,
  companyId,
  companyName,
  linkedinCompanyUrl,
  accessToken,
  serverBaseUrl,
  candidateSource,
  linkedinUnipileAccountId,
  selectedFunctionRoot,
  businessDivisionRawQuery,
  availableFunctionRoots,
  functionRootPercentLabels,
  functionRootCounts,
  isBlankTemplate,
  firstSourceUsed,
  latestOrgChart,
  itemCount,
  onGenerate,
  isGenerating,
}: OrgChartSuperImposeModalProps) => {
  const { t } = useLingui();
  const { enqueueSnackBar } = useSnackBar();

  const [linkedinUrlsText, setLinkedinUrlsText] = useState('');
  const [websiteUrlsText, setWebsiteUrlsText] = useState('');
  const [salesNavUrlsText, setSalesNavUrlsText] = useState('');
  const [keywords, setKeywords] = useState('');
  const [companySelection, setCompanySelection] =
    useState<SuperImposeAutocompleteItem | null>(null);
  const [locationSelection, setLocationSelection] =
    useState<SuperImposeAutocompleteItem | null>(null);
  const [functionRoot, setFunctionRoot] = useState(
    selectedFunctionRoot ?? 'fullcompany',
  );
  const [businessDivision, setBusinessDivision] = useState(
    businessDivisionRawQuery ?? '',
  );
  const [leadershipOnly, setLeadershipOnly] = useState(false);
  const [appendToExisting, setAppendToExisting] = useState(false);
  const [estimate, setEstimate] = useState<SuperImposeEstimate | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [resolvedPreview, setResolvedPreview] = useState<
    Array<{ slug: string; companyName?: string; resolvedFrom: string }>
  >([]);
  const [resolveErrors, setResolveErrors] = useState<string[]>([]);

  const targetCompany = useMemo(
    () =>
      companySelection
        ? buildSuperImposeTargetCompanyFromAutocomplete(
            companySelection,
            resolveOrgChartCanonicalCompanyId,
          )
        : undefined,
    [companySelection],
  );

  const targetLocation = useMemo(
    () =>
      locationSelection
        ? buildSuperImposeTargetLocationFromAutocomplete(locationSelection)
        : undefined,
    [locationSelection],
  );

  const isDifferentTargetCompany = useMemo(
    () =>
      isDifferentSuperImposeTargetCompany({
        backgroundCompanyId: companyId,
        backgroundCompanyName: companyName,
        targetCompany: targetCompany ?? null,
        resolveSlug: resolveOrgChartCanonicalCompanyId,
      }),
    [companyId, companyName, targetCompany],
  );

  const appendEligibility = useMemo(
    () =>
      canAppendToExistingSuperImposeChart({
        isBlankTemplate,
        firstSourceUsed,
        latestOrgChart,
        itemCount,
        isDifferentTargetCompany,
      }),
    [
      firstSourceUsed,
      isBlankTemplate,
      isDifferentTargetCompany,
      itemCount,
      latestOrgChart,
    ],
  );

  const visibleFunctionRoots = useMemo(
    () =>
      buildVisibleFunctionRoots({
        availableFunctionRoots,
        functionRootPercentLabels,
        selectedFunctionRoot: functionRoot,
        includePreviewFunctionRoots: true,
        includeFullCompany: true,
      }),
    [availableFunctionRoots, functionRoot, functionRootPercentLabels],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setCompanySelection(
      buildInitialTargetCompany(companyId, companyName, linkedinCompanyUrl),
    );
    setLocationSelection(null);
    setFunctionRoot(selectedFunctionRoot ?? 'fullcompany');
    setBusinessDivision(businessDivisionRawQuery ?? '');
    setLeadershipOnly(false);
    setAppendToExisting(false);
  }, [
    businessDivisionRawQuery,
    companyId,
    companyName,
    isOpen,
    linkedinCompanyUrl,
    selectedFunctionRoot,
  ]);

  const superImposePayload = useMemo(
    () => ({
      linkedinCompanyUrls: parseMultilineUrlInput(linkedinUrlsText),
      websiteUrls: parseMultilineUrlInput(websiteUrlsText),
      salesNavigatorSearchUrls: parseMultilineUrlInput(salesNavUrlsText),
      linkedinSearchKeywords: keywords.trim() || undefined,
      targetCompany,
      targetLocation,
    }),
    [
      keywords,
      linkedinUrlsText,
      salesNavUrlsText,
      targetCompany,
      targetLocation,
      websiteUrlsText,
    ],
  );

  const effectiveCompanyId = targetCompany?.slug ?? companyId;
  const effectiveCompanyName = targetCompany?.title ?? companyName;
  const effectiveLinkedinUrl =
    targetCompany?.linkedinCompanyUrl ?? linkedinCompanyUrl;

  const fetchResolvePreview = useCallback(async () => {
    const base = serverBaseUrl.replace(/\/$/, '');
    const res = await fetch(`${base}/org-chart/super-impose/resolve-inputs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        superImpose: superImposePayload,
        companyId: effectiveCompanyId,
        companyName: effectiveCompanyName,
        linkedinCompanyUrl: effectiveLinkedinUrl,
      }),
    });
    const json = (await res.json()) as {
      resolvedCompanies?: Array<{
        slug: string;
        companyName?: string;
        resolvedFrom: string;
      }>;
      errors?: string[];
    };
    if (!res.ok) {
      throw new Error(
        typeof json === 'object' && json && 'message' in json
          ? String((json as { message?: string }).message)
          : `Resolve failed (${res.status})`,
      );
    }
    setResolvedPreview(json.resolvedCompanies ?? []);
    setResolveErrors(json.errors ?? []);
  }, [
    accessToken,
    effectiveCompanyId,
    effectiveCompanyName,
    effectiveLinkedinUrl,
    serverBaseUrl,
    superImposePayload,
  ]);

  const fetchEstimate = useCallback(async () => {
    if (!targetCompany) {
      setEstimate(null);
      return;
    }

    setEstimateLoading(true);
    try {
      const base = serverBaseUrl.replace(/\/$/, '');
      const res = await fetch(`${base}/org-chart/super-impose/estimate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          superImpose: superImposePayload,
          functionRoot:
            functionRoot === 'fullcompany' ? undefined : functionRoot,
          businessDivisionRawQuery: businessDivision.trim() || undefined,
          leadershipOnly: leadershipOnly || undefined,
          candidateSource,
          companyId: effectiveCompanyId,
          companyName: effectiveCompanyName,
          linkedinCompanyUrl: effectiveLinkedinUrl,
          linkedinUnipileAccountId,
          linkedinLocationId: targetLocation?.id,
          linkedinLocationName: targetLocation?.title,
          linkedinCompanyParameterId: targetCompany.id,
        }),
      });
      const json = (await res.json()) as SuperImposeEstimate & {
        message?: string;
      };
      if (!res.ok) {
        throw new Error(json.message ?? `Estimate failed (${res.status})`);
      }
      setEstimate(json);
    } catch (error) {
      setEstimate(null);
      enqueueSnackBar(
        error instanceof Error ? error.message : 'Estimate failed',
        { variant: SnackBarVariant.Warning, duration: 5000 },
      );
    } finally {
      setEstimateLoading(false);
    }
  }, [
    accessToken,
    businessDivision,
    candidateSource,
    effectiveCompanyId,
    effectiveCompanyName,
    effectiveLinkedinUrl,
    enqueueSnackBar,
    functionRoot,
    leadershipOnly,
    linkedinUnipileAccountId,
    serverBaseUrl,
    superImposePayload,
    targetCompany,
    targetLocation,
  ]);

  const debouncedResolve = useDebouncedCallback(() => {
    if (!isOpen) {
      return;
    }
    void fetchResolvePreview().catch(() => {
      setResolvedPreview([]);
    });
  }, 500);

  const debouncedEstimate = useDebouncedCallback(() => {
    if (!isOpen) {
      return;
    }
    void fetchEstimate();
  }, 400);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    debouncedResolve();
    debouncedEstimate();
  }, [
    debouncedEstimate,
    debouncedResolve,
    isOpen,
    superImposePayload,
    functionRoot,
    businessDivision,
    leadershipOnly,
    targetCompany,
    targetLocation,
  ]);

  const generateDisabled =
    isGenerating ||
    estimateLoading ||
    estimate?.scopeRequired === true ||
    !targetCompany;

  const estimateTone: 'ok' | 'warn' | 'error' =
    estimate?.scopeRequired === true
      ? 'error'
      : estimate?.thresholdExceeded === true
        ? 'warn'
        : 'ok';

  const handleGenerate = () => {
    if (!targetCompany) {
      enqueueSnackBar(t`Select a target company.`, {
        variant: SnackBarVariant.Error,
        duration: 5000,
      });
      return;
    }

    if (estimate?.scopeRequired) {
      enqueueSnackBar(
        t`Too many people. Select a location, function, or leadership filter first.`,
        { variant: SnackBarVariant.Error, duration: 6000 },
      );
      return;
    }

    onGenerate({
      ...superImposePayload,
      appendToExistingChart: appendToExisting,
      functionRoot: functionRoot === 'fullcompany' ? undefined : functionRoot,
      businessDivisionRawQuery: businessDivision.trim() || undefined,
      leadershipOnly: leadershipOnly || undefined,
      targetCompany,
      targetLocation,
      linkedinLocationId: targetLocation?.id,
      linkedinLocationName: targetLocation?.title,
      linkedinCompanyParameterId: targetCompany.id,
    });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <StyledModal isClosable onClose={onClose} padding="large">
      <StyledContent>
        <StyledTitle>{t`Super Impose Org Chart`}</StyledTitle>
        <p>
          {t`Select a target company and optional location, then merge employees from additional sources into the chart.`}
        </p>

        <StyledField>
          <StyledFieldLabel>{t`Company`}</StyledFieldLabel>
          <SuperImposeLinkedInFacetAutocomplete
            kind="company"
            label={t`Company`}
            value={companySelection}
            onChange={setCompanySelection}
            accessToken={accessToken}
            serverBaseUrl={serverBaseUrl}
          />
        </StyledField>

        <StyledField>
          <StyledFieldLabel>{t`Location (optional)`}</StyledFieldLabel>
          <SuperImposeLinkedInFacetAutocomplete
            kind="location"
            label={t`Location`}
            placeholder={t`Global if empty`}
            value={locationSelection}
            onChange={setLocationSelection}
            accessToken={accessToken}
            serverBaseUrl={serverBaseUrl}
          />
        </StyledField>

        <StyledField>
          <StyledFieldLabel>{t`Function`}</StyledFieldLabel>
          <StyledSelect
            value={functionRoot}
            onChange={(event) => setFunctionRoot(event.target.value)}
          >
            {visibleFunctionRoots.map((key) => (
              <option key={key} value={key}>
                {formatOrgChartFunctionRootOptionLabel(
                  key,
                  functionRootPercentLabels,
                  functionRootCounts,
                )}
              </option>
            ))}
          </StyledSelect>
        </StyledField>

        <StyledCheckboxRow>
          <input
            type="checkbox"
            checked={leadershipOnly}
            onChange={(event) => setLeadershipOnly(event.target.checked)}
          />
          {t`Fetch leadership positions only`}
        </StyledCheckboxRow>

        <StyledField>
          <StyledFieldLabel>{t`Business division (optional)`}</StyledFieldLabel>
          <TextInput
            value={businessDivision}
            onChange={setBusinessDivision}
            placeholder={t`e.g. textile machinery team`}
          />
        </StyledField>

        <StyledAdvancedSection>
          <StyledAdvancedSummary>{t`Advanced sources`}</StyledAdvancedSummary>
          <StyledAdvancedBody>
            <StyledField>
              <StyledFieldLabel>{t`LinkedIn company URLs (one per line)`}</StyledFieldLabel>
              <TextArea
                minRows={2}
                value={linkedinUrlsText}
                onChange={setLinkedinUrlsText}
                placeholder="https://www.linkedin.com/company/example/"
              />
            </StyledField>

            <StyledField>
              <StyledFieldLabel>{t`Company websites (one per line)`}</StyledFieldLabel>
              <TextArea
                minRows={2}
                value={websiteUrlsText}
                onChange={setWebsiteUrlsText}
                placeholder="example.com"
              />
            </StyledField>

            <StyledField>
              <StyledFieldLabel>{t`Sales Navigator search URLs`}</StyledFieldLabel>
              <TextArea
                minRows={2}
                value={salesNavUrlsText}
                onChange={setSalesNavUrlsText}
                placeholder="https://www.linkedin.com/sales/search/people?..."
              />
            </StyledField>

            <StyledField>
              <StyledFieldLabel>{t`Keywords (optional)`}</StyledFieldLabel>
              <TextInput
                value={keywords}
                onChange={setKeywords}
                placeholder={t`Boolean keywords, e.g. insulator OR NGK`}
              />
            </StyledField>
          </StyledAdvancedBody>
        </StyledAdvancedSection>

        {resolvedPreview.length > 0 ? (
          <StyledField>
            <StyledFieldLabel>{t`Resolved companies`}</StyledFieldLabel>
            <StyledResolvedList>
              {resolvedPreview.map((company) => (
                <li key={company.slug}>
                  {company.companyName ?? company.slug} ({company.resolvedFrom})
                </li>
              ))}
            </StyledResolvedList>
          </StyledField>
        ) : null}

        {resolveErrors.length > 0 ? (
          <StyledEstimateBadge $tone="warn">
            {resolveErrors.join(' · ')}
          </StyledEstimateBadge>
        ) : null}

        <StyledEstimateBadge $tone={estimateTone}>
          {estimateLoading
            ? `Estimating people…`
            : estimate
              ? estimate.scopeRequired
                ? `Too many people (~${estimate.estimatedTotalUpperBound}). Select a location, function, or leadership filter.`
                : `≈ ${estimate.estimatedTotal} people (up to ${estimate.estimatedTotalUpperBound})`
              : targetCompany
                ? `Estimating…`
                : `Select a company to see an estimate`}
        </StyledEstimateBadge>

        <StyledCheckboxRow>
          <input
            type="checkbox"
            checked={appendToExisting}
            disabled={!appendEligibility.eligible}
            onChange={(event) => setAppendToExisting(event.target.checked)}
          />
          {t`Append to existing chart`}
          {!appendEligibility.eligible && appendEligibility.reason
            ? ` — ${appendEligibility.reason}`
            : ''}
        </StyledCheckboxRow>

        <StyledActions>
          <Button
            title={t`Cancel`}
            variant="secondary"
            onClick={onClose}
            disabled={isGenerating}
          />
          <Button
            title={isGenerating ? t`Generating...` : t`Generate`}
            variant="primary"
            accent="blue"
            onClick={handleGenerate}
            disabled={generateDisabled}
          />
        </StyledActions>
      </StyledContent>
    </StyledModal>
  );
};
