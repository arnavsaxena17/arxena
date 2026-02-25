import styled from '@emotion/styled';
import { IconBrandLinkedin, IconBrandWhatsapp } from '@tabler/icons-react';
import { ReactNode } from 'react';
import {
    Button,
    IconAlertCircle,
    IconDownload,
    IconMessage,
    IconPlus,
    IconX,
} from 'twenty-ui';

import { CompanySearchAutocomplete } from '@/orgchart/components/CompanySearchAutocomplete';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';

import type { IconComponent } from 'twenty-ui';

const StyledCompanySearchWrapper = styled.div`
  position: absolute;
  left: 45%;
  transform: translateX(-50%);
  flex: 0 1 420px;
  min-width: 350px;
  max-width: 420px;
  z-index: 1;

  @media (max-width: 1024px) {
    position: relative;
    left: auto;
    transform: none;
    flex: 1 1 auto;
    max-width: 100%;
  }
`;

export const StyledPageHeader = styled(PageHeader)`
  flex-shrink: 0;
  padding: 12px 24px;
  overflow: visible;
  position: relative;
  z-index: 10;

  /* Single horizontal row: title (left) | search (center) | buttons (right) */
  & > div {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    position: relative;
  }
  & > div > div:first-of-type {
    width: auto;
    flex: 0 1 auto;
    min-width: 0;
  }
  & > div > div:last-of-type {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.spacing(2)};
    position: relative;
  }

  @media (max-width: 768px) {
    padding: 8px 16px;
  }
`;

const StyledButtonContainer = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  flex: 1;
  min-width: 0;
`;

const StyledLeftSpacer = styled.div`
  flex: 1;
  min-width: 0;
`;

// const StyledCenterSearch = styled.div`
//   flex-shrink: 0;
//   display: flex;
//   justify-content: center;
//   margin: 0 ${({ theme }) => theme.spacing(2)};
// `;

const StyledRightSection = styled.div`
  flex: 1;
  display: flex;
  left: 0;

  align-items: center;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing(2)};
  min-width: 0;
`;


const StyledConnectionStatus = styled.div<{ isConnected: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme, isConnected }) =>
    isConnected ? theme.color.green : theme.color.gray};
  color: ${({ theme }) => theme.font.color.inverted};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  transition: all 0.2s ease-in-out;
  min-width: ${({ isConnected }) => (isConnected ? '120px' : '130px')};

  svg {
    width: 16px;
    height: 16px;
    color: ${({ theme }) => theme.font.color.inverted};
  }
`;

const StyledConnectionStatusGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-left: auto;
`;

const StyledCreditsAlert = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.color.red};
  color: ${({ theme }) => theme.font.color.inverted};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  margin-left: ${({ theme }) => theme.spacing(2)};
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  &:hover {
    opacity: 0.9;
  }

  svg {
    width: 16px;
    height: 16px;
    color: ${({ theme }) => theme.font.color.inverted};
  }
`;

export type CandidateTablePageHeaderProps = {
  title: ReactNode;
  Icon: IconComponent;
  onAddJob: () => void;
  isExtensionInstalled: boolean;
  onDownloadClick: () => void;
  isLinkedinConnected: boolean;
  isWhatsappLoggedIn: boolean;
  hasPaginationButtons?: boolean;
  hasPreviousRecord?: boolean;
  hasNextRecord?: boolean;
  navigateToPreviousRecord?: () => void;
  navigateToNextRecord?: () => void;
  hasClosePageButton?: boolean;
  onClosePage?: () => void;
  onOrgCharts?: () => void;
  onCompanySelect?: (company: {
    companyId: string;
    companyName: string;
    website?: string;
    locationName?: string;
    industry?: string;
    profileCount?: number;
    linkedinUrl?: string;
  }) => void;
  hasToken?: boolean;
  hasInsufficientCredits?: boolean;
  onAddCredits?: () => void;
  onChatKitToggle?: () => void;
};

export const CandidateTablePageHeader = ({
  title,
  Icon,
  onAddJob,
  isExtensionInstalled,
  onDownloadClick,
  isLinkedinConnected,
  isWhatsappLoggedIn,
  hasPaginationButtons,
  hasPreviousRecord,
  hasNextRecord,
  navigateToPreviousRecord,
  navigateToNextRecord,
  hasClosePageButton,
  onClosePage,
  onOrgCharts,
  onCompanySelect,
  hasToken = false,
  hasInsufficientCredits,
  onAddCredits,
  onChatKitToggle,
}: CandidateTablePageHeaderProps) => (
    <StyledPageHeader
      title={title}
      Icon={Icon}
      hasPaginationButtons={hasPaginationButtons}
      hasPreviousRecord={hasPreviousRecord}
      hasNextRecord={hasNextRecord}
      navigateToPreviousRecord={navigateToPreviousRecord}
      navigateToNextRecord={navigateToNextRecord}
      hasClosePageButton={hasClosePageButton}
      onClosePage={onClosePage}
    >
      {onCompanySelect !== undefined && (
        <StyledCompanySearchWrapper>
          <CompanySearchAutocomplete
            onCompanySelect={onCompanySelect}
            placeholder="Search company for org charts..."
            disabled={!hasToken}
          />
        </StyledCompanySearchWrapper>
      )}
    {/* <StyledButtonContainer> */}
      {/* <StyledLeftSpacer /> */}

      {/* <StyledRightSection> */}
        <Button dataTestId="add-new-job" title="Add New Job" Icon={IconPlus} variant="primary" onClick={onAddJob} />
        {/* {onOrgCharts !== undefined && (
          <Button
            title="Org Charts"
            Icon={IconSitemap}
            variant="secondary"
            onClick={onOrgCharts}
            disabled={!hasToken}
          />
        )} */}
        {onChatKitToggle !== undefined && (
          <Button
            title="AI Chat"
            Icon={IconMessage}
            variant="secondary"
            onClick={onChatKitToggle}
          />
        )}
        {!isExtensionInstalled && (
          <Button title="Download App" Icon={IconDownload} variant="secondary" onClick={onDownloadClick} />
        )}
      {hasInsufficientCredits && onAddCredits && (
        <StyledCreditsAlert onClick={onAddCredits}>
          <IconAlertCircle />
          Insufficient OpenAI Credits
        </StyledCreditsAlert>
      )}
      <StyledConnectionStatusGroup>
        <StyledConnectionStatus isConnected={isLinkedinConnected}>
          {isLinkedinConnected ? (
            <>
              <IconBrandLinkedin />
              LinkedIn
            </>
          ) : (
            <>
              <IconX />
              LinkedIn
            </>
          )}
        </StyledConnectionStatus>
        <StyledConnectionStatus isConnected={isWhatsappLoggedIn}>
          {isWhatsappLoggedIn ? (
            <>
              <IconBrandWhatsapp />
              Whatsapp
            </>
          ) : (
            <>
              <IconX />
              Whatsapp
            </>
          )}
        </StyledConnectionStatus>
      </StyledConnectionStatusGroup>
      {/* </StyledRightSection> */}
    {/* </StyledButtonContainer> */}
  </StyledPageHeader>
);
