import { Module } from "@nestjs/common";
import { MailerService } from "./gmail-sender.service";
import { MailerController } from "./gmail-sender.controller";

@Module({
  controllers: [MailerController],
  providers: [MailerService],
  exports: [MailerService],
})
export class MailerModule {}
