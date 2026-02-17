export const CREDITS_DESCRIPTION =
  'Each credit processes 100 candidates.';

export type PlanTier = 'basics' | 'engagement' | 'engagement_annual';

export type PlanFeatureGroup = {
  title: string;
  items: string[];
};

export const PLAN_FEATURES: Record<PlanTier, PlanFeatureGroup[]> = {
  basics: [
    {
      title: 'Sourcing',
      items: [
        'Org charts',
        'People search',
        'Chrome extension — LinkedIn (Premium, Sales Navigator, Recruiter)',
        'Naukri (Hiring, Resdex)',
      ],
    },
    {
      title: 'Conversation',
      items: [
        'LinkedIn',
        'Personal WhatsApp',
        'Business WhatsApp',
      ],
    },
  ],
  engagement: [
    {
      title: 'Sourcing',
      items: [
        'Org charts',
        'People search',
        'Chrome extension — LinkedIn (Premium, Sales Navigator, Recruiter)',
        'Naukri (Hiring, Resdex)',
      ],
    },
    {
      title: 'Conversation',
      items: [
        'LinkedIn',
        'Personal WhatsApp',
        'Business WhatsApp',
      ],
    },
  ],
  engagement_annual: [
    {
      title: 'Sourcing',
      items: [
        'Org charts',
        'People search',
        'Chrome extension — LinkedIn (Premium, Sales Navigator, Recruiter)',
        'Naukri (Hiring, Resdex)',
      ],
    },
    {
      title: 'Conversation',
      items: [
        'LinkedIn',
        'Personal WhatsApp',
        'Business WhatsApp',
      ],
    },
  ],
};

export const getPlanTierFromName = (planName: string): PlanTier => {
  const name = planName.toLowerCase();
  if (name.includes('basics')) {
    return 'basics';
  }
  if (name.includes('annual')) {
    return 'engagement_annual';
  }
  return 'engagement';
};
