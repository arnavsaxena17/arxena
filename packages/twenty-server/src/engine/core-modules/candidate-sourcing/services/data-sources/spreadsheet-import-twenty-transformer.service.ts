import { Injectable } from '@nestjs/common';
import { MasterDataFormat } from '../../types/master-data.types';
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

  transformToMasterFormat(
    candidateData: any,
    context: TransformationContext
  ): MasterDataFormat {
    const masterData = this.createBaseMasterData(candidateData, context);
    
    // Process name
    this.processNameData(candidateData, masterData);
    
    // Process contact information
    this.processSpreadsheetContactData(candidateData, masterData);
    
    // Process profile information
    this.processSpreadsheetProfileData(candidateData, masterData);
    
    // Process skills
    this.processSkillsData(candidateData, masterData);
    
    // Process spreadsheet-specific data
    this.processSpreadsheetSpecificData(candidateData, masterData);
    
    return masterData;
  }

  private processSpreadsheetContactData(candidateData: any, masterData: MasterDataFormat): void {
    // Process phone numbers - spreadsheet import uses specific field names
    const phoneNumberKey = candidateData['Phone number (phoneNumber)'] || 
                          candidateData.phoneNumber || 
                          candidateData.phone_number;
    
    if (phoneNumberKey) {
      const phones = this.dataProcessingUtils.cleanPhoneNumbers(phoneNumberKey);
      masterData.phone_numbers = phones;
      masterData.all_numbers = phones;
    }

    // Process email addresses - spreadsheet import uses specific field names
    const emailKey = candidateData['Email (email)'] || 
                    candidateData.email || 
                    candidateData.email_address;
    
    if (emailKey) {
      const emails = this.dataProcessingUtils.cleanEmailAddresses(emailKey);
      masterData.email_address = emails;
      masterData.all_mails = emails;
      
      // Categorize emails
      masterData.emails.personal = emails.filter(email => 
        !email.includes('@company.') && !email.includes('@corp.')
      );
      masterData.emails.work = emails.filter(email => 
        email.includes('@company.') || email.includes('@corp.')
      );
    }
  }

  private processSpreadsheetProfileData(candidateData: any, masterData: MasterDataFormat): void {
    const profileUrl = candidateData.phone_number || candidateData.email_address || '';
    
    if (profileUrl) {
      masterData.profile_url = profileUrl;
      masterData.profiles = [{
        title: candidateData.profileSummary || null,
        network: 'spreadsheet_import_twenty',
        connections: null,
        username: candidateData.applicationId?.toString() || '',
        is_primary: true,
        url: profileUrl,
      }];
    }

    // Set profile title
    masterData.profile_title = candidateData.profileSummary || null;
  }

  private processSpreadsheetSpecificData(candidateData: any, masterData: MasterDataFormat): void {
    // Set application ID if available
    if (candidateData.applicationId) {
      masterData.id = candidateData.applicationId.toString();
    }
    
    // Process profile summary
    if (candidateData.profileSummary) {
      masterData.job_process.events.push({
        type: 'profile_summary',
        value: candidateData.profileSummary,
        timestamp: new Date().toISOString(),
      });
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
        masterData.job_process.events.push({
          type: field,
          value: candidateData[field],
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Process any custom fields that might exist in spreadsheet imports
    Object.keys(candidateData).forEach(key => {
      // Skip standard fields we've already processed
      const standardFields = [
        'name', 'Name', 'first_name', 'last_name', 'email', 'phone_number',
        'profileSummary', 'applicationId', 'keySkills', 'Phone number (phoneNumber)',
        'Email (email)'
      ];
      
      if (!standardFields.includes(key) && candidateData[key]) {
        masterData.job_process.events.push({
          type: `custom_${key}`,
          value: candidateData[key],
          timestamp: new Date().toISOString(),
        });
      }
    });
    
    // Generate unique key string based on available data
    const nameData = candidateData.name || candidateData.Name || masterData.full_name || '';
    if (nameData) {
      masterData.unique_key_string = nameData
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 50) + '_' + Date.now();
    } else {
      // Fallback if no name is available
      masterData.unique_key_string = 'spreadsheet_import_' + Date.now();
    }
  }
}
