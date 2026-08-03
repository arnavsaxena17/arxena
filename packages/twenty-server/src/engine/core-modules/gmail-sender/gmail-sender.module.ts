import { Module } from "@nestjs/common";
import { GoogleConnectedAccountAuthModule } from "src/engine/core-modules/google-auth/google-connected-account-auth.module";
import { GoogleAuthService, MailerService } from "./gmail-sender.service";

@Module({
  imports: [GoogleConnectedAccountAuthModule],
  controllers: [],
  providers: [MailerService, GoogleAuthService],
  exports: [MailerService],
})
export class MailerModule {}
