import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import {
  Button,
  Card,
  IconBrandLinkedin,
  IconButton,
  IconMail,
  IconPhone,
  IconX,
  Loader,
} from 'twenty-ui';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { Modal } from '@/ui/layout/modal/components/Modal';
import {
  getProxiedImageUrl,
  isValidLinkedInProfileUrl,
  toTitleCase,
} from 'twenty-shared';
import { ContextResultItem } from '../types';

const DEFAULT_AVATAR =
  'https://st2.depositphotos.com/4111759/12123/v/950/depositphotos_121232442-stock-illustration-male-default-placeholder-avatar-profile.jpg';

const INSUFFICIENT_CONTACT_CREDITS_SNACKBAR = 'Insufficient contact credits';

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

const StyledProfileName = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  line-height: ${({ theme }) => theme.text.lineHeight.md};
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
  /**
   * Indicates that a contact fetch was attempted for this person,
   * even if no email/phone data was ultimately found.
   */
  fetched?: boolean;
};

type ResultItemProps = {
  item: ContextResultItem;
  contactInfo?: ContactInfo;
  isFetchingContacts?: boolean;
  onFetchContacts?: (item: ContextResultItem) => void;
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
}: ResultItemProps) => {
  const theme = useTheme();
  const iconSm = theme.icon.size.sm;
  const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';
  const rawAvatarUrl = getAvatarUrl(item) ?? DEFAULT_AVATAR;
  const avatarUrl = getProxiedImageUrl(rawAvatarUrl, baseUrl) || rawAvatarUrl;
  const displayHeadline = item.headline
    ? toTitleCase(item.headline, { skipIfMasked: true })
    : '';
  const displayCompany = item.company ? toTitleCase(item.company) : '';
  const roleCompanyLine = [displayHeadline, displayCompany]
    .filter((part) => part.length > 0)
    .join(' · ');

  const hasLinkedInProfile = isValidLinkedInProfileUrl(item.linkedinUrl);
  const canAttemptContactFetch =
    hasLinkedInProfile ||
    Boolean(item.email?.trim()) ||
    Boolean(item.phone?.trim());

  const showFetchContacts =
    Boolean(onFetchContacts) &&
    (!contactInfo || contactInfo.fetched !== true) &&
    canAttemptContactFetch;

  return (
    <StyledProfileCard
      fullWidth
      rounded
      data-testid={`orgchart-result-item-${item.id}`}
    >
      <Avatar src={avatarUrl} size={48} />
      <StyledProfileTextColumn>
        <StyledProfileName>{item.fullName}</StyledProfileName>
        {roleCompanyLine.length > 0 && (
          <StyledProfileSubline>{roleCompanyLine}</StyledProfileSubline>
        )}
        {contactInfo && (contactInfo.email || contactInfo.phone) && (
          <StyledProfileMeta
            data-testid={`orgchart-contact-details-${item.id}`}
          >
            {contactInfo.email && <span>Email: {contactInfo.email}</span>}
            {contactInfo.email && contactInfo.phone && ' · '}
            {contactInfo.phone && <span>Phone: {contactInfo.phone}</span>}
          </StyledProfileMeta>
        )}
        {contactInfo &&
          contactInfo.fetched === true &&
          !contactInfo.email &&
          !contactInfo.phone && (
            <StyledProfileMeta>
              No contacts have been fetched for this person yet.
            </StyledProfileMeta>
          )}
        {(Boolean(hasLinkedInProfile && item.linkedinUrl) ||
          showFetchContacts) && (
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
                onClick={() => onFetchContacts(item)}
                disabled={isFetchingContacts}
              >
                <IconPhone size={iconSm} stroke={1.5} />
                <IconMail size={iconSm} stroke={1.5} />
                {isFetchingContacts ? 'Fetching contacts…' : 'Fetch contacts'}
              </StyledContactButton>
            )}
          </StyledProfileActions>
        )}
      </StyledProfileTextColumn>
    </StyledProfileCard>
  );
};

