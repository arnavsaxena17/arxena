import styled from '@emotion/styled';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  convertPricingAmountSubunits,
  getPricingCurrencySymbol,
  getSmallPaymentTestCreditPackKey,
  PRICING_MARKETING_HERO_HEADLINE,
  PRICING_MARKETING_HERO_SUBHEADLINE,
  PRICING_PLANS,
  PricingPlanId,
  PricingPlanTier,
  CreditPack as SharedCreditPack,
  SMALL_PAYMENT_TEST_VOLUME_SELECTOR_VALUE,
  SUPPORTED_PRICING_CURRENCIES,
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
  Section,
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
  setDisplayCurrency: (currency: SupportedPricingCurrency) => void;
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

const StyledPricingHero = styled.div`
  margin: 0 auto ${({ theme }) => theme.spacing(4)};
  max-width: ${({ theme }) => theme.spacing(220)};
  text-align: center;
`;

const StyledPricingHeadline = styled.h2`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xxl};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  line-height: 1.2;
  margin: 0 0 ${({ theme }) => theme.spacing(2)} 0;

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    font-size: ${({ theme }) => theme.font.size.xxl};
  }
`;

const StyledPricingSubheadline = styled.p`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.md};
  line-height: ${({ theme }) => theme.text.lineHeight.lg};
  margin: 0;
  white-space: pre-line;
`;

const StyledPricingControls = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledCurrencySelect = styled.select`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  margin: 0 auto ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => `${theme.spacing(1)} ${theme.spacing(2)}`};
`;

const StyledBillingCard = styled(Card)`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.md};
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const StyledCreditCardsGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(6)};
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: ${({ theme }) => theme.spacing(4)};

  @media (max-width: 1400px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    gap: ${({ theme }) => theme.spacing(4)};
    grid-template-columns: 1fr;
  }
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

const StyledCreditPackCardContent = styled(CardContent)`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  min-width: 0;
  padding: ${({ theme }) => theme.spacing(5)};
`;

const StyledCreditCardTitle = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledCreditCardPrice = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xxl};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  line-height: 1.1;
`;

const StyledPriceUnit = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.regular};
`;

const StyledCreditCardCredits = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledCreditCardTotal = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledIncludedRevealCredits = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
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
  gap: ${({ theme }) => theme.spacing(3)};
  line-height: ${({ theme }) => theme.text.lineHeight.lg};
  margin-bottom: ${({ theme }) => theme.spacing(3)};

  &:last-of-type {
    margin-bottom: 0;
  }
`;

const StyledCheckIcon = styled(IconCheck)`
  color: ${({ theme }) => theme.font.color.primary};
  flex-shrink: 0;
  margin-top: ${({ theme }) => theme.spacing(0.5)};
`;

const StyledCreditActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: auto;
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

const StyledSmallPaymentTestBanner = styled.div`
  background: ${({ theme }) => theme.background.tertiary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: ${({ theme }) => theme.text.lineHeight.lg};
  margin-bottom: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(3)}`};
`;

const StyledCardPaymentDisabledState = styled.div`
  background: ${({ theme }) => theme.background.tertiary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(2)};
