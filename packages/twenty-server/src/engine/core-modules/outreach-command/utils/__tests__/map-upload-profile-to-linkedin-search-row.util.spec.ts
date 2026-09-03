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
        summary: 'About Linda',
        profile_picture_url_large: 'https://media.licdn.com/dms/image/linda-lg.jpg',
        network_distance: 'DISTANCE_2',
        premium: true,
      },
      '3616d8a1-0219-408a-a6e9-75105117be4e',
    );

    expect(mapped).toEqual(
      expect.objectContaining({
        linkedinUrl: 'https://www.linkedin.com/in/lindawindham',
        profile_url: 'https://www.linkedin.com/in/lindawindham',
        public_identifier: 'lindawindham',
        profile_picture_url: 'https://media.licdn.com/dms/image/linda.jpg',
        profile_picture_url_large:
          'https://media.licdn.com/dms/image/linda-lg.jpg',
        displayPicture: 'https://media.licdn.com/dms/image/linda.jpg',
        first_name: 'Linda',
        last_name: 'Windham',
        jobTitle: 'Director of Talent Solutions',
        jobCompanyName: 'Korn Ferry',
        companyId: '3616d8a1-0219-408a-a6e9-75105117be4e',
        jobCompanyId: '3616d8a1-0219-408a-a6e9-75105117be4e',
        summary: 'About Linda',
        linkedinSummary: 'About Linda',
        network_distance: 'DISTANCE_2',
        premium: true,
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

  it('keeps Unipile current_positions company_id instead of synthesizing a role', () => {
    const mapped = mapUploadProfileToLinkedinSearchRow({
      name: 'Gopala Krishnan',
      title: 'Group President',
      company: 'Hinduja Group Limited',
      linkedinUrl: 'https://www.linkedin.com/in/gopala',
      current_positions: [
        {
          role: 'Group President',
          company: 'Hinduja Group Limited',
          company_id: '946958',
        },
        {
          role: 'Advisor',
          company: 'Other Co',
          company_id: '1',
        },
      ],
    });

    expect(mapped.current_positions).toEqual([
      {
        role: 'Group President',
        company: 'Hinduja Group Limited',
        company_id: '946958',
      },
      {
        role: 'Advisor',
        company: 'Other Co',
        company_id: '1',
      },
    ]);
  });

  it('keeps a CRM UUID on companyId and a LinkedIn id on jobCompanyId', () => {
    const mapped = mapUploadProfileToLinkedinSearchRow({
      linkedinUrl: 'https://www.linkedin.com/in/ann',
      companyId: '3616d8a1-0219-408a-a6e9-75105117be4e',
      jobCompanyId: '946958',
    });

    expect(mapped.companyId).toBe('3616d8a1-0219-408a-a6e9-75105117be4e');
    expect(mapped.jobCompanyId).toBe('946958');
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

  it('reads a Links composite linkedinUrl', () => {
    const mapped = mapUploadProfileToLinkedinSearchRow({
      firstName: 'Prenisha',
      linkedinUrl: {
        primaryLinkUrl: 'https://www.linkedin.com/in/prenisha-harry-075760b',
      },
    });

    expect(mapped.linkedinUrl).toBe(
      'https://www.linkedin.com/in/prenisha-harry-075760b',
    );
    expect(mapped.public_identifier).toBe('prenisha-harry-075760b');
  });

  it('fills title and company from fetch-linkedin-profile experience', () => {
    const mapped = mapUploadProfileToLinkedinSearchRow({
      firstName: 'Prenisha',
      lastName: 'Harry',
      headline: 'Senior People Director, International - e.l.f Beauty',
      linkedinUrl: 'https://www.linkedin.com/in/prenisha-harry-075760b',
      experience: [
        {
          company: 'E.L.F. BEAUTY',
          position: 'Senior People Director, International',
        },
      ],
    });

    expect(mapped).toEqual(
      expect.objectContaining({
        first_name: 'Prenisha',
        last_name: 'Harry',
        jobTitle: 'Senior People Director, International',
        jobCompanyName: 'E.L.F. BEAUTY',
        current_positions: [
          {
            company: 'E.L.F. BEAUTY',
            role: 'Senior People Director, International',
            location: '',
          },
        ],
      }),
    );
  });
});
