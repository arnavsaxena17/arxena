const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const firstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return undefined;
};

export const UNIPILE_V2_CLASSIC_SEARCH_MAX_RESULTS = 50;
export const UNIPILE_V2_PREMIUM_SEARCH_MAX_RESULTS = 100;

export const isPremiumLinkedInSearchApi = (api?: string): boolean =>
  api === 'sales_navigator' || api === 'recruiter';

export const usesClassicCursorPagination = (
  api?: string,
  category?: string,
  hasUrl?: boolean,
): boolean => {
  if (isPremiumLinkedInSearchApi(api)) {
    return false;
  }
  if (hasUrl) {
    return true;
  }
  return category !== 'jobs';
};

export const linkedinSearchCategoryToV2Resource = (
  api?: string,
  category?: string,
): string => {
  const next = category ?? 'people';
  if (next === 'leads' || next === 'candidates') {
    return 'people';
  }
  return next;
};

export const buildUnipileV2LinkedInSearchPath = (args: {
  accountId: string;
  api?: string;
  category?: string;
  hasUrl?: boolean;
  cursor?: string;
  offset?: string | number;
  limit?: number;
}): string => {
  const prefix =
    args.api === 'sales_navigator'
      ? 'sales-navigator/search'
      : args.api === 'recruiter'
        ? 'recruiter/search'
        : 'search';
  const suffix = args.hasUrl
    ? ''
    : `/${linkedinSearchCategoryToV2Resource(args.api, args.category)}`;
  const query = new URLSearchParams();
  const premium = isPremiumLinkedInSearchApi(args.api);
  const classicCursor = usesClassicCursorPagination(
    args.api,
    args.category,
    args.hasUrl,
  );

  if (classicCursor) {
    if (args.cursor) {
      query.set('cursor', args.cursor);
    }
  } else if (premium) {
    if (args.offset != null && String(args.offset) !== '') {
      query.set('offset', String(args.offset));
    }
    if (args.limit != null) {
      query.set(
        'limit',
        String(Math.min(Math.max(1, args.limit), UNIPILE_V2_PREMIUM_SEARCH_MAX_RESULTS)),
      );
    }
  } else if (args.limit != null) {
    query.set(
      'limit',
      String(Math.min(Math.max(1, args.limit), UNIPILE_V2_CLASSIC_SEARCH_MAX_RESULTS)),
    );
  }

  const suffixQuery = query.toString() ? `?${query.toString()}` : '';
  return `/v2/${encodeURIComponent(args.accountId)}/linkedin/${prefix}${suffix}${suffixQuery}`;
};

const searchTypeFromCategory = (
  category?: string,
): 'PEOPLE' | 'COMPANY' | 'JOB' | 'POST' | undefined => {
  if (category === 'companies') {
    return 'COMPANY';
  }
  if (category === 'jobs') {
    return 'JOB';
  }
  if (category === 'posts') {
    return 'POST';
  }
  if (category === 'people' || category === 'leads' || category === 'candidates') {
    return 'PEOPLE';
  }
  return undefined;
};

export const normalizeUnipileV2SearchItems = (
  payload: unknown,
  category?: string,
): { items: Record<string, unknown>[]; cursor?: string; object?: string } => {
  const record = asRecord(payload) ?? {};
  const rawItems = Array.isArray(record.items)
    ? record.items
    : Array.isArray(record.data)
      ? record.data
      : [];
  const items = rawItems
    .filter((item): item is Record<string, unknown> => !!asRecord(item))
    .map((item) => normalizeUnipileV2SearchHit(item, category));
  const cursor = firstString(record.next_cursor, record.cursor);

  return {
    object: typeof record.object === 'string' ? record.object : 'LinkedinSearch',
    items,
    cursor,
  };
};

