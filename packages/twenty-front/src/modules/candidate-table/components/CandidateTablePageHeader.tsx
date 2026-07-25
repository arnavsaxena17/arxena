import { IconDownload } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { IconComponent } from 'twenty-ui/icon';
import { IconAlertCircle, IconHierarchy2, IconMessage } from 'twenty-ui/icon';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useLingui } from '@lingui/react/macro';
import { IconArrowMerge } from 'twenty-ui/icon';
import { ReactNode, useState } from 'react';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

import { CreditHistoryModal } from '@/billing/components/CreditHistoryModal';
import { CandidateTableProjectsPageMenuDropdown } from '@/candidate-table/components/CandidateTableProjectsPageMenuDropdown';
import { OrgChartCompanySearchWrapper } from '@/orgchart/components/OrgChartCompanySearchWrapper';
import { orgChartLinkedinCandidateSourceState } from '@/orgchart/states/orgChartLinkedInCandidateSourceState';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';

const StyledCompanySearchWrapper = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  margin-inline: auto;
  width: min(420px, 100%);
  flex: 0 1 420px;
  min-width: 350px;
  max-width: 420px;
  z-index: 1;
  pointer-events: none;

  & > * {
    pointer-events: auto;
  }

  @media (max-width: 1024px) {
    position: relative;
    left: auto;
    right: auto;
    margin-inline: 0;
    width: auto;
    flex: 1 1 auto;
    max-width: 100%;
    pointer-events: auto;
  }
`;

const StyledOrgChartSearchRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledPageHeaderShell = styled.div`
  flex-shrink: 0;
  overflow: visible;
  position: relative;
  /* Below top bar tooltips (25) and right drawer (30); above page body */
  z-index: 20;
`;

export const StyledPageHeader = styled(PageHeader)`
  flex-shrink: 0;
  padding: 12px 24px;
  overflow: visible;
  position: relative;

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
    gap: ${themeCssVariables.spacing[2]};
    position: relative;
  }

  @media (max-width: 768px) {
    padding: 8px 16px;
  }
`;

const StyledCreditsAlert = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  background-color: ${themeCssVariables.color.red};
  color: ${themeCssVariables.font.color.inverted};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  margin-left: ${themeCssVariables.spacing[2]};
  cursor: pointer;
  transition: all 0.2s ease-in-out;

  &:hover {
    opacity: 0.9;
  }

  svg {
    width: 16px;
    height: 16px;
    color: ${themeCssVariables.font.color.inverted};
  }
`;

export type CandidateTablePageHeaderProps = {
  title: ReactNode;
  Icon: IconComponent;
  onAddJob: () => void;
  isExtensionInstalled: boolean;
  isExtensionChecking?: boolean;
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
  revealCredits?: number;
  revealCreditsAsEmailEquivalent?: number;
  revealCreditsAsPhoneEquivalent?: number;
  emailRevealCost?: number;
  phoneRevealCost?: number;
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
  isExtensionChecking = false,
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
  revealCredits,
  revealCreditsAsEmailEquivalent,
  revealCreditsAsPhoneEquivalent,
  emailRevealCost,
  phoneRevealCost,
  onFloatingAIChatToggle,
  onMergeJobs,
  isMergeMode,
  onMergeModeCancel,
  mergeSelectedCount = 0,
  onMergeSelected,
}: CandidateTablePageHeaderProps) => {
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const { t } = useLingui();
  const orgChartLinkedinSource = useAtomStateValue(
    orgChartLinkedinCandidateSourceState,
  );

  const creditsTotal =
    orgChartCredits !== undefined
      ? (orgChartCredits ?? 0) + (revealCredits ?? 0)
      : undefined;

  const companySearchDisabledByUnipile =
    orgChartLinkedinSource === 'unipile' && !isLinkedinConnected;
  const companySearchDisabled = !hasToken;
  const companySearchTitle = companySearchDisabledByUnipile
    ? t`Connect LinkedIn (Unipile) before searching companies for org charts`
    : undefined;

  return (
    <>
      {/* <LinkedinUnipileOrgChartReconnectBanner
        key={
          isLinkedinConnected
            ? 'linkedin-unipile-connected'
            : 'linkedin-unipile-disconnected'
        }
        isExtensionInstalled={isExtensionInstalled}
      /> */}
      <StyledPageHeaderShell>
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
                placeholder="Search any company's org chart..."
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
              Icon={IconArrowMerge}
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
        <CandidateTableProjectsPageMenuDropdown
          onAddJob={onAddJob}
          onMergeJobs={onMergeJobs}
          isLinkedinConnected={isLinkedinConnected}
          isWhatsappLoggedIn={isWhatsappLoggedIn}
          isMergeMode={isMergeMode}
          isExtensionInstalled={isExtensionInstalled}
          isExtensionChecking={isExtensionChecking}
          onDownloadClick={onDownloadClick}
          creditsTotal={creditsTotal}
          onCreditsClick={
            creditsTotal !== undefined
              ? () => setIsCreditModalOpen(true)
              : undefined
          }
        />
        </StyledPageHeader>
      </StyledPageHeaderShell>
      {orgChartCredits !== undefined && (
        <CreditHistoryModal
          isOpen={isCreditModalOpen}
          onClose={() => setIsCreditModalOpen(false)}
          orgChartCredits={orgChartCredits}
          revealCredits={revealCredits}
          revealCreditsAsEmailEquivalent={revealCreditsAsEmailEquivalent}
          revealCreditsAsPhoneEquivalent={revealCreditsAsPhoneEquivalent}
          emailRevealCost={emailRevealCost}
          phoneRevealCost={phoneRevealCost}
        />
      )}
    </>
  );
};
