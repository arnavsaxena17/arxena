import { Logger } from '@nestjs/common';

import { createTransport, SendMailOptions, Transporter } from 'nodemailer';
import SMTPConnection from 'nodemailer/lib/smtp-connection';

import { EmailDriver } from 'src/engine/core-modules/email/drivers/interfaces/email-driver.interface';

export class SmtpDriver implements EmailDriver {
  private readonly logger = new Logger(SmtpDriver.name);
  private transport: Transporter;

  constructor(options: SMTPConnection.Options) {
    this.transport = createTransport(options);
  }

  async send(sendMailOptions: SendMailOptions): Promise<void> {
    try {
      this.logger.log(`Attempting to send email to '${sendMailOptions.to}'`);
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
