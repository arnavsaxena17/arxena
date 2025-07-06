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

      // Get auth client
      const auth = await this.googleContactsService.loadSavedCredentialsIfExist(jobData.twentyToken);
      if (!auth) {
        throw new Error('Failed to authenticate with Google');
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
} 