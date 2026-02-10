import styled from '@emotion/styled';
import { useState } from 'react';

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
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.25)};
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
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.color.blue};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const StyledContactButton = styled.button`
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
`;

const StyledLoadingMessage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.md};
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

const ResultItem = ({
  item,
  contactInfo,
  isFetchingContacts,
  onFetchContacts,
}: ResultItemProps) => (
  <StyledContextResultItem>
    <StyledContextResultName>{item.fullName}</StyledContextResultName>
    {item.headline && (
      <StyledContextResultMeta>{item.headline}</StyledContextResultMeta>
    )}
    {item.company && (
      <StyledContextResultMeta>{item.company}</StyledContextResultMeta>
    )}
    {item.linkedinUrl && (
      <StyledContextResultLink
        href={item.linkedinUrl}
        target="_blank"
        rel="noreferrer"
      >
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
        {isFetchingContacts ? 'Fetching contacts…' : 'Fetch contacts'}
      </StyledContactButton>
    )}
  </StyledContextResultItem>
);

const useClickedContactLinkImage = () => {
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

  const fetchContactsFromServer = async (
    item: ContextResultItem,
  ): Promise<ContactInfo | null> => {
    const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';
    if (!baseUrl || !item.linkedinUrl) {
      return null;
    }

    try {
      const response = await fetch(`${baseUrl}/org-chart/contact-info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ linkedinUrl: item.linkedinUrl }),
        credentials: 'include',
      });

      if (!response.ok) {
        return null;
      }

      const json = (await response.json()) as {
        emailAddresses?: string[];
        phoneNumbers?: string[];
      };

      const email =
        Array.isArray(json.emailAddresses) && json.emailAddresses.length > 0
          ? json.emailAddresses[0]
          : undefined;
      const phone =
        Array.isArray(json.phoneNumbers) && json.phoneNumbers.length > 0
          ? json.phoneNumbers[0]
          : undefined;

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
  error: string | null;
  results: ContextResultItem[];
  booleanKeywordsString?: string | null;
  emptyMessage?: string;
  onClose: () => void;
  onDownloadCsv?: () => void;
  extraFooterButtons?: React.ReactNode;
  onGetSimilarPeople?: () => void;
};

export const OrgChartResultModal = ({
  title,
  isLoading,
  error,
  results,
  booleanKeywordsString,
  emptyMessage = 'No candidates returned for this request yet.',
  onClose,
  onDownloadCsv,
  extraFooterButtons,
  onGetSimilarPeople,
}: OrgChartResultModalProps) => {
  const { contactsById, loadingById, clickedContactLinkImage } =
    useClickedContactLinkImage();

  return (
    <StyledContextModalBackdrop>
      <StyledContextModal>
        <StyledContextModalHeader>
          <StyledContextModalTitle>{title}</StyledContextModalTitle>
        </StyledContextModalHeader>
        <StyledContextModalBody>
          {isLoading && (
            <StyledLoadingMessage>Fetching people...</StyledLoadingMessage>
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
          {onGetSimilarPeople && (
            <StyledContextSecondaryButton
              type="button"
              onClick={onGetSimilarPeople}
            >
              Get similar people in similar companies
            </StyledContextSecondaryButton>
          )}
          {extraFooterButtons}
          <StyledContextPrimaryButton type="button" onClick={onClose}>
            Close
          </StyledContextPrimaryButton>
        </StyledContextModalFooter>
      </StyledContextModal>
    </StyledContextModalBackdrop>
  );
};
