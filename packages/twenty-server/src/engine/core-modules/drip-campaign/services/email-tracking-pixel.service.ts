import { Injectable } from '@nestjs/common';
import { EmailStatus } from '../entities/email-tracking.entity';
import { EmailTrackingService } from './email-tracking.service';

@Injectable()
export class EmailTrackingPixelService {
  constructor(
    private readonly emailTrackingService: EmailTrackingService,
  ) {}

  async handlePixelTracking(pixelId: string, userAgent?: string, ipAddress?: string): Promise<void> {
    try {
      const tracking = await this.emailTrackingService.getTrackingByPixelId(pixelId);
      
      if (!tracking) {
        console.log(`Tracking record not found for pixel ID: ${pixelId}`);
        return;
      }

      // Only update if not already opened
      if (tracking.status !== EmailStatus.OPENED && tracking.status !== EmailStatus.CLICKED && tracking.status !== EmailStatus.REPLIED) {
        await this.emailTrackingService.updateTracking(tracking.id, {
          status: EmailStatus.OPENED,
          openedAt: new Date(),
        });

        console.log(`Email opened: ${tracking.recipientEmail} (Campaign: ${tracking.campaignId})`);
      }
    } catch (error) {
      console.error(`Error handling pixel tracking for ${pixelId}:`, error);
    }
  }

  async handleReplyTracking(replyId: string, replyContent?: string): Promise<void> {
    try {
      const tracking = await this.emailTrackingService.getTrackingByReplyId(replyId);
      
      if (!tracking) {
        console.log(`Tracking record not found for reply ID: ${replyId}`);
        return;
      }

      // Update to replied status
      await this.emailTrackingService.updateTracking(tracking.id, {
        status: EmailStatus.REPLIED,
        repliedAt: new Date(),
      });

      console.log(`Email replied: ${tracking.recipientEmail} (Campaign: ${tracking.campaignId})`);
    } catch (error) {
      console.error(`Error handling reply tracking for ${replyId}:`, error);
    }
  }

  async handleClickTracking(pixelId: string, clickUrl?: string): Promise<void> {
    try {
      const tracking = await this.emailTrackingService.getTrackingByPixelId(pixelId);
      
      if (!tracking) {
        console.log(`Tracking record not found for pixel ID: ${pixelId}`);
        return;
      }

      // Update to clicked status
      await this.emailTrackingService.updateTracking(tracking.id, {
        status: EmailStatus.CLICKED,
        clickedAt: new Date(),
        clickUrl,
      });

      console.log(`Email clicked: ${tracking.recipientEmail} (Campaign: ${tracking.campaignId})`);
    } catch (error) {
      console.error(`Error handling click tracking for ${pixelId}:`, error);
    }
  }

  async handleBounceTracking(email: string, bounceReason?: string): Promise<void> {
    try {
      // Find tracking records for this email
      const trackingHistory = await this.emailTrackingService.getRecipientTrackingHistory(email);
      
      for (const tracking of trackingHistory) {
        if (tracking.status === EmailStatus.SENT) {
          await this.emailTrackingService.updateTracking(tracking.id, {
            status: EmailStatus.BOUNCED,
            bouncedAt: new Date(),
            bounceReason,
          });
        }
      }

      console.log(`Email bounced: ${email} (Reason: ${bounceReason})`);
    } catch (error) {
      console.error(`Error handling bounce tracking for ${email}:`, error);
    }
  }

  async handleUnsubscribeTracking(email: string, campaignId?: string): Promise<void> {
    try {
      // Find tracking records for this email
      const trackingHistory = await this.emailTrackingService.getRecipientTrackingHistory(email, campaignId);
      
      for (const tracking of trackingHistory) {
        if (tracking.status !== EmailStatus.UNSUBSCRIBED) {
          await this.emailTrackingService.updateTracking(tracking.id, {
            status: EmailStatus.UNSUBSCRIBED,
            unsubscribedAt: new Date(),
          });
        }
      }

      console.log(`Email unsubscribed: ${email} (Campaign: ${campaignId})`);
    } catch (error) {
      console.error(`Error handling unsubscribe tracking for ${email}:`, error);
    }
  }
}
