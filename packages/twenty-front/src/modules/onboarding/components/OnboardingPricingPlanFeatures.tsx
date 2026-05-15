import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import {
    getInheritedFeatures,
    getPricingPlanOwnFeatures,
    PRICING_PLAN_CONTENT_BY_ID,
    type PricingPlanId,
    type PricingSegmentTone,
} from 'twenty-shared';
import { IconCheck, ThemeType } from 'twenty-ui';

type OnboardingPricingPlanFeaturesLayout = 'grid' | 'column';

type OnboardingPricingPlanFeaturesProps = {
  planId: PricingPlanId;
  layout?: OnboardingPricingPlanFeaturesLayout;
  showInheritedLine?: boolean;
};

const getSegmentAccentColor = (theme: ThemeType, tone: PricingSegmentTone) => {
  switch (tone) {
    case 'orange':
      return theme.color.orange60;
    case 'indigo':
      return theme.color.blue60;
    case 'teal':
      return theme.color.turquoise60;
    case 'forest':
      return theme.color.green70;
  }
};

const StyledFeatureGrid = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  display: grid;
  gap: ${({ theme }) => theme.spacing(2)};
  grid-template-columns: repeat(2, minmax(0, 1fr));
  line-height: 1.6;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const StyledFeatureColumn = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  flex-direction: column;
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.md};
  gap: ${({ theme }) => theme.spacing(1.5)};
  line-height: 1.6;
`;

const StyledFeatureItem = styled.div`
  align-items: flex-start;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledCheckIcon = styled(IconCheck)<{ $accentColor: string }>`
  color: ${({ $accentColor }) => $accentColor};
  flex-shrink: 0;
  margin-top: 2px;
`;

const StyledInheritedLine = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  grid-column: 1 / -1;
  line-height: 1.5;
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

export const OnboardingPricingPlanFeatures = ({
  planId,
  layout = 'grid',
  showInheritedLine = false,
}: OnboardingPricingPlanFeaturesProps) => {
  const theme = useTheme();
  const features = getPricingPlanOwnFeatures(planId);
  const inherited = getInheritedFeatures(planId);
  const segmentTone = PRICING_PLAN_CONTENT_BY_ID[planId].segmentTone;
  const accentColor = getSegmentAccentColor(theme, segmentTone);
  const FeatureContainer =
    layout === 'column' ? StyledFeatureColumn : StyledFeatureGrid;

  return (
    <FeatureContainer>
      {showInheritedLine && inherited.inheritedFromLabel && (
        <StyledInheritedLine>
          Everything in {inherited.inheritedFromLabel}, plus:
        </StyledInheritedLine>
      )}
      {features.map((feature) => (
        <StyledFeatureItem key={feature}>
          <StyledCheckIcon size={18} stroke={2.5} $accentColor={accentColor} />
          {feature}
        </StyledFeatureItem>
      ))}
    </FeatureContainer>
  );
};
