import { Injectable } from "@nestjs/common";
import axios from "axios";
import { google } from "googleapis";
import { graphqlToFetchAllCandidateData } from "twenty-shared";
import { StaticGraphQLService } from "../graphql/static-graphql.service";

type AddCandidatesToGoogleContactsResult = {
  success: boolean;
  message?: string;
  error?: string;
  skipped?: number;
  created?: number;
  skippedDetails?: { candidateId: string; reason: string }[];
  details?: { status: string; message?: string };
};

@Injectable()
export class GoogleContactsService {
  private oauth2Client;

  constructor(private readonly staticGraphQLService: StaticGraphQLService) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.AUTH_GOOGLE_CLIENT_ID,
      process.env.AUTH_GOOGLE_CLIENT_SECRET,
      process.env.AUTH_GOOGLE_CALLBACK_URL
    );
  }

  /**
   * Check if Google Contacts service is available and properly configured
   */
  isServiceAvailable(): boolean {
    return !!(
      process.env.AUTH_GOOGLE_CLIENT_ID &&
      process.env.AUTH_GOOGLE_CLIENT_SECRET &&
      process.env.AUTH_GOOGLE_CALLBACK_URL
    );
  }

  async loadSavedCredentialsIfExist(twenty_token: string) {
    const connectedAccountsResponse = await axios.request({
      method: "get", 
      url: "http://localhost:3000/rest/connectedAccounts",
      headers: {
        authorization: "Bearer " + twenty_token,
        "content-type": "application/json",
      },
    });

    const connectedAccounts =
      connectedAccountsResponse?.data?.data?.connectedAccounts ?? [];

    if (connectedAccounts.length > 0) {
      const connectedAccountToUse = connectedAccounts.find(
        (account) => account.provider?.toLowerCase() === 'google',
      );
      const refreshToken = connectedAccountToUse?.refreshToken;
      
      if (!refreshToken) {
        return null;
      }

      try {
        const credentials = {
          type: "authorized_user",
          client_id: process.env.AUTH_GOOGLE_CLIENT_ID,
          client_secret: process.env.AUTH_GOOGLE_CLIENT_SECRET,
          refresh_token: refreshToken,
        };

        return google.auth.fromJSON(credentials);
      } catch (err) {
        return null;
      }
    }
  }

  async createOrGetContactGroup(auth, groupName: string) {
    try {
      const people = google.people({ version: 'v1', auth });
      
      // List existing groups
      const results = await people.contactGroups.list();
      const contactGroups = results.data.contactGroups || [];

      // Check if group exists
      for (const group of contactGroups) {
        if (group.name === groupName) {
          return group.resourceName;
        }
      }

      // Create new group if it doesn't exist
      const response = await people.contactGroups.create({
        requestBody: {
          contactGroup: {
            name: groupName
          }
        }
      });

      return response.data.resourceName;

    } catch (error) {
      console.error('Error creating/getting contact group:', error);
      return null;
    }
  }

  async batchCreateContacts(auth, contacts: any[], searchName: string) {
    try {
      const people = google.people({ version: 'v1', auth });
      
      const groupResourceName = await this.createOrGetContactGroup(auth, searchName);
      if (!groupResourceName) {
        throw new Error("Failed to create contact group");
      }

      const batchSize = 200;
      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        
        const body = {
          contacts: batch.map(contact => ({
            contactPerson: {
              names: [{
                givenName: contact.contactPerson.names[0].givenName,
                familyName: contact.contactPerson.names[0].familyName,
                honorificSuffix: searchName
              }],
              phoneNumbers: [{
                type: "home",
                value: contact.contactPerson.phoneNumbers[0].value
              }],
              emailAddresses: [{
                value: contact.contactPerson.emailAddresses[0].value
              }],
              organizations: [{
                name: contact.contactPerson.organizations[0].name,
                title: contact.contactPerson.organizations[0].title
              }],
              memberships: [{
                contactGroupMembership: {
                  contactGroupResourceName: groupResourceName
                }
              }]
            }
          }))
        };

        await people.people.batchCreateContacts({
          requestBody: body
        });
      }

      return { status: "success", message: "Contacts uploaded successfully" };

    } catch (error) {
      console.error('Error creating contacts:', error);
      throw error;
    }
  }

  async getExistingPhoneNumbers(auth) {
    const existingNumbers = new Set();
    const people = google.people({ version: 'v1', auth });
    let pageToken: string | null = null;

    try {
      do {
        const response = await people.people.connections.list({
          resourceName: 'people/me',
          pageSize: 1000,
          personFields: 'phoneNumbers',
          pageToken: pageToken || undefined,
        });

        const connections = response.data.connections || [];
        
        for (const person of connections) {
          const phoneNumbers = person.phoneNumbers || [];
          for (const phone of phoneNumbers) {
            existingNumbers.add(phone.value);
          }
        }

        pageToken = response.data.nextPageToken;
      } while (pageToken);

      return existingNumbers;

    } catch (error) {
      console.error('Error getting existing phone numbers in google contacts service:', error);
      throw error;
    }
  }

  /**
   * Same path as the right-drawer "Add to Google Contacts" action
   * (`POST /contacts/add-candidate-to-google-contacts`).
   */
  async addCandidatesToGoogleContacts(
    twentyToken: string,
    candidateIds: string[],
  ): Promise<AddCandidatesToGoogleContactsResult> {
    try {
      if (!candidateIds.length) {
        return {
          success: false,
          error: 'No candidates provided',
        };
      }

      const auth = await this.loadSavedCredentialsIfExist(twentyToken);
      if (!auth) {
        throw new Error('Failed to authenticate with Google');
      }

      const candidatesResponse = await this.staticGraphQLService.executeGraphQL(
        graphqlToFetchAllCandidateData,
        { filter: { id: { in: candidateIds } } },
        twentyToken,
      );

      const candidates =
        candidatesResponse?.data?.data?.candidates?.edges?.map(
          (edge: { node: Record<string, unknown> }) => edge.node,
        ) || [];

      if (candidates.length === 0) {
        return {
          success: false,
          error: 'No candidates found',
        };
      }

      const existingNumbers = await this.getExistingPhoneNumbers(auth);
      console.log(
        `Found ${existingNumbers.size} existing phone numbers in Google Contacts`,
      );

      const contactsToCreate: {
        contactPerson: {
          names: { givenName: string; familyName: string }[];
          phoneNumbers: { value: string; type: string }[];
          emailAddresses: { value: string }[];
          organizations: { name: string; title: string }[];
        };
      }[] = [];
      const skippedCandidates: { candidateId: string; reason: string }[] = [];

      for (const candidate of candidates) {
        const people = candidate.people as
          | {
              phones?: { primaryPhoneNumber?: string };
              emails?: { primaryEmail?: string };
              name?: { firstName?: string; lastName?: string };
              jobTitle?: string;
            }
          | undefined;
        const phoneNumberField = candidate.phoneNumber as
          | { primaryPhoneNumber?: string }
          | undefined;
        const emailField = candidate.email as
          | { primaryEmail?: string }
          | undefined;

        const phoneNumber =
          people?.phones?.primaryPhoneNumber ||
          phoneNumberField?.primaryPhoneNumber;
        const email =
          people?.emails?.primaryEmail || emailField?.primaryEmail;
        const nameParts =
          typeof candidate.name === 'string'
            ? candidate.name.trim().split(/\s+/)
            : [];
        const firstName = people?.name?.firstName || nameParts[0] || '';
        const lastName =
          people?.name?.lastName || nameParts.slice(1).join(' ') || '';
        const jobTitle =
          people?.jobTitle ||
          (typeof candidate.jobTitle === 'string' ? candidate.jobTitle : '') ||
          '';
        const companyName =
          typeof candidate.jobCompanyName === 'string'
            ? candidate.jobCompanyName
            : '';
        const candidateId =
          typeof candidate.id === 'string' ? candidate.id : 'unknown';

        if (!phoneNumber) {
          console.warn(
            `Candidate ${candidateId} has no phone number, skipping`,
          );
          skippedCandidates.push({
            candidateId,
            reason: 'No phone number',
          });
          continue;
        }

        if (!email) {
          console.warn(`Candidate ${candidateId} has no email, skipping`);
          skippedCandidates.push({
            candidateId,
            reason: 'No email',
          });
          continue;
        }

        if (existingNumbers.has(phoneNumber)) {
          console.log(
            `Skipping candidate ${candidateId} with phone number ${phoneNumber} - already exists`,
          );
          skippedCandidates.push({
            candidateId,
            reason: 'Phone number already exists',
          });
          continue;
        }

        contactsToCreate.push({
          contactPerson: {
            names: [
              {
                givenName: firstName,
                familyName: lastName,
              },
            ],
            phoneNumbers: [
              {
                value: phoneNumber,
                type: 'home',
              },
            ],
            emailAddresses: [
              {
                value: email,
              },
            ],
            organizations: [
              {
                name: companyName,
                title: jobTitle,
              },
            ],
          },
        });
      }

      console.log(
        `Filtered ${candidates.length} candidates down to ${contactsToCreate.length} new contacts`,
      );

      if (contactsToCreate.length === 0) {
        return {
          success: true,
          message:
            'All candidates already exist in Google Contacts or missing required data',
          skipped: candidates.length,
          created: 0,
          skippedDetails: skippedCandidates,
          details: { status: 'no_new_contacts' },
        };
      }

      const result = await this.batchCreateContacts(
        auth,
        contactsToCreate,
        'Arx',
      );

      return {
        success: true,
        message: `Successfully processed ${contactsToCreate.length} candidates`,
        skipped: skippedCandidates.length,
        created: contactsToCreate.length,
        skippedDetails: skippedCandidates,
        details: result,
      };
    } catch (error) {
      console.error('Error adding candidates to Google Contacts:', error);
      return {
        success: false,
        message: 'Failed to add candidates to Google Contacts',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}