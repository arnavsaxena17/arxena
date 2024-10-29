import { Module } from "@nestjs/common";
import { GoogleAuthService, MailerService } from "./gmail-sender.service";
import { GoogleAuthController, MailerController } from "./gmail-sender.controller";

@Module({
  imports: [],
  controllers: [MailerController, GoogleAuthController],
  providers: [MailerService, GoogleAuthService],
  exports: [MailerService],
})
export class MailerModule {}
