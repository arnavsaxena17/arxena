import { Module } from "@nestjs/common";
import { GoogleContactsService } from "./google-contacts.service";

@Module({
  imports: [],
  controllers: [],
  providers: [GoogleContactsService],
  exports: [GoogleContactsService],
})
export class GoogleContactsModule {}
