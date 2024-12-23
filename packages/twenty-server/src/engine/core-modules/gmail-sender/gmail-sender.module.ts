import { Module } from "@nestjs/common";
import { GoogleAuthService, MailerService } from "./gmail-sender.service";
import { GoogleAuthController, GmailSender } from "./gmail-sender.controller";

@Module({
  imports: [],
  controllers: [GoogleAuthController],
  providers: [MailerService, GoogleAuthService],
  exports: [MailerService],
})
export class MailerModule {}
