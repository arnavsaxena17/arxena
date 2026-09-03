import { DataProcessingUtils } from '../../../utils/data-processing.utils';
import { LinkedInSearchTransformerService } from '../linkedin-search-transformer.service';

describe('LinkedInSearchTransformerService Unipile Sales Nav fields', () => {
  const transformer = new LinkedInSearchTransformerService(
    new DataProcessingUtils(),
  );

  const sampleHit = {
    type: 'PEOPLE',
    id: 'ACwAAD2lincB3n4kdFtVny5W6RyU26MOFQSchXE',
    name: 'Liz Wright',
    first_name: 'Liz',
    last_name: 'Wright',
    member_urn: 'urn:li:member:46637503',
    public_identifier: 'liz-wright-36775113',
    public_profile_url: 'https://www.linkedin.com/in/liz-wright-36775113',
    profile_url:
      'https://www.linkedin.com/sales/lead/ACwAALHob8B,NAME_SEARCH,LcL3',
    profile_picture_url: 'https://media.licdn.com/small.jpg',
    profile_picture_url_large: 'https://media.licdn.com/large.jpg',
    network_distance: 'DISTANCE_3',
    location: 'Chalfont St Peter, England, United Kingdom',
    headline: 'Transformation leader|Digital Product|CIO',
    summary:
      'Director with 20+ years leading strategic change across FTSE 100 organisations',
    premium: false,
    current_positions: [
      {
        company: 'British Airways',
        company_id: '2962',
        description: 'Leading enterprise-wide product and platform delivery',
        location: 'West Drayton, England, United Kingdom',
        industry: ['Airlines and Aviation'],
        role: 'Director of Customer & Commercial Technology',
        tenure_at_company: { years: 4, months: 4 },
        tenure_at_role: { years: 4, months: 4 },
        start: { month: 6, year: 2022 },
      },
    ],
  };

  it('maps summary, pictures, tenure, and role description onto UserProfile', () => {
    const profile = transformer.transformToUserProfile(sampleHit as never, {
      projectId: 'job-1',
      jobName: 'BA search',
      userId: 'user-1',
      dataSource: 'linkedin_search',
      timestamp: new Date().toISOString(),
    });

    expect(profile.linkedinSummary).toContain('FTSE 100');
    expect(profile.linkedinHeadline).toBe(
      'Transformation leader|Digital Product|CIO',
    );
    expect(profile.profileUrl).toBe(
      'https://www.linkedin.com/in/liz-wright-36775113',
    );
    expect(profile.displayPicture).toBe('https://media.licdn.com/small.jpg');
    expect(profile.jobTitle).toBe(
      'Director of Customer & Commercial Technology',
    );
    expect(profile.jobCompanyName).toBe('British Airways');
    expect(profile.jobCompanyId).toBe('2962');
    expect(profile.linkedinSpecificData?.isPremium).toBe(false);
    expect(profile.linkedinSpecificData?.networkDistance).toBe('DISTANCE_3');
    expect(profile.linkedinSpecificData?.profilePictureUrlLarge).toBe(
      'https://media.licdn.com/large.jpg',
    );
    expect(profile.linkedinSpecificData?.unipileSearchId).toBe(sampleHit.id);
    expect(profile.linkedinSpecificData?.tenureAtCompany).toEqual({
      years: 4,
      months: 4,
    });
    expect(profile.linkedinSpecificData?.currentJobDescription).toContain(
      'enterprise-wide',
    );
    expect(profile.experience[0]?.description).toContain('enterprise-wide');
    expect(profile.experience[0]?.tenureAtRole).toEqual({
      years: 4,
      months: 4,
    });
  });
});
