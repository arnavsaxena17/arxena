import { isValidUuid } from 'twenty-shared/utils';

import { extractLinkedinCompanyId } from 'src/engine/core-modules/company-api/utils/company-identity.util';
import type { UploadProfilesPerson } from 'src/engine/core-modules/gtm-command/utils/normalize-upload-people.util';
import {
  extractCompanyFromPositionLike,
  extractCompanyIdFromPositionLike,
  extractTitleFromPositionLike,
} from 'src/engine/core-modules/people-api/utils/extract-candidate-job-title.util';
import {
  flattenCandidateFromMatchedPosition,
  isScopedSearchIntent,
  pickCurrentPositionForSearchIntent,
  type SearchPositionIntent,
} from 'src/engine/core-modules/people-api/utils/pick-current-position-for-search-intent.util';

export type UploadEmployerHit = {
  id: string;
  name: string;
};

export type PreparedUploadPerson = UploadProfilesPerson & {
  skip?: boolean;
};

export const buildUploadSearchIntent = ({
  workflowCompany,
}: {
  workflowCompany?: {
    id?: string | null;
    name?: string | null;
    linkedinId?: string | null;
  };
}): SearchPositionIntent => {
  const linkedinId = workflowCompany?.linkedinId?.trim();
  const companyName = workflowCompany?.name?.trim();

  return {
    ...(linkedinId ? { companyId: linkedinId } : {}),
    ...(companyName ? { companyName } : {}),
  };
};

export const prepareUploadPersonEmployer = (
  person: UploadProfilesPerson,
  intent: SearchPositionIntent,
  workflowCompanyId?: string,
): {
  person: PreparedUploadPerson;
  employerHit?: UploadEmployerHit;
  skip: boolean;
} => {
  const candidate = person as UploadProfilesPerson & Record<string, unknown>;
  const matched = pickCurrentPositionForSearchIntent(candidate, intent);
  const scoped = isScopedSearchIntent(intent);

  if (scoped && !matched) {
    return { person: { ...person, skip: true }, skip: true };
  }

  const flattened = flattenCandidateFromMatchedPosition(
    candidate,
    matched,
  ) as PreparedUploadPerson;
  const linkedinCompanyId = matched
    ? extractCompanyIdFromPositionLike(matched)
    : null;
  const companyName = matched
    ? extractCompanyFromPositionLike(matched)
    : flattened.company ?? flattened.companyName;
  const title = matched
    ? extractTitleFromPositionLike(matched)
    : flattened.title;

  const employerHit =
    linkedinCompanyId && companyName
      ? { id: linkedinCompanyId, name: companyName }
      : undefined;

  const crmCompanyId =
    workflowCompanyId && isValidUuid(workflowCompanyId)
      ? workflowCompanyId
      : person.companyId && isValidUuid(person.companyId)
        ? person.companyId
        : undefined;

  return {
    person: {
      ...flattened,
      ...(title ? { title } : {}),
      ...(companyName ? { company: companyName, companyName } : {}),
      ...(linkedinCompanyId ? { jobCompanyId: linkedinCompanyId } : {}),
      ...(crmCompanyId ? { companyId: crmCompanyId } : {}),
      skip: false,
    },
    employerHit,
    skip: false,
  };
};

export const collectUniqueEmployerHits = (
  hits: Array<UploadEmployerHit | undefined>,
): UploadEmployerHit[] => {
  const unique: UploadEmployerHit[] = [];
  const seen = new Set<string>();

  for (const hit of hits) {
    if (!hit) {
      continue;
    }

    const id = extractLinkedinCompanyId(hit);

    if (!id || seen.has(id)) {
      continue;
    }

    seen.add(id);
    unique.push({ id, name: hit.name });
  }

  return unique;
};

export const stampCrmCompanyIds = (
  people: PreparedUploadPerson[],
  employerHits: UploadEmployerHit[],
  companyIds: string[],
): PreparedUploadPerson[] => {
  const crmIdByLinkedinId = new Map<string, string>();

  for (const [index, hit] of employerHits.entries()) {
    const crmId = companyIds[index];

    if (crmId && isValidUuid(crmId)) {
      crmIdByLinkedinId.set(hit.id, crmId);
    }
  }

  return people.map((person) => {
    if (person.skip) {
      return person;
    }

    const linkedinId = person.jobCompanyId?.trim();
    const fromUpsert = linkedinId
      ? crmIdByLinkedinId.get(linkedinId)
      : undefined;
    const companyId =
      (person.companyId && isValidUuid(person.companyId)
        ? person.companyId
        : undefined) ?? fromUpsert;

    return {
      ...person,
      ...(companyId ? { companyId } : {}),
    };
  });
};
