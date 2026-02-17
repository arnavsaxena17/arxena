import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { Button } from 'twenty-ui';

import {
    getPlanTierFromName,
    PLAN_FEATURES,
    type PlanFeatureGroup,
} from '../constants/billingPlanFeatures';
import type { EngagementPlan } from '../utils/getDisplayPlans';

import { LicenceQuantityStepper } from './LicenceQuantityStepper';

const StyledCard = styled.div<{ isHighlighted?: boolean }>`
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid
    ${({ theme, isHighlighted }) =>
      isHighlighted ? theme.border.color.strong : theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledPlanName = styled.div`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledPriceLine = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.md};
`;

const StyledLicenceRow = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledLicenceLabel = styled.label`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledFeatureList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledFeatureGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledFeatureGroupTitle = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledFeatureItem = styled.li`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding-left: ${({ theme }) => theme.spacing(2)};
  position: relative;

  &::before {
    content: '•';
    left: 0;
    position: absolute;
  }
`;

type BillingPlanCardProps = {
  plan: EngagementPlan;
  licenceQuantity: number;
  onLicenceQuantityChange: (value: number) => void;
  onSubscribe: () => void;
  isSubscribing: boolean;
  hasCurrentSubscription: boolean;
  isHighlighted?: boolean;
};

export const BillingPlanCard = ({
  plan,
  licenceQuantity,
  onLicenceQuantityChange,
  onSubscribe,
  isSubscribing,
  hasCurrentSubscription,
  isHighlighted = false,
}: BillingPlanCardProps) => {
  const { t } = useLingui();
  const tier = getPlanTierFromName(plan.name);
  const featureGroups: PlanFeatureGroup[] = PLAN_FEATURES[tier];

  return (
    <StyledCard isHighlighted={isHighlighted}>
      <StyledPlanName>{plan.name}</StyledPlanName>
      <StyledPriceLine>
        {plan.currency} {(plan.amount / 100).toFixed(2)} / {plan.period} ·{' '}
        {t`per licence`}
      </StyledPriceLine>
      <StyledLicenceRow>
        <StyledLicenceLabel>{t`Licences`}</StyledLicenceLabel>
        <LicenceQuantityStepper
          value={licenceQuantity}
          onChange={onLicenceQuantityChange}
          min={1}
          max={999}
          disabled={isSubscribing}
        />
      </StyledLicenceRow>
      {featureGroups?.length > 0 && (
        <StyledFeatureList>
          {featureGroups.map((group) => (
            <StyledFeatureGroup key={group.title}>
              <StyledFeatureGroupTitle>{group.title}</StyledFeatureGroupTitle>
              {group.items.map((item) => (
                <StyledFeatureItem key={item}>{item}</StyledFeatureItem>
              ))}
            </StyledFeatureGroup>
          ))}
        </StyledFeatureList>
      )}
      <Button
        title={hasCurrentSubscription ? t`Upgrade` : t`Subscribe`}
        variant="secondary"
        onClick={onSubscribe}
        disabled={isSubscribing}
      />
    </StyledCard>
  );
};
