import { isNonEmptyString } from '@sniptt/guards';
import { type ObjectLiteral } from 'typeorm';

// The person columns identity matching needs. Composite fields arrive nested
// from the workspace ORM.
export type PersonIdentityRecord = ObjectLiteral & {
  id: string;
  nameFirstName?: string | null;
  nameLastName?: string | null;
  jobCompanyName?: string | null;
  emails?: { primaryEmail?: string | null } | null;
  linkedinLink?: { primaryLinkUrl?: string | null } | null;
  doNotContact?: boolean | null;
};

export type PersonIdentity = {
  name: string;
  companyName: string;
  email: string;
  linkedinUrl: string;
};

export const readPersonIdentity = (
  person: PersonIdentityRecord,
): PersonIdentity => ({
  name: [person.nameFirstName, person.nameLastName]
    .filter(isNonEmptyString)
    .join(' '),
  companyName: person.jobCompanyName ?? '',
  email: person.emails?.primaryEmail ?? '',
  linkedinUrl: person.linkedinLink?.primaryLinkUrl ?? '',
});
