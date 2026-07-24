import type { ParsedCVData } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/parsed-cv-transformer.service';

import { resolveLinkedinProfileUrl } from './linkedin-identifier.util';

const LINKEDIN_PROFILE_URL_RE =
  /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9_%-]+)/i;

/**
 * Pulls a LinkedIn /in/ profile URL from free text (resume body).
 */
export const extractLinkedinProfileUrlFromText = (
  text: string | undefined | null,
): string | undefined => {
  if (!text?.trim()) {
    return undefined;
  }
  const match = text.match(LINKEDIN_PROFILE_URL_RE);
  if (!match?.[1]) {
    return undefined;
  }
  return `https://www.linkedin.com/in/${decodeURIComponent(match[1])}`;
};

/**
 * Resolves LinkedIn profile URL from parsed CV fields, then falls back to
 * scanning the raw resume text.
 */
export const resolveLinkedinUrlFromResume = (input: {
  parsed: ParsedCVData;
  resumeText: string;
}): string | undefined => {
  const candidates = [
    input.parsed.linkedinUrl,
    input.parsed.profileUrl,
    extractLinkedinProfileUrlFromText(input.resumeText),
  ];

  for (const candidate of candidates) {
    if (!candidate?.trim()) {
      continue;
    }
    if (!candidate.toLowerCase().includes('linkedin.com/in/')) {
      continue;
    }
    const resolved = resolveLinkedinProfileUrl(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return undefined;
};

/**
 * Maps parsed CV JSON into a Unipile-like person profile shape so the existing
 * ICP extraction prompt can consume it without LinkedIn.
 */
export const buildPersonProfileFromParsedCv = (
  parsed: ParsedCVData,
  resumeText: string,
): Record<string, unknown> => {
  const firstName = parsed.firstName?.trim() || undefined;
  const lastName = parsed.lastName?.trim() || undefined;
  const fullName =
    parsed.fullName?.trim() ||
    parsed.name?.trim() ||
    [firstName, lastName].filter(Boolean).join(' ').trim() ||
    undefined;

  const workExperience = (parsed.workExperience ?? []).map((exp) => ({
    company: exp.company ?? '',
    position: exp.jobTitle ?? '',
    location: exp.location ?? '',
    description: [exp.jobSummary, exp.duration]
      .filter((part): part is string => Boolean(part?.trim()))
      .join('\n'),
    start: null,
    end: null,
  }));

  const headline =
    workExperience[0]?.position && workExperience[0]?.company
      ? `${workExperience[0].position} @ ${workExperience[0].company}`
      : workExperience[0]?.position || undefined;

  const skills = [parsed.keySkills, parsed.skills]
    .filter((part): part is string => Boolean(part?.trim()))
    .join('; ');

  return {
    object: 'ResumePersonProfile',
    provider: 'RESUME',
    first_name: firstName ?? fullName?.split(/\s+/)[0] ?? '',
    last_name:
      lastName ??
      (fullName ? fullName.split(/\s+/).slice(1).join(' ') : '') ??
      '',
    headline: headline ?? '',
    location: parsed.location?.trim() || parsed.currentLocation?.trim() || '',
    summary: [
      skills ? `Skills: ${skills}` : '',
      resumeText.trim().slice(0, 4000),
    ]
      .filter(Boolean)
      .join('\n\n'),
    work_experience: workExperience,
    linkedin_url: resolveLinkedinUrlFromResume({ parsed, resumeText }),
  };
};

export const resolveCurrentCompanyFromParsedCv = (
  parsed: ParsedCVData,
): { companyName?: string; role?: string; location?: string } => {
  const current = parsed.workExperience?.[0];
  if (!current?.company?.trim()) {
    return {};
  }
  return {
    companyName: current.company.trim(),
    role: current.jobTitle?.trim() || undefined,
    location: current.location?.trim() || parsed.location?.trim() || undefined,
  };
};
