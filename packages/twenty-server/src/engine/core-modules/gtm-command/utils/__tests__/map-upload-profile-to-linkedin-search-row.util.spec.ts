import { mapUploadProfileToLinkedinSearchRow } from '../map-upload-profile-to-linkedin-search-row.util';

describe('mapUploadProfileToLinkedinSearchRow', () => {
  it('maps search-people-for-company hits into linkedin_search transformer fields', () => {
    const mapped = mapUploadProfileToLinkedinSearchRow(
      {
        name: 'Linda Windham, MSC, SHRM-CP',
        firstName: 'Linda',
        lastName: 'Windham',
        title: 'Director of Talent Solutions',
        headline: 'Director of Talent Solutions | Interim Executive Search',
        company: 'Korn Ferry',
        location: 'United States',
        linkedinUrl: 'https://www.linkedin.com/in/lindawindham',
        linkedinProfileId: 'lindawindham',
        peopleId: 'ACwAAABcZlcB',
        profilePictureUrl: 'https://media.licdn.com/dms/image/linda.jpg',
      },
      '3616d8a1-0219-408a-a6e9-75105117be4e',
    );

    expect(mapped).toEqual(
      expect.objectContaining({
        linkedinUrl: 'https://www.linkedin.com/in/lindawindham',
        profile_url: 'https://www.linkedin.com/in/lindawindham',
        public_identifier: 'lindawindham',
        profile_picture_url: 'https://media.licdn.com/dms/image/linda.jpg',
        displayPicture: 'https://media.licdn.com/dms/image/linda.jpg',
        first_name: 'Linda',
        last_name: 'Windham',
        jobTitle: 'Director of Talent Solutions',
        jobCompanyName: 'Korn Ferry',
        companyId: '3616d8a1-0219-408a-a6e9-75105117be4e',
        jobCompanyId: '3616d8a1-0219-408a-a6e9-75105117be4e',
        current_positions: [
          {
            company: 'Korn Ferry',
            role: 'Director of Talent Solutions',
            location: 'United States',
          },
        ],
      }),
    );
  });

  it('prefers a per-person companyId over the upload-profiles argument', () => {
    const mapped = mapUploadProfileToLinkedinSearchRow(
      {
        linkedinUrl: 'https://www.linkedin.com/in/ann',
        companyId: 'person-company',
      },
      'workflow-company',
    );

    expect(mapped.companyId).toBe('person-company');
    expect(mapped.jobCompanyId).toBe('person-company');
  });
});
