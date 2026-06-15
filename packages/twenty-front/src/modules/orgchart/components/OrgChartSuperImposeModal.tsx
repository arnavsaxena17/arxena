import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildVisibleFunctionRoots,
  formatOrgChartFunctionRootOptionLabel,
} from 'twenty-orgchart';
import { Button } from 'twenty-ui';
import { useDebouncedCallback } from 'use-debounce';

import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TextArea } from '@/ui/input/components/TextArea';
import { TextInput } from '@/ui/input/components/TextInput';
import { Modal } from '@/ui/layout/modal/components/Modal';

import {
  canAppendToExistingSuperImposeChart,
  parseMultilineUrlInput,
} from '../utils/superImposeAppendEligibility';

const StyledModal = styled(Modal)`
  border-radius: ${({ theme }) => theme.spacing(1)};
  max-height: 90dvh;
  width: min(720px, calc(100vw - ${({ theme }) => theme.spacing(8)}));
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
  selectedCountry?: string;
  selectedFunctionRoot?: string;
  businessDivisionRawQuery?: string;
  availableCountries: string[];
  availableFunctionRoots: string[];
  countryPercentLabels: Record<string, string>;
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
    country?: string;
    functionRoot?: string;
    businessDivisionRawQuery?: string;
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
  selectedCountry,
  selectedFunctionRoot,
  businessDivisionRawQuery,
  availableCountries,
  availableFunctionRoots,
  countryPercentLabels,
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
  const [country, setCountry] = useState(selectedCountry ?? 'global');
  const [functionRoot, setFunctionRoot] = useState(
    selectedFunctionRoot ?? 'fullcompany',
  );
  const [businessDivision, setBusinessDivision] = useState(
    businessDivisionRawQuery ?? '',
  );
  const [appendToExisting, setAppendToExisting] = useState(false);
  const [estimate, setEstimate] = useState<SuperImposeEstimate | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [resolvedPreview, setResolvedPreview] = useState<
    Array<{ slug: string; companyName?: string; resolvedFrom: string }>
  >([]);
  const [resolveErrors, setResolveErrors] = useState<string[]>([]);

  const appendEligibility = useMemo(
    () =>
      canAppendToExistingSuperImposeChart({
        isBlankTemplate,
        firstSourceUsed,
        latestOrgChart,
        itemCount,
      }),
    [firstSourceUsed, isBlankTemplate, itemCount, latestOrgChart],
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
    setCountry(selectedCountry ?? 'global');
    setFunctionRoot(selectedFunctionRoot ?? 'fullcompany');
    setBusinessDivision(businessDivisionRawQuery ?? '');
  }, [
    businessDivisionRawQuery,
    isOpen,
    selectedCountry,
    selectedFunctionRoot,
  ]);

  const superImposePayload = useMemo(
    () => ({
      linkedinCompanyUrls: parseMultilineUrlInput(linkedinUrlsText),
      websiteUrls: parseMultilineUrlInput(websiteUrlsText),
      salesNavigatorSearchUrls: parseMultilineUrlInput(salesNavUrlsText),
      linkedinSearchKeywords: keywords.trim() || undefined,
    }),
    [keywords, linkedinUrlsText, salesNavUrlsText, websiteUrlsText],
  );

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
        companyId,
        companyName,
        linkedinCompanyUrl,
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
    companyId,
    companyName,
    linkedinCompanyUrl,
    linkedinUnipileAccountId,
    serverBaseUrl,
    superImposePayload,
  ]);

  const fetchEstimate = useCallback(async () => {
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
          country: country === 'global' ? undefined : country,
          functionRoot:
            functionRoot === 'fullcompany' ? undefined : functionRoot,
          businessDivisionRawQuery: businessDivision.trim() || undefined,
          candidateSource,
          companyId,
          companyName,
          linkedinCompanyUrl,
          linkedinUnipileAccountId,
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
    companyId,
    companyName,
    country,
    enqueueSnackBar,
    functionRoot,
    linkedinCompanyUrl,
    linkedinUnipileAccountId,
    serverBaseUrl,
    superImposePayload,
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
    country,
    functionRoot,
    businessDivision,
  ]);

  const generateDisabled =
    isGenerating ||
    estimateLoading ||
    estimate?.scopeRequired === true;

  const estimateTone: 'ok' | 'warn' | 'error' =
    estimate?.scopeRequired === true
      ? 'error'
      : estimate?.thresholdExceeded === true
        ? 'warn'
        : 'ok';

  const handleGenerate = () => {
    if (estimate?.scopeRequired) {
      enqueueSnackBar(
        t`Too many people. Select a country or function filter first.`,
        { variant: SnackBarVariant.Error, duration: 6000 },
      );
      return;
    }

    onGenerate({
      ...superImposePayload,
      appendToExistingChart: appendToExisting,
      country: country === 'global' ? undefined : country,
      functionRoot: functionRoot === 'fullcompany' ? undefined : functionRoot,
      businessDivisionRawQuery: businessDivision.trim() || undefined,
    });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <StyledModal
      isClosable
      onClose={onClose}
      padding="large"
    >
      <StyledContent>
        <StyledTitle>{t`Super Impose Org Chart`}</StyledTitle>
        <p>
          {t`Merge employees from additional LinkedIn company pages, websites, or Sales Navigator searches into this chart.`}
        </p>

        <StyledField>
          <StyledFieldLabel>{t`LinkedIn company URLs (one per line)`}</StyledFieldLabel>
          <TextArea
            minRows={3}
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

        <StyledField>
          <StyledFieldLabel>{t`Business division (optional)`}</StyledFieldLabel>
          <TextInput
            value={businessDivision}
            onChange={setBusinessDivision}
            placeholder={t`e.g. textile machinery team`}
          />
        </StyledField>

        <StyledField>
          <StyledFieldLabel>{t`Country`}</StyledFieldLabel>
          <StyledSelect
            value={country}
            onChange={(event) => setCountry(event.target.value)}
          >
            <option value="global">{t`Global`}</option>
            {availableCountries.map((key) => (
              <option key={key} value={key}>
                {key}
                {countryPercentLabels[key]
                  ? ` (${countryPercentLabels[key]})`
                  : ''}
              </option>
            ))}
          </StyledSelect>
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
                ? `Too many people (~${estimate.estimatedTotalUpperBound}). Select a country or function.`
                : `≈ ${estimate.estimatedTotal} people (up to ${estimate.estimatedTotalUpperBound})`
              : `Enter sources to see an estimate`}
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
