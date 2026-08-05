import { normalizePhonesFieldInput } from '../normalize-phones-field-input';

describe('normalizePhonesFieldInput', () => {
  it('should return null and undefined unchanged', () => {
    expect(normalizePhonesFieldInput(null)).toBeNull();
    expect(normalizePhonesFieldInput(undefined)).toBeUndefined();
  });

  it('should coerce a plain E.164 string into primaryPhoneNumber', () => {
    expect(normalizePhonesFieldInput('+919820976134')).toEqual({
      primaryPhoneNumber: '+919820976134',
    });
  });

  it('should coerce an array of numbers into primary + additionalPhones', () => {
    expect(
      normalizePhonesFieldInput(['+919820976134', '+918411937769']),
    ).toEqual({
      primaryPhoneNumber: '+919820976134',
      additionalPhones: [{ number: '+918411937769' }],
    });
  });

  it('should coerce a numbers alias into the composite phones shape', () => {
    expect(
      normalizePhonesFieldInput({
        numbers: ['+919820976134', '+918411937769'],
      }),
    ).toEqual({
      primaryPhoneNumber: '+919820976134',
      additionalPhones: [{ number: '+918411937769' }],
    });
  });

  it('should coerce phoneNumbers alias and leave country/calling code for inference', () => {
    expect(
      normalizePhonesFieldInput({
        phoneNumbers: '+14155552671',
      }),
    ).toEqual({
      primaryPhoneNumber: '+14155552671',
      additionalPhones: null,
    });
  });

  it('should move a calling code misplaced in primaryPhoneCountryCode', () => {
    expect(
      normalizePhonesFieldInput({
        primaryPhoneNumber: '+919820976134',
        primaryPhoneCountryCode: '+91',
      }),
    ).toEqual({
      primaryPhoneNumber: '+919820976134',
      primaryPhoneCallingCode: '+91',
    });
  });

  it('should coerce string entries in additionalPhones to objects', () => {
    expect(
      normalizePhonesFieldInput({
        primaryPhoneNumber: '+919820976134',
        additionalPhones: ['+918411937769'],
      }),
    ).toEqual({
      primaryPhoneNumber: '+919820976134',
      additionalPhones: [{ number: '+918411937769' }],
    });
  });

  it('should leave a valid composite phones object intact', () => {
    const phonesValue = {
      primaryPhoneNumber: '+919820976134',
      primaryPhoneCountryCode: 'IN',
      primaryPhoneCallingCode: '+91',
      additionalPhones: null,
    };

    expect(normalizePhonesFieldInput(phonesValue)).toEqual(phonesValue);
  });
});