`;

const planOrder: PricingPlanId[] = [
  'sales',
  'recruitment',
  'corporate',
  'investment',
];

const findTier = (planId: PricingPlanId, maps: number): PricingPlanTier => {
  const plan = PRICING_PLANS[planId];
  const exact = plan.tiers.find((tier) => tier.maps === maps);
  return exact ?? plan.tiers[0];
};

export const SettingsBillingPricing = ({
  creditPacks,
  displayCurrency,
  setDisplayCurrency,
  selectedMapsByPlan,
  setSelectedMapsByPlan,
  sharedPackMetaByKey,
  resolvePackPriceSubunits,
  buyingPackKey,
  handleBuyCredits,
  setInvoicePackKey,
}: SettingsBillingPricingProps) => {
  const { t } = useLingui();

  const smallPaymentTestPacksAvailable = planOrder.every((planId) =>
    creditPacks.some((p) => p.key === getSmallPaymentTestCreditPackKey(planId)),
  );

  return (
    <Section>
      <StyledPricingHero>
        <StyledPricingHeadline>
          {PRICING_MARKETING_HERO_HEADLINE}
        </StyledPricingHeadline>
        <StyledPricingSubheadline>
          {PRICING_MARKETING_HERO_SUBHEADLINE}
        </StyledPricingSubheadline>
      </StyledPricingHero>
      {smallPaymentTestPacksAvailable && (
        <StyledSmallPaymentTestBanner>
          <Trans>
            Small payment testing: use Volume → “$1 payment test” for an extra
            ~$1 SKU (1 org-chart + 1 reveal credit) per plan. Regular map tiers
            and prices are unchanged. Disable SMALL_PAYMENT_TESTING on the
            server outside staging.
          </Trans>
        </StyledSmallPaymentTestBanner>
      )}
      <StyledPricingControls>
        <StyledCurrencySelect
          aria-label="Select currency"
          value={displayCurrency}
          onChange={(event) =>
            setDisplayCurrency(event.target.value as SupportedPricingCurrency)
          }
        >
          {SUPPORTED_PRICING_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </StyledCurrencySelect>
      </StyledPricingControls>
      <StyledCreditCardsGrid>
        {planOrder.map((planId) => {
          const plan = PRICING_PLANS[planId];
          const smallPackKey = getSmallPaymentTestCreditPackKey(planId);
          const hasSmallPaymentPack = creditPacks.some(
            (p) => p.key === smallPackKey,
          );
          const rawVolume = selectedMapsByPlan[planId] ?? plan.minMaps;
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
          const tier = findTier(planId, tierMaps);
          const regularPackKey = `${planId}_maps_${tier.maps}`;
          const packKey = isSmallPaymentSelection
            ? smallPackKey
            : regularPackKey;
          const apiPack = creditPacks.find((p) => p.key === packKey);
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
          const mapsCount = pack.mapsCount ?? meta?.mapsCount;
          const totalSubunits = convertedAmountSubunits * (mapsCount ?? 1);
          const totalUsdSubunits = convertPricingAmountSubunits(
            totalSubunits,
            displayCurrency,
            'USD',
          );
          const shouldHideCardPayment = totalUsdSubunits > 5000 * 100;
          const totalAmount = baseAmount * (mapsCount ?? 1);

          const selectValue =
            selectedVolume === SMALL_PAYMENT_TEST_VOLUME_SELECTOR_VALUE &&
            hasSmallPaymentPack
              ? SMALL_PAYMENT_TEST_VOLUME_SELECTOR_VALUE
              : tier.maps;

          return (
            <StyledBillingCard key={`${planId}-${pack.key}`} fullWidth rounded>
              <StyledCreditPackCardContent>
                <StyledCreditCardTitle>
                  {meta?.name ?? pack.name}
                </StyledCreditCardTitle>
                <StyledCreditCardPrice>
                  {getPricingCurrencySymbol(displayCurrency)}
                  {baseAmount.toLocaleString()}
                  <StyledPriceUnit> / {t`talent map`}</StyledPriceUnit>
                </StyledCreditCardPrice>
                {mapsCount !== undefined && (
                  <StyledCreditCardTotal>
                    {t`Total`}: {getPricingCurrencySymbol(displayCurrency)}
                    {totalAmount.toLocaleString()} / {mapsCount} {t`maps`}
                  </StyledCreditCardTotal>
                )}
                <StyledCreditCardCredits>
                  {creditsLabel}
                </StyledCreditCardCredits>
                <StyledTierSelectWrap>
                  <StyledTierSelectLabel htmlFor={`tier-${planId}`}>
                    {t`Volume`}
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
                        {planTier.maps} {t`maps`}
                      </option>
                    ))}
                    {hasSmallPaymentPack && (
                      <option value={SMALL_PAYMENT_TEST_VOLUME_SELECTOR_VALUE}>
                        {t`$1 payment test`} ({t`1 map`}, {t`1 credit`})
                      </option>
                    )}
                  </StyledTierSelect>
                </StyledTierSelectWrap>
                <StyledIncludedRevealCredits>
                  {t`Includes`} {includedEmail.toLocaleString()}{' '}
                  {t`email credits`} + {includedPhone.toLocaleString()}{' '}
                  {t`phone reveals`}
                </StyledIncludedRevealCredits>
                <StyledPanelDivider />
                <StyledFeatureList>
                  {features.map((feature) => (
                    <StyledFeatureItem key={feature}>
                      <StyledCheckIcon size={20} strokeWidth={2.5} />
                      {feature}
                    </StyledFeatureItem>
                  ))}
                </StyledFeatureList>
                <StyledCreditActions>
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
              </StyledCreditPackCardContent>
            </StyledBillingCard>
          );
        })}
      </StyledCreditCardsGrid>
    </Section>
  );
};
