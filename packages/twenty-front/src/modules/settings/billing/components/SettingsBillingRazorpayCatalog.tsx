import { useMutation, useQuery } from '@apollo/client/react';
import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { useCallback, useEffect, useState } from 'react';
import {
  buildClientGeoHeaders,
  buildComparableMapsByPlan,
  convertPricingAmountSubunits,
  CREDIT_PACKS_BY_INTENT,
  getOrFetchClientGeoSession,
  PRICING_PLAN_ORDER,
  PRICING_PLANS,
  SMALL_PAYMENT_TEST_VOLUME_SELECTOR_VALUE,
  SUPPORTED_PRICING_CURRENCIES,
  type CreditPack as SharedCreditPack,
  type SupportedPricingCurrency,
} from 'twenty-shared';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath, isDefined } from 'twenty-shared/utils';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { H2Title } from 'twenty-ui/typography';

import { currentUserState } from '@/auth/states/currentUserState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { InvoiceRequestModal } from '@/billing/components/InvoiceRequestModal';
import { SettingsBillingPricing } from '@/billing/components/SettingsBillingPricing';
import { CHECKOUT_SESSION } from '@/billing/graphql/checkoutSession';
import { CREATE_RAZORPAY_ORDER_FOR_CREDITS } from '@/billing/graphql/createRazorpayOrderForCredits';
import { CREDIT_PACKS } from '@/billing/graphql/creditPacks';
import { ENGAGEMENT_PLANS } from '@/billing/graphql/engagementPlans';
import { REQUEST_INVOICE_FOR_CREDITS } from '@/billing/graphql/requestInvoiceForCredits';
import { REQUEST_PRICING_CURRENCY } from '@/billing/graphql/requestPricingCurrency';
import { TextInput } from '@/ui/input/components/TextInput';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import {
  BillingPlanKey,
  SubscriptionInterval,
} from '~/generated-metadata/graphql';

type EngagementPlan = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  period: string;
  interval: number;
};

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

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

