import { Injectable } from '@nestjs/common';
import { NameProcessor } from '../../workspace-modifications/object-apis/data/nameProcessor';
import { CleanPhoneNumbers } from './clean-phone-numbers';

export interface NameProcessorResult {
  first_name: string;
  last_name: string;
  middle_name: string;
  middle_initial: string;
  full_name: string;
}

@Injectable()
export class DataProcessingUtils {
  private nameProcessor: NameProcessor;
  private phoneNumberCleaner: CleanPhoneNumbers;

  constructor() {
    this.nameProcessor = new NameProcessor();
    this.phoneNumberCleaner = new CleanPhoneNumbers();
  }
  /**
   * Process a full name into individual components using NameProcessor
   */
  processName(fullName: string): NameProcessorResult {
    if (!fullName || typeof fullName !== 'string') {
      return {
        first_name: '',
        last_name: '',
        middle_name: '',
        middle_initial: '',
        full_name: '',
      };
    }

    // Use the NameProcessor to process the name
    const nameData = this.nameProcessor.processName(fullName);
    
    return {
      first_name: nameData.first_name || '',
      last_name: nameData.last_name || '',
      middle_name: nameData.middle_name || '',
      middle_initial: nameData.middle_initial || '',
      full_name: this.nameProcessor.masterDataJson.full_name || fullName,
    };
  }

  /**
   * Generate a unique key string from candidate data
   * Format: first_name + last_name + company_name (matching Python implementation)
   */
  generateUniqueStringKey(candidateData: any, dataSource: string): string {
    // Spreadsheet imports often have stable contact identifiers; prefer them when present.
    // This improves deduping and ensures a consistent key across repeated uploads of the same file.
    if (typeof dataSource === 'string' && dataSource.startsWith('spreadsheet_import')) {
      const emailRaw =
        candidateData['Email ID'] ||
        candidateData['Email (emails)'] ||
        candidateData['Email (email)'] ||
        candidateData.emails ||
        candidateData.email ||
        candidateData.email_address ||
        candidateData.emailAddress;
      const email = this.cleanEmailAddresses(emailRaw)[0];
      if (email) {
        return `spreadsheet_import|email:${email}`;
      }

      const phoneRaw =
        candidateData['Phone Number'] ||
        candidateData['Phone number (phones)'] ||
        candidateData['Phone number (phoneNumber)'] ||
        candidateData.phones ||
        candidateData.phone ||
        candidateData.phoneNumber ||
        candidateData.phone_number ||
        candidateData.phone_numbers;
      const phone = this.cleanPhoneNumbers(phoneRaw)[0];
      if (phone) {
        return `spreadsheet_import|phone:${phone}`;
      }
    }

    // First try to get full name from various fields
    let fullName = candidateData.name || candidateData.jsUserName || candidateData.full_name || candidateData['Name'] || '';
    
    // If no full name found, try to construct it from first and last name fields
    if (!fullName) {
      const firstName = candidateData['First Name (name)'] || 
                       candidateData.firstName || 
                       candidateData.first_name || 
                       candidateData['First Name'] || '';
      const lastName = candidateData['Last Name (name)'] || 
                      candidateData.lastName || 
                      candidateData.last_name || 
                      candidateData['Last Name'] || '';
      
      // Only construct full name if we have at least one non-empty name component
      if (firstName.trim() || lastName.trim()) {
        fullName = `${firstName} ${lastName}`.trim();
      }
    }
    
    const companyName = candidateData.employment?.current?.organization ||
                       candidateData.employment?.current?.company ||
                       candidateData.employment?.current?.companyName ||
                       candidateData.companyName || 
                       candidateData['Curr. Company name'] || 
                       candidateData.company_name || 
                       candidateData.company || 
                       candidateData['Company'] || '';
    
    // Use NameProcessor's getUniqueStringKeyFromFullNameCompanyNameData method
    // which matches the Python implementation exactly
    const uniqueStringKey = this.nameProcessor.getUniqueStringKeyFromFullNameCompanyNameData(fullName, companyName);
    
    return uniqueStringKey;
  }

