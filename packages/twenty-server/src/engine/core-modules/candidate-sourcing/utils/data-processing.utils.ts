import { Injectable } from '@nestjs/common';

export interface NameProcessorResult {
  first_name: string;
  last_name: string;
  middle_name: string;
  middle_initial: string;
  full_name: string;
}

@Injectable()
export class DataProcessingUtils {
  /**
   * Process a full name into individual components
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

    const cleanName = fullName.trim().replace(/\s+/g, ' ');
    const nameParts = cleanName.split(' ').filter(part => part.length > 0);

    let firstName = '';
    let lastName = '';
    let middleName = '';
    let middleInitial = '';

    if (nameParts.length === 1) {
      firstName = nameParts[0];
    } else if (nameParts.length === 2) {
      firstName = nameParts[0];
      lastName = nameParts[1];
    } else if (nameParts.length >= 3) {
      firstName = nameParts[0];
      lastName = nameParts[nameParts.length - 1];
      middleName = nameParts.slice(1, -1).join(' ');
      middleInitial = nameParts.slice(1, -1).map(name => name.charAt(0).toUpperCase()).join('');
    }

    return {
      first_name: this.titleCase(firstName),
      last_name: this.titleCase(lastName),
      middle_name: this.titleCase(middleName),
      middle_initial: middleInitial,
      full_name: this.titleCase(cleanName),
    };
  }

  /**
   * Generate a unique key string from candidate data
   */
  generateUniqueKeyString(candidateData: any, dataSource: string): string {
    const name = candidateData.name || candidateData.jsUserName || candidateData.full_name || '';
    const email = Array.isArray(candidateData.email_address) 
      ? candidateData.email_address[0] 
      : candidateData.email_address || '';
    const phone = Array.isArray(candidateData.phone_numbers) 
      ? candidateData.phone_numbers[0] 
      : candidateData.phone_number || '';
    
    // Create a base string from available identifiers
    const baseString = `${name}_${email}_${phone}_${dataSource}`.toLowerCase();
    
    // Remove special characters and spaces
    const cleanString = baseString.replace(/[^a-z0-9]/g, '');
    
    // Add timestamp for uniqueness
    const timestamp = Date.now().toString();
    
    return `${cleanString}_${timestamp}`;
  }

  /**
   * Clean and standardize phone numbers
   */
  cleanPhoneNumbers(phoneNumbers: any): string[] {
    if (!phoneNumbers) return [];
    
    const phones = Array.isArray(phoneNumbers) ? phoneNumbers : [phoneNumbers];
    
    return phones
      .map(phone => {
        if (typeof phone === 'object' && phone.number) {
          return phone.number;
        }
        return phone;
      })
      .filter(phone => phone && typeof phone === 'string')
      .map(phone => phone.replace(/[^\d+]/g, ''))
      .filter(phone => phone.length >= 10);
  }

  /**
   * Clean and standardize email addresses
   */
  cleanEmailAddresses(emails: any): string[] {
    if (!emails) return [];
    
    const emailArray = Array.isArray(emails) ? emails : [emails];
    
    return emailArray
      .filter(email => email && typeof email === 'string')
      .map(email => email.toLowerCase().trim())
      .filter(email => this.isValidEmail(email));
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
   * Convert string to title case
   */
  private titleCase(str: string): string {
    if (!str) return '';
    
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
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