export const normalizeUnipileV2SearchHit = (
  item: Record<string, unknown>,
  category?: string,
): Record<string, unknown> => {
  const workExperience = Array.isArray(item.work_experience)
    ? item.work_experience
    : Array.isArray(item.current_positions)
      ? item.current_positions
      : [];
  const currentPositions = workExperience.map((position) => {
    const pos = asRecord(position) ?? {};
    const company = asRecord(pos.company);
    return {
      ...pos,
      company: company?.name ?? pos.company,
      company_id: company?.id ?? pos.company_id,
      role: pos.job_title ?? pos.role,
    };
  });
  const inferredType =
    typeof item.type === 'string' && item.type
      ? item.type
      : searchTypeFromCategory(category);

  return {
    ...item,
    name: item.name ?? item.display_name,
    display_name: item.display_name ?? item.name,
    first_name: item.first_name,
    last_name: item.last_name,
    public_profile_url: item.public_profile_url ?? item.profile_url,
    profile_url: item.profile_url ?? item.public_profile_url,
    profile_picture_url: item.profile_picture_url ?? item.public_picture_url,
    public_picture_url: item.public_picture_url ?? item.profile_picture_url,
    connections_count: item.connections_count ?? item.relations_count,
    relations_count: item.relations_count ?? item.connections_count,
    shared_connections_count:
      item.shared_connections_count ?? item.shared_relations_count,
    shared_relations_count:
      item.shared_relations_count ?? item.shared_connections_count,
    recruiter_candidate_id: item.recruiter_candidate_id ?? item.candidate_id,
    candidate_id: item.candidate_id ?? item.recruiter_candidate_id,
    verified: item.verified ?? item.is_verified,
    premium: item.premium ?? item.is_premium,
    open_profile: item.open_profile ?? item.is_open_profile,
    current_positions: currentPositions,
    ...(inferredType ? { type: inferredType } : {}),
  };
};

const stripSearchMeta = (body: Record<string, unknown>): Record<string, unknown> => {
  const next = { ...body };
  delete next.api;
  delete next.category;
  delete next.account_id;
  delete next.cursor;
  return next;
};

const toUpperIfString = (value: unknown): unknown =>
  typeof value === 'string' ? value.toUpperCase() : value;

const mapDatePostedNumber = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value.toUpperCase();
  }
  if (typeof value !== 'number') {
    return value;
  }
  if (value <= 1) {
    return 'PAST_DAY';
  }
  if (value <= 7) {
    return 'PAST_WEEK';
  }
  return 'PAST_MONTH';
};

const JOB_SENIORITY: Record<string, string> = {
  executive: 'EXECUTIVE',
  director: 'DIRECTOR',
  mid_senior: 'MID_SENIOR_LEVEL',
  associate: 'ASSOCIATE',
  entry: 'ENTRY_LEVEL',
  intern: 'INTERNSHIP',
};

export const mapClassicPeopleSearchBodyToV2 = (
  body: Record<string, unknown>,
): Record<string, unknown> => {
  const next = stripSearchMeta(body);
  if (next.company && !next.current_company) {
    next.current_company = next.company;
  }
  delete next.open_to;
  return next;
};

export const mapClassicCompaniesSearchBodyToV2 = (
  body: Record<string, unknown>,
): Record<string, unknown> => {
  const next = stripSearchMeta(body);
  if (next.has_job_offers != null && next.has_job_postings == null) {
    next.has_job_postings = next.has_job_offers;
  }
  if (next.network_distance != null && next.is_employing_relations == null) {
    next.is_employing_relations = true;
  }
  delete next.has_job_offers;
  delete next.network_distance;
  return next;
};

export const mapClassicPostsSearchBodyToV2 = (
  body: Record<string, unknown>,
): Record<string, unknown> => {
  const next = stripSearchMeta(body);
  next.sort_by = toUpperIfString(next.sort_by);
  next.date_posted = toUpperIfString(next.date_posted);
  next.content_type = toUpperIfString(next.content_type);
  const postedBy = asRecord(next.posted_by);
  if (postedBy && postedBy.first_connections != null && postedBy.relations == null) {
    next.posted_by = {
      ...postedBy,
      relations: postedBy.first_connections,
    };
    delete (next.posted_by as Record<string, unknown>).first_connections;
  }
  return next;
};

