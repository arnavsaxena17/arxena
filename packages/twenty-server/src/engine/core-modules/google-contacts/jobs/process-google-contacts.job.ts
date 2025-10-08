import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { GoogleContactsService } from '../google-contacts.service';

interface GoogleContactJobData {
  candidateId: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  company: string;
  jobTitle: string;
  searchName: string;
  twentyToken: string;
}

@Processor(MessageQueue.googleContactsQueue)
export class GoogleContactsQueueProcessor {
  constructor(
    private readonly googleContactsService: GoogleContactsService,
  ) {
    console.log('GoogleContactsQueueProcessor initialized');
  }

  @Process(GoogleContactsQueueProcessor.name)
  async handle(jobData: GoogleContactJobData): Promise<void> {
    try {
      console.log(
        `Processing Google Contact creation for candidate ${jobData.candidateId}`,
      );

      // Check if Google Contacts service is available
      if (!this.googleContactsService.isServiceAvailable()) {
        console.warn('Google Contacts service is not available - missing required environment variables. Skipping contact creation.');
        return;
      }

      // Get auth client
      const auth = await this.googleContactsService.loadSavedCredentialsIfExist(jobData.twentyToken);
      if (!auth) {
        console.warn('Failed to authenticate with Google - no valid credentials found. Skipping contact creation.');
        return;
      }

      // Format contact for Google API
      const contact = {
        contactPerson: {
          names: [{
            givenName: jobData.firstName,
            familyName: jobData.lastName
          }],
          phoneNumbers: [{
            value: jobData.phoneNumber,
            type: 'home'
          }],
          emailAddresses: [{
            value: jobData.email
          }],
          organizations: [{
            name: jobData.company,
            title: jobData.jobTitle
          }]
        }
      };

      // Create contact
      await this.googleContactsService.batchCreateContacts(
        auth,
        [contact],
        jobData.searchName
      );

      console.log(
        `Successfully created Google Contact for candidate ${jobData.candidateId}`,
      );
    } catch (error) {
      console.error(
        `Failed to create Google Contact for candidate ${jobData.candidateId}:`,
        error,
      );
      throw error;
    }
  }

  @Process('GoogleContactsBatchProcessor')
  async handleBatch(jobData: {
    contacts: any[];
    searchName: string;
    twentyToken: string;
  }): Promise<void> {
    try {
      console.log(
        `Processing Google Contacts batch creation for ${jobData.contacts.length} contacts`,
      );

      // Check if Google Contacts service is available
      if (!this.googleContactsService.isServiceAvailable()) {
        console.warn('Google Contacts service is not available - missing required environment variables. Skipping batch contact creation.');
        return;
      }

      // Get auth client
      const auth = await this.googleContactsService.loadSavedCredentialsIfExist(jobData.twentyToken);
      if (!auth) {
        console.warn('Failed to authenticate with Google - no valid credentials found. Skipping batch contact creation.');
        return;
      }

      // Create contacts in batch
      await this.googleContactsService.batchCreateContacts(
        auth,
        jobData.contacts,
        jobData.searchName
      );

      console.log(
        `Successfully created ${jobData.contacts.length} Google Contacts`,
      );
    } catch (error) {
      console.error(
        `Failed to create Google Contacts batch:`,
        error,
      );
      throw error;
    }
  }
} 