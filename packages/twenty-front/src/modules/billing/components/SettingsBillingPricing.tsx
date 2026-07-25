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
  convertPricingAmountSubunits,
  findPricingPlanTier,
  getCreditPackForPlanVolume,
  getInheritedFeatures,
  getPricingCurrencySymbol,
  getPricingMarketingSubheadlineLines,
  getSmallPaymentTestCreditPackKey,
  PRICING_COMPARABLE_MAPS_VOLUME,
  PRICING_MAP_TYPE_LABEL,
  PRICING_MARKETING_HERO_HEADLINE,
  PRICING_PLAN_CONTENT_BY_ID,
  PRICING_PLAN_ORDER,
  PRICING_PLANS,
  PRICING_RECOMMENDED_PLAN_ID,
  PRICING_TALENT_MAP_UNIT,
  PRICING_TALENT_MAPS_UNIT,
  PRICING_VOLUME_LABEL,
  PricingPlanId,
  PricingSegmentTone,
  REVEAL_CREDIT_COST_EMAIL,
  REVEAL_CREDIT_COST_PHONE,
  CreditPack as SharedCreditPack,
  SMALL_PAYMENT_TEST_VOLUME_SELECTOR_VALUE,
  SupportedPricingCurrency,
} from 'twenty-shared';

type CreditPack = {
  key: string;
  name: string;
  credits: number;
  amountSubunits: number;
  currency: string;
  planId?: string;
  intent?: string;
  mapsCount?: number;
  mapType?: string;
  mapTypeLabel?: string;
  tagline?: string;
  inheritedFromPlanId?: string | null;
  ownFeatures?: string[];
  includedEmailCredits?: number;
  includedPhoneCredits?: number;
  creditsDisplay?: string;
  pricesSubunitsJson?: string;
};

type ResolvePackPriceSubunitsResult = {
  subunits: number;
  isExplicit: boolean;
};

type SettingsBillingPricingProps = {
  creditPacks: CreditPack[];
  displayCurrency: SupportedPricingCurrency;
  selectedMapsByPlan: Record<PricingPlanId, number>;
  setSelectedMapsByPlan: (
    fn: (
      previous: Record<PricingPlanId, number>,
    ) => Record<PricingPlanId, number>,
  ) => void;
  sharedPackMetaByKey: Map<string, SharedCreditPack>;
  resolvePackPriceSubunits: (
    pack: CreditPack,
    targetCurrency: SupportedPricingCurrency,
  ) => ResolvePackPriceSubunitsResult;
  buyingPackKey: string | null;
  handleBuyCredits: (
    creditPackKey: string,
    selectedCurrency: SupportedPricingCurrency,
  ) => void;
  setInvoicePackKey: (packKey: string) => void;
};

const getSegmentAccentColor = (tone: PricingSegmentTone) => {
  switch (tone) {
    case 'orange':
      return themeCssVariables.color.orange60;
    case 'indigo':
      return themeCssVariables.color.blue60;
    case 'teal':
      return themeCssVariables.color.turquoise60;
    case 'forest':
      return themeCssVariables.color.green70;
  }
};

const getSegmentAccentBackground = (tone: PricingSegmentTone) => {
  switch (tone) {
    case 'orange':
      return themeCssVariables.color.orange10;
    case 'indigo':
      return themeCssVariables.color.blue10;
    case 'teal':
      return themeCssVariables.color.turquoise10;
    case 'forest':
      return themeCssVariables.color.green10;
  }
};

const getSegmentAccentBorder = (tone: PricingSegmentTone) => {
  switch (tone) {
    case 'orange':
      return themeCssVariables.color.orange30;
    case 'indigo':
      return themeCssVariables.color.blue30;
    case 'teal':
      return themeCssVariables.color.turquoise30;
    case 'forest':
      return themeCssVariables.color.gray50;
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: ${themeCssVariables.spacing[4]};
  min-width: 0;
  width: 100%;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    gap: ${themeCssVariables.spacing[3]};
    grid-template-columns: minmax(0, 1fr);
  }
`;

const StyledBillingCard = styled(Card)<{
  $isSelected: boolean;
  $tone: PricingSegmentTone;
}>`
  background: ${({ $tone }) => getSegmentAccentBackground($tone)};
  border: 2px solid
    ${({ $isSelected, $tone }) => $isSelected
        ? getSegmentAccentColor($tone)
        : getSegmentAccentBorder($tone)};
  border-radius: ${themeCssVariables.border.radius.md};
  border-top: 4px solid
    ${({ $tone }) => getSegmentAccentColor($tone)};
  box-shadow: ${({ $isSelected }) => $isSelected ? themeCssVariables.boxShadow.strong : themeCssVariables.boxShadow.light};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  opacity: ${({ $isSelected }) => ($isSelected ? 1 : 0.9)};
  transition:
    border-color ${themeCssVariables.animation.duration.normal}ms ease,
    box-shadow ${themeCssVariables.animation.duration.normal}ms ease,
    opacity ${themeCssVariables.animation.duration.normal}ms ease,
    transform ${themeCssVariables.animation.duration.normal}ms ease;

  &:hover {
    box-shadow: ${themeCssVariables.boxShadow.strong};
    transform: translateY(-2px);
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
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1.5]};
`;

const StyledCreditCardTitle = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  line-height: 1.25;
  overflow-wrap: anywhere;
`;