export const mapClassicJobsSearchBodyToV2 = (
  body: Record<string, unknown>,
): Record<string, unknown> => {
  const next = stripSearchMeta(body);
  if (next.date_posted != null) {
    next.date_posted = mapDatePostedNumber(next.date_posted);
  }
  if (next.region && !next.primary_location) {
    next.primary_location = next.region;
  }
  if (next.location_within_area != null && next.location_radius == null) {
    next.location_radius = next.location_within_area;
  }
  if (next.role && !next.job_title) {
    next.job_title = next.role;
  }
  if (next.job_type && !next.employment_status) {
    next.employment_status = Array.isArray(next.job_type)
      ? next.job_type.map(toUpperIfString)
      : toUpperIfString(next.job_type);
  }
  if (next.presence && !next.workplace_type) {
    next.workplace_type = Array.isArray(next.presence)
      ? next.presence.map(toUpperIfString)
      : toUpperIfString(next.presence);
  }
  if (typeof next.seniority === 'string') {
    next.seniority = JOB_SENIORITY[next.seniority] ?? next.seniority.toUpperCase();
  } else if (Array.isArray(next.seniority)) {
    next.seniority = next.seniority.map((item) =>
      typeof item === 'string'
        ? JOB_SENIORITY[item] ?? item.toUpperCase()
        : item,
    );
  }
  if (next.benefits != null) {
    next.benefits = Array.isArray(next.benefits)
      ? next.benefits.map(toUpperIfString)
      : toUpperIfString(next.benefits);
  }
  if (next.commitments != null) {
    next.commitments = Array.isArray(next.commitments)
      ? next.commitments.map(toUpperIfString)
      : toUpperIfString(next.commitments);
  }
  if (next.minimum_salary != null && next.salary == null) {
    next.salary =
      typeof next.minimum_salary === 'object'
        ? {
            starting_from:
              asRecord(next.minimum_salary)?.value ??
              asRecord(next.minimum_salary)?.starting_from,
          }
        : { starting_from: next.minimum_salary };
  }
  delete next.region;
  delete next.location_within_area;
  delete next.role;
  delete next.job_type;
  delete next.presence;
  delete next.minimum_salary;
  return next;
};

export const mapSalesNavSearchBodyToV2 = (
  body: Record<string, unknown>,
): Record<string, unknown> => {
  const next = stripSearchMeta(body);
  if (next.role && !next.current_job_title) {
    next.current_job_title = next.role;
  }
  if (next.company && !next.current_company) {
    next.current_company = next.company;
  }
  if (next.past_role && !next.past_job_title) {
    next.past_job_title = next.past_role;
  }
  if (next.tenure && !next.years_of_experience) {
    next.years_of_experience = next.tenure;
  }
  if (next.tenure_at_company && !next.years_in_company) {
    next.years_in_company = next.tenure_at_company;
  }
  if (next.tenure_at_role && !next.years_in_position) {
    next.years_in_position = next.tenure_at_role;
  }
  if (next.groups && !next.group) {
    next.group = Array.isArray(next.groups)
      ? { include: next.groups }
      : next.groups;
  }
  if (typeof next.saved_search_id === 'string' && !next.saved_search) {
    next.saved_search = { id: next.saved_search_id };
  }
  if (typeof next.recent_search_id === 'string' && !next.recent_search) {
    next.recent_search = { id: next.recent_search_id };
  }
  if (next.location_by_postal_code && !next.postal_code) {
    next.postal_code = next.location_by_postal_code;
  }
  if (typeof next.first_name === 'string') {
    next.first_name = [next.first_name];
  }
  if (typeof next.last_name === 'string') {
    next.last_name = [next.last_name];
  }
  if (next.company_type) {
    next.company_type = Array.isArray(next.company_type)
      ? next.company_type.map(toUpperIfString)
      : toUpperIfString(next.company_type);
  }
  if (Array.isArray(next.seniority)) {
    next.seniority = next.seniority.map(toUpperIfString);
  } else if (asRecord(next.seniority)) {
    const seniority = asRecord(next.seniority) ?? {};
    next.seniority = {
      ...seniority,
      include: Array.isArray(seniority.include)
        ? seniority.include.map(toUpperIfString)
        : seniority.include,
      exclude: Array.isArray(seniority.exclude)
        ? seniority.exclude.map(toUpperIfString)
        : seniority.exclude,
    };
  }
  const savedSearch = asRecord(next.saved_search) ?? {};
  if (next.last_viewed_at && !savedSearch.last_viewed_at) {
    next.saved_search = { ...savedSearch, last_viewed_at: next.last_viewed_at };
  }
  const recentInteraction = asRecord(next.recent_interaction) ?? {};
  if (next.viewed_profile_recently != null) {
    recentInteraction.viewed_profile = next.viewed_profile_recently;
  }
  if (next.messaged_recently != null) {
    recentInteraction.messaged = next.messaged_recently;
  }
  if (Object.keys(recentInteraction).length > 0) {
    next.recent_interaction = recentInteraction;
  }
  const savedResources = asRecord(next.saved_resources) ?? {};
  if (next.include_saved_leads != null) {
    savedResources.saved_leads = next.include_saved_leads;
  }
  if (next.include_saved_accounts != null) {
    savedResources.saved_accounts = next.include_saved_accounts;
  }
  if (Object.keys(savedResources).length > 0) {
    next.saved_resources = savedResources;
  }
  if (next.save_search && !next.search_name) {
    next.search_name = next.save_search;
  }
  if (next.account_lists && !next.account_list) {
    next.account_list = next.account_lists;
  }
  if (next.lead_lists && !next.lead_list) {
    next.lead_list = next.lead_lists;
  }
  delete next.saved_search_id;
  delete next.recent_search_id;
  delete next.location_by_postal_code;
  delete next.last_viewed_at;
  delete next.viewed_profile_recently;
  delete next.messaged_recently;
  delete next.include_saved_leads;
  delete next.include_saved_accounts;
  delete next.save_search;
  delete next.account_lists;
  delete next.lead_lists;
  delete next.mentionned_in_news;
  delete next.role;
  delete next.company;
  delete next.past_role;
  delete next.tenure;
  delete next.tenure_at_company;
  delete next.tenure_at_role;
  delete next.groups;
  return next;
};

