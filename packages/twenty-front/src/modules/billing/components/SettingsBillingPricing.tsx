import { styled } from '@linaria/react';
import { Button } from 'twenty-ui/input';
import { Card, CardContent } from 'twenty-ui/surfaces';
import { Pill } from 'twenty-ui/data-display';
import { Section } from 'twenty-ui/layout';
import { MOBILE_VIEWPORT, themeCssVariables } from 'twenty-ui/theme-constants';
import { IconCheck, IconCreditCard, IconFileText } from 'twenty-ui/icon';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import {
  FREEMIUM_PLAN_ORDER,
  FREEMIUM_PLANS,
  FREEMIUM_SEAT_OPTIONS,
  PRICING_CTA_START_FOR_FREE,
  PRICING_MARKETING_HERO_HEADLINE,
  PRICING_PER_SEAT_MONTH_UNIT,
  PRICING_RECOMMENDED_FREEMIUM_PLAN_ID,
  PRICING_RECOMMENDED_PLAN_LABEL,
  PRICING_SEATS_LABEL,
  getFreemiumEntitlementsForSeats,
  getFreemiumMonthlyTotalSubunits,
  getPricingCurrencySymbol,
  getPricingMarketingSubheadlineLines,
  type FreemiumPlanId,
  type PricingSegmentTone,
  type SupportedPricingCurrency,
} from 'twenty-shared';

type SettingsBillingPricingProps = {
  displayCurrency: SupportedPricingCurrency;
  selectedSeatsByPlan: Record<FreemiumPlanId, number>;
  setSelectedSeatsByPlan: (
    fn: (
      previous: Record<FreemiumPlanId, number>,
    ) => Record<FreemiumPlanId, number>,
  ) => void;
  buyingPackKey: string | null;
  subscribingPlanId: string | null;
  handleSubscribeFreemium: (
    freemiumPlanId: FreemiumPlanId,
    seats: number,
  ) => void;
  handleBuyCredits: (
    creditPackKey: string,
    selectedCurrency: SupportedPricingCurrency,
    seats?: number,
  ) => void;
  setInvoicePackKey: (packKey: string) => void;
};

const getSegmentAccentColor = (tone: PricingSegmentTone) => {
  switch (tone) {
    case 'orange':
      return themeCssVariables.color.orange9;
    case 'indigo':
      return themeCssVariables.color.blue9;
    case 'teal':
      return themeCssVariables.color.turquoise9;
    case 'forest':
      return themeCssVariables.color.green9;
  }
};

// *3 tokens are light tints (readable with primary text); *10 are solid fills
const getSegmentAccentBackground = (tone: PricingSegmentTone) => {
  switch (tone) {
    case 'orange':
      return themeCssVariables.color.orange3;
    case 'indigo':
      return themeCssVariables.color.blue3;
    case 'teal':
      return themeCssVariables.color.turquoise3;
    case 'forest':
      return themeCssVariables.color.green3;
  }
};

const getSegmentAccentBorder = (tone: PricingSegmentTone) => {
  switch (tone) {
    case 'orange':
      return themeCssVariables.color.orange6;
    case 'indigo':
      return themeCssVariables.color.blue6;
    case 'teal':
      return themeCssVariables.color.turquoise6;
    case 'forest':
      return themeCssVariables.color.green6;
  }
};

const heroSubheadlineLines = getPricingMarketingSubheadlineLines();
const heroOrientLead = heroSubheadlineLines[0] ?? '';
const heroOrientDetail = heroSubheadlineLines[1] ?? '';

const StyledPricingHero = styled.div`
  margin: 0 auto ${themeCssVariables.spacing[4]};
  max-width: 880px;
  min-width: 0;
  text-align: center;
  width: 100%;
`;

const StyledPricingHeadline = styled.h2`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.xxl};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  line-height: 1.2;
  margin: 0 0 ${themeCssVariables.spacing[2]} 0;
  overflow-wrap: anywhere;
  text-wrap: balance;

  @media (max-width: 1100px) {
    font-size: ${themeCssVariables.font.size.xl};
  }

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    font-size: ${themeCssVariables.font.size.lg};
  }
`;

