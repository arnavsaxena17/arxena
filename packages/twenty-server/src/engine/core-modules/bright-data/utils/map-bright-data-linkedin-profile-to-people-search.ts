import {
  LinkedInCurrentPosition,
  LinkedInEducation,
  LinkedInPeopleSearchResult,
  LinkedInWorkExperience,
} from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';
import { normalizeLinkedInUrl } from 'src/engine/core-modules/candidate-sourcing/utils/linkedin-url.utils';

import type { BrightDataLinkedinProfileRecord } from '../types/bright-data-linkedin-profile.types';

const emptyTenure = { years: 0, months: 0 };

const toYear = (value: string | undefined): number => {
  if (!value) {
    return new Date().getUTCFullYear();
  }
  const n = Number.parseInt(value.slice(0, 4), 10);

  return Number.isFinite(n) ? n : new Date().getUTCFullYear();
};

const mapEducation = (
  entries: BrightDataLinkedinProfileRecord['education'],
): LinkedInEducation[] => {
  if (!entries?.length) {
    return [];
  }

  return entries.map((edu) => ({
    degree: null,
    field_of_study: null,
    school: edu.title?.trim() ?? '',
    school_id: null,
    start: { year: 0 },
    end: edu.end_year ? { year: toYear(edu.end_year) } : undefined,
    school_details: {
      name: edu.title?.trim() ?? '',
      employeeCount: 0,
      location: '',
      description: '',
      url: edu.url ?? '',
      logo: null,
    },
  }));
};

const mapWorkExperience = (
  entries: BrightDataLinkedinProfileRecord['experience'],
): LinkedInWorkExperience[] => {
  if (!entries?.length) {
    return [];
  }

  return entries.map((exp) => ({
    company: exp.company?.trim() ?? '',
    company_id: null,
    role: exp.title?.trim() ?? '',
    industry: null,
    start: { year: toYear(exp.start_date) },
    end: exp.end_date ? { year: toYear(exp.end_date) } : undefined,
    skills: null,
  }));
};

const buildCurrentPositions = (
  bd: BrightDataLinkedinProfileRecord,
): LinkedInCurrentPosition[] => {
  const companyName =
    bd.current_company_name?.trim() ||
    bd.current_company?.name?.trim() ||
    '';
  const companyId =
    bd.current_company_company_id?.trim() ||
    bd.current_company?.company_id?.trim() ||
    null;
  const location =
    bd.current_company?.location?.trim() ||
    [bd.city, bd.country_code].filter(Boolean).join(', ') ||
    bd.location?.trim() ||
    null;

  if (bd.experience?.length) {
    const current = bd.experience[0];
    const role = current.title?.trim() || bd.about?.slice(0, 120) || '';

    if (role || current.company) {
      return [
        {
          company: current.company?.trim() || companyName,
          company_id: companyId,
          description: current.description?.trim() || bd.about?.trim() || null,
          role,
          location: current.location?.trim() || location,
          industry: [],
          tenure_at_role: emptyTenure,
          tenure_at_company: emptyTenure,
          start: { year: toYear(current.start_date) },
          skills: null,
        },
      ];
    }
  }

  if (companyName) {
    return [
      {
        company: companyName,
        company_id: companyId,
        description: bd.about?.trim() || null,
        role: bd.about?.split('\n')[0]?.trim()?.slice(0, 200) || '',
        location,
        industry: [],
        tenure_at_role: emptyTenure,
        tenure_at_company: emptyTenure,
        start: { year: new Date().getUTCFullYear() },
        skills: null,
      },
    ];
  }

  return [];
};

/**
 * Merges Bright Data profile scrape into an existing SERP-derived row (same LinkedIn identity).
 */
export const mergeBrightDataIntoLinkedinPeopleSearchResult = (
  base: LinkedInPeopleSearchResult,
  bd: BrightDataLinkedinProfileRecord,
): LinkedInPeopleSearchResult => {
  const linkedinUrl =
    bd.input_url ||
    bd.url ||
    base.profile_url ||
    base.public_profile_url ||
    '';
  let normalizedProfileUrl: string | null = null;

  try {
    normalizedProfileUrl = linkedinUrl ? normalizeLinkedInUrl(linkedinUrl) : null;
  } catch {
    normalizedProfileUrl = linkedinUrl || null;
  }

  const publicId = bd.linkedin_id?.trim() || base.public_identifier;
  const firstName = bd.first_name?.trim() || base.first_name;
  const lastName = bd.last_name?.trim() || base.last_name;
  const displayName =
    bd.name?.trim() ||
    [firstName, lastName].filter(Boolean).join(' ') ||
    base.name;

  const currentPositions = buildCurrentPositions(bd);
  const workExperience = mapWorkExperience(bd.experience);
  const education = mapEducation(bd.education);

  return {
    ...base,
    id: publicId || base.id,
    public_identifier: publicId,
    public_profile_url: normalizedProfileUrl,
    profile_url: normalizedProfileUrl,
    profile_picture_url: bd.avatar ?? base.profile_picture_url,
    profile_picture_url_large: bd.avatar ?? base.profile_picture_url_large,
    name: displayName,
    first_name: firstName,
    last_name: lastName,
    headline: base.headline || bd.about?.split('\n')[0]?.slice(0, 500) || '',
    location:
      base.location ||
      [bd.city, bd.country_code].filter(Boolean).join(', ') ||
      bd.location ||
      null,
    connections_count: bd.connections ?? base.connections_count,
    followers_count: bd.followers ?? base.followers_count,
    current_positions:
      currentPositions.length > 0 ? currentPositions : base.current_positions,
    work_experience:
      workExperience.length > 0 ? workExperience : base.work_experience,
    education: education.length > 0 ? education : base.education,
  };
};
