import { useRedirect } from '@/domain-manager/hooks/useRedirect';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { CHECKOUT_SESSION } from '@/billing/graphql/checkoutSession';
import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { isDefined } from 'twenty-shared/utils';
import {
  type BillingPlanKey,
  type SubscriptionInterval,
} from '~/generated-metadata/graphql';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

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

export const useHandleCheckoutSession = ({
  recurringInterval,
  plan,
  requirePaymentMethod,
  successUrlPath,
}: {
  recurringInterval: SubscriptionInterval;
  plan: BillingPlanKey;
  requirePaymentMethod: boolean;
  successUrlPath: string;
}) => {
  const { redirect } = useRedirect();

  const { enqueueErrorSnackBar } = useSnackBar();

  const [checkoutSession] = useMutation(CHECKOUT_SESSION);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCheckoutSession = async () => {
    setIsSubmitting(true);
    try {
      const { data } = await checkoutSession({
        variables: {
          recurringInterval,
          successUrlPath,
          plan,
          requirePaymentMethod,
        },
      });
      const session = data?.checkoutSession;

      if (
        isDefined(session?.razorpaySubscriptionId) &&
        isDefined(session?.razorpayKeyId) &&
        isDefined(session?.razorpayCallbackUrl)
      ) {
        await loadRazorpayCheckoutScript();

        if (!isDefined(window.Razorpay)) {
          throw new Error('Razorpay Checkout unavailable');
        }

        const razorpay = new window.Razorpay({
          key: session.razorpayKeyId,
          subscription_id: session.razorpaySubscriptionId,
          callback_url: session.razorpayCallbackUrl,
          redirect: true,
          name: 'Arxena',
          description: 'Subscription',
        });

        razorpay.open();

        return;
      }

      if (!isDefined(session?.url) || session.url === '') {
        enqueueErrorSnackBar({
          message: t`Checkout session error. Please retry or contact Arxena team`,
        });
        return;
      }
      redirect(session.url);
    } catch {
      enqueueErrorSnackBar({
        message: t`Checkout session error. Please retry or contact Arxena team`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  return { isSubmitting, handleCheckoutSession };
};