  /**
   * Clean and standardize phone numbers using advanced phone number parsing
   */
  cleanPhoneNumbers(phoneNumbers: any): string[] {
    if (!phoneNumbers) return [];
    
    const phones = Array.isArray(phoneNumbers) ? phoneNumbers : [phoneNumbers];
    
    return phones
      .map(phone => {
        // Extract phone number from object structures
        if (typeof phone === 'object' && phone !== null) {
          const po = phone as Record<string, unknown>;
          if (typeof po.primaryPhoneNumber === 'string' && po.primaryPhoneNumber.trim()) {
            return po.primaryPhoneNumber;
          }
          if (phone.number) return phone.number;
          if (phone.value) return phone.value;
          if (phone.formattedNumber) return phone.formattedNumber;
          if (phone.phoneNumber) return phone.phoneNumber;
          return null;
        }
        return phone;
      })
      .filter(phone => phone && typeof phone === 'string')
      .map(phone => {
        try {
          // Pre-validate 91 prefix for India ISD code before cleaning
          const phoneStr = phone.toString();
          if (phoneStr.startsWith('91') && !phoneStr.startsWith('+91') && phoneStr.length !== 12) {
            // If starts with 91 but not 12 digits, remove 91 prefix
            phone = phoneStr.substring(2);
          }
          
          // Use the advanced phone number cleaning utility
          return this.phoneNumberCleaner.cleanPhoneNumber(phone.toString());
        } catch (error) {
          console.warn(`Failed to clean phone number: ${phone}`, error);
          // Fallback to basic cleaning
          return phone.replace(/[^\d+]/g, '');
        }
      })
      .filter(phone => phone && phone.length >= 10)
      .filter((phone, index, array) => array.indexOf(phone) === index); // Remove duplicates
  }

  /**
   * Parse comma-separated phone numbers and create structured phone object
   */
  parsePhoneNumbers(phoneData: any): {
    primaryPhoneNumber: string;
    primaryPhoneCountryCode: string;
    primaryPhoneCallingCode: string;
    additionalPhones: Array<{
      number: string;
      callingCode: string;
      countryCode: string;
    }>;
  } {
    let primaryPhoneNumber = '';
    let primaryPhoneCountryCode = '';
    let primaryPhoneCallingCode = '';
    const additionalPhones: Array<{
      number: string;
      callingCode: string;
      countryCode: string;
    }> = [];

    if (!phoneData) {
      return {
        primaryPhoneNumber,
        primaryPhoneCountryCode,
        primaryPhoneCallingCode,
        additionalPhones
      };
    }

    // Handle different input formats
    let phoneNumbers: string[] = [];
    
    if (typeof phoneData === 'string') {
      // Split by comma and clean each phone number
      phoneNumbers = phoneData.split(',').map(phone => phone.trim()).filter(phone => phone);
    } else if (Array.isArray(phoneData)) {
      // Handle array of phone numbers
      phoneNumbers = phoneData
        .map(phone => {
          if (typeof phone === 'string') {
            return phone;
          } else if (typeof phone === 'object' && phone) {
            return (
              phone.primaryPhoneNumber ||
              phone.number ||
              phone.value ||
              phone.formattedNumber ||
              phone.phoneNumber ||
              ''
            );
          }
          return '';
        })
        .filter(phone => phone && phone.trim());
    } else if (typeof phoneData === 'object') {
      // Handle object with phone number properties
      if (phoneData.primaryPhoneNumber) {
        phoneNumbers = [phoneData.primaryPhoneNumber];
      } else if (phoneData.number) {
        phoneNumbers = [phoneData.number];
      } else if (phoneData.value) {
        phoneNumbers = [phoneData.value];
      } else if (phoneData.phoneNumber) {
        phoneNumbers = [phoneData.phoneNumber];
      }
    }

    if (phoneNumbers.length === 0) {
      return {
        primaryPhoneNumber,
        primaryPhoneCountryCode,
        primaryPhoneCallingCode,
        additionalPhones
      };
    }

    // Clean all phone numbers
    const cleanedPhones = phoneNumbers.map(phone => this.cleanPhoneNumber(phone)).filter(phone => phone);

    if (cleanedPhones.length > 0) {
      // Set the first phone as primary
      primaryPhoneNumber = cleanedPhones[0];
      
      // Extract country code and calling code from primary phone
      try {
        const parsedNumber = this.phoneNumberCleaner.parsePhoneNumber(cleanedPhones[0], 'IN');
        const countryCode = this.phoneNumberCleaner.getCountryCode(parsedNumber);
        if (countryCode) {
          primaryPhoneCountryCode = countryCode.toString();
          primaryPhoneCallingCode = `+${primaryPhoneCountryCode}`;
        }
      } catch (error) {
        // Fallback: try to extract from the phone number string
        if (cleanedPhones[0].startsWith('+91')) {
          primaryPhoneCountryCode = '91';
          primaryPhoneCallingCode = '+91';
        } else if (cleanedPhones[0].startsWith('91')) {
          primaryPhoneCountryCode = '91';
          primaryPhoneCallingCode = '+91';
        }
      }

      // Add remaining phones as additional
      for (let i = 1; i < cleanedPhones.length; i++) {
        let countryCode = 'IN';
        let callingCode = '+91';
        
        try {
          const parsedNumber = this.phoneNumberCleaner.parsePhoneNumber(cleanedPhones[i], 'IN');
          const regionCode = this.phoneNumberCleaner.getRegionCode(parsedNumber);
          const countryCodeNum = this.phoneNumberCleaner.getCountryCode(parsedNumber);
          
          if (regionCode) {
            countryCode = regionCode;
          }
          if (countryCodeNum) {
            callingCode = `+${countryCodeNum}`;
          }
        } catch (error) {
          // Use default values
        }

        additionalPhones.push({
          number: cleanedPhones[i],
          callingCode,
          countryCode
        });
      }
    }

    return {
      primaryPhoneNumber,
      primaryPhoneCountryCode,
      primaryPhoneCallingCode,
      additionalPhones
    };
  }

