import * as phonenumbers from 'google-libphonenumber';

export class CleanPhoneNumbers {
    private phoneUtil = phonenumbers.PhoneNumberUtil.getInstance();

    cleanPhoneNumber(phoneNumber: string, defaultRegion: string = 'IN'): string {
        try {
            if (!phoneNumber) return '';
            if (phoneNumber.includes(',')) phoneNumber = phoneNumber.split(', ')[0];
            phoneNumber = phoneNumber.trim();
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
            if (phoneNumber.length > 10) {
                // do nothing
            } else if (phoneNumber.length === 12 && phoneNumber.startsWith('91')) {
                phoneNumber = `+${phoneNumber}`;
            } else if (phoneNumber.length === 10) {
                phoneNumber = `+91${phoneNumber}`;
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
}
