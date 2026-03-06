import styled from '@emotion/styled';
import { IconBrandLinkedin, IconMail, IconPhone } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { toTitleCase } from 'twenty-shared';

const DEFAULT_AVATAR =
  'https://st2.depositphotos.com/4111759/12123/v/950/depositphotos_121232442-stock-illustration-male-default-placeholder-avatar-profile.jpg';

import type { ContextResultItem } from '../types';

const StyledContextModalBackdrop = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
`;

const StyledContextModal = styled.div`
  width: 720px;
  max-width: 100%;
  max-height: 80vh;
  background: ${({ theme }) => theme.background.primary};
  border-radius: ${({ theme }) => theme.border.radius.xl};
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.35);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const StyledContextModalHeader = styled.div`
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledContextModalTitle = styled.h3`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: 600;
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledContextModalBody = styled.div`
  padding: ${({ theme }) => theme.spacing(2.5)} ${({ theme }) => theme.spacing(3)};
  overflow: auto;
`;

const StyledContextModalFooter = styled.div`
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing(1.5)};
`;

const StyledContextPrimaryButton = styled.button`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: none;
  background: ${({ theme }) => theme.color.blue};
  color: ${({ theme }) => theme.font.color.inverted};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.color.blue80};
  }
`;

const StyledContextSecondaryButton = styled.button`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: transparent;
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
  }
`;

const StyledContextResultItem = styled.div`
  padding: ${({ theme }) => theme.spacing(1.5)} 0;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledAvatarWrapper = styled.div<{ $size: number }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  min-width: ${({ $size }) => $size}px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
`;

const StyledAvatarImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const StyledContextResultContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.25)};
  min-width: 0;