const StyledPlansGrid = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[3]};
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
`;

const StyledPlanCard = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledPlanName = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledPlanMeta = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledLicenceRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledLicenceLabel = styled.label`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  white-space: nowrap;
`;

const loadRazorpayCheckoutScript = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (isDefined(window.Razorpay)) {
      resolve();

      return;
    }

    const script = document.createElement('script');

    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay Checkout'));
    document.body.appendChild(script);
  });

export const SettingsBillingRazorpayCatalog = () => {
  const { t } = useLingui();
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const currentWorkspace = useAtomStateValue(currentWorkspaceState);
  const currentUser = useAtomStateValue(currentUserState);

  const [displayCurrency, setDisplayCurrency] =
    useState<SupportedPricingCurrency>('USD');
  const [selectedMapsByPlan, setSelectedMapsByPlan] = useState(
    buildComparableMapsByPlan,
  );
  const [planQuantities, setPlanQuantities] = useState<Record<string, number>>(
    {},
  );
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(
    null,
  );
  const [buyingPackKey, setBuyingPackKey] = useState<string | null>(null);
  const [invoicePackKey, setInvoicePackKey] = useState<string | null>(null);
  const [pricingGeoHeaders, setPricingGeoHeaders] = useState<
    Record<string, string>
  >({});

  const { data: engagementPlansData } = useQuery<{
    engagementPlans?: EngagementPlan[];
  }>(ENGAGEMENT_PLANS);
  const engagementPlans = engagementPlansData?.engagementPlans ?? [];

  const { data: creditPacksData } = useQuery<{ creditPacks?: CreditPack[] }>(
    CREDIT_PACKS,
  );
  const creditPacks = creditPacksData?.creditPacks ?? [];

  const { data: requestPricingCurrencyData, refetch: refetchPricingCurrency } =
    useQuery<{ requestPricingCurrency?: string }>(REQUEST_PRICING_CURRENCY, {
      context: {
        headers: pricingGeoHeaders,
      },
    });

  const [checkoutSessionMutation] = useMutation(CHECKOUT_SESSION);
  const [createRazorpayOrderMutation] = useMutation(
    CREATE_RAZORPAY_ORDER_FOR_CREDITS,
  );
  const [requestInvoiceMutation] = useMutation(REQUEST_INVOICE_FOR_CREDITS);

  useEffect(() => {
    void getOrFetchClientGeoSession().then((session) => {
      setPricingGeoHeaders(buildClientGeoHeaders(session));
    });
  }, []);

  useEffect(() => {
    if (Object.keys(pricingGeoHeaders).length === 0) {
      return;
    }
    void refetchPricingCurrency();
  }, [pricingGeoHeaders, refetchPricingCurrency]);

  useEffect(() => {
    setSelectedMapsByPlan((previous) => {
      let changed = false;
      const next = { ...previous };

      for (const planId of PRICING_PLAN_ORDER) {
        const plan = PRICING_PLANS[planId];
        const raw = next[planId];

        if (
          raw === undefined ||
          raw === SMALL_PAYMENT_TEST_VOLUME_SELECTOR_VALUE
        ) {
          continue;
        }

        if (!plan.tiers.some((tier) => tier.maps === raw)) {
          next[planId] = plan.minMaps;
          changed = true;
        }
      }

      return changed ? next : previous;
    });
  }, []);

  useEffect(() => {
    const resolvedCurrency =
      requestPricingCurrencyData?.requestPricingCurrency;

    if (
      isDefined(resolvedCurrency) &&
      SUPPORTED_PRICING_CURRENCIES.includes(
        resolvedCurrency as SupportedPricingCurrency,
      )
    ) {
      setDisplayCurrency(resolvedCurrency as SupportedPricingCurrency);
    }
  }, [requestPricingCurrencyData]);

  const sharedPackMetaByKey = (() => {
    const allPacks: SharedCreditPack[] = Object.values(
      CREDIT_PACKS_BY_INTENT,
    ).flat();

    return new Map(allPacks.map((pack) => [pack.key, pack]));
  })();

  const resolvePackPriceSubunits = (
    pack: CreditPack,
    targetCurrency: SupportedPricingCurrency,
  ): { subunits: number; isExplicit: boolean } => {
    const packPricesJson = pack.pricesSubunitsJson;

    if (typeof packPricesJson === 'string' && packPricesJson.length > 0) {
      try {
        const parsed = JSON.parse(packPricesJson) as Partial<
          Record<SupportedPricingCurrency, number>
        >;
        const explicit = parsed[targetCurrency];

        if (typeof explicit === 'number' && explicit > 0) {
          return { subunits: explicit, isExplicit: true };
        }
      } catch {
        // fall through to conversion
      }
    }

    const meta = sharedPackMetaByKey.get(pack.key);
    const explicit = meta?.pricesSubunits?.[targetCurrency];

    if (typeof explicit === 'number' && explicit > 0) {
      return { subunits: explicit, isExplicit: true };
    }

    const sourceCurrency: SupportedPricingCurrency =
      pack.currency === 'INR' ||
      pack.currency === 'USD' ||
      pack.currency === 'GBP' ||
      pack.currency === 'EUR' ||
      pack.currency === 'AUD' ||
      pack.currency === 'AED'
        ? (pack.currency as SupportedPricingCurrency)
        : 'GBP';

    return {
      subunits: convertPricingAmountSubunits(
        pack.amountSubunits,
        sourceCurrency,
        targetCurrency,
      ),
      isExplicit: false,
    };
  };

  const loadRazorpayAndOpenSubscription = useCallback(
    async (keyId: string, subscriptionId: string, callbackUrl: string) => {
      await loadRazorpayCheckoutScript();

      if (!isDefined(window.Razorpay)) {
        throw new Error('Razorpay Checkout unavailable');
      }

      const razorpay = new window.Razorpay({
        key: keyId,
        subscription_id: subscriptionId,
        callback_url: callbackUrl,
        redirect: true,
        name: 'Arxena',
        description: 'Subscription',
      });

      razorpay.open();
    },
    [],
  );

  const handleSubscribePlan = useCallback(
    async (razorpayPlanId: string, quantity = 1) => {
      setSubscribingPlanId(razorpayPlanId);

      try {
        const billingPath = getSettingsPath(SettingsPath.Billing);
        const { data } = await checkoutSessionMutation({
          variables: {
            recurringInterval: SubscriptionInterval.Month,
            successUrlPath: billingPath,
            successReturnUrl: `${window.location.origin}${billingPath}`,
            plan: BillingPlanKey.PRO,
            requirePaymentMethod: true,
            razorpayPlanId,
            quantity: Math.max(1, quantity),
          },
        });
        const session = (
          data as {
            checkoutSession?: {
              url?: string | null;
              razorpaySubscriptionId?: string | null;
              razorpayKeyId?: string | null;
              razorpayCallbackUrl?: string | null;
            };
          }
        )?.checkoutSession;

        if (
          isDefined(session?.razorpaySubscriptionId) &&
          isDefined(session?.razorpayKeyId) &&
          isDefined(session?.razorpayCallbackUrl)
        ) {
          await loadRazorpayAndOpenSubscription(
            session.razorpayKeyId,
            session.razorpaySubscriptionId,
            session.razorpayCallbackUrl,
          );
        } else if (isDefined(session?.url) && session.url !== '') {
          window.open(session.url, '_blank', 'noopener,noreferrer');
          enqueueSuccessSnackBar({
            message: t`Complete payment in the new tab. Close that tab to return here.`,
          });
        } else {
          enqueueErrorSnackBar({
            message: t`Could not start checkout`,
          });
        }
      } catch (error) {
        enqueueErrorSnackBar({
          message:
            error instanceof Error ? error.message : t`Checkout failed`,
        });
      } finally {
        setSubscribingPlanId(null);
      }
    },
    [
      checkoutSessionMutation,
      enqueueErrorSnackBar,
      enqueueSuccessSnackBar,
      loadRazorpayAndOpenSubscription,
      t,
    ],
  );

  const handleBuyCredits = useCallback(
    async (
      creditPackKey: string,
      selectedCurrency: SupportedPricingCurrency,
    ) => {
      setBuyingPackKey(creditPackKey);

      try {
        const { data } = await createRazorpayOrderMutation({
          variables: {
            input: { creditPackKey, currency: selectedCurrency },
          },
        });
        const order = (
          data as {
            createRazorpayOrderForCredits?: {
              orderId: string;
              amount: number;
              currency: string;
              keyId: string;
            };
          }
        )?.createRazorpayOrderForCredits;

        if (!isDefined(order?.orderId) || !isDefined(order?.keyId)) {
          throw new Error('Order creation failed');
        }

        await loadRazorpayCheckoutScript();

        if (!isDefined(window.Razorpay)) {
          throw new Error('Razorpay Checkout unavailable');
        }

        const razorpay = new window.Razorpay({
          key: order.keyId,
          order_id: order.orderId,
          amount: order.amount,
          currency: order.currency,
          name: 'Arxena',
          description: 'Credit pack',
          handler: () => {
            enqueueSuccessSnackBar({
              message: t`Payment successful. Credits will be added shortly.`,
            });
          },
        });

        razorpay.open();
      } catch (error) {
        enqueueErrorSnackBar({
          message:
            error instanceof Error
              ? error.message
              : t`Failed to create order`,
        });
      } finally {
        setBuyingPackKey(null);
      }
    },
    [
      createRazorpayOrderMutation,
      enqueueErrorSnackBar,
      enqueueSuccessSnackBar,
      t,
    ],
  );

  const handleRequestInvoice = useCallback(
    async (
      creditPackKey: string,
      params: {
        companyName: string;
        billingAddress: string;
        billingEmail: string;
        vatNumber?: string;
      },
    ) => {
      try {
        await requestInvoiceMutation({
          variables: {
            input: {
              creditPackKey,
              companyName: params.companyName,
              billingAddress: params.billingAddress,
              billingEmail: params.billingEmail,
              vatNumber: params.vatNumber,
            },
          },
        });
        enqueueSuccessSnackBar({
          message: t`Invoice request received. We'll send your invoice within 1-2 business days.`,
        });
      } catch {
        enqueueErrorSnackBar({
          message: t`Invoice request failed. Please try again.`,
        });
        throw new Error('Invoice request failed');
      }
    },
    [enqueueErrorSnackBar, enqueueSuccessSnackBar, requestInvoiceMutation, t],
  );

  if (engagementPlans.length === 0 && creditPacks.length === 0) {
    return null;
  }

  return (
    <>
      {engagementPlans.length > 0 && (
        <Section>
          <H2Title
            title={t`Subscription plans`}
            description={t`Choose or upgrade your plan`}
          />
          <StyledPlansGrid>
            {engagementPlans.map((plan) => {
              const licenses = planQuantities[plan.id] ?? 1;

              return (
                <StyledPlanCard key={plan.id}>
                  <StyledPlanName>{plan.name}</StyledPlanName>
                  <StyledPlanMeta>
                    {plan.currency} {(plan.amount / 100).toFixed(2)} /{' '}
                    {plan.period} · {t`per licence`}
                  </StyledPlanMeta>
                  <StyledLicenceRow>
                    <StyledLicenceLabel htmlFor={`licences-${plan.id}`}>
                      {t`Licences`}
                    </StyledLicenceLabel>
                    <TextInput
                      id={`licences-${plan.id}`}
                      fullWidth
                      type="number"
                      value={String(licenses)}
                      onChange={(text) => {
                        const parsed = parseInt(text, 10);
                        const quantity =
                          Number.isNaN(parsed) || parsed < 1
                            ? 1
                            : Math.min(999, parsed);

                        setPlanQuantities((previous) => ({
                          ...previous,
                          [plan.id]: quantity,
                        }));
                      }}
                    />
                  </StyledLicenceRow>
                  <Button
                    title={
                      currentWorkspace?.currentBillingSubscription
                        ? t`Upgrade`
                        : t`Subscribe`
                    }
                    variant="secondary"
                    fullWidth
                    onClick={() =>
                      void handleSubscribePlan(
                        plan.id,
                        planQuantities[plan.id] ?? 1,
                      )
                    }
                    disabled={subscribingPlanId !== null}
                  />
                </StyledPlanCard>
              );
            })}
          </StyledPlansGrid>
        </Section>
      )}

      {creditPacks.length > 0 && (
        <SettingsBillingPricing
          creditPacks={creditPacks}
          displayCurrency={displayCurrency}
          selectedMapsByPlan={selectedMapsByPlan}
          setSelectedMapsByPlan={setSelectedMapsByPlan}
          sharedPackMetaByKey={sharedPackMetaByKey}
          resolvePackPriceSubunits={resolvePackPriceSubunits}
          buyingPackKey={buyingPackKey}
          handleBuyCredits={handleBuyCredits}
          setInvoicePackKey={setInvoicePackKey}
        />
      )}

      <InvoiceRequestModal
        isOpen={invoicePackKey !== null}
        pack={creditPacks.find((pack) => pack.key === invoicePackKey) ?? null}
        initialCompanyName={currentWorkspace?.displayName ?? ''}
        initialBillingEmail={currentUser?.email ?? ''}
        onClose={() => setInvoicePackKey(null)}
        onSubmit={async (params) => {
          if (isDefined(invoicePackKey)) {
            await handleRequestInvoice(invoicePackKey, params);
          }
        }}
      />
    </>
  );
};
