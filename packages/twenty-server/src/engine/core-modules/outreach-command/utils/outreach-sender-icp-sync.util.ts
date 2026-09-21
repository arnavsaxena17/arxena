import { isNonEmptyString } from '@sniptt/guards';
import { v4 } from 'uuid';

import { type OutreachSenderProfile } from 'src/engine/core-modules/outreach-command/types/outreach-sender-profile.type';
import {
  EMPTY_ICP_SPEC,
  normalizeIcpSpec,
  type IcpSpec,
} from 'src/engine/core-modules/outreach-command/utils/outreach-icp-spec.util';

export const icpSpecFromSenderIcp = (
  icp: OutreachSenderProfile['icp'] | null | undefined,
): IcpSpec => {
  if (!icp) {
    return { ...EMPTY_ICP_SPEC };
  }

  return normalizeIcpSpec({
    targetTitles: icp.target_roles,
    locations: icp.geography,
  });
};

export const applyIcpSpecToSenderIcp = (
  icp: OutreachSenderProfile['icp'],
  icpSpec: IcpSpec,
  options?: { fillEmptyOnly?: boolean },
): OutreachSenderProfile['icp'] => {
  const normalized = normalizeIcpSpec(icpSpec);
  const fillEmptyOnly = options?.fillEmptyOnly === true;

  const nextTargetRoles =
    fillEmptyOnly && icp.target_roles.length > 0
      ? icp.target_roles
      : normalized.targetTitles;
  const nextGeography =
    fillEmptyOnly && icp.geography.length > 0
      ? icp.geography
      : normalized.locations;

  return {
    ...icp,
    target_roles: nextTargetRoles,
    geography: nextGeography,
  };
};

export const applyIcpSpecToSenderProfile = (
  profile: OutreachSenderProfile,
  icpSpec: IcpSpec,
  options?: { fillEmptyOnly?: boolean },
): OutreachSenderProfile => ({
  ...profile,
  icp: applyIcpSpecToSenderIcp(profile.icp, icpSpec, options),
});

type BuildSenderProfileSeedInput = {
  member?: {
    id?: string;
    name?: { firstName?: string | null; lastName?: string | null } | null;
    userEmail?: string | null;
    jobTitle?: string | null;
    phoneNumber?: string | null;
    linkedinUrl?: string | null;
  } | null;
  companyName?: string | null;
  companyDomain?: string | null;
  industry?: string | null;
  summary?: string | null;
  hq?: string | null;
  icpSpec?: IcpSpec | null;
};

export const buildEmptySenderIcp = (): OutreachSenderProfile['icp'] => ({
  target_roles: [],
  target_company_profile: null,
  revenue_band: null,
  geography: [],
  exclude_roles: [],
  exclude_company_types: [],
  known_objections: [],
});

export const buildSenderProfileSeedFromWorkspace = (
  input: BuildSenderProfileSeedInput,
): OutreachSenderProfile => {
  const firstName = input.member?.name?.firstName?.trim() ?? '';
  const lastName = input.member?.name?.lastName?.trim() ?? '';
  const fullName = [firstName, lastName].filter(isNonEmptyString).join(' ');
  const companyName = input.companyName?.trim() ?? '';
  const companyDomain = input.companyDomain?.trim().toLowerCase() ?? '';
  const website = isNonEmptyString(companyDomain)
    ? `https://${companyDomain}`
    : null;
  const summary = input.summary?.trim() ?? '';
  const industry = input.industry?.trim() ?? '';
  const icpSpec = normalizeIcpSpec(input.icpSpec ?? EMPTY_ICP_SPEC);

  return {
    id: input.member?.id ?? v4(),
    identity: {
      full_name: isNonEmptyString(fullName) ? fullName : null,
      first_name: isNonEmptyString(firstName) ? firstName : null,
      how_they_sign: isNonEmptyString(firstName) ? firstName : null,
      title: input.member?.jobTitle?.trim() || null,
      company: isNonEmptyString(companyName) ? companyName : null,
      company_short: isNonEmptyString(companyName) ? companyName : null,
      website,
      phone: input.member?.phoneNumber?.trim() || null,
      email: input.member?.userEmail?.trim() || null,
      linkedin_url: input.member?.linkedinUrl?.trim() || null,
      city: input.hq?.trim() || null,
      timezone: null,
    },
    credibility: {
      one_liner: null,
      operator_line: null,
      credentials: [],
      years_experience: null,
      industries_known: isNonEmptyString(industry) ? [industry] : [],
      shared_background_tags: [],
    },
    offer: {
      product_name: isNonEmptyString(companyName) ? companyName : null,
      category: isNonEmptyString(industry) ? industry : null,
      one_sentence: isNonEmptyString(summary) ? summary : null,
      problem_statements: [],
      outcomes: [],
      proof_points: [],
      works_with: [],
      implementation_time: null,
      pilot_offer: null,
      pricing_line: null,
      data_security_line: null,
      faq: [],
      collateral: [],
    },
    icp: {
      ...buildEmptySenderIcp(),
      target_roles: icpSpec.targetTitles,
      geography: icpSpec.locations,
      target_company_profile: isNonEmptyString(summary) ? summary : null,
    },
    voice: {
      register: null,
      formality: null,
      uses_honorifics: false,
      signature_phrases: [],
      avoid_phrases: [],
      sign_off: null,
    },
    meeting: {
      default_duration_min: 30,
      platform: null,
      agenda_template: null,
      preferred_windows: [],
      allow_weekends_if_proposed: false,
    },
  };
};

export const mergeSenderProfileSeedOntoExisting = (
  existing: OutreachSenderProfile,
  seed: OutreachSenderProfile,
  options?: { force?: boolean; fillEmptyIcpOnly?: boolean },
): OutreachSenderProfile => {
  const force = options?.force === true;
  const fillEmptyIcpOnly = options?.fillEmptyIcpOnly === true;

  if (force) {
    return {
      ...seed,
      id: existing.id || seed.id,
      identity: {
        ...seed.identity,
        email: seed.identity.email ?? existing.identity.email,
        phone: seed.identity.phone ?? existing.identity.phone,
        linkedin_url:
          seed.identity.linkedin_url ?? existing.identity.linkedin_url,
      },
      voice: existing.voice,
      meeting: existing.meeting,
      review_flags: existing.review_flags,
    };
  }

  return {
    ...existing,
    identity: {
      ...existing.identity,
      company: existing.identity.company ?? seed.identity.company,
      company_short:
        existing.identity.company_short ?? seed.identity.company_short,
      website: existing.identity.website ?? seed.identity.website,
      city: existing.identity.city ?? seed.identity.city,
    },
    offer: {
      ...existing.offer,
      product_name: existing.offer.product_name ?? seed.offer.product_name,
      category: existing.offer.category ?? seed.offer.category,
      one_sentence: existing.offer.one_sentence ?? seed.offer.one_sentence,
    },
    credibility: {
      ...existing.credibility,
      industries_known:
        existing.credibility.industries_known.length > 0
          ? existing.credibility.industries_known
          : seed.credibility.industries_known,
    },
    icp: applyIcpSpecToSenderIcp(
      {
        ...existing.icp,
        target_company_profile:
          existing.icp.target_company_profile ??
          seed.icp.target_company_profile,
      },
      {
        targetTitles: seed.icp.target_roles,
        locations: seed.icp.geography,
      },
      { fillEmptyOnly: fillEmptyIcpOnly },
    ),
  };
};
