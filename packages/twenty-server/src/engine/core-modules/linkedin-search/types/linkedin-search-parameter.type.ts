export type LinkedInSearchParameterType = 
  // Common parameters
  | 'LOCATION'
  | 'PEOPLE'
  | 'CONNECTIONS'
  | 'COMPANY'
  | 'SCHOOL'
  | 'INDUSTRY'
  | 'SERVICE'
  | 'JOB_FUNCTION'
  | 'JOB_TITLE'
  | 'EMPLOYMENT_TYPE'
  | 'SKILL'
  // Sales navigator specifics
  | 'GROUPS'
  | 'SALES_INDUSTRY'
  | 'DEPARTMENT'
  | 'PERSONA'
  | 'ACCOUNT_LISTS'
  | 'LEAD_LISTS'
  | 'TECHNOLOGIES'
  | 'SAVED_ACCOUNTS'
  | 'SAVED_SEARCHES'
  | 'RECENT_SEARCHES'
  | 'POSTAL_CODE'
  // Recruiter specifics
  | 'HIRING_PROJECTS'
  | 'SAVED_FILTERS';

export type LinkedInSearchApiType = 'classic' | 'sales_navigator' | 'recruiter';

export type LinkedInSearchCategoryType = 'people' | 'companies' | 'posts' | 'jobs';

export type LinkedInNetworkDistanceType = 1 | 2 | 3 | 'GROUP';

export type LinkedInSeniorityType = 
  | 'owner/partner'
  | 'cxo'
  | 'vice_president'
  | 'director'
  | 'experienced_manager'
  | 'entry_level_manager'
  | 'strategic'
  | 'senior'
  | 'entry_level'
  | 'in_training';

export type LinkedInJobType = 
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'temporary'
  | 'volunteer'
  | 'internship'
  | 'other';

export type LinkedInPresenceType = 'on_site' | 'hybrid' | 'remote';

export type LinkedInContentType = 
  | 'videos'
  | 'images'
  | 'live_videos'
  | 'collaborative_articles'
  | 'documents';

export type LinkedInSortByType = 'relevance' | 'date';

export type LinkedInDatePostedType = 'past_day' | 'past_week' | 'past_month';

export type LinkedInCompanyType = 
  | 'public_company'
  | 'privately_held'
  | 'non_profit'
  | 'educational_institution'
  | 'partnership'
  | 'self_employed'
  | 'self_owned'
  | 'government_agency';

export type LinkedInOpenToType = 'proBono' | 'boardMember';

export type LinkedInBenefitType = 
  | 'medical_insurance'
  | 'vision_insurance'
  | 'dental_insurance'
  | 'disability_insurance'
  | '401(k)'
  | 'pension_plan'
  | 'paid_maternity_leave'
  | 'paid_paternity_leave'
  | 'commuter_benefits'
  | 'student_loan_assistance'
  | 'tuition_assistance';

export type LinkedInCommitmentType = 
  | 'career_growth_and_learning'
  | 'diversity_equity_and_inclusion'
  | 'environmental_sustainability'
  | 'social_impact'
  | 'work_life_balance';

export type LinkedInRecentActivityType = 
  | 'senior_leadership_changes'
  | 'funding_events';

export type LinkedInSpotlightType = 
  | 'OPEN_TO_WORK'
  | 'ACTIVE_TALENT'
  | 'REDISCOVERED_CANDIDATES'
  | 'INTERNAL_CANDIDATES'
  | 'INTERESTED_IN_YOUR_COMPANY'
  | 'HAVE_COMPANY_CONNECTIONS';

export type LinkedInRecruitingActivityType = 
  | 'messages'
  | 'tags'
  | 'notes'
  | 'projects'
  | 'resumes'
  | 'reviews';

export type LinkedInLanguageScopeType = 
  | 'ELEMENTARY'
  | 'LIMITED_WORKING'
  | 'PROFESSIONAL_WORKING'
  | 'FULL_PROFESSIONAL'
  | 'NATIVE_OR_BILINGUAL';

export type LinkedInPriorityType = 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE';

export type LinkedInScopeType = 
  | 'CURRENT_OR_PAST'
  | 'CURRENT'
  | 'PAST'
  | 'PAST_NOT_CURRENT'
  | 'OPEN_TO_WORK'
  | 'OPEN_TO_RELOCATE_ONLY'
  | 'CURRENT_OR_OPEN_TO_RELOCATE';

export type LinkedInLocaleType = 
  | 'arabic'
  | 'bangla'
  | 'czech'
  | 'danish'
  | 'german'
  | 'greek'
  | 'english'
  | 'spanish'
  | 'persian'
  | 'finnish'
  | 'french'
  | 'hindi'
  | 'hungarian'
  | 'indonesian'
  | 'italian'
  | 'hebrew'
  | 'japanese'
  | 'korean'
  | 'marathi'
  | 'malay'
  | 'dutch'
  | 'norwegian'
  | 'punjabi'
  | 'polish'
  | 'portuguese'
  | 'romanian'
  | 'russian'
  | 'swedish'
  | 'telugu'
  | 'thai'
  | 'tagalog'
  | 'turkish'
  | 'ukrainian'
  | 'vietnamese'
  | 'chinese_simplified'
  | 'chinese_traditional';