const StyledPricingOrientLead = styled.p`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.medium};
  line-height: ${themeCssVariables.text.lineHeight.lg};
  margin: 0 0 ${themeCssVariables.spacing[1]} 0;
  min-width: 0;
  overflow-wrap: anywhere;
  text-wrap: pretty;
  width: 100%;

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    font-size: ${themeCssVariables.font.size.md};
  }
`;

const StyledPricingOrientDetail = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.md};
  line-height: ${themeCssVariables.text.lineHeight.lg};
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
  text-wrap: pretty;
  width: 100%;

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    font-size: ${themeCssVariables.font.size.sm};
  }
`;

const StyledCreditCardsGrid = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[4]};
  // Settings content is ~760px — auto-fit so cards wrap instead of crushing into 4 cols
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  margin-left: auto;
  margin-right: auto;
  margin-top: ${themeCssVariables.spacing[4]};
  min-width: 0;
  width: 100%;

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    gap: ${themeCssVariables.spacing[3]};
    grid-template-columns: minmax(0, 1fr);
  }
`;

const StyledBillingCard = styled(Card)<{
  $isSelected: boolean;
  $tone: PricingSegmentTone;
}>`
  background-color: ${({ $isSelected, $tone }) =>
    $isSelected
      ? getSegmentAccentBackground($tone)
      : themeCssVariables.background.primary};
  border: 1px solid
    ${({ $isSelected, $tone }) =>
      $isSelected
        ? getSegmentAccentColor($tone)
        : themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  border-top: 3px solid ${({ $tone }) => getSegmentAccentColor($tone)};
  box-shadow: ${({ $isSelected }) =>
    $isSelected ? themeCssVariables.boxShadow.light : 'none'};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  transition:
    background-color ${themeCssVariables.animation.duration.normal}ms ease,
    border-color ${themeCssVariables.animation.duration.normal}ms ease,
    box-shadow ${themeCssVariables.animation.duration.normal}ms ease,
    transform ${themeCssVariables.animation.duration.normal}ms ease;

  &:hover {
    box-shadow: ${themeCssVariables.boxShadow.light};
    transform: translateY(-1px);
  }
`;
const StyledCreditPackCardContent = styled(CardContent)`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  min-width: 0;
  padding: ${themeCssVariables.spacing[4]};

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    padding: ${themeCssVariables.spacing[3]};
  }
`;

const StyledCardHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1.5]};
`;

const StyledCardLabel = styled.div<{ $tone: PricingSegmentTone }>`
  align-items: center;
  color: ${({ $tone }) => getSegmentAccentColor($tone)};
  display: flex;
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  gap: ${themeCssVariables.spacing[1.5]};
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

const StyledCardEmoji = styled.span`
  font-size: ${themeCssVariables.font.size.lg};
  line-height: 1;
`;

const StyledTitleRow = styled.div`
  align-items: flex-start;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
`;

const StyledCreditCardTitle = styled.h3`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  line-height: 1.3;
  margin: 0;
`;

const StyledPersonaPill = styled(Pill)<{ $tone: PricingSegmentTone }>`
  background: ${({ $tone }) => getSegmentAccentBackground($tone)};
  border: 1px solid ${({ $tone }) => getSegmentAccentBorder($tone)};
  color: ${({ $tone }) => getSegmentAccentColor($tone)};
  flex-shrink: 0;
`;

const StyledTierSelectWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledTierSelectLabel = styled.label`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

const StyledTierSelect = styled.select`
  appearance: none;
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[2]};
  width: 100%;

  &:disabled {
    color: ${themeCssVariables.font.color.primary};
    cursor: default;
    opacity: 1;
  }
`;

const StyledCreditCardPrice = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.xxl};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  line-height: 1.1;
`;

const StyledPriceUnit = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.regular};
`;

const StyledCreditCardTotal = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  min-height: ${themeCssVariables.font.size.md};
`;

const StyledPriceBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  min-height: 3.75rem;
`;

const StyledIncludedCreditsBlock = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  flex-direction: column;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledPanelDivider = styled.div`
  background: ${themeCssVariables.border.color.light};
  height: 1px;
  width: 100%;