export const mapSalesNavCompaniesSearchBodyToV2 = (
  body: Record<string, unknown>,
): Record<string, unknown> => {
  const next = mapSalesNavSearchBodyToV2(body);
  const spotlights = Array.isArray(next.spotlights)
    ? [...(next.spotlights as unknown[])]
    : [];
  if (next.has_job_offers) {
    spotlights.push('HIRING_ON_LINKEDIN');
  }
  if (next.network_distance) {
    spotlights.push('FIRST_DEGREE_CONNECTIONS');
  }
  if (Array.isArray(next.recent_activities)) {
    const activities = next.recent_activities as unknown[];
    if (activities.includes('leadership') || activities.includes('RECENT_LEADERSHIP_CHANGE')) {
      spotlights.push('RECENT_LEADERSHIP_CHANGE');
    }
    if (activities.includes('funding') || activities.includes('RECENT_FUNDING_EVENTS')) {
      spotlights.push('RECENT_FUNDING_EVENTS');
    }
  }
  if (spotlights.length > 0) {
    next.spotlights = [...new Set(spotlights)];
  }
  if (next.followers_count && !next.followers) {
    next.followers = next.followers_count;
  }
  delete next.has_job_offers;
  delete next.network_distance;
  delete next.recent_activities;
  delete next.followers_count;
  delete next.technologies;
  return next;
};

