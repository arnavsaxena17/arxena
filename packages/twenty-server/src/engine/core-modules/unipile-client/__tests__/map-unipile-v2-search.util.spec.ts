import {
  buildUnipileV2LinkedInSearchPath,
  linkedinSearchCategoryToV2Resource,
  mapClassicCompaniesSearchBodyToV2,
  mapClassicJobsSearchBodyToV2,
  mapClassicPeopleSearchBodyToV2,
  mapClassicPostsSearchBodyToV2,
  mapRecruiterPeopleSearchBodyToV2,
  mapSalesNavCompaniesSearchBodyToV2,
  mapSalesNavSearchBodyToV2,
  normalizeUnipileV2SearchHit,
  normalizeUnipileV2SearchItems,
} from '../map-unipile-v2-search.util';

describe('map-unipile-v2-search.util', () => {
  describe('paths', () => {
    it('keeps people resource for Sales Nav and Recruiter (live Unipile paths)', () => {
      expect(linkedinSearchCategoryToV2Resource('sales_navigator', 'people')).toBe(
        'people',
      );
      expect(linkedinSearchCategoryToV2Resource('recruiter', 'people')).toBe(
        'people',
      );
      expect(linkedinSearchCategoryToV2Resource('classic', 'people')).toBe(
        'people',
      );
      expect(linkedinSearchCategoryToV2Resource('sales_navigator', 'leads')).toBe(
        'people',
      );
      expect(linkedinSearchCategoryToV2Resource('recruiter', 'candidates')).toBe(
        'people',
      );
    });

    it('builds Classic cursor query without limit or offset', () => {
      expect(
        buildUnipileV2LinkedInSearchPath({
          accountId: 'acc_1',
          api: 'classic',
          category: 'people',
          cursor: 'cur_abc',
          limit: 50,
        }),
      ).toBe('/v2/acc_1/linkedin/search/people?cursor=cur_abc');
    });

    it('builds Classic jobs with clamped limit and no offset', () => {
      expect(
        buildUnipileV2LinkedInSearchPath({
          accountId: 'acc_1',
          category: 'jobs',
          limit: 80,
          offset: 10,
        }),
      ).toBe('/v2/acc_1/linkedin/search/jobs?limit=50');
    });

    it('builds Sales Nav people with offset and clamped limit 100', () => {
      expect(
        buildUnipileV2LinkedInSearchPath({
          accountId: 'acc_1',
          api: 'sales_navigator',
          category: 'people',
          cursor: 'do-not-use',
          offset: 20,
          limit: 250,
        }),
      ).toBe(
        '/v2/acc_1/linkedin/sales-navigator/search/people?offset=20&limit=100',
      );
    });

    it('builds Recruiter people with offset and limit', () => {
      expect(
        buildUnipileV2LinkedInSearchPath({
          accountId: 'acc_1',
          api: 'recruiter',
          category: 'people',
          offset: 0,
          limit: 40,
        }),
      ).toBe('/v2/acc_1/linkedin/recruiter/search/people?offset=0&limit=40');
    });

    it('omits category suffix for URL search', () => {
      expect(
        buildUnipileV2LinkedInSearchPath({
          accountId: 'acc_1',
          api: 'sales_navigator',
          hasUrl: true,
          offset: 5,
          limit: 100,
        }),
      ).toBe('/v2/acc_1/linkedin/sales-navigator/search?offset=5&limit=100');
    });
  });

  describe('body remaps', () => {
    it('maps Classic people company and drops open_to', () => {
      expect(
        mapClassicPeopleSearchBodyToV2({
          api: 'classic',
          category: 'people',
          account_id: 'acc',
          company: { include: ['1'] },
          open_to: ['volunteering'],
        }),
      ).toEqual({
        current_company: { include: ['1'] },
        company: { include: ['1'] },
      });
    });

    it('maps Classic companies has_job_offers and drops network_distance', () => {
      expect(
        mapClassicCompaniesSearchBodyToV2({
          has_job_offers: true,
          network_distance: 1,
        }),
      ).toEqual({
        has_job_postings: true,
        is_employing_relations: true,
      });
    });

    it('uppercases Classic posts sort fields and remaps relations', () => {
      expect(
        mapClassicPostsSearchBodyToV2({
          sort_by: 'date',
          date_posted: 'past_week',
          content_type: 'videos',
          posted_by: { first_connections: true },
        }),
      ).toEqual({
        sort_by: 'DATE',
        date_posted: 'PAST_WEEK',
        content_type: 'VIDEOS',
        posted_by: { relations: true },
      });
    });

    it('maps Classic jobs date, location, seniority, and salary', () => {
      expect(
        mapClassicJobsSearchBodyToV2({
          date_posted: 7,
          region: 'US',
          location_within_area: 25,
          role: 'engineer',
          job_type: 'full_time',
          presence: 'remote',
          seniority: 'entry',
          minimum_salary: 120000,
        }),
      ).toEqual({
        date_posted: 'PAST_WEEK',
        primary_location: 'US',
        location_radius: 25,
        job_title: 'engineer',
        employment_status: 'FULL_TIME',
        workplace_type: 'REMOTE',
        seniority: 'ENTRY_LEVEL',
        salary: { starting_from: 120000 },
      });
    });

    it('maps Sales Nav people remaining fields', () => {
      expect(
        mapSalesNavSearchBodyToV2({
          first_name: 'Ada',
          last_name: 'Lovelace',
          viewed_profile_recently: true,
          include_saved_leads: true,
          save_search: 'My search',
        }),
      ).toEqual({
        first_name: ['Ada'],
        last_name: ['Lovelace'],
        recent_interaction: { viewed_profile: true },
        saved_resources: { saved_leads: true },
        search_name: 'My search',
      });
    });

    it('maps Sales Nav companies spotlights and followers', () => {
      expect(
        mapSalesNavCompaniesSearchBodyToV2({
          has_job_offers: true,
          network_distance: 1,
          followers_count: { min: 100 },
        }),
      ).toMatchObject({
        spotlights: ['HIRING_ON_LINKEDIN', 'FIRST_DEGREE_CONNECTIONS'],
        followers: { min: 100 },
      });
    });

    it('maps Recruiter people role, tenure, groups, and saved_filter', () => {
      expect(
        mapRecruiterPeopleSearchBodyToV2({
          role: { name: 'PM', id: '1', scope: 'CURRENT' },
          tenure: { min: 2 },
          groups: { include: ['g1'] },
          saved_filter: 'sf_1',
          locale: 'en',
          company_headcount: { min: 50 },
        }),
      ).toEqual({
        job_title: { name: 'PM', id: '1', preferences: 'CURRENT' },
        years_of_experience: { min: 2 },
        group: { include: ['g1'] },
        saved_filter: { id: 'sf_1' },
        company_size: { min: 50 },
      });
    });
  });

  describe('response transformers', () => {
    it('fills type from category when Unipile omits it', () => {
      expect(normalizeUnipileV2SearchHit({ id: 'c1' }, 'companies').type).toBe(
        'COMPANY',
      );
      expect(normalizeUnipileV2SearchHit({ id: 'j1' }, 'jobs').type).toBe('JOB');
      expect(normalizeUnipileV2SearchHit({ id: 'p1' }, 'posts').type).toBe(
        'POST',
      );
      expect(normalizeUnipileV2SearchHit({ id: 'u1' }, 'people').type).toBe(
        'PEOPLE',
      );
    });

    it('aliases Recruiter candidate_id and shared_relations_count', () => {
      const hit = normalizeUnipileV2SearchHit(
        {
          candidate_id: 'cand_1',
          shared_relations_count: 3,
          display_name: 'Pat Lee',
        },
        'people',
      );
      expect(hit.recruiter_candidate_id).toBe('cand_1');
      expect(hit.shared_connections_count).toBe(3);
      expect(hit.name).toBe('Pat Lee');
    });

    it('reads data plus next_cursor envelope', () => {
      const normalized = normalizeUnipileV2SearchItems(
        {
          data: [{ display_name: 'Acme' }],
          next_cursor: 'cur_2',
        },
        'companies',
      );
      expect(normalized.cursor).toBe('cur_2');
      expect(normalized.items[0].type).toBe('COMPANY');
      expect(normalized.items[0].name).toBe('Acme');
    });
  });
});
