import { isSalesNavigatorLinkedInProviderId } from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-attendee-id.util';

// Prefer ACw match for SN inbox webhooks; classic replies still use ACo / profile URL.
export const shouldMatchLinkedinWebhookBySalesNavigatorProviderId = ({
  feature,
  attendeeProviderId,
}: {
  feature?: string | null;
  attendeeProviderId?: string | null;
}): boolean =>
  feature === 'sales_navigator' &&
  isSalesNavigatorLinkedInProviderId(attendeeProviderId);
