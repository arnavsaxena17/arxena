import { useMutation, useQuery } from '@apollo/client';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import {
  Button,
  H2Title,
  IconCalendarEvent,
  IconCircleX,
  IconCreditCard,
  Section,
} from 'twenty-ui';

import { currentUserState } from '@/auth/states/currentUserState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { SettingsBillingCoverImage } from '@/billing/components/SettingsBillingCoverImage';
import { useRedirect } from '@/domain-manager/hooks/useRedirect';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPath } from '@/types/SettingsPath';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { useSubscriptionStatus } from '@/workspace/hooks/useSubscriptionStatus';
import { format } from 'date-fns';
import { isDefined } from 'twenty-shared';
import {
  BillingPlanKey,
  SubscriptionInterval,
  SubscriptionStatus,
  useBillingPortalSessionQuery,
  useCheckoutSessionMutation,
  useUpdateBillingSubscriptionMutation,
} from '~/generated/graphql';
import { BILLING_PROVIDER } from '~/modules/billing/graphql/billingProvider';
import { CREATE_RAZORPAY_ORDER_FOR_CREDITS } from '~/modules/billing/graphql/createRazorpayOrderForCredits';
import { CREDIT_PACKS } from '~/modules/billing/graphql/creditPacks';
import { ENGAGEMENT_PLANS } from '~/modules/billing/graphql/engagementPlans';
import { WORKSPACE_CREDITS } from '~/modules/billing/graphql/workspaceCredits';
import { getSettingsPath } from '~/utils/navigation/getSettingsPath';

type SwitchInfo = {
  newInterval: SubscriptionInterval;
  to: string;
  from: string;
  impact: string;
};

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

const loadRazorpayScript = (): Promise<unknown> => {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT_URL}"]`);
  if (existing) return Promise.resolve((window as { Razorpay?: unknown }).Razorpay);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve((window as { Razorpay?: unknown }).Razorpay);
    script.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.body.appendChild(script);
  });
};