`;

const StyledContextResultName = styled.div`
  font-weight: 500;
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledContextResultMeta = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledContextResultLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(0.5)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.color.blue};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const StyledContactButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(0.5)};
  margin-top: ${({ theme }) => theme.spacing(0.5)};
  padding: 0;
  border: none;
  background: none;
  color: ${({ theme }) => theme.color.blue};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  text-align: left;

  &:hover {
    text-decoration: underline;
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
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

const StyledSpinner = styled.div`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid ${({ theme }) => theme.border.color.light};
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

const StyledLoadingDetails = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledErrorMessage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  color: ${({ theme }) => theme.color.red};
  font-size: ${({ theme }) => theme.font.size.md};
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

const Avatar = ({ src, size = 36 }: { src: string; size?: number }) => {
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
  const avatarUrl = getAvatarUrl(item) ?? DEFAULT_AVATAR;
  const displayHeadline = item.headline
    ? toTitleCase(item.headline, { skipIfMasked: true })
    : '';
  const displayCompany = item.company
    ? toTitleCase(item.company)
    : '';

  return (
    <StyledContextResultItem>
      <Avatar src={avatarUrl} size={36} />
      <StyledContextResultContent>
        <StyledContextResultName>{item.fullName}</StyledContextResultName>
        {displayHeadline && (
          <StyledContextResultMeta>{displayHeadline}</StyledContextResultMeta>
        )}
        {displayCompany && (
          <StyledContextResultMeta>{displayCompany}</StyledContextResultMeta>
        )}
        {item.linkedinUrl && (
          <StyledContextResultLink
            href={item.linkedinUrl}
            target="_blank"
            rel="noreferrer"
          >
            <IconBrandLinkedin size={14} stroke={1.6} />
            View on LinkedIn
          </StyledContextResultLink>
        )}
        {contactInfo && (contactInfo.email || contactInfo.phone) && (
          <StyledContextResultMeta>
            {contactInfo.email && <span>Email: {contactInfo.email}</span>}
            {contactInfo.email && contactInfo.phone && ' · '}
            {contactInfo.phone && <span>Phone: {contactInfo.phone}</span>}
          </StyledContextResultMeta>
        )}
        {contactInfo &&
          contactInfo.fetched &&
          !contactInfo.email &&
          !contactInfo.phone && (
            <StyledContextResultMeta>
              No contacts have been fetched for this person yet.
            </StyledContextResultMeta>
          )}
        {onFetchContacts &&
          (!contactInfo || !contactInfo.fetched) && (
            <StyledContactButton
              type="button"
              onClick={() => onFetchContacts(item)}
              disabled={isFetchingContacts}
            >
              <IconPhone size={14} stroke={1.6} />
              <IconMail size={14} stroke={1.6} />
              {isFetchingContacts ? 'Fetching contacts…' : 'Fetch contacts'}
            </StyledContactButton>
          )}
      </StyledContextResultContent>
    </StyledContextResultItem>
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

      if ('results' in json && item.linkedinUrl) {
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
      let savedStatus:
        | { saved: boolean; candidateIds?: string[]; jobIds?: string[] }
        | null = null;

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
    <StyledContextModalBackdrop onClick={onClose}>
      <StyledContextModal
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <StyledContextModalHeader>
          <StyledContextModalTitle>{title}</StyledContextModalTitle>
        </StyledContextModalHeader>
        <StyledContextModalBody>
          {isLoading && (
            <StyledLoadingMessage>
              <StyledLoadingRow>
                <StyledSpinner />
                <span>Fetching people...</span>
              </StyledLoadingRow>
              <StyledLoadingDetails>Elapsed: {elapsedLabel}</StyledLoadingDetails>
              {loadingProgressMessage && (
                <StyledLoadingDetails>{loadingProgressMessage}</StyledLoadingDetails>
              )}
              {(loadingPage || loadingTotalPages || loadingTotalCandidates) && (
                <StyledLoadingDetails>
                  {`Page ${loadingPage ?? '-'}${loadingTotalPages ? `/${loadingTotalPages}` : ''} - ${loadingTotalCandidates ?? 0} people`}
                </StyledLoadingDetails>
              )}
            </StyledLoadingMessage>
          )}
          {!isLoading && error && (
            <StyledErrorMessage>{error}</StyledErrorMessage>
          )}
          {!isLoading && !error && booleanKeywordsString && (
            <StyledContextResultItem>
              <StyledContextResultName>Boolean string</StyledContextResultName>
              <StyledContextResultMeta>
                {booleanKeywordsString}
              </StyledContextResultMeta>
            </StyledContextResultItem>
          )}
          {!isLoading &&
            !error &&
            !booleanKeywordsString &&
            results.map((item) => (
              <ResultItem
                key={item.id}
                item={item}
                contactInfo={contactsById[item.id]}
                isFetchingContacts={!!loadingById[item.id]}
                onFetchContacts={clickedContactLinkImage}
              />
            ))}
          {!isLoading &&
            !error &&
            !booleanKeywordsString &&
            !results.length && (
              <StyledContextResultMeta>{emptyMessage}</StyledContextResultMeta>
            )}
        </StyledContextModalBody>
        <StyledContextModalFooter>
          {onDownloadCsv && (results.length > 0 || onGetSimilarPeople) && (
            <StyledContextSecondaryButton type="button" onClick={onDownloadCsv}>
              Download to CSV
            </StyledContextSecondaryButton>
          )}
          {onAddToJob && results.length > 0 && (
            <StyledContextSecondaryButton type="button" onClick={onAddToJob}>
              Add to job
            </StyledContextSecondaryButton>
          )}
          {/* {onGetSimilarPeople && (
            <StyledContextSecondaryButton
              type="button"
              onClick={onGetSimilarPeople}
            >
              Get similar people in similar companies
            </StyledContextSecondaryButton>
          )} */}
          {extraFooterButtons}
          <StyledContextPrimaryButton type="button" onClick={onClose}>
            Close
          </StyledContextPrimaryButton>
        </StyledContextModalFooter>
      </StyledContextModal>
    </StyledContextModalBackdrop>
  );
};
