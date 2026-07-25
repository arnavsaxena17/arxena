import { useQuery } from '@apollo/client/react';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { styled } from '@linaria/react';

import { CreditHistoryModal } from '@/billing/components/CreditHistoryModal';
import { WORKSPACE_CREDITS } from '@/billing/graphql/workspaceCredits';
import {
  StyledSettingsBillingCard,
  StyledSettingsBillingCardHeader,
} from '@/settings/billing/components/internal/SettingsBillingCard';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { H2Title } from 'twenty-ui/typography';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledBalances = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledBalanceItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  min-width: 140px;
`;

const StyledBalanceLabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledBalanceValue = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledCardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[3]};
`;

type WorkspaceCreditsQuery = {
  workspaceCredits?: {
    orgChartCredits: number;
    revealCredits: number;
    revealCreditsAsEmailEquivalent: number;
    revealCreditsAsPhoneEquivalent: number;
    emailRevealCost: number;
    phoneRevealCost: number;
  };
};

export const SettingsBillingMapsRevealsSection = () => {
  const { t } = useLingui();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const { data: creditsData } =
    useQuery<WorkspaceCreditsQuery>(WORKSPACE_CREDITS);

  const credits = creditsData?.workspaceCredits;

  return (
    <Section>
      <H2Title
        title={t`Talent maps & contact reveals`}
        description={t`Prepaid balances for org charts and contact reveals. Separate from AI credits.`}
      />
      <StyledSettingsBillingCard>
        <StyledSettingsBillingCardHeader>
          {t`Current balances`}
        </StyledSettingsBillingCardHeader>
        <StyledBalances>
          <StyledBalanceItem>
            <StyledBalanceLabel>{t`Map credits`}</StyledBalanceLabel>
            <StyledBalanceValue>
              {credits?.orgChartCredits ?? 0}
            </StyledBalanceValue>
          </StyledBalanceItem>
          <StyledBalanceItem>
            <StyledBalanceLabel>{t`Reveal credits`}</StyledBalanceLabel>
            <StyledBalanceValue>
              {credits?.revealCredits ?? 0}
            </StyledBalanceValue>
          </StyledBalanceItem>
          <StyledBalanceItem>
            <StyledBalanceLabel>{t`≈ Emails / phones`}</StyledBalanceLabel>
            <StyledBalanceValue>
              {credits?.revealCreditsAsEmailEquivalent ?? 0} /{' '}
              {credits?.revealCreditsAsPhoneEquivalent ?? 0}
            </StyledBalanceValue>
          </StyledBalanceItem>
        </StyledBalances>
        <StyledCardBody>
          <Button
            title={t`View credit history`}
            onClick={() => setIsHistoryOpen(true)}
            variant="secondary"
          />
        </StyledCardBody>
      </StyledSettingsBillingCard>

      {isHistoryOpen && credits && (
        <CreditHistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          orgChartCredits={credits.orgChartCredits}
          revealCredits={credits.revealCredits}
          emailRevealCost={credits.emailRevealCost}
          phoneRevealCost={credits.phoneRevealCost}
        />
      )}
    </Section>
  );
};
