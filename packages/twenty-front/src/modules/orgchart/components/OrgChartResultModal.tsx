import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import {
  Button,
  Card,
  IconBrandLinkedin,
  IconButton,
  IconChevronLeft,
  IconMail,
  IconPhone,
  IconX,
  Loader,
} from 'twenty-ui';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal, StyledCenteredButton } from '@/ui/layout/modal/components/ConfirmationModal';
import { Modal } from '@/ui/layout/modal/components/Modal';
import {
  getProxiedImageUrl,
  isValidLinkedInProfileUrl,
  toTitleCase,
} from 'twenty-shared';
import { OnboardingIntentModalLayout } from '~/pages/onboarding/OnboardingIntentModalLayout';
import { orgChartContactsByKeyState } from '../states/orgChartContactsByKeyState';

import { ContextResultItem } from '../types';
import {
  extractCompanyDomainFromWebsite,
  formatNetworkDistanceDegree,
} from '../utils/orgChartUtils';
import {
  OrgChartModalTightContent,
  OrgChartModalTightHeader,
} from './OrgChartModalTightContent';
import { OrgChartOutreachModal } from './OrgChartOutreachModal';
import { OrgChartResultsAddToJobPanel } from './OrgChartResultsAddToJobPanel';

const DEFAULT_AVATAR =
  'https://st2.depositphotos.com/4111759/12123/v/950/depositphotos_121232442-stock-illustration-male-default-placeholder-avatar-profile.jpg';

const INSUFFICIENT_CONTACT_CREDITS_SNACKBAR =
  'You’re out of contact credits. Add credits to continue.';

const StyledOrgChartResultModal = styled(Modal)`
  max-height: 90dvh;
  width: min(720px, 100vw - ${({ theme }) => theme.spacing(8)});
`;

const StyledHeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

const StyledTitle = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledAddToJobHeaderRow = styled.div`
  align-items: center;
  display: flex;
  flex: 1;
  gap: ${({ theme }) => theme.spacing(1)};
  min-width: 0;
`;

const StyledModalBodyScroll = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  max-height: min(560px, calc(90dvh - 200px));
  overflow-y: auto;
  width: 100%;
`;

const StyledProfileList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  width: 100%;
`;

const StyledProfileCard = styled(Card)`
  align-items: flex-start;
  background-color: ${({ theme }) => theme.background.primary};
  box-sizing: border-box;
  color: ${({ theme }) => theme.font.color.primary};
  display: flex;
  flex-direction: row;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(3)};
  width: 100%;
`;

const StyledBooleanCard = styled(Card)`
  background-color: ${({ theme }) => theme.background.secondary};
  box-sizing: border-box;
  color: ${({ theme }) => theme.font.color.primary};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1.5)};
  padding: ${({ theme }) => theme.spacing(3)};
  width: 100%;
`;

const StyledBooleanLabel = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  letter-spacing: 0.02em;
  text-transform: uppercase;
`;

const StyledBooleanValue = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: ${({ theme }) => theme.text.lineHeight.md};
  word-break: break-word;
`;

const StyledOrgChartModalFooter = styled(Modal.Footer)`
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
  height: auto;
  justify-content: flex-end;
  min-height: 60px;
`;

const StyledAvatarWrapper = styled.div<{ $size: number }>`
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: 50%;
  flex-shrink: 0;
  height: ${({ $size }) => $size}px;
  min-width: ${({ $size }) => $size}px;
  overflow: hidden;
  width: ${({ $size }) => $size}px;
`;

const StyledAvatarImage = styled.img`
  height: 100%;
  object-fit: cover;
  width: 100%;
`;

const StyledProfileTextColumn = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  min-width: 0;
`;

const StyledProfileNameRow = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(1)};
  min-width: 0;
`;

const StyledProfileName = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  line-height: ${({ theme }) => theme.text.lineHeight.md};
`;

const StyledOrgChartTenureDot = styled.span<{ $variant: 'current' | 'past' }>`
  color: ${({ theme, $variant }) =>
    $variant === 'current' ? theme.color.green : theme.font.color.light};
  flex-shrink: 0;
  font-size: ${({ theme }) => theme.font.size.xs};
  line-height: 1;
`;

const StyledProfileSubline = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: ${({ theme }) => theme.text.lineHeight.md};
`;

const StyledProfileMeta = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: ${({ theme }) => theme.text.lineHeight.md};
`;

const StyledNetworkDistance = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledBadgeRow = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledProfileBadge = styled.span`
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  padding: ${({ theme }) => theme.spacing(0.5)}
    ${({ theme }) => theme.spacing(1)};
`;

const StyledProfileActions = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme }) => theme.spacing(0.5)};
`;

const StyledProfileExternalLink = styled.a`
  align-items: center;
  color: ${({ theme }) => theme.color.blue};
  display: inline-flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  gap: ${({ theme }) => theme.spacing(1)};
  text-decoration: none;

  &:hover {
    color: ${({ theme }) => theme.color.blue80};
    text-decoration: underline;
  }
`;

