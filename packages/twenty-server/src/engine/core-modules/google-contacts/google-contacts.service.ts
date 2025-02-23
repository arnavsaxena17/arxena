import { Injectable } from "@nestjs/common";
import { google } from "googleapis";
import axios from "axios";

@Injectable()
export class GoogleContactsService {
  private oauth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.AUTH_GOOGLE_CLIENT_ID,
      process.env.AUTH_GOOGLE_CLIENT_SECRET,
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

    if (connectedAccountsResponse?.data?.data?.connectedAccounts?.length > 0) {
      const connectedAccountToUse = connectedAccountsResponse.data.data.connectedAccounts
        .filter(x => x.handle === process.env.EMAIL_SMTP_USER)[0];
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
          pageSize: 1000,
          personFields: 'phoneNumbers',
          pageToken: pageToken || undefined
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
      console.error('Error getting existing phone numbers:', error);
      throw error;
    }
  }
}