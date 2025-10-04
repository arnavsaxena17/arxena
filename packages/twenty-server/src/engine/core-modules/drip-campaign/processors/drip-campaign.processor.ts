import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { MailerService } from '../../gmail-sender/gmail-sender.service';
import { DripCampaignService } from '../services/drip-campaign.service';
import { EmailSequenceService } from '../services/email-sequence.service';
import { EmailTrackingService } from '../services/email-tracking.service';

@Processor('drip-campaign')
export class DripCampaignProcessor {
  constructor(
    private readonly dripCampaignService: DripCampaignService,
    private readonly emailSequenceService: EmailSequenceService,
    private readonly emailTrackingService: EmailTrackingService,
    private readonly gmailSenderService: MailerService,
  ) {}

  @Process('process-campaign')
  async handleProcessCampaign(job: Job<{ campaignId: string }>) {
    const { campaignId } = job.data;
    
    try {
      console.log(`Processing drip campaign: ${campaignId}`);
      
      const campaign = await this.dripCampaignService.findCampaignById(campaignId);
      
      if (!campaign.isActive) {
        console.log(`Campaign ${campaignId} is not active, skipping processing`);
        return;
      }

      // Get active sequences for the campaign
      const sequences = await this.emailSequenceService.getActiveSequencesForCampaign(campaignId);
      
      if (sequences.length === 0) {
        console.log(`No active sequences found for campaign ${campaignId}`);
        return;
      }

      // Process each sequence
      for (const sequence of sequences) {
        await this.processSequence(campaign, sequence);
      }

      console.log(`Successfully processed campaign: ${campaignId}`);
    } catch (error) {
      console.error(`Error processing campaign ${campaignId}:`, error);
      throw error;
    }
  }

  @Process('send-email')
  async handleSendEmail(job: Job<{
    campaignId: string;
    sequenceId: string;
    recipientId: string;
    recipientEmail: string;
    subject: string;
    content: string;
    trackingPixelId: string;
    replyTrackingId: string;
  }>) {
    const {
      campaignId,
      sequenceId,
      recipientId,
      recipientEmail,
      subject,
      content,
      trackingPixelId,
      replyTrackingId,
    } = job.data;

    try {
      console.log(`Sending email to ${recipientEmail} for campaign ${campaignId}`);

      // Create tracking record
      const tracking = await this.emailTrackingService.createTracking({
        campaignId,
        sequenceId,
        recipientId,
        recipientEmail,
        trackingPixelId,
        replyTrackingId,
      });

      // Add tracking pixel to email content
      const trackingPixel = `<img src="${process.env.SERVER_BASE_URL}/drip-campaigns/tracking/pixel/${trackingPixelId}" width="1" height="1" style="display:none;" />`;
      const contentWithTracking = content + trackingPixel;

      // Send email using Gmail service
      const auth = await this.gmailSenderService.authorize(process.env.TWENTY_TOKEN || '');
      
      const gmailMessageData = {
        sendEmailFrom: process.env.EMAIL_SMTP_USER || '',
        sendEmailNameFrom: 'Arxena Drip Campaign',
        sendEmailTo: recipientEmail,
        subject,
        message: contentWithTracking,
        attachments: [],
      };

      await this.gmailSenderService.sendMails(auth, gmailMessageData);

      // Update tracking status to delivered
      await this.emailTrackingService.updateTracking(tracking.id, {
        status: 'delivered' as any,
        deliveredAt: new Date(),
      });

      console.log(`Email sent successfully to ${recipientEmail}`);
    } catch (error) {
      console.error(`Error sending email to ${recipientEmail}:`, error);
      
      // Update tracking status to bounced
      try {
        const tracking = await this.emailTrackingService.getTrackingByPixelId(trackingPixelId);
        if (tracking) {
          await this.emailTrackingService.updateTracking(tracking.id, {
            status: 'bounced' as any,
            bouncedAt: new Date(),
            bounceReason: error.message,
          });
        }
      } catch (trackingError) {
        console.error('Error updating tracking status:', trackingError);
      }
      
      throw error;
    }
  }

  private async processSequence(campaign: any, sequence: any) {
    console.log(`Processing sequence: ${sequence.name} (Order: ${sequence.order})`);

    // Calculate delay in milliseconds
    const delayMs = (sequence.delayDays * 24 * 60 * 60 * 1000) +
                   (sequence.delayHours * 60 * 60 * 1000) +
                   (sequence.delayMinutes * 60 * 1000);

    // Schedule email sending job with delay
    if (delayMs > 0) {
      // For now, we'll process immediately. In production, you'd use a proper job scheduler
      console.log(`Sequence ${sequence.name} scheduled with delay: ${delayMs}ms`);
    }

    // TODO: Get recipients from job/campaign data
    // For now, we'll use a placeholder
    const recipients = [
      { id: 'recipient1', email: 'test@example.com' },
      // Add more recipients as needed
    ];

    // Schedule email sending for each recipient
    for (const recipient of recipients) {
      const trackingPixelId = `pixel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const replyTrackingId = `reply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // In production, you'd add this to a queue with proper delay
      // For now, we'll process immediately
      await this.handleSendEmail({
        data: {
          campaignId: campaign.id,
          sequenceId: sequence.id,
          recipientId: recipient.id,
          recipientEmail: recipient.email,
          subject: sequence.subject,
          content: sequence.content,
          trackingPixelId,
          replyTrackingId,
        }
      } as Job);
    }
  }
}
