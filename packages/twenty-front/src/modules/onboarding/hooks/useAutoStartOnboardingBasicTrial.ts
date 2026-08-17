import { billingCheckoutSessionState } from '@/auth/states/billingCheckoutSessionState';
import { isOnboardingCheckoutPendingState } from '@/onboarding/states/isOnboardingCheckoutPendingState';
import { useHandleCheckoutSession } from '@/settings/billing/hooks/useHandleCheckoutSession';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { useEffect, useState } from 'react';
import { AppPath } from 'twenty-shared/types';

export const useAutoStartOnboardingBasicTrial = ({
  enabled,
}: {
  enabled: boolean;
}) => {
  const billingCheckoutSession = useAtomStateValue(billingCheckoutSessionState);
  const setIsOnboardingCheckoutPending = useSetAtomState(
    isOnboardingCheckoutPendingState,
  );
  const [hasStarted, setHasStarted] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  const { handleCheckoutSession } = useHandleCheckoutSession({
    recurringInterval: billingCheckoutSession.interval,
    plan: billingCheckoutSession.plan,
    requirePaymentMethod: false,
    successUrlPath: AppPath.PlanRequiredSuccess,
    showErrorSnackBar: false,
  });

  useEffect(() => {
    if (!enabled || hasStarted) {
      return;
    }

    setHasStarted(true);
    setIsOnboardingCheckoutPending(true);

    void handleCheckoutSession().then((succeeded) => {
      if (!succeeded) {
        setHasFailed(true);
        setIsOnboardingCheckoutPending(false);
      }
    });
  }, [
    enabled,
    handleCheckoutSession,
    hasStarted,
    setIsOnboardingCheckoutPending,
  ]);

  return {
    hasFailed,
  };
};
