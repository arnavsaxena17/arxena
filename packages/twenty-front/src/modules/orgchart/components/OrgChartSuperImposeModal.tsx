import { Checkbox, CheckboxSize, CheckboxVariant, CircularProgressBar, IconButton, MainButton, MOBILE_VIEWPORT } from 'twenty-ui';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { IconX } from 'twenty-ui/icon';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    buildVisibleFunctionRoots,
    formatOrgChartFunctionRootOptionLabel,
} from 'twenty-orgchart';
import { resolveOrgChartCanonicalCompanyId } from 'twenty-shared/utils';

import { useDebouncedCallback } from 'use-debounce';

import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useOrgChartSnackBar } from '@/orgchart/hooks/useOrgChartSnackBar';
import { TextArea } from '@/ui/input/components/TextArea';
import { TextInput } from '@/ui/input/components/TextInput';
import { Modal } from '@/ui/layout/modal/components/Modal';
import { OnboardingIntentModalLayout } from '~/pages/onboarding/OnboardingIntentModalLayout';

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
  max-height: 90dvh;
  min-height: 480px;
  min-width: 640px;
  padding: 0;
  position: relative;
  user-select: text;
  width: min(800px, calc(100vw - ${themeCssVariables.spacing[8]}));

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    min-height: auto;
    min-width: auto;
    width: 100%;
  }
`;

const StyledCloseButtonContainer = styled.div`
  align-items: center;
  aspect-ratio: 1;
  display: flex;
  height: 60px;
  justify-content: center;
  position: absolute;
  right: 0;
  top: 0;
  z-index: 1;
`;

const StyledHeader = styled(Modal.Header)`
  background-color: ${themeCssVariables.background.secondary};
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  height: 60px;
  padding: 0 ${themeCssVariables.spacing[8]} 0
    ${themeCssVariables.spacing[6]};

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    padding-left: ${themeCssVariables.spacing[4]};
    padding-right: ${themeCssVariables.spacing[4]};
  }
`;

const StyledHeaderTitle = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledContent = styled(Modal.Content)`
  flex: 1;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[6]};

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    padding: ${themeCssVariables.spacing[4]};
  }
`;

const StyledBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  width: 100%;
`;

const StyledDescription = styled.p`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: ${themeCssVariables.text.lineHeight.md};
  margin: 0;
`;

const StyledField = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledFieldLabel = styled.label`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledSelect = styled.select`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  min-height: 36px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

const StyledAdvancedSection = styled.details`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledAdvancedSummary = styled.summary`
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  user-select: none;
`;

const StyledAdvancedBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  margin-top: ${themeCssVariables.spacing[3]};
`;

const StyledInfoCard = styled.div<{ $tone: 'ok' | 'warn' | 'error' }>`
  background: ${({ $tone }) =>
    $tone === 'error'
      ? themeCssVariables.background.danger
      : $tone === 'warn'
        ? themeCssVariables.background.secondary
        : themeCssVariables.background.transparent.blue};
  border: 1px solid
    ${({ $tone }) =>
      $tone === 'error'
        ? themeCssVariables.border.color.danger
        : themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: ${themeCssVariables.text.lineHeight.md};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledResolvedList = styled.ul`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: ${themeCssVariables.text.lineHeight.md};
  margin: 0;
  padding-left: ${themeCssVariables.spacing[3]};
`;

const StyledFooter = styled(Modal.Footer)`
  border-top: 1px solid ${themeCssVariables.border.color.light};
  gap: ${themeCssVariables.spacing[2]};
  height: auto;
  justify-content: flex-end;
  min-height: 60px;
  padding: ${themeCssVariables.spacing[6]} ${themeCssVariables.spacing[8]};

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    padding: ${themeCssVariables.spacing[4]};
  }