const StyledPersonaPill = styled(Pill)<{ $tone: PricingSegmentTone }>`
  background: ${({ $tone }) => getSegmentAccentBackground($tone)};
  border: 1px solid ${({ $tone }) => getSegmentAccentColor($tone)};
  color: ${({ $tone }) => getSegmentAccentColor($tone)};
  height: auto;
  padding: ${`${themeCssVariables.spacing[0.5]} ${themeCssVariables.spacing[2]}`};
`;

const StyledCardTagline = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: ${themeCssVariables.text.lineHeight.lg};
  margin: 0;
  overflow-wrap: anywhere;
`;

const StyledMapTypePill = styled.div`
  align-self: flex-start;
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.pill};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.xs};
  padding: ${`${themeCssVariables.spacing[0.5]} ${themeCssVariables.spacing[2]}`};
`;

const StyledTierSelectWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledTierSelectLabel = styled.label`
  color: ${themeCssVariables.font.color.light};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

const StyledTierSelect = styled.select`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${`${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[2]}`};
  width: 100%;
`;

const StyledCreditCardPrice = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.xl};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  line-height: 1.1;
  overflow-wrap: anywhere;
`;

const StyledPriceUnit = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.regular};
`;

const StyledCreditCardTotal = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
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
  line-height: ${themeCssVariables.text.lineHeight.lg};
  padding: 10px;
`;

const StyledIncludedRevealCredits = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledChoiceHint = styled.div<{ $tone: PricingSegmentTone }>`
  background: ${themeCssVariables.background.primary};
  border-radius: ${themeCssVariables.border.radius.md};
  color: ${({ $tone }) => getSegmentAccentColor($tone)};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  line-height: 1.45;
  margin-top: auto;
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledInheritedLine = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledPanelDivider = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.light};
  margin: ${themeCssVariables.spacing[1]} 0;
  width: 100%;
`;

const StyledFeatureList = styled.ul`
  flex: 1;
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
  line-height: ${themeCssVariables.text.lineHeight.lg};
  margin-bottom: ${themeCssVariables.spacing[2]};

  &:last-of-type {
    margin-bottom: 0;
  }
`;

const StyledCheckIcon = styled(IconCheck)<{ $tone: PricingSegmentTone }>`
  color: ${({ $tone }) => getSegmentAccentColor($tone)};
  flex-shrink: 0;
  margin-top: ${themeCssVariables.spacing[0.5]};
`;

const StyledCreditActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[1]};
`;

const StyledActionsDivider = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.light};
  margin: ${themeCssVariables.spacing[1]} 0;
  width: 100%;
`;

const StyledPaymentLimitHint = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  margin-top: ${themeCssVariables.spacing[1]};
`;

const StyledCardPaymentDisabledState = styled.div`
  background: ${themeCssVariables.background.tertiary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  padding: ${themeCssVariables.spacing[2]};
`;

const formatMoneyMajor = (subunits: number): string =>
  Math.round(subunits / 100).toLocaleString();

