import { isNonEmptyString } from '@sniptt/guards';

import { type CampaignRecipient } from 'src/engine/core-modules/emailing-domain/types/campaign-recipient.type';
import { type CampaignSkippedBreakdown } from 'src/engine/core-modules/emailing-domain/types/campaign-skipped-breakdown.type';
import { type RawCampaignRecipient } from 'src/engine/core-modules/emailing-domain/types/raw-campaign-recipient.type';

export const normalizeCampaignRecipients = (
  rawRecipients: RawCampaignRecipient[],
  maxRecipients: number,
): { recipients: CampaignRecipient[]; skipped: CampaignSkippedBreakdown } => {
  const skipped: CampaignSkippedBreakdown = {
    noEmail: 0,
    deduped: 0,
    overCap: 0,
  };
  const seenEmails = new Set<string>();
  const recipients: CampaignRecipient[] = [];

  for (const recipient of rawRecipients) {
    const normalizedEmail = recipient.email?.trim().toLowerCase();

    if (!isNonEmptyString(normalizedEmail)) {
      skipped.noEmail += 1;
      continue;
    }

    if (seenEmails.has(normalizedEmail)) {
      skipped.deduped += 1;
      continue;
    }

    seenEmails.add(normalizedEmail);

    if (recipients.length >= maxRecipients) {
      skipped.overCap += 1;
      continue;
    }

    recipients.push({ email: normalizedEmail, personId: recipient.personId });
  }

  return { recipients, skipped };
};
