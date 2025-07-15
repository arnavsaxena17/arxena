import { Logger } from '@nestjs/common';
import axios from 'axios';
import { createTransport, SendMailOptions, Transporter } from 'nodemailer';
import type { Attachment } from 'nodemailer/lib/mailer';
import SMTPConnection from 'nodemailer/lib/smtp-connection';

import { EmailDriver } from 'src/engine/core-modules/email/drivers/interfaces/email-driver.interface';

const RETRY_DELAY = 5000; // 5 seconds
const MAX_RETRIES = 3;

export class SmtpDriver implements EmailDriver {
  private readonly logger = new Logger(SmtpDriver.name);
  private transport: Transporter;

  constructor(options: SMTPConnection.Options) {
    this.transport = createTransport({
      ...options,
      pool: true, // Use connection pooling
      maxConnections: 5,
      rateDelta: 1000, // Minimum time between messages
      rateLimit: 5, // Max messages per rateDelta
    });
  }

  private async downloadAttachment(url: string): Promise<Buffer> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 10000, // 10 second timeout
        maxContentLength: 10 * 1024 * 1024, // 10MB max file size
      });
      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error(`Failed to download attachment from ${url}: ${error.message}`);
      throw new Error(`Attachment download failed: ${error.message}`);
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isRateLimitError(error: any): boolean {
    return error.responseCode === 421 || 
           (error.message && error.message.includes('Try again later'));
  }

  async send(sendMailOptions: SendMailOptions): Promise<void> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        this.logger.log(`Attempt ${attempt}: Sending email to '${sendMailOptions.to}'`);

        // Handle attachments if present
        if (sendMailOptions.attachments) {
          const processedAttachments = await Promise.all(
            sendMailOptions.attachments.map(async (attachment: Attachment) => {
              if (typeof attachment.path === 'string' && attachment.path.startsWith('http')) {
                try {
                  const content = await this.downloadAttachment(attachment.path);
                  return {
                    ...attachment,
                    content,
                    path: undefined, // Remove path since we're using content
                  } as Attachment;
                } catch (error) {
                  this.logger.warn(
                    `Skipping attachment ${attachment.filename} due to download error: ${error.message}`,
                  );
                  return undefined;
                }
              }
              return attachment;
            }),
          );

          // Filter out failed attachments
          sendMailOptions.attachments = processedAttachments.filter((a): a is Attachment => a !== undefined);
        }

        await this.transport.sendMail(sendMailOptions);
        this.logger.log(`Email to '${sendMailOptions.to}' successfully sent`);
        return;
      } catch (error) {
        lastError = error;
        
        if (this.isRateLimitError(error)) {
          if (attempt < MAX_RETRIES) {
            const delayTime = RETRY_DELAY * attempt;
            this.logger.warn(
              `Rate limit hit, waiting ${delayTime/1000} seconds before retry ${attempt + 1}/${MAX_RETRIES}`,
            );
            await this.delay(delayTime);
            continue;
          }
        }
        
        this.logger.error(
          `Error sending email to '${sendMailOptions.to}': ${error.message}`,
          error.stack,
        );
        break;
      }
    }

    if (lastError) {
      throw lastError;
    }
  }
}
