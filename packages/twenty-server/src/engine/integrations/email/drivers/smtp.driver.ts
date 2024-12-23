import { Logger } from '@nestjs/common';

import { createTransport, Transporter, SendMailOptions } from 'nodemailer';
import SMTPConnection from 'nodemailer/lib/smtp-connection';

import { EmailDriver } from 'src/engine/integrations/email/drivers/interfaces/email-driver.interface';

export class SmtpDriver implements EmailDriver {
  private readonly logger = new Logger(SmtpDriver.name);
  private transport: Transporter;

  constructor(options: SMTPConnection.Options) {
    this.logger.log('SMTP Options:', options);
    this.transport = createTransport(options);
    
    // Verify connection
    this.transport.verify()
      .then(() => this.logger.log('SMTP connection verified'))
      .catch(err => this.logger.error('SMTP verification failed:', err));
  }

  async send(sendMailOptions: SendMailOptions): Promise<void> {
    try {
      // Verify connection before sending
      await this.transport.verify();
      this.logger.log('SMTP connection verified');
      console.log('SMTP connection verified');

      const result = await this.transport.sendMail(sendMailOptions);
      console.log('Email sent successfully. MessageId:', result.messageId);
      
      return result;
    } catch (error) {
      console.log("SMGT PERROR:", error)
      this.logger.error('SMTP Error:', {
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode
      });
      throw error;
    }
  }
  async testConnection(): Promise<void> {
    try {
      await this.transport.verify();
      this.logger.log('SMTP connection test successful');
    } catch (error) {
      this.logger.error('SMTP connection test failed:', error);
      throw error;
    }
  }
  
}

