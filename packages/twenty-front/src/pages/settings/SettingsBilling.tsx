import { useMutation, useQuery } from '@apollo/client';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import {
  Button,
  H2Title,
  IconCalendarEvent,
  IconCircleX,
  IconCreditCard,
  Section,
} from 'twenty-ui';

import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { SettingsBillingCoverImage } from '@/billing/components/SettingsBillingCoverImage';
import { billingState } from '@/client-config/states/billingState';
import { useRedirect } from '@/domain-manager/hooks/useRedirect';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPath } from '@/types/SettingsPath';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { useSubscriptionStatus } from '@/workspace/hooks/useSubscriptionStatus';
import { isDefined } from 'twenty-shared';
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
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
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
  const { data, loading } = useBillingPortalSessionQuery({
    variables: {
      returnUrlPath: '/settings/billing',
    },
    skip: isRazorpay ? false : !hasSubscriptions,
  });

  const { data: creditsData, refetch: refetchCredits } = useQuery(
    WORKSPACE_CREDITS,
    { skip: !billingEnabled },
  );
  const subscribedCredits =
    (creditsData as { workspaceCredits?: { credits: number } } | undefined)
      ?.workspaceCredits?.credits ?? 0;

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

  const loadRazorpayAndOpenSubscription = useCallback(
    (keyId: string, subscriptionId: string, callbackUrl: string) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        if (window.Razorpay) {
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
    async (razorpayPlanId: string, quantity: number = 1) => {
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
        const session = data?.checkoutSession as {
          url?: string | null;
          razorpaySubscriptionId?: string | null;
          razorpayKeyId?: string | null;
          razorpayCallbackUrl?: string | null;
        } | undefined;
        if (
          session?.razorpaySubscriptionId &&
          session?.razorpayKeyId &&
          session?.razorpayCallbackUrl
        ) {
          loadRazorpayAndOpenSubscription(
            session.razorpayKeyId,
            session.razorpaySubscriptionId,
            session.razorpayCallbackUrl,
          );
        } else if (session?.url) {
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
        if (window.Razorpay) {
          const rzp = new window.Razorpay({
            key: keyId,
            order_id: orderId,
            amount,
            currency,
            name: 'Credits',
            description: 'Add credits to your workspace',
            handler: () => {
              enqueueSnackBar(t`Payment successful. Credits will be added shortly.`, {
                variant: SnackBarVariant.Success,
              });
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
    async (creditPackKey: string) => {
      setBuyingPackKey(creditPackKey);
      try {
        const { data } = await createRazorpayOrderMutation({
          variables: { input: { creditPackKey } },
        });
        const result = data as {
          createRazorpayOrderForCredits?: {
            orderId: string;
            amount: number;
            currency: string;
            keyId: string;
          };
        } | undefined;
        const order = result?.createRazorpayOrderForCredits;
        if (order?.orderId && order?.keyId) {
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

  const billingPortalButtonDisabled =
    loading || !isDefined(data) || !isDefined(data.billingPortalSession?.url);
  const openBillingPortal = () => {
    if (isDefined(data) && isDefined(data.billingPortalSession?.url)) {
      redirect(data.billingPortalSession.url);
    }
  };

  const openSwitchingIntervalModal = () => {
    setIsSwitchingIntervalModalOpen(true);
  };

  const from = switchingInfo.from;
  const to = switchingInfo.to;
  const impact = switchingInfo.impact;
  console.log("SWITCHING_INFO::", JSON.stringify(switchingInfo, null, 2));
  console.log("currentWorkspace?.currentBillingSubscription:", currentWorkspace?.currentBillingSubscription);
  console.log("currentWorkspace?.currentBillingSubscription?.interval:", currentWorkspace?.currentBillingSubscription?.interval);
  console.log("switchingInfo.newInterval:", switchingInfo.newInterval);
  console.log("isDefined(currentWorkspace?.currentBillingSubscription):", isDefined(currentWorkspace?.currentBillingSubscription));
  console.log("isDefined(currentWorkspace?.currentBillingSubscription?.interval):", isDefined(currentWorkspace?.currentBillingSubscription?.interval));
  console.log("isDefined(switchingInfo.newInterval):", isDefined(switchingInfo.newInterval));
  console.log("isDefined(currentWorkspace?.currentBillingSubscription):", isDefined(currentWorkspace?.currentBillingSubscription));
  console.log("isDefined(currentWorkspace?.currentBillingSubscription?.interval):", isDefined(currentWorkspace?.currentBillingSubscription?.interval));
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
    } catch (error: any) {
      enqueueSnackBar(t`Error while switching subscription ${to}.`, {
        variant: SnackBarVariant.Error,
      });
    }
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
      <SettingsPageContainer>
        <SettingsBillingCoverImage />
        <Section>
          <H2Title
            title={t`Manage your subscription`}
            description={t`Edit payment method, see your invoices and more`}
          />
          {billingEnabled && (
            <p style={{ marginBottom: 12 }}>
              {t`Current plan:`}{' '}
              {[
                currentWorkspace?.currentBillingSubscription?.planName,
                currentWorkspace?.currentBillingSubscription?.status ??
                  t`No active subscription`,
              ]
                .filter(Boolean)
                .join(' · ')}
              {' · '}
              {t`Credits:`} {subscribedCredits}
            </p>
          )}
          <Button
            Icon={IconCreditCard}
            title={t`View billing details`}
            variant="secondary"
            onClick={openBillingPortal}
            disabled={billingPortalButtonDisabled}
          />
        </Section>
        {engagementPlans.length > 0 && (
          <Section>
            <H2Title
              title={t`Subscription plans`}
              description={t`Choose or upgrade your plan`}
            />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '16px',
                marginTop: 16,
              }}
            >
              {engagementPlans.map((plan) => {
                const licenses = planQuantities[plan.id] ?? 1;
                return (
                  <div
                    key={plan.id}
                    style={{
                      border: '1px solid var(--color-gray-20)',
                      borderRadius: 8,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{plan.name}</div>
                    <div style={{ color: 'var(--color-gray-50)' }}>
                      {plan.currency} {(plan.amount / 100).toFixed(2)} /{' '}
                      {plan.period} · {t`per licence`}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <label
                        htmlFor={`licences-${plan.id}`}
                        style={{
                          fontSize: 13,
                          color: 'var(--color-gray-60)',
                        }}
                      >
                        {t`Licences`}:
                      </label>
                      <input
                        id={`licences-${plan.id}`}
                        type="number"
                        min={1}
                        max={999}
                        value={licenses}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          const num =
                            Number.isNaN(v) || v < 1 ? 1 : Math.min(999, v);
                          setPlanQuantities((prev) => ({
                            ...prev,
                            [plan.id]: num,
                          }));
                        }}
                        style={{
                          width: 80,
                          minWidth: 80,
                          padding: '6px 24px 6px 8px',
                          borderRadius: 4,
                          border: '1px solid var(--color-gray-30)',
                          fontSize: 14,
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <Button
                      title={
                        currentWorkspace?.currentBillingSubscription
                          ? t`Upgrade`
                          : t`Subscribe`
                      }
                      variant="secondary"
                      onClick={() =>
                        handleSubscribePlan(plan.id, planQuantities[plan.id] ?? 1)
                      }
                      disabled={subscribingPlanId !== null}
                    />
                  </div>
                );
              })}
            </div>
          </Section>
        )}
        {creditPacks.length > 0 && (
          <Section>
            <H2Title
              title={t`Buy credits`}
              description={t`Add one-time credits to your workspace`}
            />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '16px',
                marginTop: 16,
              }}
            >
              {creditPacks.map((pack) => (
                <div
                  key={pack.key}
                  style={{
                    border: '1px solid var(--color-gray-20)',
                    borderRadius: 8,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{pack.name}</div>
                  <div style={{ color: 'var(--color-gray-50)' }}>
                    {pack.credits} credits · {pack.currency}{' '}
                    {(pack.amountSubunits / 100).toFixed(2)}
                  </div>
                  <Button
                    title={t`Buy credits`}
                    variant="secondary"
                    onClick={() => handleBuyCredits(pack.key)}
                    disabled={buyingPackKey !== null}
                  />
                </div>
              ))}
            </div>
          </Section>
        )}
        {!isRazorpay && (
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
