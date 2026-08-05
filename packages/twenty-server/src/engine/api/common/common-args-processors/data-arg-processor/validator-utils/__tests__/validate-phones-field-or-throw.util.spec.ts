import { validatePhonesFieldOrThrow } from 'src/engine/api/common/common-args-processors/data-arg-processor/validator-utils/validate-phones-field-or-throw.util';
import { CommonQueryRunnerException } from 'src/engine/api/common/common-query-runners/errors/common-query-runner.exception';

describe('validatePhonesFieldOrThrow', () => {
  describe('valid inputs', () => {
    it('should return null when value is null', () => {
      const result = validatePhonesFieldOrThrow(null, 'testField');

      expect(result).toBeNull();
    });

    it('should return the phones object when all fields are valid', () => {
      const phonesValue = {
        primaryPhoneNumber: '+1234567890',
        primaryPhoneCountryCode: 'US',
        primaryPhoneCallingCode: '+1',
        additionalPhones: null,
      };
      const result = validatePhonesFieldOrThrow(phonesValue, 'testField');

      expect(result).toEqual(phonesValue);
    });

    it('should return the phones object when only primaryPhoneNumber is provided', () => {
      const phonesValue = {
        primaryPhoneNumber: '+1234567890',
      };
      const result = validatePhonesFieldOrThrow(phonesValue, 'testField');

      expect(result).toEqual(phonesValue);
    });

    it('should coerce a plain phone string into primaryPhoneNumber', () => {
      const result = validatePhonesFieldOrThrow('+919820976134', 'phones');

      expect(result).toEqual({
        primaryPhoneNumber: '+919820976134',
      });
    });

    it('should coerce a numbers alias into primary + additional phones', () => {
      const result = validatePhonesFieldOrThrow(
        {
          numbers: ['+919820976134', '+918411937769'],
        },
        'phones',
      );

      expect(result).toEqual({
        primaryPhoneNumber: '+919820976134',
        additionalPhones: [{ number: '+918411937769' }],
      });
    });
  });

  describe('invalid inputs', () => {
    it('should throw when value is not an object after normalization', () => {
      expect(() => validatePhonesFieldOrThrow(42, 'testField')).toThrow(
        CommonQueryRunnerException,
      );
    });

    it('should throw when value is undefined', () => {
      expect(() => validatePhonesFieldOrThrow(undefined, 'testField')).toThrow(
        CommonQueryRunnerException,
      );
    });

    it('should throw when primaryPhoneNumber is not a string', () => {
      const phonesValue = {
        primaryPhoneNumber: 123456,
      };

      expect(() =>
        validatePhonesFieldOrThrow(phonesValue, 'testField'),
      ).toThrow(CommonQueryRunnerException);
    });

    it('should throw when primaryPhoneCountryCode is not a string', () => {
      const phonesValue = {
        primaryPhoneCountryCode: 123,
      };

      expect(() =>
        validatePhonesFieldOrThrow(phonesValue, 'testField'),
      ).toThrow(CommonQueryRunnerException);
    });

    it('should throw when primaryPhoneCallingCode is not a string', () => {
      const phonesValue = {
        primaryPhoneCallingCode: 1,
      };

      expect(() =>
        validatePhonesFieldOrThrow(phonesValue, 'testField'),
      ).toThrow(CommonQueryRunnerException);
    });

    it('should throw when an invalid subfield is present', () => {
      const phonesValue = {
        primaryPhoneNumber: '+1234567890',
        invalidField: 'invalid',
      };

      expect(() =>
        validatePhonesFieldOrThrow(phonesValue, 'testField'),
      ).toThrow('Invalid subfield invalidField for phones field "testField"');
    });
  });
});
