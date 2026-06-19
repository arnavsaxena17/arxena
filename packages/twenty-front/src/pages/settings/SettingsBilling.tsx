import { useMutation, useQuery } from '@apollo/client';
import styled from '@emotion/styled';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import {
  Button,
  Card,
  CardContent,
  H2Title,
  Section
} from 'twenty-ui';

import { currentUserState } from '@/auth/states/currentUserState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { InvoiceRequestModal } from '@/billing/components/InvoiceRequestModal';
import { SettingsBillingPricing } from '@/billing/components/SettingsBillingPricing';
import { billingState } from '@/client-config/states/billingState';
import { useRedirect } from '@/domain-manager/hooks/useRedirect';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPath } from '@/types/SettingsPath';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TextInput } from '@/ui/input/components/TextInput';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { useSubscriptionStatus } from '@/workspace/hooks/useSubscriptionStatus';
import {
  buildComparableMapsByPlan,
  buildClientGeoHeaders,
  convertPricingAmountSubunits,
  CREDIT_PACKS_BY_INTENT,
  getOrFetchClientGeoSession,
  isDefined,
  PRICING_PLAN_ORDER,
  PRICING_PLANS,
  CreditPack as SharedCreditPack,
  SMALL_PAYMENT_TEST_VOLUME_SELECTOR_VALUE,
  SUPPORTED_PRICING_CURRENCIES,
  SupportedPricingCurrency,
} from 'twenty-shared';
import {
  BillingPlanKey,
  SubscriptionInterval,
  SubscriptionStatus,
  useBillingPortalSessionQuery,
  useUpdateBillingSubscriptionMutation,
} from '~/generated/graphql';
import { CHECKOUT_SESSION } from '~/modules/billing/graphql/checkoutSession';
import { CREATE_RAZORPAY_ORDER_FOR_CREDITS } from '~/modules/billing/graphql/createRazorpayOrderForCredits';
import { CREDIT_PACKS } from '~/modules/billing/graphql/creditPacks';
import { ENGAGEMENT_PLANS } from '~/modules/billing/graphql/engagementPlans';
import { REQUEST_INVOICE_FOR_CREDITS } from '~/modules/billing/graphql/requestInvoiceForCredits';
import { REQUEST_PRICING_CURRENCY } from '~/modules/billing/graphql/requestPricingCurrency';
import { WORKSPACE_CREDITS } from '~/modules/billing/graphql/workspaceCredits';
import { getSettingsPath } from '~/utils/navigation/getSettingsPath';

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
    Razorpay?: new (options: {
      key: string;
      order_id?: string;
      amount?: number;
      currency?: string;
      subscription_id?: string;
      callback_url?: string;
      redirect?: boolean;
      name?: string;
      description?: string;
      handler?: (response: unknown) => void;
    }) => { open: () => void };
  }
}

type SwitchInfo = {
  newInterval: SubscriptionInterval;
  to: string;
  from: string;
  impact: string;
};

const StyledBillingRoot = styled.div`
  margin: 0 auto;
  max-width: 1480px;
  min-width: 0;
  overflow-x: clip;
  width: 100%;
`;

const StyledBillingCard = styled(Card)`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.md};
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
`;

const StyledPlansGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(4)};
  grid-template-columns: repeat(
    auto-fit,
    minmax(min(100%, ${({ theme }) => theme.spacing(60)}), 1fr)
  );
  margin-top: ${({ theme }) => theme.spacing(4)};
  min-width: 0;
  width: 100%;
`;

const StyledPlanCardContent = styled(CardContent)`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  height: 100%;
`;

const StyledPlanName = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledPlanMeta = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledLicenceRow = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledLicenceLabel = styled.label`
  color: ${({ theme }) => theme.font.color.light};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledLicenceInputWrap = styled.div`
  width: ${({ theme }) => theme.spacing(20)};
`;

