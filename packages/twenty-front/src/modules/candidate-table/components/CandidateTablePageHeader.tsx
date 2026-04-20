import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { IconGitMerge } from '@tabler/icons-react';
import { ReactNode, useState } from 'react';
import { useRecoilValue } from 'recoil';
import {
  Button,
  IconAlertCircle,
  IconComponent,
  IconHierarchy2,
  IconMessage
} from 'twenty-ui';

import { CreditHistoryModal } from '@/billing/components/CreditHistoryModal';
import { CandidateTableJobsPageMenuDropdown } from '@/candidate-table/components/CandidateTableJobsPageMenuDropdown';
import { OrgChartCompanySearchWrapper } from '@/orgchart/components/OrgChartCompanySearchWrapper';
import { orgChartLinkedinCandidateSourceState } from '@/orgchart/states/orgChartLinkedInCandidateSourceState';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import { LinkedinUnipileOrgChartReconnectBanner } from '@/unipile/components/LinkedinUnipileOrgChartReconnectBanner';

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

const StyledOrgChartSearchRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
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
  orgChartCredits?: number;
  emailContactCredits?: number;
  phoneContactCredits?: number;
  /** Opens/toggles the job page Floating AI chat (FloatingAIChat). */
  onFloatingAIChatToggle?: () => void;
  onMergeJobs?: () => void;
  isMergeMode?: boolean;
  onMergeModeCancel?: () => void;
  mergeSelectedCount?: number;
  onMergeSelected?: () => void;
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
  onOrgCharts: _onOrgCharts,
  onCompanySelect,
  hasToken = false,
  hasInsufficientCredits,
  onAddCredits,
  orgChartCredits,
  emailContactCredits,
  phoneContactCredits,
  onFloatingAIChatToggle,
  onMergeJobs,
  isMergeMode,
  onMergeModeCancel,
  mergeSelectedCount = 0,
  onMergeSelected,
}: CandidateTablePageHeaderProps) => {
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const { t } = useLingui();
  const orgChartLinkedinSource = useRecoilValue(
    orgChartLinkedinCandidateSourceState,
  );

  const creditsTotal =
    orgChartCredits !== undefined
      ? (orgChartCredits ?? 0) +
        (emailContactCredits ?? 0) +
        (phoneContactCredits ?? 0)
      : undefined;

  const companySearchDisabledByUnipile =
    orgChartLinkedinSource === 'unipile' && !isLinkedinConnected;
  const companySearchDisabled = !hasToken;
  const companySearchTitle = companySearchDisabledByUnipile
    ? t`Connect LinkedIn (Unipile) before searching companies for org charts`
    : undefined;

  return (
    <>
      <LinkedinUnipileOrgChartReconnectBanner
        key={
          isLinkedinConnected
            ? 'linkedin-unipile-connected'
            : 'linkedin-unipile-disconnected'
        }
        isExtensionInstalled={isExtensionInstalled}
      />
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
          <StyledCompanySearchWrapper title={companySearchTitle}>
            <StyledOrgChartSearchRow>
              <OrgChartCompanySearchWrapper
                onCompanySelect={onCompanySelect}
                placeholder="Search company for org charts..."
                disabled={companySearchDisabled}
                startIcon={<IconHierarchy2 size={20} />}
              />
            </StyledOrgChartSearchRow>
          </StyledCompanySearchWrapper>
        )}
        {isMergeMode ? (
          <>
            <Button
              dataTestId="merge-selected"
              title={`Merge selected (${mergeSelectedCount})`}
              Icon={IconGitMerge}
              variant="primary"
              onClick={onMergeSelected}
              disabled={mergeSelectedCount < 2}
            />
            <Button
              dataTestId="merge-cancel"
              title="Cancel"
              variant="secondary"
              onClick={onMergeModeCancel}
            />
          </>
        ) : null}
        {onFloatingAIChatToggle !== undefined && (
          <Button
            title="AI Chat"
            Icon={IconMessage}
            variant="secondary"
            onClick={onFloatingAIChatToggle}
          />
        )}
        {/* {!isExtensionInstalled && (
          <Button
            title="Download App"
            Icon={IconDownload}
            variant="secondary"
            onClick={onDownloadClick}
          />
        )} */}
        {hasInsufficientCredits && onAddCredits && (
          <StyledCreditsAlert onClick={onAddCredits}>
            <IconAlertCircle />
            Insufficient OpenAI Credits
          </StyledCreditsAlert>
        )}
        <CandidateTableJobsPageMenuDropdown
          onAddJob={onAddJob}
          onMergeJobs={onMergeJobs}
          isLinkedinConnected={isLinkedinConnected}
          isWhatsappLoggedIn={isWhatsappLoggedIn}
          isMergeMode={isMergeMode}
          isExtensionInstalled={isExtensionInstalled}
          onDownloadClick={onDownloadClick}
          creditsTotal={creditsTotal}
          onCreditsClick={
            creditsTotal !== undefined
              ? () => setIsCreditModalOpen(true)
              : undefined
          }
        />
      </StyledPageHeader>
      {orgChartCredits !== undefined && (
        <CreditHistoryModal
          isOpen={isCreditModalOpen}
          onClose={() => setIsCreditModalOpen(false)}
          orgChartCredits={orgChartCredits}
          emailContactCredits={emailContactCredits}
          phoneContactCredits={phoneContactCredits}
        />
      )}
    </>
  );
};
