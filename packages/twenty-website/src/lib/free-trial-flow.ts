/** When unset or any value other than `"false"`, the free-trial lead + Calendly flow is enabled. */
export const isFreeTrialLeadFlowEnabled = (): boolean => {
  const flag =
    process.env.NEXT_PUBLIC_FREE_TRIAL_LEAD_FLOW?.trim().toLowerCase();

  if (flag === 'false') {
    return false;
  }

  return true;
};

export const FREE_TRIAL_CTA_LABEL = 'Free trial';
