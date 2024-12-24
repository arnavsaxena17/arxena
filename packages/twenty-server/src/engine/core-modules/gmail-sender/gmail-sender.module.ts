import { Module } from "@nestjs/common";
import { GoogleAuthService, MailerService } from "./gmail-sender.service";
// import { GoogleAuthController } from "./gmail-sender";

@Module({
  imports: [],
  controllers: [],
  providers: [MailerService, GoogleAuthService],
  exports: [MailerService],
})
export class MailerModule {}
