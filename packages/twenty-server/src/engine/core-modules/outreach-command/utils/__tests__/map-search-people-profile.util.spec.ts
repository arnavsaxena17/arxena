import { mapSearchPeopleProfile } from '../map-search-people-profile.util';

describe('mapSearchPeopleProfile', () => {
  it('maps Unipile current_positions into title, company, and employment history', () => {
    const mapped = mapSearchPeopleProfile(
      {
        id: 'ACwAABwmmrIBDUQbQR9lxcfdk22Zhg1JkGMQX7E',
        name: 'Nabin .',
        first_name: 'Nabin',
        last_name: '.',
        headline:
          'Leading sustainable electric transportation initiatives with global collaboration.',
        location: 'Delhi, India',
        public_identifier: 'nprasadnabin',
        public_profile_url:
          'https://www.linkedin.com/sales/lead/ACwAABwmmrIBDUQbQR9lxcfdk22Zhg1JkGMQX7E,NAME_SEARCH,xYO7',
        profile_picture_url: 'https://media.licdn.com/example.jpg',
        current_positions: [
          {
            role: 'Senior Director , Government of Saudi Arabia',
            company: 'Industrial Clusters | التجمعات الصناعية',
            company_id: '324236',
            location: 'Riyadh, Saudi Arabia',
            description: 'Leads industrial cluster programs',
            start: { year: 2021, month: 3 },
          },
        ],
        work_experience: [
          {
            role: 'Director',
            company: 'Prior Co',
            start: { year: 2018, month: 1 },
            end: { year: 2021, month: 2 },
          },
        ],
        education: [
          {
            school: 'Delhi University',
            degree: 'MBA',
            field_of_study: 'Business',
            start: { year: 2008 },
            end: { year: 2010 },
          },
        ],
      },
      { source: 'unipile' },
    );

    expect(mapped).toMatchObject({
      name: 'Nabin .',
      firstName: 'Nabin',
      lastName: '.',
      title: 'Senior Director , Government of Saudi Arabia',
      headline:
        'Leading sustainable electric transportation initiatives with global collaboration.',
      companyName: 'Industrial Clusters | التجمعات الصناعية',
      company: 'Industrial Clusters | التجمعات الصناعية',
      location: 'Delhi, India',
      linkedinProfileId: 'nprasadnabin',
      peopleId: 'ACwAABwmmrIBDUQbQR9lxcfdk22Zhg1JkGMQX7E',
      source: 'unipile',
    });
    expect(mapped.experience).toEqual([
      {
        company: 'Industrial Clusters | التجمعات الصناعية',
        position: 'Senior Director , Government of Saudi Arabia',
        location: 'Riyadh, Saudi Arabia',
        description: 'Leads industrial cluster programs',
        start: '2021-03',
        end: '',
        isCurrent: true,
        companyId: '324236',
      },
      {
        company: 'Prior Co',
        position: 'Director',
        location: '',
        description: '',
        start: '2018-01',
        end: '2021-02',
        isCurrent: false,
        companyId: '',
      },
    ]);
    expect(mapped.education).toEqual([
      {
        school: 'Delhi University',
        degree: 'MBA',
        fieldOfStudy: 'Business',
        start: '2008',
        end: '2010',
      },
    ]);
    expect(mapped.current_positions).toHaveLength(1);
  });

  it('keeps taxonomy from resolved classification', () => {
    const mapped = mapSearchPeopleProfile({
      name: 'Ada',
      title: 'CEO',
      companyName: 'Acme',
      resolved: {
        stdFunction: 'general management',
        stdFunctionRoot: 'general management',
        stdGrade: 'c-level',
      },
    });

    expect(mapped).toMatchObject({
      title: 'CEO',
      companyName: 'Acme',
      stdFunction: 'general management',
      stdFunctionRoot: 'general management',
      stdGrade: 'c-level',
    });
  });
});
