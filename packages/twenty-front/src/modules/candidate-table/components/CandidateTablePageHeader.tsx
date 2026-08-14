import { IconDownload } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { type IconComponent } from 'twenty-ui/icon';
import { IconAlertCircle, IconHierarchy2 } from 'twenty-ui/icon';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useLingui } from '@lingui/react/macro';
import { IconArrowMerge } from 'twenty-ui/icon';
import { type ReactNode, useState } from 'react';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

import { CreditHistoryModal } from '@/billing/components/CreditHistoryModal';
import { CandidateTableProjectsPageMenuDropdown } from '@/candidate-table/components/CandidateTableProjectsPageMenuDropdown';
import { InformationBannerChromeExtensionNotInstalled } from '@/information-banner/components/chrome-extension/InformationBannerChromeExtensionNotInstalled';
import { OrgChartCompanySearchWrapper } from '@/orgchart/components/OrgChartCompanySearchWrapper';
import { orgChartLinkedinCandidateSourceState } from '@/orgchart/states/orgChartLinkedInCandidateSourceState';
import { useGetResourceCreditUsage } from '@/settings/billing/hooks/useGetResourceCreditUsage';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';

const StyledCompanySearchWrapper = styled.div`
  flex: 0 1 420px;
  left: 0;
  margin-inline: auto;
  max-width: 420px;
  min-width: 350px;
  pointer-events: none;
  position: absolute;
  right: 0;
  width: min(420px, 100%);
  z-index: 1;

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
  align-items: center;
  display: flex;
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
  overflow: visible;
  padding: 12px 24px;
  position: relative;

  /* Single horizontal row: title (left) | search (center) | buttons (right) */
  & > div {
    align-items: center;
    display: flex;
    flex-wrap: nowrap;
    position: relative;
  }
  & > div > div:first-of-type {
    flex: 0 1 auto;
    min-width: 0;
    width: auto;
  }
  & > div > div:last-of-type {
    align-items: center;
    display: flex;
    flex: 1 1 auto;
    flex-direction: row;
    flex-wrap: nowrap;
    gap: ${themeCssVariables.spacing[2]};
    justify-content: flex-end;
    min-width: 0;
    position: relative;
  }

  @media (max-width: 768px) {
    padding: 8px 16px;
  }
`;

const StyledCreditsAlert = styled.div`
  align-items: center;
  background-color: ${themeCssVariables.color.red};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.inverted};
  cursor: pointer;
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  gap: ${themeCssVariables.spacing[1]};
  margin-left: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  transition: all 0.2s ease-in-out;

  &:hover {
    opacity: 0.9;
  }

  svg {
    color: ${themeCssVariables.font.color.inverted};
    height: 16px;
    width: 16px;
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
  apiCredits?: number;
  revealCreditsAsEmailEquivalent?: number;
  revealCreditsAsPhoneEquivalent?: number;
  emailRevealCost?: number;
  phoneRevealCost?: number;
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
  apiCredits,
  revealCreditsAsEmailEquivalent,
  revealCreditsAsPhoneEquivalent,
  emailRevealCost,
  phoneRevealCost,
  onMergeJobs,
  isMergeMode,
  onMergeModeCancel,
  mergeSelectedCount = 0,
  onMergeSelected,
}: CandidateTablePageHeaderProps) => {
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const { t } = useLingui();
  const orgChartLinkedinCandidateSource = useAtomStateValue(
    orgChartLinkedinCandidateSourceState,
  );

  const {
    isGetResourceCreditUsageQueryLoaded,
    hasResourceCreditUsage,
    getResourceCreditUsage,
  } = useGetResourceCreditUsage();
  let aiCreditsDisplay: number | undefined;
  if (isGetResourceCreditUsageQueryLoaded && hasResourceCreditUsage) {
    try {
      const usage = getResourceCreditUsage();
      const available =
        (usage.totalGrantedCredits ?? 0) - (usage.usedCredits ?? 0);
      aiCreditsDisplay = Math.max(0, Math.round(available / 1_000_000));
    } catch {
      aiCreditsDisplay = undefined;
    }
  }

  const companySearchDisabledByUnipile =
    orgChartLinkedinCandidateSource === 'unipile' && !isLinkedinConnected;
  const companySearchDisabled = !hasToken;
  const companySearchTitle = companySearchDisabledByUnipile
    ? t`Connect LinkedIn (Unipile) before searching companies for org charts`
    : undefined;

  return (
    <>
      <InformationBannerChromeExtensionNotInstalled
        isExtensionInstalled={isExtensionInstalled}
        isChecking={isExtensionChecking}
      />
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
          mapCredits={orgChartCredits}
          revealCredits={revealCredits}
          apiCredits={apiCredits}
          aiCredits={aiCreditsDisplay}
          onCreditsClick={
            orgChartCredits !== undefined
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
          apiCredits={apiCredits}
          revealCreditsAsEmailEquivalent={revealCreditsAsEmailEquivalent}
          revealCreditsAsPhoneEquivalent={revealCreditsAsPhoneEquivalent}
          emailRevealCost={emailRevealCost}
          phoneRevealCost={phoneRevealCost}
          aiCredits={aiCreditsDisplay}
        />
      )}
    </>
  );
};
