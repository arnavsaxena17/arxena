const PENDING_SUPER_IMPOSE_STORAGE_KEY = 'orgchart_pending_super_impose_v1';

export type PendingSuperImposeInput = {
  linkedinCompanyUrls: string[];
  websiteUrls: string[];
  salesNavigatorSearchUrls: string[];
  linkedinSearchKeywords?: string;
  linkedinLocationId?: string;
  linkedinLocationTitle?: string;
  appendToExistingChart: boolean;
  country?: string;
  functionRoot?: string;
  businessDivisionRawQuery?: string;
};

export const storePendingSuperImpose = (input: PendingSuperImposeInput): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(
    PENDING_SUPER_IMPOSE_STORAGE_KEY,
    JSON.stringify(input),
  );
};

export const consumePendingSuperImpose = (): PendingSuperImposeInput | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.sessionStorage.getItem(PENDING_SUPER_IMPOSE_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  window.sessionStorage.removeItem(PENDING_SUPER_IMPOSE_STORAGE_KEY);

  try {
    return JSON.parse(raw) as PendingSuperImposeInput;
  } catch {
    return null;
  }
};
