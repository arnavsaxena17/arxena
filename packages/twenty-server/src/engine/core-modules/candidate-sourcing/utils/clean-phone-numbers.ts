import * as phonenumbers from 'google-libphonenumber';

export class CleanPhoneNumbers {
  private phoneUtil = phonenumbers.PhoneNumberUtil.getInstance();

  cleanPhoneNumber(phoneNumber: string, defaultRegion = 'IN'): string {
    try {
      if (!phoneNumber) return '';
      if (phoneNumber.includes(',')) phoneNumber = phoneNumber.split(', ')[0];
      phoneNumber = phoneNumber.trim();
      
      // Pre-validate 91 prefix for India ISD code
      if (phoneNumber.startsWith('91') && !phoneNumber.startsWith('+91')) {
        // For numbers starting with 91, ensure they are exactly 12 digits
        if (phoneNumber.length !== 12) {
          // If not 12 digits, it's likely not a valid India ISD number
          // Remove the 91 prefix and treat as regular number
          phoneNumber = phoneNumber.substring(2);
        }
      }
      
      const parsedNumber = this.phoneUtil.parse(phoneNumber, defaultRegion);
      let cleanPhoneNumber = `${parsedNumber.getCountryCode()}${parsedNumber.getNationalNumber()}`;

      if (phoneNumber.includes('E+')) {
        cleanPhoneNumber = cleanPhoneNumber.replace('E+', '').replace('.', '');
      }

      return cleanPhoneNumber;
    } catch (e) {
      console.info(`Cleaning phone numbers Exception for ::::${phoneNumber}`);

      return phoneNumber;
    }
  }

  getNumberOfPartsOfPhoneNumber(phoneNumber: string): number {
    if (phoneNumber.includes('.')) {
      return phoneNumber.replace(/[()]/g, '').split('.').length;
    } else if (phoneNumber.includes(' ')) {
      return phoneNumber.replace(/[()]/g, '').split(' ').length;
    } else if (phoneNumber.includes('-')) {
      return phoneNumber.replace(/[()]/g, '').split('-').length;
    } else if (phoneNumber.includes(' ') && phoneNumber.includes('-')) {
      return phoneNumber.replace(/[() ]/g, '-').split('-').length;
    } else {
      return phoneNumber.replace(/[ .()-]/g, '-').split('-').length;
    }
  }

  cleanPhoneNumbersOldAlgo(phoneNumber: string): string {
    phoneNumber = phoneNumber.replace(/[-.() ]/g, '');
    if (phoneNumber.length === 11 && phoneNumber.startsWith('0')) {
      phoneNumber = phoneNumber.slice(1);
    }
    if (phoneNumber.startsWith('91') || phoneNumber.startsWith('+91')) {
      if (phoneNumber.startsWith('+91')) {
        // Handle +91 prefix - should be 13 digits total (+91 + 10 digits)
        if (phoneNumber.length === 13) {
          // Valid +91 format, keep as is
        } else if (phoneNumber.length === 12) {
          // Missing +, add it
          phoneNumber = `+${phoneNumber}`;
        } else {
          // Invalid length for +91, treat as regular number
          phoneNumber = phoneNumber.replace('+91', '');
        }
      } else if (phoneNumber.startsWith('91')) {
        // Handle 91 prefix - should be exactly 12 digits for India ISD
        if (phoneNumber.length === 12) {
          phoneNumber = `+${phoneNumber}`;
        } else if (phoneNumber.length === 10) {
          // 10 digits without country code, add +91
          phoneNumber = `+91${phoneNumber}`;
        } else {
          // Invalid length for 91 prefix, remove 91 and treat as regular number
          phoneNumber = phoneNumber.substring(2);
        }
      }
    }
    if (!phoneNumber.startsWith('+') && phoneNumber.length === 10) {
      phoneNumber = `+91${phoneNumber}`;
    }
    if (phoneNumber.startsWith('+9191') && phoneNumber.length > 10) {
      phoneNumber = phoneNumber.replace('9191', '91');
    }
    if (phoneNumber.startsWith('+910') && phoneNumber.length > 12) {
      phoneNumber = phoneNumber.replace('+910', '+91');
    }
    if (phoneNumber.length === 14 && phoneNumber.startsWith('9191')) {
      phoneNumber = phoneNumber.slice(2);
    }

    return phoneNumber;
  }

  /**
   * Parse a phone number and return the parsed object
   */
  parsePhoneNumber(phoneNumber: string, defaultRegion = 'IN'): any {
    try {
      if (!phoneNumber) return null;
      if (phoneNumber.includes(',')) phoneNumber = phoneNumber.split(', ')[0];
      phoneNumber = phoneNumber.trim();
      return this.phoneUtil.parse(phoneNumber, defaultRegion);
    } catch (e) {
      console.info(`Parsing phone number Exception for ::::${phoneNumber}`);
      return null;
    }
  }

  /**
   * Get the country code from a parsed phone number
   */
  getCountryCode(parsedNumber: any): number | null {
    try {
      return parsedNumber ? parsedNumber.getCountryCode() : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Get the region code from a parsed phone number
   */
  getRegionCode(parsedNumber: any): string | null {
    try {
      return parsedNumber ? this.phoneUtil.getRegionCodeForNumber(parsedNumber) : null;
    } catch (e) {
      return null;
    }
  }
}
