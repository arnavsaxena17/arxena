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
  IconCircleX,
  IconCreditCard,
  IconFileText,
  MOBILE_VIEWPORT,
  Section,
} from 'twenty-ui';

import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { InvoiceRequestModal } from '@/billing/components/InvoiceRequestModal';
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
  max-width: ${({ theme }) => theme.spacing(300)};
  width: 100%;
`;

const StyledBillingCard = styled(Card)`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const StyledCreditSummary = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: ${({ theme }) => theme.text.lineHeight.lg};
  margin: 0;
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: ${({ theme }) => theme.spacing(4)};

  @media (max-width: 1200px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    grid-template-columns: 1fr;
  }
`;

const StyledCreditPackCardContent = styled(CardContent)`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
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
`;

const StyledCreditCardCredits = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
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

type CreditBalanceSummaryTextProps = {
  orgChartCredits: number;
  emailContactCredits: number;
  phoneContactCredits: number;
};

const CreditBalanceSummaryText = ({
  orgChartCredits,
  emailContactCredits,
  phoneContactCredits,
}: CreditBalanceSummaryTextProps) => (
  <StyledCreditSummary>
    <Trans>
      Org chart credits: {orgChartCredits} | Email credits:{' '}
      {emailContactCredits} | Phone credits: {phoneContactCredits}
    </Trans>
  </StyledCreditSummary>
);

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

  const { data: creditsData, refetch: refetchCredits } = useQuery(
    WORKSPACE_CREDITS,
    { skip: !billingEnabled },
  );
  const workspaceCredits =
    (
      creditsData as
        | {
            workspaceCredits?: {
              orgChartCredits: number;
              emailContactCredits: number;
              phoneContactCredits: number;
            };
          }
        | undefined
    )?.workspaceCredits ?? null;

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
    async (creditPackKey: string) => {
      setBuyingPackKey(creditPackKey);
      try {
        const { data } = await createRazorpayOrderMutation({
          variables: { input: { creditPackKey } },
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
          {workspaceCredits && billingEnabled && (
            <Section>
              <H2Title
                title={t`Credit balance`}
                description={t`Credits available for this workspace`}
              />
              <CreditBalanceSummaryText
                orgChartCredits={workspaceCredits.orgChartCredits}
                emailContactCredits={workspaceCredits.emailContactCredits}
                phoneContactCredits={workspaceCredits.phoneContactCredits}
              />
            </Section>
          )}
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
              <H2Title
                title={t`Org chart credits`}
                description={t`Add org chart credits to your workspace. 1 credit = 1 org chart (<100 employees). Larger org charts consume more (e.g. 300 employees = 3 credits). Credit card: +3% surcharge. Pay by invoice: no surcharge.`}
              />
              <StyledCreditCardsGrid>
                {creditPacks.map((pack) => {
                  const baseAmount = pack.amountSubunits / 100;
                  const cardAmount =
                    Math.round(pack.amountSubunits * 1.03) / 100;
                  const packCredits = pack.credits;
                  const perCreditUsd = Math.round(baseAmount / packCredits);
                  const creditsLabel =
                    packCredits === 1
                      ? t`1 credit (<100 employees)`
                      : t`${packCredits} credits (~$${perCreditUsd}/credit)`;
                  const features =
                    pack.credits === 1
                      ? [
                          t`Full org chart structure`,
                          t`LinkedIn profiles + emails`,
                          t`Sign up to unmask names`,
                        ]
                      : [
                          pack.name,
                          t`All features included`,
                          t`12-month expiry`,
                        ];
                  return (
                    <StyledBillingCard key={pack.key} fullWidth rounded>
                      <StyledCreditPackCardContent>
                        <StyledCreditCardTitle>
                          {pack.name}
                        </StyledCreditCardTitle>
                        <StyledCreditCardPrice>
                          {pack.currency === 'USD' ? '$' : pack.currency + ' '}
                          {baseAmount.toLocaleString()}
                        </StyledCreditCardPrice>
                        <StyledCreditCardCredits>
                          {creditsLabel}
                        </StyledCreditCardCredits>
                        <StyledCreditCardSurcharge>
                          {t`Credit card`}:{' '}
                          {pack.currency === 'USD' ? '$' : pack.currency + ' '}
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
                            onClick={() => handleBuyCredits(pack.key)}
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
          {!isRazorpay && (
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
          )}
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
