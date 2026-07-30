export const isResumeUploadFile = (file: File): boolean => {
  const lowerName = file.name.toLowerCase();

  return (
    file.type === 'application/pdf' ||
    file.type ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.type === 'application/msword' ||
    lowerName.endsWith('.pdf') ||
    lowerName.endsWith('.docx') ||
    lowerName.endsWith('.doc')
  );
};

export const isCandidateSpreadsheetImportPath = (): boolean => {
  const pathname = window.location.pathname.toLowerCase();

  return (
    pathname.includes('/project/') ||
    pathname.includes('/projects') ||
    (pathname.includes('/candidate') &&
      !pathname.includes('/jobcandidate'))
  );
};

export const isValidUuidString = (value: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return uuidRegex.test(value);
};

export const isPhoneNumberHeader = (header: string): boolean => {
  const normalizedHeader = header.toLowerCase();

  return (
    normalizedHeader.includes('phone') ||
    normalizedHeader.includes('mobile') ||
    normalizedHeader.includes('whatsapp')
  );
};

export const isLikelyValidPhoneNumber = (value: unknown): boolean => {
  if (typeof value !== 'string') {
    return false;
  }

  const digits = value.replace(/\D/g, '');

  return digits.length >= 7 && digits.length <= 15;
};
