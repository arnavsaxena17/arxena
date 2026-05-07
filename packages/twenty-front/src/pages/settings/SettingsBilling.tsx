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
  IconCheck,
  IconCreditCard,
  IconFileText,
  MOBILE_VIEWPORT,
  Section
} from 'twenty-ui';

import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { InvoiceRequestModal } from '@/billing/components/InvoiceRequestModal';
import { billingState } from '@/client-config/states/billingState';
import { useRedirect } from '@/domain-manager/hooks/useRedirect';
import { onboardingIntentPathState } from '@/onboarding/states/onboardingIntentPathState';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPath } from '@/types/SettingsPath';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TextInput } from '@/ui/input/components/TextInput';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { useSubscriptionStatus } from '@/workspace/hooks/useSubscriptionStatus';
import {
  convertPricingAmountSubunits,
  CREDIT_PACKS_BY_INTENT,
  getPricingCurrencySymbol,
  isDefined,
  type PricingIntent,
  type CreditPack as SharedCreditPack,
  type SupportedPricingCurrency
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
  max-width: 1160px;
  min-width: 0;
  width: 100%;
`;

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
`;

const StyledPricingControls = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledIntentTabs = styled.div`
  background: ${({ theme }) => theme.background.transparent.lighter};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.pill};
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(1)};
  justify-content: center;
  margin: ${({ theme }) => theme.spacing(4)} auto ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(1)};
  width: fit-content;

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    border-radius: ${({ theme }) => theme.border.radius.md};
    width: 100%;
  }
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

const StyledIntentTab = styled.button<{ isActive: boolean }>`
  appearance: none;
  background: ${({ isActive, theme }) =>
    isActive ? theme.background.transparent.primary : 'transparent'};
  border: 0;
  border-radius: ${({ theme }) => theme.border.radius.pill};
  color: ${({ theme }) => theme.font.color.primary};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(3)}`};
  transition: background-color 0.15s ease;

  &:hover {
    background: ${({ isActive, theme }) =>
      isActive ? theme.background.transparent.primary : theme.background.transparent.lighter};
  }

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    flex: 1;
    min-width: ${({ theme }) => theme.spacing(22)};
    text-align: center;
  }
`;

const StyledBillingCard = styled(Card)`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.md};
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const StyledPlansGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(4)};
  grid-template-columns: repeat(
    auto-fill,
    minmax(${({ theme }) => theme.spacing(60)}, 1fr)
  );
  margin-top: ${({ theme }) => theme.spacing(4)};

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    grid-template-columns: 1fr;
  }
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

const StyledCreditCardsGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(6)};
  grid-template-columns: repeat(
    auto-fit,
    minmax(min(100%, ${({ theme }) => theme.spacing(60)}), 1fr)
  );
  justify-content: center;
  margin-top: ${({ theme }) => theme.spacing(4)};

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    gap: ${({ theme }) => theme.spacing(4)};
    grid-template-columns: 1fr;
  }
`;

const PRICING_CURRENCY_STORAGE_KEY = 'arxena:pricing-currency';