`;

const StyledCheckboxRow = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledCheckboxHint = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
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
  const { enqueueSnackBar } = useOrgChartSnackBar();

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
      enqueueSnackBar(`Select a target company.`, {
        variant: SnackBarVariant.Error,
        duration: 5000,
      });
      return;
    }

    if (estimate?.scopeRequired) {
      enqueueSnackBar(
        `Too many people. Select a location, function, or leadership filter first.`,
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
    <StyledModal isClosable onClose={onClose} padding="none" size="large">
      <StyledCloseButtonContainer>
        <IconButton Icon={IconX} onClick={onClose} variant="tertiary" />
      </StyledCloseButtonContainer>

      <StyledHeader>
        <StyledHeaderTitle>{`Super Impose Org Charts`}</StyledHeaderTitle>
      </StyledHeader>

      <StyledContent>
        <OnboardingIntentModalLayout panelWidth="lg">
          <StyledBody>
            <StyledDescription>
              {`Select a target company and optional location, then merge employees from additional sources into the chart.`}
            </StyledDescription>

            <StyledField>
              <StyledFieldLabel>{`Company`}</StyledFieldLabel>
              <SuperImposeLinkedInFacetAutocomplete
                kind="company"
                label={`Company`}
                value={companySelection}
                onChange={setCompanySelection}
                accessToken={accessToken}
                serverBaseUrl={serverBaseUrl}
              />
            </StyledField>

            <StyledField>
              <StyledFieldLabel>{`Location`}</StyledFieldLabel>
              <SuperImposeLinkedInFacetAutocomplete
                kind="location"
                label={`Location`}
                placeholder={`Global if empty`}
                value={locationSelection}
                onChange={setLocationSelection}
                accessToken={accessToken}
                serverBaseUrl={serverBaseUrl}
              />
            </StyledField>

            <StyledField>
              <StyledFieldLabel>{`Function`}</StyledFieldLabel>
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
              <Checkbox
                checked={leadershipOnly}
                onCheckedChange={setLeadershipOnly}
                size={CheckboxSize.Small}
                variant={CheckboxVariant.Primary}
              />
              {`Fetch leadership positions only`}
            </StyledCheckboxRow>

            <StyledField>
              <StyledFieldLabel>{`Business division (optional)`}</StyledFieldLabel>
              <TextInput
                value={businessDivision}
                onChange={setBusinessDivision}
                placeholder={`e.g. textile machinery team`}
              />
            </StyledField>

            <StyledAdvancedSection>
              <StyledAdvancedSummary>{`Advanced sources`}</StyledAdvancedSummary>
              <StyledAdvancedBody>
                <StyledField>
                  <StyledFieldLabel>{`LinkedIn company URLs (one per line)`}</StyledFieldLabel>
                  <TextArea
                    textAreaId="orgchart-super-impose-linkedin-urls"
                    minRows={2}
                    value={linkedinUrlsText}
                    onChange={setLinkedinUrlsText}
                    placeholder="https://www.linkedin.com/company/example/"
                  />
                </StyledField>

                <StyledField>
                  <StyledFieldLabel>{`Company websites (one per line)`}</StyledFieldLabel>
                  <TextArea
                    textAreaId="orgchart-super-impose-website-urls"
                    minRows={2}
                    onChange={setWebsiteUrlsText}
                    placeholder="example.com"
                  />
                </StyledField>

                <StyledField>
                  <StyledFieldLabel>{`Sales Navigator search URLs`}</StyledFieldLabel>
                  <TextArea
                    textAreaId="orgchart-super-impose-sales-nav-urls"
                    minRows={2}
                    value={salesNavUrlsText}
                    onChange={setSalesNavUrlsText}
                    placeholder="https://www.linkedin.com/sales/search/people?..."
                  />
                </StyledField>

                <StyledField>
                  <StyledFieldLabel>{`Keywords (optional)`}</StyledFieldLabel>
                  <TextInput
                    value={keywords}
                    onChange={setKeywords}
                    placeholder={`Boolean keywords, e.g. insulator OR NGK`}
                  />
                </StyledField>
              </StyledAdvancedBody>
            </StyledAdvancedSection>

            {resolvedPreview.length > 0 ? (
              <StyledField>
                <StyledFieldLabel>{`Resolved companies`}</StyledFieldLabel>
                <StyledResolvedList>
                  {resolvedPreview.map((company) => (
                    <li key={company.slug}>
                      {company.companyName ?? company.slug} (
                      {company.resolvedFrom})
                    </li>
                  ))}
                </StyledResolvedList>
              </StyledField>
            ) : null}

            {resolveErrors.length > 0 ? (
              <StyledInfoCard $tone="warn">
                {resolveErrors.join(' · ')}
              </StyledInfoCard>
            ) : null}

            <StyledInfoCard $tone={estimateTone}>
              {estimateLoading
                ? `Estimating people…`
                : estimate
                  ? estimate.scopeRequired
                    ? `Too many people (~${estimate.estimatedTotalUpperBound}). Select a location, function, or leadership filter.`
                    : `≈ ${estimate.estimatedTotal} people (up to ${estimate.estimatedTotalUpperBound})`
                  : targetCompany
                    ? `Estimating…`
                    : `Select a company to see an estimate`}
            </StyledInfoCard>

            <StyledCheckboxRow>
              <Checkbox
                checked={appendToExisting}
                disabled={!appendEligibility.eligible}
                onCheckedChange={setAppendToExisting}
                size={CheckboxSize.Small}
                variant={CheckboxVariant.Primary}
              />
              {`Append to existing char`}
              {!appendEligibility.eligible && appendEligibility.reason ? (
                <StyledCheckboxHint>
                  — {appendEligibility.reason}
                </StyledCheckboxHint>
              ) : null}
            </StyledCheckboxRow>
          </StyledBody>
        </OnboardingIntentModalLayout>
      </StyledContent>

      <StyledFooter>
        <MainButton
          title={`Cancel`}
          variant="secondary"
          onClick={onClose}
          disabled={isGenerating}
        />
        <MainButton
          Icon={isGenerating || estimateLoading ? CircularProgressBar : undefined}
          title={isGenerating ? `Generating...` : `Generate`}
          variant="primary"
          onClick={!isGenerating ? handleGenerate : undefined}
          disabled={generateDisabled}
        />
      </StyledFooter>
    </StyledModal>
  );
};
