import { ResponseFormatOption } from './SearchSchemas';

export type { ResponseFormatOption };

/**
 * Response format options for LinkedIn search parameters
 * Each option includes an example JSON structure that matches the corresponding schema
 */
export const RESPONSE_FORMAT_OPTIONS: ResponseFormatOption[] = [
  {
    id: 'sales_navigator_people',
    name: 'Sales Navigator People Search',
    description: 'LinkedIn Sales Navigator people search parameters',
    schema: {} as any, // Will be properly typed in the component
    example: {
      keywords: "software engineer",
      location: {
        include: ["San Francisco Bay Area", "New York City"],
        exclude: null
      },
      industry: {
        include: ["Technology", "Software Development"],
        exclude: null
      },
      company_headcount: [
        {
          min: 201,
          max: 1000
        }
      ],
      seniority: {
        include: ["senior", "strategic"],
        exclude: ["entry_level", "in_training"]
      },
      network_distance: [1, 2],
      tenure_at_company: [
        {
          min: 1,
          max: 5
        }
      ]
    }
  },
  {
    id: 'sales_navigator_companies',
    name: 'Sales Navigator Companies Search',
    description: 'LinkedIn Sales Navigator companies search parameters',
    schema: {} as any,
    example: {
      keywords: "technology startup",
      industry: {
        include: ["Technology", "Software Development"],
        exclude: null
      },
      location: {
        include: ["San Francisco Bay Area"],
        exclude: null
      },
      headcount: [
        {
          min: 51,
          max: 500
        }
      ],
      annual_revenue: {
        currency: "USD",
        min: 1,
        max: 10
      },
      technologies: ["React", "Node.js", "Python"],
      recent_activities: ["funding_events"]
    }
  },
  {
    id: 'recruiter_people',
    name: 'Recruiter People Search',
    description: 'LinkedIn Recruiter people search parameters',
    schema: {} as any,
    example: {
      keywords: "senior developer",
      locale: "english",
      location: [
        {
          id: "us:84",
          priority: "MUST_HAVE",
          scope: "CURRENT",
          title: "San Francisco Bay Area"
        }
      ],
      role: [
        {
          keywords: "software engineer",
          priority: "MUST_HAVE",
          scope: "CURRENT"
        }
      ],
      skills: [
        {
          keywords: "React JavaScript",
          priority: "MUST_HAVE"
        }
      ],
      company_headcount: [
        {
          min: 201,
          max: 1000
        }
      ],
      seniority: {
        include: ["senior", "manager"],
        exclude: ["entry", "training"]
      },
      spotlights: ["OPEN_TO_WORK", "ACTIVE_TALENT"]
    }
  },
  {
    id: 'job_description',
    name: 'Job Description Parsing',
    description: 'Parsed job description structure',
    schema: {} as any,
    example: {
      jobTitle: "Senior Software Engineer",
      company: "TechCorp Inc.",
      location: "San Francisco, CA",
      industry: "Technology",
      requiredSkills: ["React", "Node.js", "TypeScript", "AWS"],
      preferredSkills: ["GraphQL", "Docker", "Kubernetes"],
      experienceLevel: "senior_level",
      education: ["Bachelor's degree in Computer Science"],
      keywords: ["software engineer", "full stack", "web development"],
      responsibilities: [
        "Develop and maintain web applications",
        "Collaborate with cross-functional teams",
        "Mentor junior developers"
      ],
      qualifications: [
        "5+ years of software development experience",
        "Strong knowledge of React and Node.js"
      ],
      benefits: ["Health insurance", "401k matching", "Flexible PTO"],
      employmentType: "full_time",
      remoteWork: true,
      salaryRange: {
        min: 120000,
        max: 180000,
        currency: "USD"
      }
    }
  },
  {
    id: 'classic_people',
    name: 'Classic People Search',
    description: 'LinkedIn classic people search parameters',
    schema: {} as any,
    example: {
      keywords: "marketing manager",
      industry: ["Marketing", "Advertising"],
      location: ["New York", "Los Angeles"],
      network_distance: [1, 2],
      company: ["Google", "Facebook", "Apple"],
      past_company: ["Microsoft", "Amazon"],
      school: ["Stanford University", "MIT"],
      advanced_keywords: {
        first_name: "John",
        last_name: "Smith",
        title: "Marketing Director",
        company: "TechCorp",
        school: "Stanford"
      }
    }
  },
  {
    id: 'classic_companies',
    name: 'Classic Companies Search',
    description: 'LinkedIn classic companies search parameters',
    schema: {} as any,
    example: {
      keywords: "fintech startup",
      industry: ["Financial Services", "Technology"],
      location: ["San Francisco", "New York"],
      has_job_offers: true,
      headcount: [
        {
          min: 50,
          max: 500
        }
      ],
      network_distance: [1, 2]
    }
  },
  {
    id: 'classic_jobs',
    name: 'Classic Jobs Search',
    description: 'LinkedIn classic jobs search parameters',
    schema: {} as any,
    example: {
      keywords: "remote software engineer",
      sort_by: "relevance",
      date_posted: 7,
      location: ["San Francisco Bay Area"],
      industry: ["Technology"],
      seniority: ["senior", "mid-level"],
      function: ["Engineering"],
      job_type: ["full_time", "contract"],
      company: ["Google", "Microsoft", "Apple"],
      presence: ["remote", "hybrid"],
      easy_apply: true,
      minimum_salary: {
        currency: "USD",
        value: 100000
      }
    }
  }
];

/**
 * Get response format option by ID
 */
export const getResponseFormatOption = (id: string): ResponseFormatOption | undefined => {
  return RESPONSE_FORMAT_OPTIONS.find(option => option.id === id);
};

/**
 * Get all response format options
 */
export const getAllResponseFormatOptions = (): ResponseFormatOption[] => {
  return RESPONSE_FORMAT_OPTIONS;
};
