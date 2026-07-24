import { Injectable } from '@nestjs/common';
import type { TransformedCandidateForTable } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/linkedin-search-transformer.service';

/**
 * Harvest API LeadShort schema (from /linkedin/lead-search):
 *   - id, linkedinUrl, firstName, lastName, openProfile, premium, pictureUrl
 *   - location: { linkedinText: string }
 *   - currentPositions: Array<{ companyName, title, description, companyId,
 *       companyLinkedinUrl, startedOn:{month,year}, tenureAtPosition, tenureAtCompany }>
 *
 * Harvest API Profile schema (from /linkedin/profile, unwrapped from `element`):
 *   - id, publicIdentifier, firstName, lastName, headline, about, linkedinUrl, photo
 *   - location: { linkedinText, countryCode, parsed: { country, countryFull, state, city, regionCode, text, countryCode } }
 *   - currentPosition: Array<{ companyName }>
 *   - experience: Array<{ companyName, duration, position, location, companyLink,
 *       description, startDate:{month,year,text}, endDate:{month,year,text}, employmentType }>
 *
 * The original transformer assumed flat fields (`title`, `headline`, `position`, `location` as string),
 * which left every Harvest candidate with empty `headline`/`jobTitle`. Downstream the Python
 * orgchart classifier then dumped them all under `UNCLASSIFIED TEAM` because boolean standardization
 * had nothing to match. This transformer extracts the title from `currentPositions[0].title`
 * (current leads) or `headline` / matching `experience` rows (past leads with profile enrichment),
 * and unwraps nested `location` / `pictureUrl` / `photo` accordingly.
 */
@Injectable()
export class HarvestLinkedinTransformerService {
  transformCurrentLeadsToCandidates(
    leads: Array<Record<string, unknown>>,
    companyName: string,
    companyLinkedinUrl?: string,
  ): TransformedCandidateForTable[] {
    return leads.map((lead, index) =>
      this.toCandidateRow({
        lead,
        profile: null,
        companyName,
        companyLinkedinUrl,
        index,
      }),
    );
  }

  transformPastLeadsWithProfilesToCandidates(
    leadsWithProfiles: Array<Record<string, unknown>>,
    companyName: string,
    companyLinkedinUrl?: string,
  ): TransformedCandidateForTable[] {
    return leadsWithProfiles.map((lead, index) =>
      this.toCandidateRow({
        lead,
        profile: this.unwrapProfile(lead.org_harvest_profile),
        companyName,
        companyLinkedinUrl,
        index,
      }),
    );
  }

  private toCandidateRow(input: {
    lead: Record<string, unknown>;
    profile: Record<string, unknown> | null;
    companyName: string;
    companyLinkedinUrl?: string;
    index: number;
  }): TransformedCandidateForTable {
    const { lead, profile } = input;

    const fullName =
      this.pickString(profile, ['name', 'fullName', 'full_name', 'displayName']) ??
      this.pickString(lead, ['name', 'fullName', 'full_name', 'displayName']);
    const firstName =
      this.pickString(profile, ['firstName', 'first_name']) ??
      this.pickString(lead, ['firstName', 'first_name']) ??
      '';
    const lastName =
      this.pickString(profile, ['lastName', 'last_name']) ??
      this.pickString(lead, ['lastName', 'last_name']) ??
      '';
    const stableName =
      fullName ?? `${firstName} ${lastName}`.trim() ?? '';

    const linkedinUrl =
      this.pickString(profile, ['linkedinUrl', 'linkedin_url']) ??
      this.pickString(lead, [
        'linkedinUrl',
        'linkedin_url',
        'profileUrl',
        'profile_url',
        'url',
      ]) ??
      '';

    const matchingExperience = profile
      ? this.findExperienceMatchingCompany(profile, {
          companyName: input.companyName,
          companyLinkedinUrl: input.companyLinkedinUrl,
        })
      : null;

    const headline =
      this.pickString(profile, ['headline']) ??
      matchingExperience?.position ??
      this.pickFirstString(lead.currentPositions, 'title') ??
      this.pickString(lead, ['title', 'headline', 'position']) ??
      '';

    const leadCompanyLinkedinUrl =
      this.pickFirstString(lead.currentPositions, 'companyLinkedinUrl') ??
      input.companyLinkedinUrl;
    const leadCompanyName =
      this.pickFirstString(lead.currentPositions, 'companyName') ??
      input.companyName;

    const profileLocationParsed = this.readObjectKey(
      profile?.location,
      'parsed',
    );

    const locationName =
      this.pickStringFromObjectKey(profile?.location, 'linkedinText') ??
      this.pickStringFromObjectKey(lead.location, 'linkedinText') ??
      this.pickString(profile, ['locationName']) ??
      this.pickString(lead, ['location', 'locationName']) ??
      '';

    const locationCountry =
      this.pickStringFromObjectKey(profileLocationParsed, 'countryFull') ??
      this.pickStringFromObjectKey(profileLocationParsed, 'country') ??
      this.pickStringFromObjectKey(profile?.location, 'countryCode') ??
      '';

    const locationRegion =
      this.pickStringFromObjectKey(profileLocationParsed, 'state') ?? '';

    const locationLocality =
      this.pickStringFromObjectKey(profileLocationParsed, 'city') ?? '';

    const profilePictureUrl =
      this.pickString(profile, ['photo', 'pictureUrl', 'profile_picture_url']) ??
      this.pickString(lead, [
        'pictureUrl',
        'profile_picture_url',
        'profilePictureUrl',
      ]) ??
      '';

    const harvestExperience = profile ? this.extractExperience(profile) : null;

    const row = {
      id: `harvest_${input.index}_${linkedinUrl || stableName || 'person'}`,
      name: stableName || 'Unknown',
      first_name: firstName,
      last_name: lastName,
      full_name: stableName || 'Unknown',
      headline,
      jobTitle: headline,
      title: headline,
      job_title: headline,
      company: leadCompanyName,
      jobCompanyName: leadCompanyName,
      location: locationName,
      locationName,
      locationCountry,
      locationRegion,
      locationLocality,
      profile_picture_url: profilePictureUrl,
      profilePictureUrl,
      public_profile_url: linkedinUrl,
      profile_url: linkedinUrl,
      linkedin_url: linkedinUrl,
      linkedinUrl,
      campaign: 'linkedin_classic_people',
      source: 'harvest',
      sources: ['harvest'],
      org_harvest_lead: lead,
      ...(profile
        ? {
            org_harvest_profile: profile,
            ...(harvestExperience
              ? { org_harvest_experience: harvestExperience }
              : {}),
          }
        : {}),
      ...(leadCompanyLinkedinUrl
        ? { jobCompanyLinkedinUrl: leadCompanyLinkedinUrl }
        : {}),
    };

    return row as unknown as TransformedCandidateForTable;
  }