const useClickedContactLinkImage = () => {
  const tokenPair = useRecoilValue(tokenPairState);
  const { enqueueSnackBar } = useSnackBar();
  const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';

  const [contactsById, setContactsById] = useState<Record<string, ContactInfo>>(
    () => {
      if (typeof window === 'undefined') {
        return {};
      }

      try {
        const stored = window.localStorage.getItem('orgchartContacts');
        if (!stored) {
          return {};
        }

        const parsed = JSON.parse(stored) as Record<string, ContactInfo>;
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    },
  );

  const [loadingById, setLoadingById] = useState<Record<string, boolean>>({});

  const persistContacts = (id: string, info: ContactInfo) => {
    setContactsById((prev) => ({
      ...prev,
      [id]: info,
    }));

    if (typeof window === 'undefined') {
      return;
    }

    try {
      const stored = window.localStorage.getItem('orgchartContacts');
      const existing = stored
        ? (JSON.parse(stored) as Record<string, ContactInfo>)
        : {};

      window.localStorage.setItem(
        'orgchartContacts',
        JSON.stringify({
          ...existing,
          [id]: info,
        }),
      );
    } catch {
      // Ignore storage errors
    }
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
  ): Promise<ContactInfo | null> => {
    if (!baseUrl || !item.linkedinUrl || !tokenPair?.accessToken?.token) {
      return null;
    }

    try {
      const response = await fetch(`${baseUrl}/contact-enrichment/fetch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenPair.accessToken.token}`,
        },
        body: JSON.stringify({
          linkedinUrl: item.linkedinUrl,
          wantEmail: true,
          wantPhone: true,
        }),
        credentials: 'include',
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
          }
        | { jobId: string; status: string; total: number }
        | { results: Record<string, { emails?: string[]; phones?: string[] }> };

      let emails: string[] | undefined;
      let phones: string[] | undefined;

      if ('results' in json && typeof item.linkedinUrl === 'string') {
        const entry = json.results[item.linkedinUrl];
        emails = entry?.emails;
        phones = entry?.phones;
      } else if ('emails' in json || 'phones' in json) {
        emails = json.emails;
        phones = json.phones;
      } else {
        // Async job response is not expected for single-URL requests here
        return { fetched: true };
      }

      const email =
        Array.isArray(emails) && emails.length > 0 ? emails[0] : undefined;
      const phone =
        Array.isArray(phones) && phones.length > 0 ? phones[0] : undefined;

      if (!email && !phone) {
        return { fetched: true };
      }

      return { email, phone, fetched: true };
    } catch {
      return null;
    }
  };

  const manageContactsFetching = async (item: ContextResultItem) => {
    if (contactsById[item.id]) {
      return;
    }

    setLoadingById((prev) => ({ ...prev, [item.id]: true }));

    try {
      // Enforce saved-candidate rule when possible
      let savedStatus: {
        saved: boolean;
        candidateIds?: string[];
        jobIds?: string[];
      } | null = null;

      if (item.linkedinUrl) {
        savedStatus = await checkCandidateSavedStatus(item);
        if (savedStatus && !savedStatus.saved) {
          enqueueSnackBar(
            'Please add this person to a job before fetching contacts.',
            {
              variant: SnackBarVariant.Error,
              duration: 4000,
            },
          );
          return;
        }
      }

      const localInfo: ContactInfo = { fetched: true };
      if (item.email) {
        localInfo.email = item.email;
      }
      if (item.phone) {
        localInfo.phone = item.phone;
      }

      let finalInfo: ContactInfo | null = null;

      if (localInfo.email || localInfo.phone) {
        finalInfo = localInfo;
      } else {
        finalInfo = await fetchContactsFromServer(item);
      }

      if (finalInfo) {
        persistContacts(item.id, finalInfo);
        // Also update backend candidate/person when we can
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
    } finally {
      setLoadingById((prev) => {
        const { [item.id]: _omit, ...rest } = prev;
        return rest;
      });
    }
  };

  const clickedContactLinkImage = (item: ContextResultItem) => {
    void manageContactsFetching(item);
  };

  return { contactsById, loadingById, clickedContactLinkImage };
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
  onAddToJob?: () => void;
  extraFooterButtons?: React.ReactNode;
  onGetSimilarPeople?: () => void;
  onStop?: () => void;
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
  onAddToJob,
  extraFooterButtons,
  onGetSimilarPeople,
  onStop,
}: OrgChartResultModalProps) => {
  const { contactsById, loadingById, clickedContactLinkImage } =
    useClickedContactLinkImage();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

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

  return (
    <StyledOrgChartResultModal
      isClosable
      onClose={onClose}
      size="large"
      padding="none"
      className="orgchart-result-modal"
    >
      <Modal.Header>
        <StyledHeaderContainer data-testid="orgchart-result-modal">
          <StyledTitle>{title}</StyledTitle>
          <IconButton Icon={IconX} onClick={onClose} variant="tertiary" />
        </StyledHeaderContainer>
      </Modal.Header>
      <Modal.Content>
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
              {(loadingPage || loadingTotalPages || loadingTotalCandidates) && (
                <StyledLoadingDetails>
                  {`Page ${loadingPage ?? '-'}${loadingTotalPages ? `/${loadingTotalPages}` : ''} - ${loadingTotalCandidates ?? 0} people`}
                </StyledLoadingDetails>
              )}
              {onStop && (
                <StyledStopRow>
                  <Button variant="secondary" title="Stop" onClick={onStop} />
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
                {results.map((item) => (
                  <ResultItem
                    key={item.id}
                    item={item}
                    contactInfo={contactsById[item.id]}
                    isFetchingContacts={!!loadingById[item.id]}
                    onFetchContacts={clickedContactLinkImage}
                  />
                ))}
              </StyledProfileList>
            )}
          {!isLoading &&
            !error &&
            !booleanKeywordsString &&
            results.length === 0 && (
              <StyledEmptyState>{emptyMessage}</StyledEmptyState>
            )}
        </StyledModalBodyScroll>
      </Modal.Content>
      <StyledOrgChartModalFooter>
        {onDownloadCsv && (results.length > 0 || onGetSimilarPeople) && (
          <Button
            variant="secondary"
            title="Download to CSV"
            onClick={onDownloadCsv}
          />
        )}
        {onAddToJob && results.length > 0 && (
          <Button
            variant="secondary"
            title="Add to job"
            onClick={onAddToJob}
            dataTestId="orgchart-results-add-to-job"
          />
        )}
        {extraFooterButtons}
        <Button variant="primary" title="Close" onClick={onClose} />
      </StyledOrgChartModalFooter>
    </StyledOrgChartResultModal>
  );
};