export const SettingsBilling = () => {
  const { t } = useLingui();
  const billing = useRecoilValue(billingState) as
    | { provider?: 'razorpay' | 'stripe'; isBillingEnabled?: boolean }
    | null
    | undefined;
  const isRazorpay = billing?.provider === 'razorpay';
  const billingEnabled = billing?.isBillingEnabled === true;
  const { redirect } = useRedirect();

  const MONTHLY_SWITCH_INFO: SwitchInfo = {
    newInterval: SubscriptionInterval.Year,
    to: t`to yearly`,
    from: t`from monthly to yearly`,
    impact: t`You will be charged immediately for the full year.`,
  };

  const YEARLY_SWITCH_INFO: SwitchInfo = {
    newInterval: SubscriptionInterval.Month,
    to: t`to monthly`,
    from: t`from yearly to monthly`,
    impact: t`Your credit balance will be used to pay the monthly bills.`,
  };

  const SWITCH_INFOS = {
    year: YEARLY_SWITCH_INFO,
    month: MONTHLY_SWITCH_INFO,
  };

  const { enqueueSnackBar } = useSnackBar();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscription = params.get('subscription');
    if (subscription === 'success' || subscription === 'failed') {
      params.delete('subscription');
      const newSearch = params.toString();
      const newUrl =
        window.location.pathname + (newSearch ? `?${newSearch}` : '');
      window.history.replaceState({}, '', newUrl);
      enqueueSnackBar(
        subscription === 'success'
          ? t`Subscription active. Thank you.`
          : t`Payment could not be completed. Please try again.`,
        {
          variant:
            subscription === 'success'
              ? SnackBarVariant.Success
              : SnackBarVariant.Error,
        },
      );
    }
  }, [enqueueSnackBar, t]);

  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const currentUser = useRecoilValue(currentUserState);
  const subscriptions = currentWorkspace?.billingSubscriptions;
  const hasSubscriptions = (subscriptions?.length ?? 0) > 0;

  const subscriptionStatus = useSubscriptionStatus();
  const hasNotCanceledCurrentSubscription =
    isDefined(subscriptionStatus) &&
    subscriptionStatus !== SubscriptionStatus.Canceled;

  const setCurrentWorkspace = useSetRecoilState(currentWorkspaceState);
  const switchingInfo =
    currentWorkspace?.currentBillingSubscription?.interval ===
    SubscriptionInterval.Year
      ? SWITCH_INFOS.year
      : SWITCH_INFOS.month;
  const [isSwitchingIntervalModalOpen, setIsSwitchingIntervalModalOpen] =
    useState(false);
  const [updateBillingSubscription] = useUpdateBillingSubscriptionMutation();
  const { data } = useBillingPortalSessionQuery({
    variables: {
      returnUrlPath: '/settings/billing',
    },
    skip: isRazorpay ? false : !hasSubscriptions,
  });
  const { refetch: refetchCredits } = useQuery(WORKSPACE_CREDITS, {
    skip: !billingEnabled,
  });

  const { data: engagementPlansData } = useQuery(ENGAGEMENT_PLANS, {
    skip: !billingEnabled,
  });
  const engagementPlans: EngagementPlan[] =
    (engagementPlansData as { engagementPlans?: EngagementPlan[] } | undefined)
      ?.engagementPlans ?? [];

  const [pricingGeoHeaders, setPricingGeoHeaders] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    void getOrFetchClientGeoSession().then((session) => {
      setPricingGeoHeaders(buildClientGeoHeaders(session));
    });
  }, []);

  const { data: requestPricingCurrencyData, refetch: refetchPricingCurrency } =
    useQuery(REQUEST_PRICING_CURRENCY, {
      skip: !billingEnabled,
      context: {
        headers: pricingGeoHeaders,
      },
    });

  useEffect(() => {
    if (!billingEnabled || Object.keys(pricingGeoHeaders).length === 0) {
      return;
    }
    void refetchPricingCurrency();
  }, [billingEnabled, pricingGeoHeaders, refetchPricingCurrency]);

  const { data: creditPacksData } = useQuery(CREDIT_PACKS, {
    skip: !billingEnabled,
  });
  const creditPacks: CreditPack[] =
    (creditPacksData as { creditPacks?: CreditPack[] } | undefined)
      ?.creditPacks ?? [];

  const [checkoutSessionMutation] = useMutation(CHECKOUT_SESSION);
  const [createRazorpayOrderMutation] = useMutation(
    CREATE_RAZORPAY_ORDER_FOR_CREDITS,
  );
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(
    null,
  );
  const [planQuantities, setPlanQuantities] = useState<Record<string, number>>(
    {},
  );
  const [buyingPackKey, setBuyingPackKey] = useState<string | null>(null);
  const [invoicePackKey, setInvoicePackKey] = useState<string | null>(null);

  const [requestInvoiceMutation] = useMutation(REQUEST_INVOICE_FOR_CREDITS);

  const loadRazorpayAndOpenSubscription = useCallback(
    (keyId: string, subscriptionId: string, callbackUrl: string) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        if (isDefined(window.Razorpay)) {
          const rzp = new window.Razorpay({
            key: keyId,
            subscription_id: subscriptionId,
            callback_url: callbackUrl,
            redirect: true,
            name: 'Arxena',
            description: 'Subscription',
          });
          rzp.open();
        }
      };
      document.body.appendChild(script);
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
        const session = data?.checkoutSession as
          | {
              url?: string | null;
              razorpaySubscriptionId?: string | null;
              razorpayKeyId?: string | null;
              razorpayCallbackUrl?: string | null;
            }
          | undefined;
        if (
          isDefined(session?.razorpaySubscriptionId) &&
          isDefined(session?.razorpayKeyId) &&
          isDefined(session?.razorpayCallbackUrl)
        ) {
          loadRazorpayAndOpenSubscription(
            session.razorpayKeyId,
            session.razorpaySubscriptionId,
            session.razorpayCallbackUrl,
          );
        } else if (isDefined(session?.url) && session.url !== '') {
          window.open(session.url, '_blank', 'noopener,noreferrer');
          enqueueSnackBar(
            t`Complete payment in the new tab. Close that tab to return here.`,
            { variant: SnackBarVariant.Success },
          );
        } else {
          enqueueSnackBar(t`Could not start checkout`, {
            variant: SnackBarVariant.Error,
          });
        }
      } catch {
        enqueueSnackBar(t`Checkout failed`, {
          variant: SnackBarVariant.Error,
        });
      } finally {
        setSubscribingPlanId(null);
      }
    },
    [
      checkoutSessionMutation,
      loadRazorpayAndOpenSubscription,
      enqueueSnackBar,
      t,
    ],
  );

  const loadRazorpayAndOpen = useCallback(
    (keyId: string, orderId: string, amount: number, currency: string) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        if (isDefined(window.Razorpay)) {
          const rzp = new window.Razorpay({
            key: keyId,
            order_id: orderId,
            amount,
            currency,
            name: 'Credits',
            description: 'Add credits to your workspace',
            handler: () => {
              enqueueSnackBar(
                t`Payment successful. Credits will be added shortly.`,
                {
                  variant: SnackBarVariant.Success,
                },
              );
              void refetchCredits();
            },
          });
          rzp.open();
        }
      };
      document.body.appendChild(script);
    },
    [enqueueSnackBar, t, refetchCredits],
  );

  const handleBuyCredits = useCallback(
    async (
      creditPackKey: string,
      selectedCurrency: SupportedPricingCurrency,
    ) => {
      setBuyingPackKey(creditPackKey);
      try {
        const { data } = await createRazorpayOrderMutation({
          variables: { input: { creditPackKey, currency: selectedCurrency } },
        });
        const result = data as
          | {
              createRazorpayOrderForCredits?: {
                orderId: string;
                amount: number;
                currency: string;
                keyId: string;
              };
            }
          | undefined;
        const order = result?.createRazorpayOrderForCredits;
        if (isDefined(order?.orderId) && isDefined(order?.keyId)) {
          loadRazorpayAndOpen(
            order.keyId,
            order.orderId,
            order.amount,
            order.currency,
          );
        } else {
          enqueueSnackBar(t`Could not create order`, {
            variant: SnackBarVariant.Error,
          });
        }
      } catch {
        enqueueSnackBar(t`Failed to create order`, {
          variant: SnackBarVariant.Error,
        });
      } finally {
        setBuyingPackKey(null);
      }
    },
    [createRazorpayOrderMutation, loadRazorpayAndOpen, enqueueSnackBar, t],
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
        enqueueSnackBar(
          t`Invoice request received. We'll send your invoice within 1-2 business days.`,
          { variant: SnackBarVariant.Success },
        );
      } catch {
        enqueueSnackBar(t`Invoice request failed. Please try again.`, {
          variant: SnackBarVariant.Error,
        });
        throw new Error('Invoice request failed');
      }
    },
    [requestInvoiceMutation, enqueueSnackBar, t],
  );

  const openBillingPortal = () => {
    if (isDefined(data) && isDefined(data.billingPortalSession?.url)) {
      redirect(data.billingPortalSession.url);
    }
  };

  const to = switchingInfo.to;
  const impact = switchingInfo.impact;

  const switchInterval = async () => {
    try {
      await updateBillingSubscription();
      if (isDefined(currentWorkspace?.currentBillingSubscription)) {
        const newCurrentWorkspace = {
          ...currentWorkspace,
          currentBillingSubscription: {
            ...currentWorkspace?.currentBillingSubscription,
            interval: switchingInfo.newInterval,
          },
        };
        setCurrentWorkspace(newCurrentWorkspace);
      }
      enqueueSnackBar(t`Subscription has been switched ${to}`, {
        variant: SnackBarVariant.Success,
      });
    } catch {
      enqueueSnackBar(t`Error while switching subscription ${to}.`, {
        variant: SnackBarVariant.Error,
      });
    }
  };

  const [displayCurrency, setDisplayCurrency] =
    useState<SupportedPricingCurrency>('USD');

  const [selectedMapsByPlan, setSelectedMapsByPlan] = useState(
    buildComparableMapsByPlan,
  );

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
        if (!plan.tiers.some((t) => t.maps === raw)) {
          next[planId] = plan.minMaps;
          changed = true;
        }
      }
      return changed ? next : previous;
    });
  }, []);

  useEffect(() => {
    const resolvedCurrency = (
      requestPricingCurrencyData as
        | { requestPricingCurrency?: string }
        | undefined
    )?.requestPricingCurrency;
    if (
      resolvedCurrency !== undefined &&
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
    return new Map(allPacks.map((p) => [p.key, p]));
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

  return (
    <SubMenuTopBarContainer
      title={t`Billing`}
      links={[
        {
          children: <Trans>Workspace</Trans>,
          href: getSettingsPath(SettingsPath.Workspace),
        },
        { children: <Trans>Billing</Trans> },
      ]}
    >
      <SettingsPageContainer fullWidth>
        <StyledBillingRoot>
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
                    <StyledBillingCard key={plan.id} fullWidth rounded>
                      <StyledPlanCardContent>
                        <StyledPlanName>{plan.name}</StyledPlanName>
                        <StyledPlanMeta>
                          {plan.currency} {(plan.amount / 100).toFixed(2)} /{' '}
                          {plan.period} · {t`per licence`}
                        </StyledPlanMeta>
                        <StyledLicenceRow>
                          <StyledLicenceLabel htmlFor={`licences-${plan.id}`}>
                            {t`Licences`}
                          </StyledLicenceLabel>
                          <StyledLicenceInputWrap>
                            <TextInput
                              id={`licences-${plan.id}`}
                              fullWidth
                              type="number"
                              value={String(licenses)}
                              onChange={(text) => {
                                const v = parseInt(text, 10);
                                const num =
                                  Number.isNaN(v) || v < 1
                                    ? 1
                                    : Math.min(999, v);
                                setPlanQuantities((prev) => ({
                                  ...prev,
                                  [plan.id]: num,
                                }));
                              }}
                            />
                          </StyledLicenceInputWrap>
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
                            handleSubscribePlan(
                              plan.id,
                              planQuantities[plan.id] ?? 1,
                            )
                          }
                          disabled={subscribingPlanId !== null}
                        />
                      </StyledPlanCardContent>
                    </StyledBillingCard>
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
          {/* {!isRazorpay && (
            <Section>
              <H2Title
                title={t`Cancel your subscription`}
                description={t`Your workspace will be disabled`}
              />
              <Button
                Icon={IconCircleX}
                title={t`Cancel Plan`}
                variant="secondary"
                accent="danger"
                onClick={openBillingPortal}
                disabled={!hasNotCanceledCurrentSubscription}
              />
            </Section>
          )} */}
        </StyledBillingRoot>
      </SettingsPageContainer>
      <InvoiceRequestModal
        isOpen={invoicePackKey !== null}
        pack={creditPacks.find((p) => p.key === invoicePackKey) ?? null}
        initialCompanyName={currentWorkspace?.displayName ?? ''}
        initialBillingEmail={currentUser?.email ?? ''}
        onClose={() => setInvoicePackKey(null)}
        onSubmit={async (params) => {
          if (isDefined(invoicePackKey)) {
            await handleRequestInvoice(invoicePackKey, params);
          }
        }}
      />
      <ConfirmationModal
        isOpen={isSwitchingIntervalModalOpen}
        setIsOpen={setIsSwitchingIntervalModalOpen}
        title={t`Switch billing ${to}`}
        subtitle={
          t`Are you sure that you want to change your billing interval?` +
          ` ${impact}`
        }
        onConfirmClick={switchInterval}
        deleteButtonText={t`Change ${to}`}
        confirmButtonAccent={'blue'}
      />
    </SubMenuTopBarContainer>
  );
};