export const SettingsBillingPricing = ({
  creditPacks,
  displayCurrency,
  selectedMapsByPlan,
  setSelectedMapsByPlan,
  sharedPackMetaByKey,
  resolvePackPriceSubunits,
  buyingPackKey,
  handleBuyCredits,
  setInvoicePackKey,
}: SettingsBillingPricingProps) => {
  const { t } = useLingui();
  const [selectedPlanId, setSelectedPlanId] = useState<PricingPlanId>(
    PRICING_RECOMMENDED_PLAN_ID,
  );

  return (
    <Section>
      <StyledPricingHero>
        <StyledPricingHeadline>
          {PRICING_MARKETING_HERO_HEADLINE}
        </StyledPricingHeadline>
        <StyledPricingOrientLead>{heroOrientLead}</StyledPricingOrientLead>
        <StyledPricingOrientDetail>{heroOrientDetail}</StyledPricingOrientDetail>
      </StyledPricingHero>
      <StyledCreditCardsGrid>
        {PRICING_PLAN_ORDER.map((planId) => {
          const plan = PRICING_PLANS[planId];
          const planContent = PRICING_PLAN_CONTENT_BY_ID[planId];
          const tone = planContent.segmentTone;
          const smallPackKey = getSmallPaymentTestCreditPackKey(planId);
          const hasSmallPaymentPack = creditPacks.some(
            (pack) => pack.key === smallPackKey,
          );
          const rawVolume =
            selectedMapsByPlan[planId] ?? PRICING_COMPARABLE_MAPS_VOLUME;
          let selectedVolume = rawVolume;
          if (
            !hasSmallPaymentPack &&
            rawVolume === SMALL_PAYMENT_TEST_VOLUME_SELECTOR_VALUE
          ) {
            selectedVolume = plan.minMaps;
          }
          const isSmallPaymentSelection =
            hasSmallPaymentPack &&
            selectedVolume === SMALL_PAYMENT_TEST_VOLUME_SELECTOR_VALUE;
          const tierMaps = isSmallPaymentSelection
            ? plan.minMaps
            : selectedVolume;
          const tier = findPricingPlanTier(plan, tierMaps);
          const regularPackKey = `${planId}_maps_${tier.maps}`;
          const packKey = isSmallPaymentSelection
            ? smallPackKey
            : regularPackKey;
          const apiPack = creditPacks.find((pack) => pack.key === packKey);
          const fallbackPack =
            getCreditPackForPlanVolume(planId, tierMaps) ??
            sharedPackMetaByKey.get(packKey);
          const pack =
            apiPack ??
            (fallbackPack
              ? ({
                  key: fallbackPack.key,
                  name: fallbackPack.name,
                  credits: fallbackPack.credits,
                  amountSubunits: fallbackPack.amountSubunits,
                  currency: fallbackPack.currency,
                  planId: fallbackPack.planId,
                  intent: fallbackPack.intent,
                  mapsCount: fallbackPack.mapsCount,
                  mapType: fallbackPack.mapType,
                  mapTypeLabel: fallbackPack.mapTypeLabel,
                  tagline: fallbackPack.tagline,
                  inheritedFromPlanId: fallbackPack.inheritedFromPlanId,
                  ownFeatures: fallbackPack.features,
                  includedEmailCredits: fallbackPack.includedEmailCredits,
                  includedPhoneCredits: fallbackPack.includedPhoneCredits,
                  creditsDisplay: fallbackPack.creditsDisplay,
                  pricesSubunitsJson: JSON.stringify(
                    fallbackPack.pricesSubunits,
                  ),
                } as CreditPack)
              : null);

          if (!pack) {
            return null;
          }

          const meta = sharedPackMetaByKey.get(pack.key);
          const tierCredits = tier.credits;
          const mapsCount = tier.maps;
          const { subunits: convertedAmountSubunits } =
            resolvePackPriceSubunits(pack, displayCurrency);
          const baseAmount = convertedAmountSubunits / 100;
          const defaultCreditsLabel = `${tierCredits.toLocaleString()} ${t`credits`}`;
          const creditsLabel =
            pack.creditsDisplay ?? meta?.creditsDisplay ?? defaultCreditsLabel;
          const features = pack.ownFeatures ?? meta?.features ?? [pack.name];
          const includedEmail = tierCredits;
          const includedPhone = Math.floor(
            tierCredits / REVEAL_CREDIT_COST_PHONE,
          );
          const totalSubunits = convertedAmountSubunits * mapsCount;
          const totalUsdSubunits = convertPricingAmountSubunits(
            totalSubunits,
            displayCurrency,
            'USD',
          );
          const shouldHideCardPayment = totalUsdSubunits > 5000 * 100;
          const inherited = getInheritedFeatures(planId);
          const selectValue =
            selectedVolume === SMALL_PAYMENT_TEST_VOLUME_SELECTOR_VALUE &&
            hasSmallPaymentPack
              ? SMALL_PAYMENT_TEST_VOLUME_SELECTOR_VALUE
              : tier.maps;
          const emailEquivalent = Math.floor(
            tierCredits / REVEAL_CREDIT_COST_EMAIL,
          );
          const phoneEquivalent = Math.floor(
            tierCredits / REVEAL_CREDIT_COST_PHONE,
          );
          const isSelected = selectedPlanId === planId;

          return (
            <StyledBillingCard
              key={`${planId}-${pack.key}`}
              data-plan-id={planId}
              fullWidth
              rounded
              $isSelected={isSelected}
              $tone={tone}
              onClick={() => setSelectedPlanId(planId)}
            >
              <StyledCreditPackCardContent>
                <StyledCardHeader>
                  <StyledCardLabel $tone={tone}>
                    <StyledCardEmoji>{plan.icon}</StyledCardEmoji>
                    {plan.label}
                  </StyledCardLabel>
                  <StyledTitleRow>
                    <StyledCreditCardTitle>{plan.tagline}</StyledCreditCardTitle>
                    <StyledPersonaPill
                      label={planContent.persona}
                      $tone={tone}
                    />
                  </StyledTitleRow>
                  <StyledCardTagline>{plan.mapTypeLabel}</StyledCardTagline>
                </StyledCardHeader>
                <StyledMapTypePill>
                  {PRICING_MAP_TYPE_LABEL} · {plan.mapType}
                </StyledMapTypePill>
                <StyledTierSelectWrap
                  onClick={(event) => event.stopPropagation()}
                >
                  <StyledTierSelectLabel htmlFor={`tier-${planId}`}>
                    {PRICING_VOLUME_LABEL}
                  </StyledTierSelectLabel>
                  <StyledTierSelect
                    id={`tier-${planId}`}
                    value={selectValue}
                    onChange={(event) => {
                      const value = parseInt(event.target.value, 10);
                      let nextMaps = plan.minMaps;
                      if (value === SMALL_PAYMENT_TEST_VOLUME_SELECTOR_VALUE) {
                        nextMaps = SMALL_PAYMENT_TEST_VOLUME_SELECTOR_VALUE;
                      }
                      if (
                        value !== SMALL_PAYMENT_TEST_VOLUME_SELECTOR_VALUE &&
                        !Number.isNaN(value)
                      ) {
                        nextMaps = value;
                      }
                      setSelectedMapsByPlan((previous) => ({
                        ...previous,
                        [planId]: nextMaps,
                      }));
                    }}
                  >
                    {plan.tiers.map((planTier) => (
                      <option key={planTier.maps} value={planTier.maps}>
                        {planTier.maps} {PRICING_TALENT_MAPS_UNIT}
                      </option>
                    ))}
                    {hasSmallPaymentPack && (
                      <option value={SMALL_PAYMENT_TEST_VOLUME_SELECTOR_VALUE}>
                        {t`$1 payment test`} ({t`1 map`}, {t`1 credit`})
                      </option>
                    )}
                  </StyledTierSelect>
                </StyledTierSelectWrap>
                <StyledCreditCardPrice>
                  {getPricingCurrencySymbol(displayCurrency)}
                  {formatMoneyMajor(convertedAmountSubunits)}
                  <StyledPriceUnit>
                    {' '}
                    / {PRICING_TALENT_MAP_UNIT}
                  </StyledPriceUnit>
                </StyledCreditCardPrice>
                <StyledCreditCardTotal>
                  {t`Total`}: {getPricingCurrencySymbol(displayCurrency)}
                  {formatMoneyMajor(totalSubunits)} {t`for`} {mapsCount}{' '}
                  {t`maps`}
                </StyledCreditCardTotal>
                <StyledIncludedCreditsBlock>
                  <div>{creditsLabel}</div>
                  <StyledIncludedRevealCredits>
                    {t`Includes`} {emailEquivalent.toLocaleString()}{' '}
                    {t`email credits`} + {phoneEquivalent.toLocaleString()}{' '}
                    {t`phone reveals`} + 1000
                    {t`AI Conversations Credits`}
                  </StyledIncludedRevealCredits>
                </StyledIncludedCreditsBlock>
                {inherited.inheritedFromLabel && (
                  <StyledInheritedLine>
                    {t`Everything in ${inherited.inheritedFromLabel}, plus:`}
                  </StyledInheritedLine>
                )}
                <StyledPanelDivider />
                <StyledFeatureList>
                  {features.map((feature) => (
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
                <StyledChoiceHint $tone={tone}>
                  {planContent.onboardingHint}
                </StyledChoiceHint>
                {isSelected && (
                  <StyledCreditActions
                    onClick={(event) => event.stopPropagation()}
                  >
                    {shouldHideCardPayment ? (
                      <StyledCardPaymentDisabledState>
                        <Button
                          Icon={IconCreditCard}
                          title={t`Pay by credit card`}
                          variant="secondary"
                          fullWidth
                          onClick={() =>
                            handleBuyCredits(pack.key, displayCurrency)
                          }
                          disabled
                        />
                        <StyledPaymentLimitHint>
                          {t`Credit card payments are available only below $5,000 total.`}
                        </StyledPaymentLimitHint>
                      </StyledCardPaymentDisabledState>
                    ) : (
                      <Button
                        Icon={IconCreditCard}
                        title={t`Pay by credit card`}
                        variant="primary"
                        accent="blue"
                        fullWidth
                        onClick={() =>
                          handleBuyCredits(pack.key, displayCurrency)
                        }
                        disabled={buyingPackKey !== null}
                      />
                    )}
                    <StyledActionsDivider />
                    <Button
                      Icon={IconFileText}
                      title={t`Create custom quote`}
                      variant="secondary"
                      fullWidth
                      onClick={() => setInvoicePackKey(pack.key)}
                    />
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