`;

const StyledFeatureList = styled.ul`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1.5]};
  list-style: none;
  margin: 0;
  padding: 0;
`;

const StyledFeatureItem = styled.li`
  align-items: flex-start;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
  line-height: 1.45;
`;

const StyledCheckIcon = styled(IconCheck)<{ $tone: PricingSegmentTone }>`
  color: ${({ $tone }) => getSegmentAccentColor($tone)};
  flex-shrink: 0;
  margin-top: 2px;
`;

const StyledCreditActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: auto;
`;

const StyledActionsDivider = styled.div`
  background: ${themeCssVariables.border.color.light};
  height: 1px;
  width: 100%;
`;

const formatMoneyMajor = (subunits: number): string =>
  Math.round(subunits / 100).toLocaleString();

export const SettingsBillingPricing = ({
  displayCurrency,
  selectedSeatsByPlan,
  setSelectedSeatsByPlan,
  buyingPackKey,
  subscribingPlanId,
  handleSubscribeFreemium,
  handleBuyCredits,
  setInvoicePackKey,
}: SettingsBillingPricingProps) => {
  const { t } = useLingui();
  const [selectedPlanId, setSelectedPlanId] = useState<FreemiumPlanId>(
    PRICING_RECOMMENDED_FREEMIUM_PLAN_ID,
  );

  return (
    <Section>
      <StyledPricingHero>
        <StyledPricingHeadline>
          {PRICING_MARKETING_HERO_HEADLINE}
        </StyledPricingHeadline>
        <StyledPricingOrientLead>{heroOrientLead}</StyledPricingOrientLead>
        <StyledPricingOrientDetail>
          {heroOrientDetail}
        </StyledPricingOrientDetail>
      </StyledPricingHero>
      <StyledCreditCardsGrid>
        {FREEMIUM_PLAN_ORDER.map((planId) => {
          const plan = FREEMIUM_PLANS[planId];
          const tone = plan.segmentTone;
          const seats = plan.isFree ? 1 : selectedSeatsByPlan[planId];
          const perSeatSubunits = plan.pricesSubunitsPerSeat[displayCurrency];
          const totalSubunits = getFreemiumMonthlyTotalSubunits(
            planId,
            seats,
            displayCurrency,
          );
          const entitlements = getFreemiumEntitlementsForSeats(planId, seats);
          const isSelected = selectedPlanId === planId;
          const packKey = plan.subscriptionPackKey;
          const isBusy = buyingPackKey !== null || subscribingPlanId !== null;

          return (
            <StyledBillingCard
              key={planId}
              data-plan-id={planId}
              fullWidth
              rounded
              $isSelected={isSelected}
              $tone={tone}
              backgroundColor={
                isSelected
                  ? getSegmentAccentBackground(tone)
                  : themeCssVariables.background.primary
              }
              onClick={() => setSelectedPlanId(planId)}
            >
              <StyledCreditPackCardContent>
                <StyledCardHeader>
                  <StyledCardLabel $tone={tone}>
                    <StyledCardEmoji>{plan.icon}</StyledCardEmoji>
                    {plan.label}
                  </StyledCardLabel>
                  <StyledTitleRow>
                    <StyledCreditCardTitle>
                      {plan.tagline}
                    </StyledCreditCardTitle>
                    {planId === PRICING_RECOMMENDED_FREEMIUM_PLAN_ID ? (
                      <StyledPersonaPill
                        label={PRICING_RECOMMENDED_PLAN_LABEL}
                        $tone={tone}
                      />
                    ) : null}
                  </StyledTitleRow>
                </StyledCardHeader>

                <StyledTierSelectWrap
                  onClick={(event) => event.stopPropagation()}
                >
                  <StyledTierSelectLabel htmlFor={`seats-${planId}`}>
                    {PRICING_SEATS_LABEL}
                  </StyledTierSelectLabel>
                  {plan.isFree ? (
                    <StyledTierSelect
                      id={`seats-${planId}`}
                      value={1}
                      disabled
                      aria-label={t`1 seat included`}
                    >
                      <option value={1}>{t`1 seat`}</option>
                    </StyledTierSelect>
                  ) : (
                    <StyledTierSelect
                      id={`seats-${planId}`}
                      value={seats}
                      onChange={(event) => {
                        const nextSeats = parseInt(event.target.value, 10);
                        setSelectedSeatsByPlan((previous) => ({
                          ...previous,
                          [planId]: Number.isNaN(nextSeats)
                            ? plan.defaultSeats
                            : nextSeats,
                        }));
                      }}
                    >
                      {FREEMIUM_SEAT_OPTIONS.map((seatOption) => (
                        <option key={seatOption} value={seatOption}>
                          {seatOption} {seatOption === 1 ? t`seat` : t`seats`}
                        </option>
                      ))}
                    </StyledTierSelect>
                  )}
                </StyledTierSelectWrap>

                <StyledPriceBlock>
                  <StyledCreditCardPrice>
                    {plan.isFree ? (
                      <>
                        {getPricingCurrencySymbol(displayCurrency)}0
                        <StyledPriceUnit> / mo</StyledPriceUnit>
                      </>
                    ) : (
                      <>
                        {getPricingCurrencySymbol(displayCurrency)}
                        {formatMoneyMajor(perSeatSubunits)}
                        <StyledPriceUnit>
                          {' '}
                          {PRICING_PER_SEAT_MONTH_UNIT}
                        </StyledPriceUnit>
                      </>
                    )}
                  </StyledCreditCardPrice>
                  <StyledCreditCardTotal>
                    {t`Total`}: {getPricingCurrencySymbol(displayCurrency)}
                    {formatMoneyMajor(totalSubunits)} {t`/ mo for`} {seats}{' '}
                    {seats === 1 ? t`seat` : t`seats`}
                  </StyledCreditCardTotal>
                </StyledPriceBlock>

                <StyledIncludedCreditsBlock>
                  <div>
                    {entitlements.reveals.toLocaleString()} {t`reveals`} ·{' '}
                    {entitlements.apiCredits.toLocaleString()} API ·{' '}
                    {entitlements.aiCredits.toLocaleString()} AI / {t`month`}
                  </div>
                </StyledIncludedCreditsBlock>

                <StyledPanelDivider />
                <StyledFeatureList>
                  {plan.ownFeatures.map((feature) => (
                    <StyledFeatureItem key={feature}>
                      <StyledCheckIcon
                        $tone={tone}
                        size={18}
                        strokeWidth={2.5}
                      />
                      {feature}
                    </StyledFeatureItem>
                  ))}
                </StyledFeatureList>

                {isSelected && (
                  <StyledCreditActions
                    onClick={(event) => event.stopPropagation()}
                  >
                    {plan.isFree ? (
                      <Button
                        title={PRICING_CTA_START_FOR_FREE}
                        variant="secondary"
                        fullWidth
                        disabled
                      />
                    ) : (
                      <>
                        <Button
                          Icon={IconCreditCard}
                          title={t`Subscribe`}
                          variant="primary"
                          accent="blue"
                          fullWidth
                          onClick={() => handleSubscribeFreemium(planId, seats)}
                          disabled={isBusy}
                        />
                        {packKey ? (
                          <>
                            <StyledActionsDivider />
                            <Button
                              Icon={IconCreditCard}
                              title={t`Pay first month by card`}
                              variant="secondary"
                              fullWidth
                              onClick={() =>
                                handleBuyCredits(
                                  packKey,
                                  displayCurrency,
                                  seats,
                                )
                              }
                              disabled={isBusy}
                            />
                            <Button
                              Icon={IconFileText}
                              title={t`Create custom quote`}
                              variant="secondary"
                              fullWidth
                              onClick={() => setInvoicePackKey(packKey)}
                              disabled={isBusy}
                            />
                          </>
                        ) : null}
                      </>
                    )}
                  </StyledCreditActions>
                )}
              </StyledCreditPackCardContent>
            </StyledBillingCard>
          );
        })}
      </StyledCreditCardsGrid>
    </Section>
  );
};
