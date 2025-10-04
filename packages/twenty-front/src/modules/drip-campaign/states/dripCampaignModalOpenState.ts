import { atom } from 'recoil';
import { createState } from 'twenty-ui';

export type EmailSequence = {
  id: string;
  name: string;
  subject: string;
  content: string;
  delayDays: number;
  delayHours: number;
  delayMinutes: number;
  order: number;
  isActive: boolean;
};

export type DripCampaign = {
  id: string;
  name: string;
  description: string;
  jobId: string;
  emailSequences: EmailSequence[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EmailTracking = {
  id: string;
  campaignId: string;
  sequenceId: string;
  recipientId: string;
  recipientEmail: string;
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'unsubscribed';
  sentAt: string;
  deliveredAt?: string;
  openedAt?: string;
  clickedAt?: string;
  repliedAt?: string;
  bouncedAt?: string;
  unsubscribedAt?: string;
  trackingPixelId: string;
  replyTrackingId: string;
};

export type CampaignMetrics = {
  campaignId: string;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalReplied: number;
  totalBounced: number;
  totalUnsubscribed: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
  unsubscribeRate: number;
  lastUpdated: string;
};

export const isDripCampaignModalOpenState = atom<boolean>({
  key: 'isDripCampaignModalOpenState',
  default: false,
});

export const isDripCampaignModalMinimizedState = atom<boolean>({
  key: 'isDripCampaignModalMinimizedState',
  default: false,
});

export const dripCampaignsState = atom<DripCampaign[]>({
  key: 'dripCampaignsState',
  default: [],
});

export const activeDripCampaignState = atom<DripCampaign | null>({
  key: 'activeDripCampaignState',
  default: null,
});

export const activeEmailSequenceState = atom<EmailSequence | null>({
  key: 'activeEmailSequenceState',
  default: null,
});

export const emailTrackingState = createState<EmailTracking[]>({
  key: 'emailTrackingState',
  defaultValue: [],
});

export const campaignMetricsState = createState<CampaignMetrics[]>({
  key: 'campaignMetricsState',
  defaultValue: [],
});

export const currentJobIdForDripState = atom<string>({
  key: 'currentJobIdForDripState',
  default: '',
});
