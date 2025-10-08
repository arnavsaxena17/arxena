import { Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { MessageQueue } from '../message-queue/message-queue.constants';
import { GoogleContactsService } from './google-contacts.service';

interface GoogleContactQueueData {
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

@Injectable()
@Processor(MessageQueue.googleContactsQueue)
export class GoogleContactsProcessor {
  constructor(private readonly googleContactsService: GoogleContactsService) {}

  @Process()
  async processGoogleContact(job: Job<GoogleContactQueueData>) {
    try {
      const {
        firstName,
        lastName,
        phoneNumber,
        email,
        company,
        jobTitle,
        searchName,
        twentyToken,
      } = job.data;

      // Check if Google Contacts service is available
      if (!this.googleContactsService.isServiceAvailable()) {
        console.warn('Google Contacts service is not available - missing required environment variables. Skipping contact creation.');
        return { success: false, reason: 'Service not available' };
      }

      // Get auth client
      const auth = await this.googleContactsService.loadSavedCredentialsIfExist(twentyToken);
      if (!auth) {
        console.warn('Failed to authenticate with Google - no valid credentials found. Skipping contact creation.');
        return { success: false, reason: 'Authentication failed' };
      }

      // Format contact for Google API
      const contact = {
        contactPerson: {
          names: [{
            givenName: firstName,
            familyName: lastName
          }],
          phoneNumbers: [{
            value: phoneNumber,
            type: 'home'
          }],
          emailAddresses: [{
            value: email
          }],
          organizations: [{
            name: company,
            title: jobTitle
          }]
        }
      };

      // Create contact
      await this.googleContactsService.batchCreateContacts(
        auth,
        [contact],
        searchName
      );

      return { success: true };
    } catch (error) {
      console.error('Error processing Google Contact:', error);
      throw error;
    }
  }
} 