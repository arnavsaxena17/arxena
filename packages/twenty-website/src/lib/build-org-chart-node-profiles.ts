import {
  isValidLinkedInProfileUrl,
  toTitleCase,
  type OrgChartNodeData,
} from 'twenty-shared/utils';

export type OrgChartNodeProfile = {
  id: string;
  fullName: string;
  headline?: string;
  company?: string;
  location?: string;
  linkedinUrl?: string;
  imageUrl?: string;
  companyTenure?: 'current' | 'past';
};

const readCandidateString = (
  candidate: Record<string, unknown>,
  keys: string[],
): string => {
  for (const key of keys) {
    const value = candidate[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
};

export const extractCandidateLocation = (
  candidate: Record<string, unknown>,
): string | undefined => {
  const locationName = readCandidateString(candidate, [
    'location_name',
    'locationName',
  ]);
  if (locationName) {
    return toTitleCase(locationName, { skipIfMasked: true });
  }

  const locality = readCandidateString(candidate, [
    'location_locality',
    'locationLocality',
    'location_city',
    'locationCity',
    'city',
  ]);
  const region = readCandidateString(candidate, [
    'location_region',
    'locationRegion',
    'location_metro',
    'locationMetro',
  ]);
  const country = readCandidateString(candidate, [
    'location_country',
    'locationCountry',
    'country',
  ]);

  const parts = [locality, region, country]
    .filter((part) => part.length > 0)
    .map((part) => toTitleCase(part, { skipIfMasked: true }));

  return parts.length > 0 ? parts.join(', ') : undefined;
};

const normalizeCandidateRecord = (
  candidate: Record<string, unknown>,
  index: number,
  companyName?: string,
): OrgChartNodeProfile | null => {
  const fullNameRaw =
    (typeof candidate.full_name === 'string' ? candidate.full_name : '') ||
    (typeof candidate.fullName === 'string' ? candidate.fullName : '');
  const fullName = fullNameRaw.trim();
  if (!fullName) {
    return null;
  }

  const headlineRaw =
    (typeof candidate.job_title === 'string' ? candidate.job_title : '') ||
    (typeof candidate.headline === 'string' ? candidate.headline : '');
  const linkedinRaw =
    (typeof candidate.std_linkedin_url === 'string'
      ? candidate.std_linkedin_url
      : '') ||
    (typeof candidate.linkedin_url === 'string' ? candidate.linkedin_url : '') ||
    (typeof candidate.linkedinUrl === 'string' ? candidate.linkedinUrl : '');
  const imageRaw =
    (typeof candidate.image === 'string' ? candidate.image : '') ||
    (typeof candidate.profile_picture_url === 'string'
      ? candidate.profile_picture_url
      : '');
  const tenureRaw = candidate.org_chart_company_tenure;
  const companyTenure =
    tenureRaw === 'current' || tenureRaw === 'past' ? tenureRaw : undefined;

  return {
    id: `candidate-${index}`,
    fullName: toTitleCase(fullName, { skipIfMasked: true }),
    headline: headlineRaw
      ? toTitleCase(headlineRaw, { skipIfMasked: true })
      : undefined,
    company: companyName,
    location: extractCandidateLocation(candidate),
    linkedinUrl: isValidLinkedInProfileUrl(linkedinRaw)
      ? linkedinRaw.trim()
      : undefined,
    imageUrl: imageRaw.trim() || undefined,
    companyTenure,
  };
};

export const buildOrgChartNodeProfiles = (
  node: OrgChartNodeData,
  companyName?: string,
): OrgChartNodeProfile[] => {
  const nodeRecord = node as Record<string, unknown>;
  const allCandidates = nodeRecord.allCandidates;
  if (Array.isArray(allCandidates) && allCandidates.length > 0) {
    return allCandidates
      .map((candidate, index) =>
        normalizeCandidateRecord(
          candidate as Record<string, unknown>,
          index,
          companyName,
        ),
      )
      .filter((profile): profile is OrgChartNodeProfile => profile !== null);
  }

  const profiles: OrgChartNodeProfile[] = [];
  for (let i = 0; i < 16; i += 1) {
    const nameKey = `name_${i}` as keyof OrgChartNodeData;
    const titleKey = `title_${i}` as keyof OrgChartNodeData;
    const linkedinKey = `linkedin_url_${i}` as keyof OrgChartNodeData;
    const imageKey = `image_${i}` as keyof OrgChartNodeData;
    const tenureKey = `org_chart_company_tenure_${i}` as keyof OrgChartNodeData;
    const name = node[nameKey];
    if (typeof name !== 'string' || name.trim().length === 0) {
      continue;
    }

    const linkedinRaw =
      typeof node[linkedinKey] === 'string' ? (node[linkedinKey] as string) : '';
    const imageRaw =
      typeof node[imageKey] === 'string' ? (node[imageKey] as string) : '';
    const tenureVal = node[tenureKey];
    const companyTenure =
      tenureVal === 'current' || tenureVal === 'past' ? tenureVal : undefined;

    const nodeCountry =
      typeof node.country === 'string' && node.country.trim().length > 0
        ? toTitleCase(node.country.trim(), { skipIfMasked: true })
        : undefined;

    profiles.push({
      id: `${node.key}-${i}`,
      fullName: toTitleCase(name.trim(), { skipIfMasked: true }),
      headline:
        typeof node[titleKey] === 'string'
          ? toTitleCase(node[titleKey] as string, { skipIfMasked: true })
          : undefined,
      company: companyName,
      location: nodeCountry,
      linkedinUrl: isValidLinkedInProfileUrl(linkedinRaw)
        ? linkedinRaw.trim()
        : undefined,
      imageUrl: imageRaw.trim() || undefined,
      companyTenure,
    });
  }

  return profiles;
};
