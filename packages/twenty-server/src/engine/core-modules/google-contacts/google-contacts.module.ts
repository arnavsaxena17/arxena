import { Module } from "@nestjs/common";
import { GraphQLExecutionModule } from "../graphql/graphql-execution.module";
import { MessageQueueModule } from "../message-queue/message-queue.module";
import { ContactsController } from "./google-contacts.controller";
import { GoogleContactsService } from "./google-contacts.service";
import { GoogleContactsQueueProcessor } from "./jobs/process-google-contacts.job";

@Module({
  imports: [
    MessageQueueModule,
    GraphQLExecutionModule,
  ],
  controllers: [ContactsController],
  providers: [GoogleContactsService, GoogleContactsQueueProcessor],
  exports: [GoogleContactsService, GoogleContactsQueueProcessor],
})
export class GoogleContactsModule {}