  /**
   * Clean a single phone number string
   */
  cleanPhoneNumber(phoneNumber: string): string {
    if (!phoneNumber || typeof phoneNumber !== 'string') return '';
    
    try {
      // Pre-validate 91 prefix for India ISD code
      if (phoneNumber.startsWith('91') && !phoneNumber.startsWith('+91') && phoneNumber.length !== 12) {
        // If starts with 91 but not 12 digits, remove 91 prefix
        phoneNumber = phoneNumber.substring(2);
      }
      
      return this.phoneNumberCleaner.cleanPhoneNumber(phoneNumber);
    } catch (error) {
      console.warn(`Failed to clean phone number: ${phoneNumber}`, error);
      // Fallback to basic cleaning
      return phoneNumber.replace(/[^\d+]/g, '');
    }
  }

  /**
   * Clean and standardize email addresses
   */
  cleanEmailAddresses(emails: any): string[] {
    if (!emails) return [];
    
    const emailArray = Array.isArray(emails) ? emails : [emails];
    
    return emailArray
      .map(email => {
        // Extract email from object structures (GraphQL-style primaryEmail first)
        if (typeof email === 'object' && email !== null) {
          const eo = email as Record<string, unknown>;
          if (typeof eo.primaryEmail === 'string' && eo.primaryEmail.trim()) {
            return eo.primaryEmail;
          }
          if (email.email) return email.email;
          if (email.value) return email.value;
          if (email.emailAddress) return email.emailAddress;
          if (email.emailId) return email.emailId;
          return null;
        }
        return email;
      })
      .filter(email => email && typeof email === 'string')
      .map(email => {
        // Handle comma-separated emails
        if (email.includes(',')) {
          return email.split(',').map(e => e.trim());
        }
        return [email];
      })
      .flat()
      .map(email => email.toLowerCase().trim())
      .filter(email => this.isValidEmail(email))
      .filter((email, index, array) => array.indexOf(email) === index); // Remove duplicates
  }

  /**
   * Clean a single email address string
   */
  cleanEmailAddress(email: string): string {
    if (!email || typeof email !== 'string') return '';
    
    // Handle comma-separated emails - take the first one
    const cleanEmail = email.includes(',') ? email.split(',')[0] : email;
    
    return cleanEmail.toLowerCase().trim();
  }

