import { Injectable } from '@nestjs/common';
import { UserProfile } from 'twenty-shared';
import { DataProcessingUtils } from '../../utils/data-processing.utils';
import { BaseDataSourceTransformerService, TransformationContext } from './base-data-source-transformer.service';

@Injectable()
export class SpreadsheetImportTwentyTransformerService extends BaseDataSourceTransformerService {
  constructor(dataProcessingUtils: DataProcessingUtils) {
    super(dataProcessingUtils);
  }

  getDataSourceIdentifier(): string {
    return 'spreadsheet_import_twenty';
  }

  transformToUserProfile(
    candidateData: any,
    context: TransformationContext
  ): UserProfile {
    const userProfile = this.createBaseUserProfile(candidateData, context);
    
    // Process name
    this.processNameData(candidateData, userProfile);
    
    // Process contact information
    this.processSpreadsheetContactData(candidateData, userProfile);
    
    // Process profile information
    this.processSpreadsheetProfileData(candidateData, userProfile);
    
    // Process job information (jobTitle, jobCompanyName)
    this.setJobInfo(candidateData, userProfile);
    
    // Process skills
    this.processSkillsData(candidateData, userProfile);
    
    // Process spreadsheet-specific data
    this.processSpreadsheetSpecificData(candidateData, userProfile);
    
    return userProfile;
  }

  private processSpreadsheetContactData(candidateData: any, userProfile: UserProfile): void {
    // Process phone numbers - spreadsheet import uses specific field names
    const phoneNumberKey = candidateData['Phone number (phones)'] || 
                          candidateData['Phone number (phoneNumber)'] || 
                          candidateData['Phone Number'] ||
                          candidateData.phoneNumber || 
                          candidateData.phone_number;
    
    console.log("Phone input created from candidate data:", phoneNumberKey);
    
    if (phoneNumberKey) {
      const phones = this.dataProcessingUtils.cleanPhoneNumbers(phoneNumberKey);
      userProfile.phoneNumbers = phones;
      userProfile.phoneNumber = phones[0] || '';
    }

    // Process email addresses - spreadsheet import uses specific field names
    const emailKey = candidateData['Email (emails)'] || 
                    candidateData['Email (email)'] || 
                    candidateData['Email ID'] ||
                    candidateData.email || 
                    candidateData.email_address;
    
    console.log("Email input created from candidate data:", emailKey);
    
    if (emailKey) {
      const emails = this.dataProcessingUtils.cleanEmailAddresses(emailKey);
      userProfile.emailAddresses = emails;
      userProfile.emailAddress = emails[0] || '';
      
    }
  }

  private processSpreadsheetProfileData(candidateData: any, userProfile: UserProfile): void {
    const profileUrl = candidateData.phone_number || candidateData.email_address || '';
    
    if (profileUrl) {
      userProfile.profileUrl = profileUrl;
    }

    // Set profile title
    userProfile.profileTitle = candidateData.profileSummary || null;
  }

  private processSpreadsheetSpecificData(candidateData: any, userProfile: UserProfile): void {
    // Set application ID if available
    if (candidateData.applicationId) {
      userProfile.id = candidateData.applicationId.toString();
    }
    
    // Process profile summary
    if (candidateData.profileSummary) {
      // this.addJobProcessEvent(userProfile, 'profile_summary', candidateData.profileSummary);
    }
    
    // Process any additional fields that might be in the spreadsheet
    const spreadsheetSpecificFields = [
      'campaign',
      'source',
      'notes',
      'status',
      'priority',
      'category',
    ];
    
    spreadsheetSpecificFields.forEach(field => {
      if (candidateData[field]) {
        // this.addJobProcessEvent(userProfile, field, candidateData[field]);
      }
    });

    // Process any custom fields that might exist in spreadsheet imports
    Object.keys(candidateData).forEach(key => {
      // Skip standard fields we've already processed
      const standardFields = [
        'name', 'Name', 'first_name', 'last_name', 'email', 'phone_number',
        'profileSummary', 'applicationId', 'keySkills', 'Phone number (phoneNumber)',
        'Phone number (phones)', 'Email (email)', 'Email (emails)', 'First Name (name)',
        'Last Name (name)','jobTitle'
      ];
      
      if (!standardFields.includes(key) && candidateData[key]) {
        // this.addJobProcessEvent(userProfile, `custom_${key}`, candidateData[key]);
      }
    });
    
    // Only generate unique key string if one doesn't already exist
    if (!userProfile.uniqueStringKey) {
      // Use the DataProcessingUtils to generate uniqueStringKey properly
      userProfile.uniqueStringKey = this.dataProcessingUtils.generateUniqueStringKey(
        candidateData,
        'spreadsheet_import_twenty'
      );
    }
  }

  /**
   * Add event to job process - utility method for UserProfile
   */
  // protected addJobProcessEvent(userProfile: UserProfile, type: string, value: any): void {
  //   if (value !== null && value !== undefined && value !== '') {
  //     if (!userProfile.job_process_events) {
  //       userProfile.job_process_events = [];
  //     }
  //     userProfile.job_process_events.push({
  //       type,
  //       value,
  //       timestamp: new Date().toISOString(),
  //     });
  //   }
  // }
}