  private unwrapProfile(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const obj = value as Record<string, unknown>;
    // Tolerate both the raw API wrapper `{ element: Profile, ... }` (in case
    // upstream forwards it as-is) and the already-unwrapped Profile shape.
    const inner = obj.element;
    if (inner && typeof inner === 'object') {
      return inner as Record<string, unknown>;
    }
    return obj;
  }

  private pickString(
    row: Record<string, unknown> | null | undefined,
    keys: string[],
  ): string | undefined {
    if (!row) return undefined;
    for (const key of keys) {
      const value = row[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
    return undefined;
  }

  private readObjectKey(value: unknown, key: string): unknown {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }

  private pickStringFromObjectKey(
    value: unknown,
    key: string,
  ): string | undefined {
    const inner = this.readObjectKey(value, key);
    return typeof inner === 'string' && inner.trim().length > 0
      ? inner.trim()
      : undefined;
  }

  private pickFirstString(value: unknown, key: string): string | undefined {
    if (!Array.isArray(value)) return undefined;
    for (const entry of value) {
      const inner = this.readObjectKey(entry, key);
      if (typeof inner === 'string' && inner.trim().length > 0) {
        return inner.trim();
      }
    }
    return undefined;
  }

  private extractExperience(
    profile: Record<string, unknown>,
  ): Array<Record<string, unknown>> | null {
    const value =
      profile.experience ??
      profile.experiences ??
      profile.workExperience ??
      profile.work_experience;
    if (!Array.isArray(value)) {
      return null;
    }
    return value.filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === 'object',
    );
  }

  /**
   * Find an experience row matching the chart company by name or LinkedIn URL.
   * Used to recover the historical title for past employees once the profile
   * enrichment pass has populated `experience`.
   */
  private findExperienceMatchingCompany(
    profile: Record<string, unknown>,
    target: { companyName: string; companyLinkedinUrl?: string },
  ): { position?: string; companyName?: string } | null {
    const experiences = this.extractExperience(profile);
    if (!experiences) return null;

    const wantName = target.companyName.trim().toLowerCase();
    const wantUrl = (target.companyLinkedinUrl ?? '')
      .trim()
      .toLowerCase()
      .replace(/\/+$/, '');

    for (const row of experiences) {
      const companyName =
        typeof row.companyName === 'string' ? row.companyName.trim() : '';
      const companyLink =
        (typeof row.companyLink === 'string' && row.companyLink) ||
        (typeof row.companyLinkedinUrl === 'string' && row.companyLinkedinUrl) ||
        '';
      const companyLinkNorm = companyLink
        .trim()
        .toLowerCase()
        .replace(/\/+$/, '');
      const matchesName =
        wantName.length > 0 &&
        companyName.toLowerCase() === wantName;
      const matchesUrl =
        wantUrl.length > 0 &&
        companyLinkNorm.length > 0 &&
        companyLinkNorm === wantUrl;
      if (matchesName || matchesUrl) {
        const position =
          (typeof row.position === 'string' && row.position.trim()) ||
          (typeof row.title === 'string' && row.title.trim()) ||
          undefined;
        return { position, companyName };
      }
    }
    return null;
  }
}