const StyledCreditPackCardContent = styled(CardContent)`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(5)};
  min-width: 0;
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

const StyledCreditCardCredits = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
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

const StyledCreditCardSurcharge = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
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

const normalizePricingAmountSubunits = (amountSubunits: number): number => {
  const amountMajor = Math.max(1, Math.round(amountSubunits / 100));

  if (amountMajor >= 1000) {
    const rounded = Math.round(amountMajor / 1000) * 1000 - 1;

    return Math.max(999, rounded) * 100;
  }

  if (amountMajor >= 100) {
    const rounded = Math.round(amountMajor / 100) * 100 - 1;

    return Math.max(99, rounded) * 100;
  }

  return amountMajor * 100;
};

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

  const intentPath = useRecoilValue(onboardingIntentPathState);
  const initialIntent: PricingIntent =
    intentPath === null || intentPath === undefined || intentPath === 'EXTENSION_INSTALL'
      ? 'SALES'
      : intentPath === 'DEAL_DILIGENCE'
        ? 'INVESTING'
        : 'RECRUITING';

  const [intent, setIntent] = useState<PricingIntent>(initialIntent);
  const [displayCurrency, setDisplayCurrency] =
    useState<SupportedPricingCurrency>('USD');

  useEffect(() => {
    const storedCurrency = localStorage.getItem(PRICING_CURRENCY_STORAGE_KEY);
    if (
      storedCurrency === 'INR' ||
      storedCurrency === 'USD' ||
      storedCurrency === 'GBP' ||
      storedCurrency === 'EUR'
    ) {
      setDisplayCurrency(storedCurrency);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(PRICING_CURRENCY_STORAGE_KEY, displayCurrency);
  }, [displayCurrency]);

  const sharedPackMetaByKey = (() => {
    const allPacks: SharedCreditPack[] = Object.values(CREDIT_PACKS_BY_INTENT).flat();
    return new Map(allPacks.map((p) => [p.key, p]));
  })();

  const visibleCreditPacks = (() => {
    const desiredKeys = CREDIT_PACKS_BY_INTENT[intent].map((p) => p.key);
    const byKey = new Map(creditPacks.map((p) => [p.key, p]));
    const packsForIntent = desiredKeys
      .map((key) => byKey.get(key))
      .filter(isDefined);

    return packsForIntent.length > 0 ? packsForIntent : creditPacks;
  })();

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
            <Section>
              <StyledPricingHero>
                <StyledPricingHeadline>
                  {intent === 'SALES'
                    ? t`Pipeline-grade org intelligence for Sales / ABM`
                    : intent === 'INVESTING'
                      ? t`Deal diligence org intelligence for PE / VC`
                      : t`Org intelligence for Recruiting`}
                </StyledPricingHeadline>
                <StyledPricingSubheadline>
                  {intent === 'SALES'
                    ? t`Map buying committees, champions, and blockers across target accounts — then reveal/export only what matters.`
                    : intent === 'INVESTING'
                      ? t`Diligence faster, monitor portfolios, and benchmark leadership teams before your first meeting.`
                      : t`Map teams, find the right candidates, and build shortlists with org-chart context before outreach.`}
                </StyledPricingSubheadline>
              </StyledPricingHero>
              <StyledPricingControls>
                <StyledCurrencySelect
                  aria-label="Select currency"
                  value={displayCurrency}
                  onChange={(event) =>
                    setDisplayCurrency(event.target.value as SupportedPricingCurrency)
                  }
                >
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                  <option value="EUR">EUR</option>
                  <option value="INR">INR</option>
                </StyledCurrencySelect>
                <StyledIntentTabs>
                  <StyledIntentTab
                    type="button"
                    isActive={intent === 'INVESTING'}
                    onClick={() => setIntent('INVESTING')}
                  >
                    PE / VC
                  </StyledIntentTab>
                  <StyledIntentTab
                    type="button"
                    isActive={intent === 'SALES'}
                    onClick={() => setIntent('SALES')}
                  >
                    Sales / ABM
                  </StyledIntentTab>
                  <StyledIntentTab
                    type="button"
                    isActive={intent === 'RECRUITING'}
                    onClick={() => setIntent('RECRUITING')}
                  >
                    Recruiting
                  </StyledIntentTab>
                </StyledIntentTabs>
              </StyledPricingControls>
              <StyledCreditCardsGrid>
                {visibleCreditPacks.map((pack) => {
                  const meta = sharedPackMetaByKey.get(pack.key);
                  const packCurrency =
                    pack.currency === 'INR' ||
                    pack.currency === 'USD' ||
                    pack.currency === 'GBP' ||
                    pack.currency === 'EUR'
                      ? (pack.currency as SupportedPricingCurrency)
                      : 'GBP';
                  const convertedAmountSubunits = convertPricingAmountSubunits(
                    pack.amountSubunits,
                    packCurrency,
                    displayCurrency,
                  );
                  const baseAmount = convertedAmountSubunits / 100;
                  const surchargeAmountSubunits = Math.round(
                    convertedAmountSubunits * 0.03,
                  );
                  const cardAmountSubunits = normalizePricingAmountSubunits(
                    convertedAmountSubunits + surchargeAmountSubunits,
                  );
                  const cardAmount = cardAmountSubunits / 100;
                  const creditsLabel =
                    meta?.creditsDisplay ??
                    (pack.credits === 1
                      ? t`1 credit (<100 employees)`
                      : t`${pack.credits} credits`);
                  const features = meta?.features ?? [pack.name];
                  return (
                    <StyledBillingCard key={pack.key} fullWidth rounded>
                      <StyledCreditPackCardContent>
                        <StyledCreditCardTitle>
                          {meta?.name ?? pack.name}
                        </StyledCreditCardTitle>
                        <StyledCreditCardPrice>
                          {getPricingCurrencySymbol(displayCurrency)}
                          {baseAmount.toLocaleString()}
                        </StyledCreditCardPrice>
                        <StyledCreditCardCredits>
                          {creditsLabel}
                        </StyledCreditCardCredits>
                        <StyledIncludedRevealCredits>
                          {t`Includes`} {(
                            meta?.includedEmailCredits ?? 0
                          ).toLocaleString()}{' '}
                          {t`email`} +{' '}
                          {(meta?.includedPhoneCredits ?? 0).toLocaleString()}{' '}
                          {t`phone credits`}
                        </StyledIncludedRevealCredits>
                        <StyledPanelDivider />
                        <StyledCreditCardSurcharge>
                          {t`Credit card`}:{' '}
                          {getPricingCurrencySymbol(displayCurrency)}
                          {cardAmount.toLocaleString()} {t`(+3%)`}
                        </StyledCreditCardSurcharge>
                        <StyledFeatureList>
                          {features.map((feature) => (
                            <StyledFeatureItem key={feature}>
                              <StyledCheckIcon size={20} strokeWidth={2.5} />
                              {feature}
                            </StyledFeatureItem>
                          ))}
                        </StyledFeatureList>
                        <StyledCreditActions>
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
                          <Button
                            Icon={IconFileText}
                            title={t`Pay by invoice`}
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
