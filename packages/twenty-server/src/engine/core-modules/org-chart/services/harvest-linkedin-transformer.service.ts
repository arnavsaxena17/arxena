import { Injectable } from '@nestjs/common';
import type { TransformedCandidateForTable } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/linkedin-search-transformer.service';

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
        profile:
          lead.org_harvest_profile && typeof lead.org_harvest_profile === 'object'
            ? (lead.org_harvest_profile as Record<string, unknown>)
            : null,
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
    const fullName = this.pickString(input.lead, [
      'name',
      'fullName',
      'full_name',
      'displayName',
    ]);
    const firstName = this.pickString(input.lead, ['firstName', 'first_name']);
    const lastName = this.pickString(input.lead, ['lastName', 'last_name']);
    const linkedinUrl = this.pickString(input.lead, [
      'linkedinUrl',
      'linkedin_url',
      'profileUrl',
      'profile_url',
      'url',
    ]);
    const headline =
      this.pickString(input.lead, ['title', 'headline', 'position']) ?? '';
    const location = this.pickString(input.lead, ['location', 'locationName']) ?? '';
    const stableName = fullName || `${firstName ?? ''} ${lastName ?? ''}`.trim();

    const row = {
      id: `harvest_${input.index}_${linkedinUrl ?? stableName ?? 'person'}`,
      name: stableName || 'Unknown',
      first_name: firstName ?? '',
      last_name: lastName ?? '',
      full_name: stableName || 'Unknown',
      headline,
      jobTitle: headline,
      title: headline,
      company: input.companyName,
      jobCompanyName: input.companyName,
      location,
      locationName: location,
      locationCountry: '',
      locationRegion: '',
      locationLocality: '',
      public_profile_url: linkedinUrl ?? '',
      profile_url: linkedinUrl ?? '',
      linkedin_url: linkedinUrl ?? '',
      linkedinUrl: linkedinUrl ?? '',
      campaign: 'linkedin_classic_people',
      source: 'harvest',
      sources: ['harvest'],
      org_harvest_lead: input.lead,
      ...(input.profile
        ? {
            org_harvest_profile: input.profile,
            org_harvest_experience: this.extractExperience(input.profile),
          }
        : {}),
      ...(input.companyLinkedinUrl
        ? { jobCompanyLinkedinUrl: input.companyLinkedinUrl }
        : {}),
    };

    return row as unknown as TransformedCandidateForTable;
  }

  private pickString(
    row: Record<string, unknown>,
    keys: string[],
  ): string | undefined {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
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
}