export const SettingsBilling = () => {
  const { t } = useLingui();
  const { redirect } = useRedirect();
  const { enqueueSnackBar } = useSnackBar();
  const currentUser = useRecoilValue(currentUserState);
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const setCurrentWorkspace = useSetRecoilState(currentWorkspaceState);

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

  const subscriptions = currentWorkspace?.billingSubscriptions;
  const hasSubscriptions = (subscriptions?.length ?? 0) > 0;
  const subscriptionStatus = useSubscriptionStatus();
  const hasNotCanceledCurrentSubscription =
    isDefined(subscriptionStatus) &&
    subscriptionStatus !== SubscriptionStatus.Canceled;

  const switchingInfo =
    currentWorkspace?.currentBillingSubscription?.interval ===
    SubscriptionInterval.Year
      ? SWITCH_INFOS.year
      : SWITCH_INFOS.month;

  const [isSwitchingIntervalModalOpen, setIsSwitchingIntervalModalOpen] =
    useState(false);
  const [razorpayCreditsLoading, setRazorpayCreditsLoading] = useState<string | null>(null);
  const [engagementLoading, setEngagementLoading] = useState<string | null>(null);

  const { data: providerData } = useQuery<{
    billingProvider: { provider: 'stripe' | 'razorpay' };
  }>(BILLING_PROVIDER);
  const billingProvider = providerData?.billingProvider?.provider ?? 'stripe';

  const { data: creditPacksData } = useQuery<{
    creditPacks: Array<{
      key: string;
      name: string;
      credits: number;
      amountSubunits: number;
      currency: string;
    }>;
  }>(CREDIT_PACKS, { skip: billingProvider !== 'razorpay' });

  const { data: engagementPlansData } = useQuery<{
    engagementPlans: Array<{
      intervalKey: string;
      name: string;
      amountSubunits: number;
      currency: string;
      planId: string;
    }>;
  }>(ENGAGEMENT_PLANS, { skip: billingProvider !== 'razorpay' });

  const { data: workspaceCreditsData } = useQuery<{
    workspaceCredits: { credits: number };
  }>(WORKSPACE_CREDITS, { skip: billingProvider !== 'razorpay' });

  const [updateBillingSubscription] = useUpdateBillingSubscriptionMutation();
  const [createRazorpayOrder] = useMutation<{
    createRazorpayOrderForCredits: {
      orderId: string;
      amount: number;
      currency: string;
      keyId: string;
      creditPackKey: string;
      credits: number;
    };
  }>(CREATE_RAZORPAY_ORDER_FOR_CREDITS);

  const [checkoutSession] = useCheckoutSessionMutation();

  const { data, loading } = useBillingPortalSessionQuery({
    variables: { returnUrlPath: '/settings/billing' },
    skip: !hasSubscriptions || billingProvider !== 'stripe',
  });

  const billingPortalButtonDisabled =
    billingProvider !== 'stripe' ||
    loading ||
    !isDefined(data) ||
    !isDefined(data.billingPortalSession.url);

  const openBillingPortal = () => {
    if (billingProvider !== 'stripe') return;
    if (isDefined(data) && isDefined(data.billingPortalSession.url)) {
      redirect(data.billingPortalSession.url);
    }
  };

  const openSwitchingIntervalModal = () => setIsSwitchingIntervalModalOpen(true);

  const from = switchingInfo.from;
  const to = switchingInfo.to;
  const impact = switchingInfo.impact;

  const switchInterval = async () => {
    try {
      await updateBillingSubscription();
      if (isDefined(currentWorkspace?.currentBillingSubscription)) {
        setCurrentWorkspace({
          ...currentWorkspace,
          currentBillingSubscription: {
            ...currentWorkspace.currentBillingSubscription,
            interval: switchingInfo.newInterval,
          },
        });
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

  const handleAddCredits = useCallback(
    async (creditPackKey: string) => {
      setRazorpayCreditsLoading(creditPackKey);
      try {
        const { data: orderData } = await createRazorpayOrder({
          variables: { creditPackKey },
        });
        const out = orderData?.createRazorpayOrderForCredits;
        if (!out?.orderId || !out.keyId) {
          enqueueSnackBar(t`Failed to create order. Please try again.`, {
            variant: SnackBarVariant.Error,
          });
          return;
        }
        await loadRazorpayScript();
        const Razorpay = (window as { Razorpay?: { new: (opts: unknown) => { open: () => void } } }).Razorpay;
        if (!Razorpay) {
          enqueueSnackBar(t`Payment provider failed to load.`, {
            variant: SnackBarVariant.Error,
          });
          return;
        }
        const options = {
          key: out.keyId,
          amount: out.amount,
          currency: out.currency,
          order_id: out.orderId,
          name: 'Arxena',
          prefill: {
            email: currentUser?.email ?? '',
          },
          handler: () => {
            enqueueSnackBar(t`Credits will be added after payment is confirmed.`, {
              variant: SnackBarVariant.Success,
            });
          },
        };
        const Rzp = Razorpay as unknown as new (opts: typeof options) => { open: () => void };
        const rzp = new Rzp(options);
        rzp.open();
      } catch {
        enqueueSnackBar(t`Failed to start checkout. Please try again.`, {
          variant: SnackBarVariant.Error,
        });
      } finally {
        setRazorpayCreditsLoading(null);
      }
    },
    [createRazorpayOrder, currentUser?.email, enqueueSnackBar, t],
  );

  const handleEngagementSubscribe = useCallback(
    async (intervalKey: string) => {
      setEngagementLoading(intervalKey);
      try {
        const { data: checkoutData } = await checkoutSession({
          variables: {
            recurringInterval: SubscriptionInterval.Year,
            successUrlPath: getSettingsPath(SettingsPath.Billing),
            plan: BillingPlanKey.PRO,
            requirePaymentMethod: true,
            engagementInterval: intervalKey,
          },
        });
        const url = checkoutData?.checkoutSession?.url;
        if (url) {
          redirect(url);
        } else {
          enqueueSnackBar(t`Failed to start subscription. Please try again.`, {
            variant: SnackBarVariant.Error,
          });
        }
      } catch {
        enqueueSnackBar(t`Failed to start subscription. Please try again.`, {
          variant: SnackBarVariant.Error,
        });
      } finally {
        setEngagementLoading(null);
      }
    },
    [checkoutSession, enqueueSnackBar, redirect, t],
  );

  const creditPacks = creditPacksData?.creditPacks ?? [];
  const engagementPlans = engagementPlansData?.engagementPlans ?? [];
  const subscribedCredits = workspaceCreditsData?.workspaceCredits?.credits ?? 0;
  const subscription = currentWorkspace?.currentBillingSubscription;
  const periodEndFormatted =
    subscription?.currentPeriodEnd &&
    format(new Date(subscription.currentPeriodEnd), 'd MMM yyyy');

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
      <SettingsPageContainer>
        <SettingsBillingCoverImage />
        <Section>
          <H2Title
            title={t`Manage your subscription`}
            description={t`Edit payment method, see your invoices and more`}
          />
          <Button
            Icon={IconCreditCard}
            title={t`View billing details`}
            variant="secondary"
            onClick={openBillingPortal}
            disabled={billingPortalButtonDisabled}
          />
        </Section>

        {billingProvider === 'razorpay' && (
          <>
            <Section>
              <H2Title
                title={t`Current plan & credits`}
                description={
                  [
                    subscription &&
                      [
                        `${subscription.status}${subscription.interval ? ` · ${subscription.interval}` : ''}`,
                        periodEndFormatted
                          ? t`Current period ends ${periodEndFormatted}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · '),
                    t`Subscribed credits: ${subscribedCredits}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                }
              />
            </Section>
            <Section>
              <H2Title
                title={t`Engagement plans`}
                description={t`Subscribe to quarterly, 6-month, or annual engagement`}
              />
              {engagementPlans.map((plan) => (
                <Button
                  key={plan.intervalKey}
                  Icon={IconCalendarEvent}
                  title={`${plan.name} — ${plan.currency} ${(plan.amountSubunits / 100).toFixed(2)}`}
                  variant="secondary"
                  onClick={() => handleEngagementSubscribe(plan.intervalKey)}
                  disabled={engagementLoading !== null}
                />
              ))}
            </Section>
            <Section>
              <H2Title
                title={t`Additional credits`}
                description={t`One-time credit packs (1 credit = 100 person org chart)`}
              />
              {creditPacks.map((pack) => (
                <Button
                  key={pack.key}
                  Icon={IconCreditCard}
                  title={`${pack.name} — ${pack.credits} credits — ${pack.currency} ${(pack.amountSubunits / 100).toFixed(2)}`}
                  variant="secondary"
                  onClick={() => handleAddCredits(pack.key)}
                  disabled={razorpayCreditsLoading !== null}
                />
              ))}
            </Section>
          </>
        )}

        {billingProvider === 'stripe' && (
          <>
            <Section>
              <H2Title
                title={t`Edit billing interval`}
                description={t`Switch ${from}`}
              />
              <Button
                Icon={IconCalendarEvent}
                title={t`Switch ${to}`}
                variant="secondary"
                onClick={openSwitchingIntervalModal}
                disabled={!hasNotCanceledCurrentSubscription}
              />
            </Section>
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
          </>
        )}
      </SettingsPageContainer>
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
