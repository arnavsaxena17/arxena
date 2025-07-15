import { Logger } from '@nestjs/common';
import axios from 'axios';
import { createTransport, SendMailOptions, Transporter } from 'nodemailer';
import type { Attachment } from 'nodemailer/lib/mailer';
import SMTPConnection from 'nodemailer/lib/smtp-connection';

import { EmailDriver } from 'src/engine/core-modules/email/drivers/interfaces/email-driver.interface';

export class SmtpDriver implements EmailDriver {
  private readonly logger = new Logger(SmtpDriver.name);
  private transport: Transporter;

  constructor(options: SMTPConnection.Options) {
    this.transport = createTransport(options);
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

  async send(sendMailOptions: SendMailOptions): Promise<void> {
    try {
      this.logger.log(`Attempting to send email to '${sendMailOptions.to}'`);

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
    } catch (error) {
      this.logger.error(
        `Error sending email to '${sendMailOptions.to}': ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
