import { Controller, Post, Body, Headers, UseGuards, ValidationPipe } from '@nestjs/common';
import { GoogleContactsService } from './google-contacts.service';
import { IsArray, IsString, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard } from '@nestjs/passport';
import { google, people_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';


// DTO for contact information
class ContactNameDto {
  @IsString()
  givenName: string;

  @IsString()
  @IsOptional()
  familyName?: string;
}

class ContactPhoneDto {
  @IsString()
  value: string;

  @IsString()
  @IsOptional()
  type?: string = 'home';
}

class ContactEmailDto {
  @IsString()
  value: string;
}

class ContactOrganizationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  title?: string;
}

class ContactPersonDto {
  @ValidateNested({ each: true })
  @Type(() => ContactNameDto)
  names: ContactNameDto[];

  @ValidateNested({ each: true })
  @Type(() => ContactPhoneDto)
  phoneNumbers: ContactPhoneDto[];

  @ValidateNested({ each: true })
  @Type(() => ContactEmailDto)
  emailAddresses: ContactEmailDto[];

  @ValidateNested({ each: true })
  @Type(() => ContactOrganizationDto)
  @IsOptional()
  organizations?: ContactOrganizationDto[];
}

class BulkContactsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactPersonDto)
  contacts: ContactPersonDto[];

  @IsString()
  searchName: string;
}

@Controller('contacts')
@UseGuards(AuthGuard('jwt'))
export class ContactsController {
  constructor(private readonly googleContactsService: GoogleContactsService) {}

  @Post('bulk')
  async createBulkContacts(
    @Headers('authorization') authHeader: string,
    @Body(new ValidationPipe({ transform: true })) bulkContactsDto: BulkContactsDto
  ) {
    try {
      // Extract token from Authorization header
      const twentyToken = authHeader.replace('Bearer ', '');

      // Get auth client
      const auth = await this.googleContactsService.loadSavedCredentialsIfExist(twentyToken);
      if (!auth) {
        throw new Error('Failed to authenticate with Google');
      }

      // Get existing phone numbers to avoid duplicates
      const existingNumbers = await this.googleContactsService.getExistingPhoneNumbers(auth);

      // Format contacts for Google API
      const formattedContacts = bulkContactsDto.contacts.map(contact => ({
        contactPerson: contact
      }));

      // Filter out contacts with existing phone numbers
      const contactsToCreate = formattedContacts.filter(contact => 
        !existingNumbers.has(contact.contactPerson.phoneNumbers[0].value)
      );

      // Create contacts
      const result = await this.googleContactsService.batchCreateContacts(
        auth,
        contactsToCreate,
        bulkContactsDto.searchName
      );

      return {
        success: true,
        message: `Successfully processed ${contactsToCreate.length} contacts`,
        skipped: formattedContacts.length - contactsToCreate.length,
        created: contactsToCreate.length,
        details: result
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to create contacts',
        error: error.message
      };
    }
  }

  // Endpoint to get all contact groups
  @Post('groups')
  async getContactGroups(@Headers('authorization') authHeader: string) {
    try {
      const twentyToken = authHeader.replace('Bearer ', '');
      const auth = await this.googleContactsService.loadSavedCredentialsIfExist(twentyToken);
      
      if (!auth) {
        throw new Error('Failed to authenticate with Google');
      }

      // Create OAuth2Client instance
      const oauth2Client = new OAuth2Client({
        clientId: process.env.AUTH_GOOGLE_CLIENT_ID,
        clientSecret: process.env.AUTH_GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.AUTH_GOOGLE_CALLBACK_URL,
      });

      // Set credentials from auth
      oauth2Client.setCredentials({
        refresh_token: auth.credentials.refresh_token,
        access_token: auth.credentials.access_token,
      });

      // Create people service with proper typing
      const peopleService: people_v1.People = google.people({
        version: 'v1',
        auth: oauth2Client
      });

      const response = await peopleService.contactGroups.list();

      return {
        success: true,
        groups: response.data.contactGroups
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to fetch contact groups',
        error: error.message
      };
    }
  }

}