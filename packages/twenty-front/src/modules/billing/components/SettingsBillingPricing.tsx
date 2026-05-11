import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import {
  convertPricingAmountSubunits,
  findPricingPlanTier,
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
import {
  Button,
  Card,
  CardContent,
  IconCheck,
  IconCreditCard,
  IconFileText,
  MOBILE_VIEWPORT,
  Pill,
  Section,
  ThemeType,
} from 'twenty-ui';

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

const getSegmentAccentBackground = (
  theme: ThemeType,
  tone: PricingSegmentTone,
) => {
  switch (tone) {
    case 'orange':
      return theme.color.orange10;
    case 'indigo':
      return theme.color.blue10;
    case 'teal':
      return theme.color.turquoise10;
    case 'forest':
      return theme.color.green10;
  }
};

const getSegmentAccentBorder = (
  theme: ThemeType,
  tone: PricingSegmentTone,
) => {
  switch (tone) {
    case 'orange':
      return theme.color.orange30;
    case 'indigo':
      return theme.color.blue30;
    case 'teal':
      return theme.color.turquoise30;
    case 'forest':
      return theme.color.gray50;
  }
};

const heroSubheadlineLines = getPricingMarketingSubheadlineLines();
const heroOrientLead = heroSubheadlineLines[0] ?? '';
const heroOrientDetail = heroSubheadlineLines[1] ?? '';

const StyledPricingHero = styled.div`
  margin: 0 auto ${({ theme }) => theme.spacing(4)};
  max-width: ${({ theme }) => theme.spacing(220)};
  min-width: 0;
  text-align: center;
  width: 100%;
`;

const StyledPricingHeadline = styled.h2`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xxl};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  line-height: 1.2;
  margin: 0 0 ${({ theme }) => theme.spacing(2)} 0;
  overflow-wrap: anywhere;
  text-wrap: balance;

  @media (max-width: 1100px) {
    font-size: ${({ theme }) => theme.font.size.xl};
  }

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    font-size: ${({ theme }) => theme.font.size.lg};
  }
`;

const StyledPricingOrientLead = styled.p`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  line-height: ${({ theme }) => theme.text.lineHeight.lg};
  margin: 0 0 ${({ theme }) => theme.spacing(1)} 0;
  min-width: 0;
  overflow-wrap: anywhere;
  text-wrap: pretty;
  width: 100%;

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    font-size: ${({ theme }) => theme.font.size.md};
  }
`;

const StyledPricingOrientDetail = styled.p`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.md};
  line-height: ${({ theme }) => theme.text.lineHeight.lg};
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
  text-wrap: pretty;
  width: 100%;

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    font-size: ${({ theme }) => theme.font.size.sm};
  }
`;

const StyledCreditCardsGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(4)};
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: ${({ theme }) => theme.spacing(4)};
  min-width: 0;
  width: 100%;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    gap: ${({ theme }) => theme.spacing(3)};
    grid-template-columns: minmax(0, 1fr);
  }
`;

const StyledBillingCard = styled(Card)<{
  $isSelected: boolean;
  $tone: PricingSegmentTone;
}>`
  background: ${({ theme, $tone }) =>
    getSegmentAccentBackground(theme, $tone)};
  border: 2px solid
    ${({ theme, $isSelected, $tone }) =>
      $isSelected
        ? getSegmentAccentColor(theme, $tone)
        : getSegmentAccentBorder(theme, $tone)};
  border-radius: ${({ theme }) => theme.border.radius.md};
  border-top: 4px solid
    ${({ theme, $tone }) => getSegmentAccentColor(theme, $tone)};
  box-shadow: ${({ theme, $isSelected }) =>
    $isSelected ? theme.boxShadow.strong : theme.boxShadow.light};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  opacity: ${({ $isSelected }) => ($isSelected ? 1 : 0.9)};
  transition:
    border-color ${({ theme }) => theme.animation.duration.normal}ms ease,
    box-shadow ${({ theme }) => theme.animation.duration.normal}ms ease,
    opacity ${({ theme }) => theme.animation.duration.normal}ms ease,
    transform ${({ theme }) => theme.animation.duration.normal}ms ease;

  &:hover {
    box-shadow: ${({ theme }) => theme.boxShadow.strong};
    transform: translateY(-2px);
  }
`;

const StyledCreditPackCardContent = styled(CardContent)`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  min-width: 0;
  padding: ${({ theme }) => theme.spacing(4)};

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    padding: ${({ theme }) => theme.spacing(3)};
  }
`;

const StyledCardHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1.5)};
`;

const StyledCardLabel = styled.div<{ $tone: PricingSegmentTone }>`
  align-items: center;
  color: ${({ theme, $tone }) => getSegmentAccentColor(theme, $tone)};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  gap: ${({ theme }) => theme.spacing(1.5)};
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

const StyledCardEmoji = styled.span`
  font-size: ${({ theme }) => theme.font.size.lg};
  line-height: 1;