export const mapRecruiterPeopleSearchBodyToV2 = (
  body: Record<string, unknown>,
): Record<string, unknown> => {
  const next = stripSearchMeta(body);
  if (next.role && !next.job_title) {
    if (Array.isArray(next.role)) {
      next.job_title = (next.role as unknown[]).map((item) => {
        const record = asRecord(item);
        if (!record) {
          return { name: String(item) };
        }
        return {
          name: record.name ?? record.keywords,
          id: record.id,
          preferences: record.preferences ?? record.scope,
          priority: record.priority,
        };
      });
    } else if (asRecord(next.role)) {
      const role = asRecord(next.role) ?? {};
        next.job_title = {
          name: role.name ?? role.keywords,
          id: role.id,
          preferences: role.preferences ?? role.scope,
          ...(role.priority != null ? { priority: role.priority } : {}),
        };
    } else {
      next.job_title = next.role;
    }
  }
  if (Array.isArray(next.skills)) {
    next.skills = next.skills.map((item) => {
      const record = asRecord(item);
      if (!record) {
        return item;
      }
      return {
        ...record,
        name: record.name ?? record.keywords,
      };
    });
  }
  if (asRecord(next.company)) {
    const company = asRecord(next.company) ?? {};
    next.company = {
      ...company,
      name: company.name ?? company.keywords,
      preferences: company.preferences ?? company.scope,
    };
  }
  if (asRecord(next.location)) {
    const location = asRecord(next.location) ?? {};
    if (location.scope && !location.preferences) {
      location.preferences = location.scope;
    }
    delete location.title;
    delete location.scope;
    next.location = location;
  }
  if (next.location_within_area != null && next.postal_code_radius == null) {
    next.postal_code_radius = next.location_within_area;
  }
  if (next.tenure && !next.years_of_experience) {
    next.years_of_experience = next.tenure;
  }
  if (next.tenure_in_company && !next.years_in_company) {
    next.years_in_company = next.tenure_in_company;
  }
  if (next.tenure_in_position && !next.years_in_position) {
    next.years_in_position = next.tenure_in_position;
  }
  if (next.groups && !next.group) {
    next.group = next.groups;
  }
  if (typeof next.saved_filter === 'string') {
    next.saved_filter = { id: next.saved_filter };
  }
  if (next.company_headcount && !next.company_size) {
    next.company_size = next.company_headcount;
  }
  if (next.spoken_languages && !next.spoken_language) {
    next.spoken_language = next.spoken_languages;
  }
  const spoken = asRecord(next.spoken_language);
  if (spoken?.scope && !spoken.preferences) {
    spoken.preferences = spoken.scope;
    delete spoken.scope;
    next.spoken_language = spoken;
  }
  if (asRecord(next.seniority)?.include && !Array.isArray(next.seniority)) {
    const include = (asRecord(next.seniority)?.include as unknown[]) ?? [];
    next.seniority = include.map((item) =>
      typeof item === 'string' ? item.toUpperCase() : item,
    );
  }
  if (next.has_military_background != null && next.is_military_veteran == null) {
    next.is_military_veteran = next.has_military_background;
  }
  if (next.past_applicants != null && next.is_past_applicant == null) {
    next.is_past_applicant = next.past_applicants;
  }
  if (next.hiring_projects && !next.project) {
    next.project = next.hiring_projects;
  }
  const recruiting = asRecord(next.recruiting_activity);
  if (recruiting?.timespan && !recruiting.preferences) {
    recruiting.preferences = recruiting.timespan;
    delete recruiting.timespan;
    next.recruiting_activity = recruiting;
  }
  delete next.role;
  delete next.locale;
  delete next.saved_search;
  delete next.location_within_area;
  delete next.tenure;
  delete next.tenure_in_company;
  delete next.tenure_in_position;
  delete next.groups;
  delete next.company_headcount;
  delete next.spoken_languages;
  delete next.has_military_background;
  delete next.past_applicants;
  delete next.hiring_projects;
  return next;
};

export const mapUnipileV2SearchBody = (
  api: string | undefined,
  category: string | undefined,
  body: Record<string, unknown>,
): Record<string, unknown> => {
  if (body.url) {
    return stripSearchMeta(body);
  }
  if (api === 'sales_navigator' && category === 'companies') {
    return mapSalesNavCompaniesSearchBodyToV2(body);
  }
  if (api === 'sales_navigator') {
    return mapSalesNavSearchBodyToV2(body);
  }
  if (api === 'recruiter') {
    return mapRecruiterPeopleSearchBodyToV2(body);
  }
  if (category === 'companies') {
    return mapClassicCompaniesSearchBodyToV2(body);
  }
  if (category === 'posts') {
    return mapClassicPostsSearchBodyToV2(body);
  }
  if (category === 'jobs') {
    return mapClassicJobsSearchBodyToV2(body);
  }
  if (category === 'people') {
    return mapClassicPeopleSearchBodyToV2(body);
  }
  return stripSearchMeta(body);
};