  /**
   * Parse comma-separated emails and create structured email object
   */
  parseEmails(emailData: any): {
    primaryEmail: string;
    additionalEmails: string[];
  } {
    let primaryEmail = '';
    const additionalEmails: string[] = [];

    if (!emailData) {
      return {
        primaryEmail,
        additionalEmails
      };
    }

    // Handle different input formats
    let emails: string[] = [];
    
    if (Array.isArray(emailData)) {
      // Handle array of emails
      emails = emailData
        .map(email => {
          if (typeof email === 'string') {
            return email;
          } else if (typeof email === 'object' && email) {
            return (
              email.primaryEmail ||
              email.email ||
              email.value ||
              email.emailAddress ||
              ''
            );
          }
          return '';
        })
        .filter(email => email && email.trim());
    } else if (typeof emailData === 'string') {
      // Handle comma-separated string
      emails = emailData.split(',').map(email => email.trim()).filter(email => email);
    } else if (typeof emailData === 'object') {
      // Handle object with email properties
      if (emailData.primaryEmail) {
        emails = [emailData.primaryEmail];
      } else if (emailData.email) {
        emails = [emailData.email];
      } else if (emailData.value) {
        emails = [emailData.value];
      } else if (emailData.personal && Array.isArray(emailData.personal)) {
        emails = emailData.personal.filter(email => email && typeof email === 'string');
      } else if (emailData.work && Array.isArray(emailData.work)) {
        emails = emailData.work.filter(email => email && typeof email === 'string');
      }
    }

    if (emails.length === 0) {
      return {
        primaryEmail,
        additionalEmails
      };
    }

    // Clean and validate emails
    const cleanedEmails = emails.map(email => this.cleanEmailAddress(email)).filter(email => this.isValidEmail(email));

    if (cleanedEmails.length > 0) {
      // Set the first email as primary
      primaryEmail = cleanedEmails[0];
      
      // Add remaining emails as additional
      for (let i = 1; i < cleanedEmails.length; i++) {
        additionalEmails.push(cleanedEmails[i]);
      }
    }

    return {
      primaryEmail,
      additionalEmails
    };
  }

  /**
   * Calculate experience in years from date strings
   */
  calculateExperience(startDate: string, endDate?: string): number {
    if (!startDate) return 0;
    
    try {
      const start = new Date(startDate);
      const end = endDate ? new Date(endDate) : new Date();
      
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
      
      return Math.round(diffYears * 10) / 10; // Round to 1 decimal place
    } catch (error) {
      console.error('Error calculating experience:', error);
      return 0;
    }
  }

  /**
   * Calculate tenure in months
   */
  calculateTenure(start: string, end?: string): number {
    if (!start) return 0;
    
    try {
      const startDate = new Date(start);
      const endDate = end ? new Date(end) : new Date();
      
      const diffMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                        (endDate.getMonth() - startDate.getMonth());
      
      return Math.max(0, diffMonths);
    } catch (error) {
      console.error('Error calculating tenure:', error);
      return 0;
    }
  }

  /**
   * Extract and clean skills from various formats
   */
  extractSkills(skillsData: any): string[] {
    if (!skillsData) return [];
    
    if (typeof skillsData === 'string') {
      return skillsData.split(/[,;|]/).map(skill => skill.trim()).filter(skill => skill.length > 0);
    }
    
    if (Array.isArray(skillsData)) {
      return skillsData
        .map(skill => typeof skill === 'object' ? skill.name || skill.skill : skill)
        .filter(skill => skill && typeof skill === 'string')
        .map(skill => skill.trim());
    }
    
    return [];
  }

  /**
   * Clean and format location data
   */
  cleanLocation(locationData: any): string {
    if (!locationData) return '';
    
    if (typeof locationData === 'string') {
      return locationData.trim();
    }
    
    if (typeof locationData === 'object') {
      const parts = [
        locationData.city,
        locationData.state,
        locationData.country
      ].filter(part => part && typeof part === 'string');
      
      return parts.join(', ');
    }
    
    return '';
  }


  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Clean and extract company information
   */
  extractCompanyInfo(companyData: any) {
    if (!companyData) return { name: null, linkedin_url: null, website: null };
    
    if (typeof companyData === 'string') {
      return { name: companyData.trim(), linkedin_url: null, website: null };
    }
    
    return {
      name: companyData.name || companyData.company || null,
      linkedin_url: companyData.linkedin_url || null,
      website: companyData.website || null,
    };
  }

  /**
   * Format date strings consistently
   */
  formatDate(dateInput: any): string | null {
    if (!dateInput) return null;
    
    try {
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) return null;
      
      return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract numeric values from salary strings
   */
  extractSalaryNumber(salaryString: any): number | null {
    if (!salaryString) return null;
    
    const str = salaryString.toString();
    const numbers = str.match(/\d+/g);
    
    if (!numbers || numbers.length === 0) return null;
    
    // Join all numbers and convert to integer
    const salaryNumber = parseInt(numbers.join(''), 10);
    
    // Handle different formats (lakhs, thousands, etc.)
    if (str.toLowerCase().includes('lakh') || str.toLowerCase().includes('lac')) {
      return salaryNumber * 100000;
    }
    
    if (str.toLowerCase().includes('crore')) {
      return salaryNumber * 10000000;
    }
    
    return salaryNumber;
  }
}