`;

const StyledTitleRow = styled.div`
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1.5)};
`;

const StyledCreditCardTitle = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  line-height: 1.25;
  overflow-wrap: anywhere;
`;

const StyledPersonaPill = styled(Pill)<{ $tone: PricingSegmentTone }>`
  background: ${({ theme, $tone }) =>
    getSegmentAccentBackground(theme, $tone)};
  border: 1px solid ${({ theme, $tone }) => getSegmentAccentColor(theme, $tone)};
  color: ${({ theme, $tone }) => getSegmentAccentColor(theme, $tone)};
  height: auto;
  padding: ${({ theme }) => `${theme.spacing(0.5)} ${theme.spacing(2)}`};
`;

const StyledCardTagline = styled.p`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: ${({ theme }) => theme.text.lineHeight.lg};
  margin: 0;
  overflow-wrap: anywhere;
`;

const StyledMapTypePill = styled.div`
  align-self: flex-start;
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.pill};
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.xs};
  padding: ${({ theme }) => `${theme.spacing(0.5)} ${theme.spacing(2)}`};
`;

const StyledTierSelectWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledTierSelectLabel = styled.label`
  color: ${({ theme }) => theme.font.color.light};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

const StyledTierSelect = styled.select`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(2)}`};
  width: 100%;
`;

const StyledCreditCardPrice = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xl};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  line-height: 1.1;
  overflow-wrap: anywhere;
`;

const StyledPriceUnit = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.regular};
`;

const StyledCreditCardTotal = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledIncludedCreditsBlock = styled.div`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  flex-direction: column;
  font-size: ${({ theme }) => theme.font.size.sm};
  gap: ${({ theme }) => theme.spacing(1)};
  line-height: ${({ theme }) => theme.text.lineHeight.lg};
  padding: ${({ theme }) => theme.spacing(2.5)};
`;

const StyledIncludedRevealCredits = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
`;

const StyledChoiceHint = styled.div<{ $tone: PricingSegmentTone }>`
  background: ${({ theme }) => theme.background.primary};
  border-radius: ${({ theme }) => theme.border.radius.md};
  color: ${({ theme, $tone }) => getSegmentAccentColor(theme, $tone)};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  line-height: 1.45;
  margin-top: auto;
  padding: ${({ theme }) => theme.spacing(2)};
`;

const StyledInheritedLine = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledPanelDivider = styled.div`
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  margin: ${({ theme }) => theme.spacing(1)} 0;
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
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.sm};
  gap: ${({ theme }) => theme.spacing(2)};
  line-height: ${({ theme }) => theme.text.lineHeight.lg};
  margin-bottom: ${({ theme }) => theme.spacing(2)};

  &:last-of-type {
    margin-bottom: 0;
  }
`;

const StyledCheckIcon = styled(IconCheck)<{ $tone: PricingSegmentTone }>`
  color: ${({ theme, $tone }) => getSegmentAccentColor(theme, $tone)};
  flex-shrink: 0;
  margin-top: ${({ theme }) => theme.spacing(0.5)};
`;

const StyledCreditActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme }) => theme.spacing(1)};
`;

const StyledActionsDivider = styled.div`
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  margin: ${({ theme }) => theme.spacing(1)} 0;
  width: 100%;
`;

const StyledPaymentLimitHint = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  margin-top: ${({ theme }) => theme.spacing(1)};
`;

const StyledCardPaymentDisabledState = styled.div`
  background: ${({ theme }) => theme.background.tertiary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(2)};
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
          const fallbackPack = sharedPackMetaByKey.get(packKey);
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
          const { subunits: convertedAmountSubunits } =
            resolvePackPriceSubunits(pack, displayCurrency);
          const baseAmount = convertedAmountSubunits / 100;
          const defaultCreditsLabel = `${pack.credits.toLocaleString()} ${t`credits`}`;
          const creditsLabel =
            pack.creditsDisplay ?? meta?.creditsDisplay ?? defaultCreditsLabel;
          const features = pack.ownFeatures ?? meta?.features ?? [pack.name];
          const includedEmail =
            pack.includedEmailCredits ?? meta?.includedEmailCredits ?? 0;
          const includedPhone =
            pack.includedPhoneCredits ?? meta?.includedPhoneCredits ?? 0;
          const mapsCount = pack.mapsCount ?? meta?.mapsCount ?? tier.maps;
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
            pack.credits / REVEAL_CREDIT_COST_EMAIL,
          );
          const phoneEquivalent = Math.floor(
            pack.credits / REVEAL_CREDIT_COST_PHONE,
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
                    {t`phone reveals`}
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
