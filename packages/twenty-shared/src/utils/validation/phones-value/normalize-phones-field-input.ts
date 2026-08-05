import { isDefined } from '../isDefined';

import { isValidCountryCode } from './isValidCountryCode';

const PHONE_NUMBER_LIST_ALIASES = new Set([
  'numbers',
  'phoneNumbers',
  'phones',
  'phone',
  'values',
]);

type AdditionalPhoneInput = {
  number: string;
  countryCode?: string;
  callingCode?: string;
};

const extractPhoneNumberString = (entry: unknown): string | null => {
  if (typeof entry === 'string') {
    const trimmed = entry.trim();

    return trimmed.length > 0 ? trimmed : null;
  }

  if (!isDefined(entry) || typeof entry !== 'object' || Array.isArray(entry)) {
    return null;
  }

  const record = entry as Record<string, unknown>;

  for (const key of [
    'number',
    'primaryPhoneNumber',
    'phoneNumber',
    'value',
    'formattedNumber',
  ]) {
    const candidate = record[key];

    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
};

const toAdditionalPhoneEntry = (
  entry: unknown,
): AdditionalPhoneInput | null => {
  const number = extractPhoneNumberString(entry);

  if (!isDefined(number)) {
    return null;
  }

  if (typeof entry === 'string') {
    return { number };
  }

  if (!isDefined(entry) || typeof entry !== 'object' || Array.isArray(entry)) {
    return { number };
  }

  const record = entry as Record<string, unknown>;
  const additionalPhone: AdditionalPhoneInput = { number };

  if (typeof record.countryCode === 'string' && record.countryCode.trim()) {
    additionalPhone.countryCode = record.countryCode.trim();
  }

  if (typeof record.callingCode === 'string' && record.callingCode.trim()) {
    additionalPhone.callingCode = record.callingCode.trim();
  }

  return additionalPhone;
};

const coerceCallingCodeMisplacedAsCountryCode = (
  record: Record<string, unknown>,
) => {
  const countryCode = record.primaryPhoneCountryCode;

  if (typeof countryCode !== 'string' || !countryCode.startsWith('+')) {
    return;
  }

  if (isValidCountryCode(countryCode)) {
    return;
  }

  if (
    !isDefined(record.primaryPhoneCallingCode) ||
    record.primaryPhoneCallingCode === ''
  ) {
    record.primaryPhoneCallingCode = countryCode;
  }

  delete record.primaryPhoneCountryCode;
};

const applyAliasedPhoneNumbers = (
  record: Record<string, unknown>,
  aliasedNumbers: unknown[],
) => {
  const phones = aliasedNumbers
    .map(toAdditionalPhoneEntry)
    .filter(isDefined);

  if (phones.length === 0) {
    return;
  }

  const existingAdditional = Array.isArray(record.additionalPhones)
    ? (record.additionalPhones as AdditionalPhoneInput[])
    : [];

  if (
    typeof record.primaryPhoneNumber !== 'string' ||
    record.primaryPhoneNumber.trim().length === 0
  ) {
    const [primary, ...rest] = phones;

    record.primaryPhoneNumber = primary.number;

    if (
      isDefined(primary.countryCode) &&
      (!isDefined(record.primaryPhoneCountryCode) ||
        record.primaryPhoneCountryCode === '')
    ) {
      record.primaryPhoneCountryCode = primary.countryCode;
    }

    if (
      isDefined(primary.callingCode) &&
      (!isDefined(record.primaryPhoneCallingCode) ||
        record.primaryPhoneCallingCode === '')
    ) {
      record.primaryPhoneCallingCode = primary.callingCode;
    }

    record.additionalPhones = [...existingAdditional, ...rest];

    return;
  }

  record.additionalPhones = [...existingAdditional, ...phones];
};

// Coerce common AI / API phone shapes into the composite phones field
// Country/calling codes are left optional — transformPhonesValue infers them from E.164
export const normalizePhonesFieldInput = (value: unknown): unknown => {
  if (!isDefined(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const number = value.trim();

    return number.length > 0 ? { primaryPhoneNumber: number } : value;
  }

  if (Array.isArray(value)) {
    const phones = value.map(toAdditionalPhoneEntry).filter(isDefined);

    if (phones.length === 0) {
      return value;
    }

    const [primary, ...rest] = phones;

    return {
      primaryPhoneNumber: primary.number,
      ...(isDefined(primary.countryCode) && {
        primaryPhoneCountryCode: primary.countryCode,
      }),
      ...(isDefined(primary.callingCode) && {
        primaryPhoneCallingCode: primary.callingCode,
      }),
      ...(rest.length > 0 && { additionalPhones: rest }),
    };
  }

  if (typeof value !== 'object') {
    return value;
  }

  const record = { ...(value as Record<string, unknown>) };
  const aliasedNumbers: unknown[] = [];

  for (const key of Object.keys(record)) {
    if (!PHONE_NUMBER_LIST_ALIASES.has(key)) {
      continue;
    }

    const aliasValue = record[key];

    if (Array.isArray(aliasValue)) {
      aliasedNumbers.push(...aliasValue);
    } else if (isDefined(aliasValue)) {
      aliasedNumbers.push(aliasValue);
    }

    delete record[key];
  }

  coerceCallingCodeMisplacedAsCountryCode(record);

  if (Array.isArray(record.additionalPhones)) {
    record.additionalPhones = record.additionalPhones
      .map(toAdditionalPhoneEntry)
      .filter(isDefined);
  }

  applyAliasedPhoneNumbers(record, aliasedNumbers);

  if (
    Array.isArray(record.additionalPhones) &&
    record.additionalPhones.length === 0
  ) {
    record.additionalPhones = null;
  }

  return record;
};
