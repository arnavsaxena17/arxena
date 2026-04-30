declare module 'twenty-orgchart/company-search' {
  import type { ComponentType } from 'react';

  export type CompanySearchAutocompleteProps = {
    onCompanySelect: (company: {
      companyId: string;
      companyName: string;
      website?: string;
      locationName?: string;
      industry?: string;
      profileCount?: number;
      linkedinUrl?: string;
      companyDomain?: string;
    }) => void;
    placeholder?: string;
    disabled?: boolean;
    baseUrl: string;
    accessToken?: string;
    autocompletePath?: string;
    logoBaseUrl?: string;
  };

  export const CompanySearchAutocomplete: ComponentType<CompanySearchAutocompleteProps>;
  export const defaultTheme: Record<string, unknown>;
}