const StyledContactButton = styled.button`
  align-items: center;
  background: none;
  border: none;
  color: ${({ theme }) => theme.color.blue};
  cursor: pointer;
  display: inline-flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(0.5)} 0;
  text-align: left;

  &:hover {
    color: ${({ theme }) => theme.color.blue80};
    text-decoration: underline;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
`;

const StyledLoadingMessage = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: center;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  min-height: 120px;
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.md};
`;

const StyledLoadingRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledStopRow = styled.div`
  display: flex;
  align-items: center;
  margin-top: ${({ theme }) => theme.spacing(2)};
`;

const StyledLoadingDetails = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledErrorMessage = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.color.red};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.md};
  justify-content: center;
  min-height: 120px;
`;

const StyledEmptyState = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: ${({ theme }) => theme.text.lineHeight.md};
  padding: ${({ theme }) => theme.spacing(6)} ${({ theme }) => theme.spacing(2)};
  text-align: center;
  width: 100%;
`;

type ContactInfo = {
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  fullName?: string;
  /**
   * Indicates that a contact fetch was attempted for this person,
   * even if no email/phone data was ultimately found.
   */
  fetched?: boolean;
};

const getContactCacheKey = (
  item: ContextResultItem,
  companyWebsite?: string,
): string => {
  const raw = item.raw as Record<string, unknown> | undefined;
  const rawPersonId = raw?.id;
  const domain = extractCompanyDomainFromWebsite(companyWebsite);
  const hasM7kqId =
    typeof domain === 'string' &&
    domain.trim().length > 0 &&
    typeof rawPersonId === 'string' &&
    rawPersonId.trim().length > 0;
  if (hasM7kqId) {
    return `m7kq:${domain!.trim().toLowerCase()}:${rawPersonId.trim()}`;
  }
  const li =
    typeof item.linkedinUrl === 'string' ? item.linkedinUrl.trim() : '';
  if (li.length > 0) {
    return `li:${li}`;
  }
  return `id:${item.id}`;
};

const getItemDerivedContactInfo = (
  item: ContextResultItem,
): ContactInfo | undefined => {
  const email = typeof item.email === 'string' ? item.email.trim() : '';
  const phone = typeof item.phone === 'string' ? item.phone.trim() : '';
  const raw = item.raw as Record<string, unknown> | undefined;
  const rawEmails = raw?.m7kq_enrichment_emails;
  const rawPhones = raw?.m7kq_enrichment_phones;
  const hasRawEmail =
    Array.isArray(rawEmails) &&
    rawEmails.some((e) => typeof e === 'string' && e);
  const hasRawPhone =
    Array.isArray(rawPhones) &&
    rawPhones.some((p) => typeof p === 'string' && p);
  const fetched = Boolean(email || phone || hasRawEmail || hasRawPhone);
  if (!fetched) {
    return undefined;
  }
  return {
    fetched: true,
    email: email || undefined,
    phone: phone || undefined,
    linkedinUrl: item.linkedinUrl,
    fullName: item.fullName,
  };
};

type ResultItemProps = {
  item: ContextResultItem;
  contactInfo?: ContactInfo;
  isFetchingContacts?: boolean;
  onFetchContacts?: (
    item: ContextResultItem,
    opts: { wantEmail: boolean; wantPhone: boolean },
  ) => void;
  onAddToJob?: (item: ContextResultItem) => void;
  onSendConnectionRequest?: (item: ContextResultItem) => void;
  companyWebsite?: string;
};

const getAvatarUrl = (item: ContextResultItem): string | undefined => {
  const raw = item.raw as Record<string, unknown> | undefined;
  if (!raw) return undefined;
  const img =
    (raw.image as string | undefined) ??
    (raw.profile_picture_url as string | undefined);
  return typeof img === 'string' && img.trim().length > 0 ? img : undefined;
};

const Avatar = ({ src, size = 48 }: { src: string; size?: number }) => {
  const [effectiveSrc, setEffectiveSrc] = useState(src);

  useEffect(() => {
    setEffectiveSrc(src);
  }, [src]);

  return (
    <StyledAvatarWrapper $size={size}>
      <StyledAvatarImage
        src={effectiveSrc}
        alt=""
        onError={() => setEffectiveSrc(DEFAULT_AVATAR)}
      />
    </StyledAvatarWrapper>
  );
};

const ResultItem = ({
  item,
  contactInfo,
  isFetchingContacts,
  onFetchContacts,
  onAddToJob,
  onSendConnectionRequest,
  companyWebsite,
}: ResultItemProps) => {
  const { t } = useLingui();
  const theme = useTheme();
  const iconSm = theme.icon.size.sm;
  const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';
  const rawAvatarUrl = getAvatarUrl(item) ?? DEFAULT_AVATAR;
  const avatarUrl = getProxiedImageUrl(rawAvatarUrl, baseUrl) || rawAvatarUrl;
  const displayHeadline = item.headline
    ? toTitleCase(item.headline, { skipIfMasked: true })
    : '';
  const displayCompany = item.company ? toTitleCase(item.company) : '';
  const rawTenure = (item.raw as Record<string, unknown> | undefined)
    ?.org_chart_company_tenure;
  const companyTenureAtTarget =
    rawTenure === 'current' || rawTenure === 'past' ? rawTenure : undefined;
  const roleCompanyLine = [displayHeadline, displayCompany]
    .filter((part) => part.length > 0)
    .join(' · ');
  const networkDegree = formatNetworkDistanceDegree(item.networkDistance);
  const locationLine = [
    item.locationName,
    item.locationRegion,
    item.locationCountry,
  ]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(' · ');
  const countsLine = [
    typeof item.sharedConnectionsCount === 'number'
      ? `${item.sharedConnectionsCount} shared`
      : null,
    typeof item.followersCount === 'number'
      ? `${item.followersCount} followers`
      : null,
    typeof item.connectionsCount === 'number'
      ? `${item.connectionsCount} connections`
      : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');
  const badgeLabels = [
    item.premium === true ? 'Premium' : null,
    item.verified === true ? 'Verified' : null,
    item.openProfile === true ? 'Open profile' : null,
  ].filter((part): part is string => part !== null);

  const hasLinkedInProfile = isValidLinkedInProfileUrl(item.linkedinUrl);
  const m7kqDomain = extractCompanyDomainFromWebsite(companyWebsite);
  const rawPersonId = (item.raw as { id?: unknown } | undefined)?.id;
  const canM7kqContactFetch = Boolean(
    m7kqDomain &&
      typeof rawPersonId === 'string' &&
      rawPersonId.trim().length > 0,
  );
  const canAttemptContactFetch =
    hasLinkedInProfile ||
    Boolean(item.email?.trim()) ||
    Boolean(item.phone?.trim()) ||
    canM7kqContactFetch;

  const derivedContactInfo = getItemDerivedContactInfo(item);
  const effectiveContactInfo = contactInfo ?? derivedContactInfo;

  const missingEmail = !effectiveContactInfo?.email?.trim();
  const missingPhone = !effectiveContactInfo?.phone?.trim();
  const shouldFetchAnything = missingEmail || missingPhone;

  const showFetchContacts =
    Boolean(onFetchContacts) && shouldFetchAnything && canAttemptContactFetch;

  const fetchLabel =
    missingEmail && missingPhone
      ? 'Fetch contacts'
      : missingEmail
        ? 'Fetch email'
        : 'Fetch phone';

  const showActions =
    Boolean(hasLinkedInProfile && item.linkedinUrl) ||
    showFetchContacts ||
    Boolean(onAddToJob) ||
    Boolean(onSendConnectionRequest && hasLinkedInProfile);

  return (
    <StyledProfileCard
      fullWidth
      rounded
      data-testid={`orgchart-result-item-${item.id}`}
    >
      <Avatar src={avatarUrl} size={48} />
      <StyledProfileTextColumn>
        <StyledProfileNameRow>
          <StyledProfileName>{item.fullName}</StyledProfileName>
          {networkDegree && (
            <StyledNetworkDistance>· {networkDegree}</StyledNetworkDistance>
          )}
          {companyTenureAtTarget && (
            <StyledOrgChartTenureDot
              $variant={companyTenureAtTarget}
              title={
                companyTenureAtTarget === 'current'
                  ? t`Current employee at this company (from profile experience)`
                  : t`Past employee at this company (from profile experience)`
              }
            >
              ●
            </StyledOrgChartTenureDot>
          )}
        </StyledProfileNameRow>
        {roleCompanyLine.length > 0 && (
          <StyledProfileSubline>{roleCompanyLine}</StyledProfileSubline>
        )}
        {locationLine.length > 0 && (
          <StyledProfileMeta>{locationLine}</StyledProfileMeta>
        )}
        {badgeLabels.length > 0 && (
          <StyledBadgeRow>
            {badgeLabels.map((label) => (
              <StyledProfileBadge key={label}>{label}</StyledProfileBadge>
            ))}
          </StyledBadgeRow>
        )}
        {countsLine.length > 0 && (
          <StyledProfileMeta>{countsLine}</StyledProfileMeta>
        )}
        {effectiveContactInfo &&
          (effectiveContactInfo.email || effectiveContactInfo.phone) && (
            <StyledProfileMeta
              data-testid={`orgchart-contact-details-${item.id}`}
            >
              {effectiveContactInfo.email && (
                <span>Email: {effectiveContactInfo.email}</span>
              )}
              {effectiveContactInfo.email &&
                effectiveContactInfo.phone &&
                ' · '}
              {effectiveContactInfo.phone && (
                <span>Phone: {effectiveContactInfo.phone}</span>
              )}
            </StyledProfileMeta>
          )}
        {effectiveContactInfo &&
          effectiveContactInfo.fetched === true &&
          !effectiveContactInfo.email &&
          !effectiveContactInfo.phone && (
            <StyledProfileMeta>
              No contacts have been fetched for this person yet.
            </StyledProfileMeta>
          )}
        {showActions && (
          <StyledProfileActions>
            {hasLinkedInProfile && item.linkedinUrl && (
              <StyledProfileExternalLink
                href={item.linkedinUrl}
                target="_blank"
                rel="noreferrer"
              >
                <IconBrandLinkedin size={iconSm} stroke={1.5} />
                View on LinkedIn
              </StyledProfileExternalLink>
            )}
            {showFetchContacts && onFetchContacts && (
              <StyledContactButton
                data-testid={`orgchart-fetch-contacts-${item.id}`}
                type="button"
                onClick={() =>
                  onFetchContacts(item, {
                    wantEmail: missingEmail,
                    wantPhone: missingPhone,
                  })
                }
                disabled={isFetchingContacts}
              >
                <IconPhone size={iconSm} stroke={1.5} />
                <IconMail size={iconSm} stroke={1.5} />
                {isFetchingContacts ? 'Fetching contacts…' : fetchLabel}
              </StyledContactButton>
            )}
            {onAddToJob && (
              <StyledContactButton
                data-testid={`orgchart-add-to-job-${item.id}`}
                type="button"
                onClick={() => onAddToJob(item)}
              >
                Add to job
              </StyledContactButton>
            )}
            {onSendConnectionRequest && hasLinkedInProfile && (
              <StyledContactButton
                data-testid={`orgchart-connect-${item.id}`}
                type="button"
                onClick={() => onSendConnectionRequest(item)}
              >
                Send connection request
              </StyledContactButton>
            )}
          </StyledProfileActions>
        )}
      </StyledProfileTextColumn>
    </StyledProfileCard>
  );
};

const useClickedContactLinkImage = (
  companyWebsite?: string,
  companyId?: string,
) => {
  const tokenPair = useRecoilValue(tokenPairState);
  const { enqueueSnackBar } = useSnackBar();
  const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';

  const [contactsById, setContactsById] = useRecoilState(
    orgChartContactsByKeyState,
  );

  const [loadingById, setLoadingById] = useState<Record<string, boolean>>({});

  const persistContacts = (key: string, info: ContactInfo) => {
    setContactsById((prev) => ({ ...prev, [key]: info }));
  };

  const checkCandidateSavedStatus = async (
    item: ContextResultItem,
  ): Promise<{
    saved: boolean;
    candidateIds?: string[];
    jobIds?: string[];
  } | null> => {
    if (!baseUrl || !item.linkedinUrl || !tokenPair?.accessToken?.token) {
      return null;
    }

    try {
      const url = new URL(
        `${baseUrl}/candidate-sourcing/candidates/by-linkedin-urls`,
      );
      url.searchParams.append('linkedinUrls', item.linkedinUrl);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokenPair.accessToken.token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        return null;
      }

      const json = (await response.json()) as {
        status: string;
        results?: Record<
          string,
          { saved: boolean; candidateIds?: string[]; jobIds?: string[] }
        >;
      };

      return json.results?.[item.linkedinUrl] ?? null;
    } catch {
      return null;
    }
  };

  const fetchContactsFromServer = async (
    item: ContextResultItem,
    opts: { wantEmail: boolean; wantPhone: boolean },
  ): Promise<ContactInfo | null> => {
    if (!baseUrl || !tokenPair?.accessToken?.token) {
      return null;
    }
    const domain = extractCompanyDomainFromWebsite(companyWebsite);
    const rawId = (item.raw as { id?: unknown } | undefined)?.id;
    const canM7kqFetch =
      Boolean(domain) && typeof rawId === 'string' && rawId.trim().length > 0;
    if (!item.linkedinUrl && !canM7kqFetch) {
      return null;
    }

    try {
      const body: Record<string, unknown> = {
        wantEmail: opts.wantEmail,
        wantPhone: opts.wantPhone,
      };
      if (canM7kqFetch) {
        body.m7kqPersonId = String(rawId).trim();
        body.companyDomain = domain;
      } else if (item.linkedinUrl) {
        body.linkedinUrl = item.linkedinUrl;
      } else {
        return null;
      }
      const response = await fetch(`${baseUrl}/contact-enrichment/fetch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenPair.accessToken.token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let message = 'Failed to fetch contacts.';

        try {
          const errorBody = await response.json();
          if (
            errorBody !== null &&
            errorBody !== undefined &&
            typeof errorBody === 'object' &&
            'message' in errorBody &&
            typeof errorBody.message === 'string' &&
            errorBody.message.trim().length > 0
          ) {
            message = errorBody.message.trim();
          }
        } catch {
          const errorText = await response.text().catch(() => '');
          if (errorText.trim().length > 0) {
            message = errorText.trim();
          }
        }

        enqueueSnackBar(
          /insufficient contact credits/i.test(message)
            ? INSUFFICIENT_CONTACT_CREDITS_SNACKBAR
            : message,
          {
            variant: SnackBarVariant.Error,
            duration: 5000,
          },
        );
        return null;
      }

      const json = (await response.json()) as
        | {
            emails?: string[];
            phones?: string[];
            source?: string;
            linkedinUrl?: string;
            fullName?: string;
          }
        | { jobId: string; status: string; total: number }
        | { results: Record<string, { emails?: string[]; phones?: string[] }> };

      let emails: string[] | undefined;
      let phones: string[] | undefined;
      let linkedinUrlFromResponse: string | undefined;
      let fullNameFromResponse: string | undefined;

      if (
        'results' in json &&
        typeof item.linkedinUrl === 'string' &&
        item.linkedinUrl
      ) {
        const entry = json.results[item.linkedinUrl];
        emails = entry?.emails;
        phones = entry?.phones;
      } else if ('emails' in json || 'phones' in json) {
        emails = json.emails;
        phones = json.phones;
        linkedinUrlFromResponse =
          typeof (json as { linkedinUrl?: unknown }).linkedinUrl === 'string'
            ? ((json as { linkedinUrl: string }).linkedinUrl ?? '').trim() ||
              undefined
            : undefined;
        fullNameFromResponse =
          typeof (json as { fullName?: unknown }).fullName === 'string'
            ? ((json as { fullName: string }).fullName ?? '').trim() ||
              undefined
            : undefined;
      } else {
        // Async job response is not expected for single-URL requests here
        return { fetched: true };
      }

      const email =
        Array.isArray(emails) && emails.length > 0 ? emails[0] : undefined;
      const phone =
        Array.isArray(phones) && phones.length > 0 ? phones[0] : undefined;

      if (!email && !phone) {
        return {
          fetched: true,
          ...(linkedinUrlFromResponse
            ? { linkedinUrl: linkedinUrlFromResponse }
            : {}),
          ...(fullNameFromResponse ? { fullName: fullNameFromResponse } : {}),
        };
      }

      return {
        email,
        phone,
        fetched: true,
        ...(linkedinUrlFromResponse
          ? { linkedinUrl: linkedinUrlFromResponse }
          : {}),
        ...(fullNameFromResponse ? { fullName: fullNameFromResponse } : {}),
      };
    } catch {
      return null;
    }
  };

  const persistToOrgChart = async (args: {
    item: ContextResultItem;
    info: ContactInfo;
  }) => {
    if (!companyId || !baseUrl || !tokenPair?.accessToken?.token) {
      return;
    }
    const domain = extractCompanyDomainFromWebsite(companyWebsite);
    const rawId = (args.item.raw as { id?: unknown } | undefined)?.id;
    const hasM7kq =
      Boolean(domain) && typeof rawId === 'string' && rawId.trim().length > 0;
    const normalizedBase = baseUrl.replace(/\/$/, '');
    const url = `${normalizedBase}/org-chart/${encodeURIComponent(
      companyId,
    )}/enrichment/apply`;
    const payload: Record<string, unknown> = {
      ...(hasM7kq
        ? { m7kqPersonId: String(rawId).trim(), companyDomain: domain }
        : args.info.linkedinUrl || args.item.linkedinUrl
          ? { linkedinUrl: args.info.linkedinUrl ?? args.item.linkedinUrl }
          : {}),
      emails: args.info.email ? [args.info.email] : undefined,
      phones: args.info.phone ? [args.info.phone] : undefined,
      linkedinUrl: args.info.linkedinUrl,
      fullName: args.info.fullName,
    };
    if (Object.keys(payload).length === 0) return;
    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenPair.accessToken.token}`,
        },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
    } catch {
      // best-effort
    }
  };

  const manageContactsFetching = async (
    item: ContextResultItem,
    opts: { wantEmail: boolean; wantPhone: boolean },
    options?: { skipSavedCheck?: boolean },
  ): Promise<
    | { needsAddToJobPrompt: true; item: ContextResultItem; opts: typeof opts }
    | { needsAddToJobPrompt: false }
    | undefined
  > => {
    const cacheKey = getContactCacheKey(item, companyWebsite);
    const derived = getItemDerivedContactInfo(item);

    const existing = contactsById[cacheKey];
    if (existing?.fetched && !opts.wantEmail && !opts.wantPhone) {
      return { needsAddToJobPrompt: false };
    }

    if (derived) {
      persistContacts(cacheKey, derived);
      return { needsAddToJobPrompt: false };
    }

    setLoadingById((prev) => ({ ...prev, [cacheKey]: true }));

    try {
      let savedStatus: {
        saved: boolean;
        candidateIds?: string[];
        jobIds?: string[];
      } | null = null;

      if (item.linkedinUrl && !options?.skipSavedCheck) {
        savedStatus = await checkCandidateSavedStatus(item);
        if (savedStatus && !savedStatus.saved) {
          return {
            needsAddToJobPrompt: true,
            item,
            opts,
          };
        }
      } else if (item.linkedinUrl && options?.skipSavedCheck) {
        savedStatus = await checkCandidateSavedStatus(item);
      }

      const localInfo: ContactInfo = { fetched: true };
      if (item.email) {
        localInfo.email = item.email;
      }
      if (item.phone) {
        localInfo.phone = item.phone;
      }
      if (item.linkedinUrl) {
        localInfo.linkedinUrl = item.linkedinUrl;
      }
      if (item.fullName) {
        localInfo.fullName = item.fullName;
      }

      let finalInfo: ContactInfo | null = null;

      if (localInfo.email || localInfo.phone) {
        finalInfo = localInfo;
      } else {
        finalInfo = await fetchContactsFromServer(item, opts);
      }

      if (finalInfo) {
        const merged: ContactInfo = {
          ...(existing ?? {}),
          ...finalInfo,
          fetched: true,
          linkedinUrl: finalInfo.linkedinUrl ?? existing?.linkedinUrl,
          fullName: finalInfo.fullName ?? existing?.fullName,
        };
        persistContacts(cacheKey, merged);
        void persistToOrgChart({ item, info: merged });
        if (
          item.linkedinUrl &&
          tokenPair?.accessToken?.token &&
          savedStatus?.saved
        ) {
          const emails =
            finalInfo.email && typeof finalInfo.email === 'string'
              ? [finalInfo.email]
              : [];
          const phones =
            finalInfo.phone && typeof finalInfo.phone === 'string'
              ? [finalInfo.phone]
              : [];

          if (emails.length > 0 || phones.length > 0) {
            try {
              await fetch(
                `${baseUrl}/candidate-sourcing/update-contact-from-enrichment`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${tokenPair.accessToken.token}`,
                  },
                  body: JSON.stringify({
                    linkedinUrl: item.linkedinUrl,
                    emails,
                    phones,
                    jobId: savedStatus.jobIds?.[0],
                    candidateId: savedStatus.candidateIds?.[0],
                  }),
                  credentials: 'include',
                },
              );
            } catch {
              // Ignore backend update failures for UI flow
            }
          }
        }
      }
      return { needsAddToJobPrompt: false };
    } finally {
      setLoadingById((prev) => {
        const { [cacheKey]: _omit, ...rest } = prev;
        return rest;
      });
    }
  };

  const clickedContactLinkImage = async (
    item: ContextResultItem,
    opts: { wantEmail: boolean; wantPhone: boolean },
  ) => {
    return manageContactsFetching(item, opts);
  };

  return {
    contactsById,
    loadingById,
    clickedContactLinkImage,
    manageContactsFetching,
  };
};

