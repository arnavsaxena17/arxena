import { BullModule } from '@nestjs/bull';
import { Module } from "@nestjs/common";
import { MessageQueue } from "../message-queue/message-queue.constants";
import { ContactsController } from "./google-contacts.controller";
import { GoogleContactsService } from "./google-contacts.service";
import { GoogleContactsQueueProcessor } from "./jobs/process-google-contacts.job";

@Module({
  imports: [
    BullModule.registerQueue({
      name: MessageQueue.googleContactsQueue,
    }),
  ],
  controllers: [ContactsController],
  providers: [GoogleContactsService, GoogleContactsQueueProcessor],
  exports: [GoogleContactsService],
})
export class GoogleContactsModule {}