export type OrgChartResultModalProps = {
  title: string;
  isLoading: boolean;
  loadingStartedAt?: number | null;
  loadingProgressMessage?: string | null;
  loadingPage?: number | null;
  loadingTotalPages?: number | null;
  loadingTotalCandidates?: number | null;
  error: string | null;
  results: ContextResultItem[];
  booleanKeywordsString?: string | null;
  emptyMessage?: string;
  onClose: () => void;
  onDownloadCsv?: () => void;
  extraFooterButtons?: React.ReactNode;
  onGetSimilarPeople?: () => void;
  onStop?: () => void;
  /** Company site URL — used with `item.raw.id` for m7kq contact match when present. */
  companyWebsite?: string;
  /** Company id — used to persist enrichment into stored org chart (Redis/S3). */
  companyId?: string;
  /**
   * When set (and there are non-loading results), "Add to job" opens a subview
   * inside this modal with a back button instead of a second dialog.
   */
  addToJobInlineContext?: {
    companyName?: string;
    contextModalMode?: string | null;
    selectedNodeFunction?: string;
    selectedNodeGrade?: string;
    queueStartChatAfter?: boolean;
  } | null;
};

export const OrgChartResultModal = ({
  title,
  isLoading,
  loadingStartedAt,
  loadingProgressMessage,
  loadingPage,
  loadingTotalPages,
  loadingTotalCandidates,
  error,
  results,
  booleanKeywordsString,
  emptyMessage = 'No candidates returned for this request yet.',
  onClose,
  onDownloadCsv,
  extraFooterButtons,
  onGetSimilarPeople,
  onStop,
  companyWebsite,
  companyId,
  addToJobInlineContext,
}: OrgChartResultModalProps) => {
  const { t } = useLingui();
  const {
    contactsById,
    loadingById,
    clickedContactLinkImage,
    manageContactsFetching,
  } = useClickedContactLinkImage(companyWebsite, companyId);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isAddToJobView, setIsAddToJobView] = useState(false);
  const [addToJobPanelResults, setAddToJobPanelResults] = useState<
    ContextResultItem[] | null
  >(null);
  const [addToJobQueueStartChatAfter, setAddToJobQueueStartChatAfter] =
    useState(true);
  const [addToJobViewTitle, setAddToJobViewTitle] = useState('Add to job');
  const [fetchContactsPrompt, setFetchContactsPrompt] = useState<{
    item: ContextResultItem;
    opts: { wantEmail: boolean; wantPhone: boolean };
  } | null>(null);
  const [outreachItem, setOutreachItem] = useState<ContextResultItem | null>(
    null,
  );

  const addToJobContextKey = addToJobInlineContext
    ? [
        addToJobInlineContext.companyName ?? '',
        addToJobInlineContext.contextModalMode ?? '',
        addToJobInlineContext.selectedNodeFunction ?? '',
        addToJobInlineContext.selectedNodeGrade ?? '',
        String(addToJobInlineContext.queueStartChatAfter ?? true),
      ].join('|')
    : '';

  const resultIdsKey = results.map((r) => r.id).join(',');

  useEffect(() => {
    setIsAddToJobView(false);
    setAddToJobPanelResults(null);
    setFetchContactsPrompt(null);
    setOutreachItem(null);
  }, [
    title,
    isLoading,
    error,
    resultIdsKey,
    booleanKeywordsString,
    addToJobContextKey,
  ]);

  const handleMainClose = () => {
    setIsAddToJobView(false);
    setAddToJobPanelResults(null);
    setFetchContactsPrompt(null);
    setOutreachItem(null);
    onClose();
  };

  const openAddToJobView = (args: {
    panelResults: ContextResultItem[];
    queueStartChatAfter: boolean;
    viewTitle: string;
  }) => {
    setAddToJobPanelResults(args.panelResults);
    setAddToJobQueueStartChatAfter(args.queueStartChatAfter);
    setAddToJobViewTitle(args.viewTitle);
    setIsAddToJobView(true);
  };

  const handleFetchContacts = async (
    item: ContextResultItem,
    opts: { wantEmail: boolean; wantPhone: boolean },
  ) => {
    const result = await clickedContactLinkImage(item, opts);
    if (result?.needsAddToJobPrompt) {
      setFetchContactsPrompt({ item: result.item, opts: result.opts });
    }
  };

  useEffect(() => {
    if (!isLoading || !loadingStartedAt) {
      setElapsedSeconds(0);
      return;
    }

    const tick = () => {
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - loadingStartedAt) / 1000),
      );
      setElapsedSeconds(elapsed);
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isLoading, loadingStartedAt]);

  const minutes = Math.floor(elapsedSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (elapsedSeconds % 60).toString().padStart(2, '0');
  const elapsedLabel = `${minutes}:${seconds}`;

  const canInlineAddToJob =
    Boolean(addToJobInlineContext) &&
    results.length > 0 &&
    !isLoading &&
    !error;

  const panelResults = addToJobPanelResults ?? results;

  return (
    <StyledOrgChartResultModal
      isClosable
      onClose={handleMainClose}
      size="large"
      padding="none"
      className="orgchart-result-modal"
    >
      <OrgChartModalTightHeader>
        <StyledHeaderContainer data-testid="orgchart-result-modal">
          {isAddToJobView && canInlineAddToJob ? (
            <StyledAddToJobHeaderRow>
              <IconButton
                Icon={IconChevronLeft}
                onClick={() => {
                  setIsAddToJobView(false);
                  setAddToJobPanelResults(null);
                }}
                variant="tertiary"
                ariaLabel={t`Back`}
              />
              <StyledTitle>{addToJobViewTitle}</StyledTitle>
            </StyledAddToJobHeaderRow>
          ) : (
            <StyledTitle>{title}</StyledTitle>
          )}
          <IconButton
            Icon={IconX}
            onClick={handleMainClose}
            variant="tertiary"
          />
        </StyledHeaderContainer>
      </OrgChartModalTightHeader>
      <OrgChartModalTightContent>
        {isAddToJobView && canInlineAddToJob && addToJobInlineContext ? (
          <OnboardingIntentModalLayout>
            <OrgChartResultsAddToJobPanel
              results={panelResults}
              companyName={addToJobInlineContext.companyName}
              contextModalMode={addToJobInlineContext.contextModalMode}
              selectedNodeFunction={addToJobInlineContext.selectedNodeFunction}
              selectedNodeGrade={addToJobInlineContext.selectedNodeGrade}
              queueStartChatAfter={addToJobQueueStartChatAfter}
              initialSelectedIds={panelResults.map((r) => r.id)}
              onCancel={() => {
                setIsAddToJobView(false);
                setAddToJobPanelResults(null);
              }}
              onComplete={() => {
                const pendingFetch = fetchContactsPrompt;
                setIsAddToJobView(false);
                setAddToJobPanelResults(null);
                if (pendingFetch) {
                  setFetchContactsPrompt(null);
                  void manageContactsFetching(
                    pendingFetch.item,
                    pendingFetch.opts,
                    { skipSavedCheck: true },
                  );
                  return;
                }
                handleMainClose();
              }}
            />
          </OnboardingIntentModalLayout>
        ) : (
          <StyledModalBodyScroll>
            {error && <StyledErrorMessage>{error}</StyledErrorMessage>}
            {isLoading && !error && (
              <StyledLoadingMessage>
                <StyledLoadingRow>
                  <Loader />
                  <span>Fetching people...</span>
                </StyledLoadingRow>
                <StyledLoadingDetails>
                  Elapsed: {elapsedLabel}
                </StyledLoadingDetails>
                {loadingProgressMessage && (
                  <StyledLoadingDetails>
                    {loadingProgressMessage}
                  </StyledLoadingDetails>
                )}
                {(loadingPage ||
                  loadingTotalPages ||
                  loadingTotalCandidates) && (
                  <StyledLoadingDetails>
                    {`Page ${loadingPage ?? '-'}${loadingTotalPages ? `/${loadingTotalPages}` : ''} - ${loadingTotalCandidates ?? 0} people`}
                  </StyledLoadingDetails>
                )}
                {onStop && (
                  <StyledStopRow>
                    <Button variant="secondary" title="Cancel" onClick={onStop} />
                  </StyledStopRow>
                )}
              </StyledLoadingMessage>
            )}
            {!isLoading && !error && booleanKeywordsString && (
              <StyledBooleanCard fullWidth rounded>
                <StyledBooleanLabel>Boolean string</StyledBooleanLabel>
                <StyledBooleanValue>{booleanKeywordsString}</StyledBooleanValue>
              </StyledBooleanCard>
            )}
            {!booleanKeywordsString &&
              results.length > 0 &&
              (!isLoading || error) && (
                <StyledProfileList>
                  {results.map((item) => {
                    const cacheKey = getContactCacheKey(item, companyWebsite);
                    return (
                      <ResultItem
                        key={item.id}
                        item={item}
                        contactInfo={contactsById[cacheKey]}
                        isFetchingContacts={!!loadingById[cacheKey]}
                        onFetchContacts={handleFetchContacts}
                        onAddToJob={
                          canInlineAddToJob
                            ? (person) =>
                                openAddToJobView({
                                  panelResults: [person],
                                  queueStartChatAfter:
                                    addToJobInlineContext?.queueStartChatAfter ??
                                    true,
                                  viewTitle: t`Add to job`,
                                })
                            : undefined
                        }
                        onSendConnectionRequest={(person) =>
                          setOutreachItem(person)
                        }
                        companyWebsite={companyWebsite}
                      />
                    );
                  })}
                </StyledProfileList>
              )}
            {!isLoading &&
              !error &&
              !booleanKeywordsString &&
              results.length === 0 && (
                <StyledEmptyState>{emptyMessage}</StyledEmptyState>
              )}
          </StyledModalBodyScroll>
        )}
      </OrgChartModalTightContent>
      {!isAddToJobView && (
        <StyledOrgChartModalFooter>
          {onDownloadCsv && (results.length > 0 || onGetSimilarPeople) && (
            <Button
              variant="secondary"
              title="Download to CSV"
              onClick={onDownloadCsv}
            />
          )}
          {canInlineAddToJob && (
            <Button
              variant="secondary"
              title={t`Add to job`}
              onClick={() =>
                openAddToJobView({
                  panelResults: results,
                  queueStartChatAfter:
                    addToJobInlineContext?.queueStartChatAfter ?? true,
                  viewTitle: t`Add to job`,
                })
              }
              dataTestId="orgchart-results-add-to-job"
            />
          )}
          {canInlineAddToJob && (
            <Button
              variant="secondary"
              title={t`Add to campaign`}
              onClick={() =>
                openAddToJobView({
                  panelResults: results,
                  queueStartChatAfter: true,
                  viewTitle: t`Add to campaign`,
                })
              }
              dataTestId="orgchart-results-add-to-campaign"
            />
          )}
          {extraFooterButtons}
          <Button variant="primary" title="Close" onClick={handleMainClose} />
        </StyledOrgChartModalFooter>
      )}
      <ConfirmationModal
        isOpen={fetchContactsPrompt !== null}
        setIsOpen={(open) => {
          if (!open) {
            setFetchContactsPrompt(null);
          }
        }}
        title={t`Add to job first?`}
        subtitle={t`This person is not on a job yet. Add them to a job before fetching contacts, or fetch and save contacts to the org chart without adding to a job.`}
        deleteButtonText={t`Add to job then fetch`}
        confirmButtonAccent="blue"
        onConfirmClick={() => {
          if (!fetchContactsPrompt || !canInlineAddToJob) {
            setFetchContactsPrompt(null);
            return;
          }
          openAddToJobView({
            panelResults: [fetchContactsPrompt.item],
            queueStartChatAfter:
              addToJobInlineContext?.queueStartChatAfter ?? true,
            viewTitle: t`Add to job`,
          });
        }}
        AdditionalButtons={
          <StyledCenteredButton
            variant="secondary"
            title={t`Fetch without adding`}
            fullWidth
            onClick={() => {
              if (!fetchContactsPrompt) {
                return;
              }
              const pending = fetchContactsPrompt;
              setFetchContactsPrompt(null);
              void manageContactsFetching(pending.item, pending.opts, {
                skipSavedCheck: true,
              });
            }}
          />
        }
      />
      <OrgChartOutreachModal
        isOpen={outreachItem !== null}
        onClose={() => setOutreachItem(null)}
        channel="linkedin_invite"
        contextItem={outreachItem}
        node={null}
        companyName={addToJobInlineContext?.companyName}
        allowSkipJob
      />
    </StyledOrgChartResultModal>
  );
};
