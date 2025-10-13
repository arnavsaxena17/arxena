import { EnrichmentResponseFormatOption } from './EnrichmentSchemas';

/**
 * Enrichment response format options for AI filter models
 * Each option includes examples of AIFilterModel structures for different enrichment types
 */
export const ENRICHMENT_RESPONSE_FORMAT_OPTIONS: EnrichmentResponseFormatOption[] = [
  {
    id: 'skills_extraction',
    name: 'Skills Extraction',
    description: 'Extract and categorize technical skills from candidate profiles',
    category: 'skills',
    examples: [
      {
        fields: [
          { 
            name: 'primarySkills', 
            type: 'text', 
            description: 'Primary technical skills identified from the profile', 
            enumValues: [] 
          },
          { 
            name: 'secondarySkills', 
            type: 'text', 
            description: 'Secondary technical skills mentioned', 
            enumValues: [] 
          },
          { 
            name: 'yearsOfExperience', 
            type: 'number', 
            description: 'Years of experience in primary skill area', 
            enumValues: [] 
          },
          { 
            name: 'skillLevel', 
            type: 'enum', 
            description: 'Overall skill proficiency level', 
            enumValues: ['Beginner', 'Intermediate', 'Advanced', 'Expert'] 
          }
        ],
        modelName: 'ExtractKeySkills',
        prompt: 'Analyze the candidate profile and extract their technical skills, experience level, and expertise areas. Focus on identifying primary and secondary skills with appropriate experience levels.',
        selectedMetadataFields: ['skills', 'experience', 'jobTitle', 'profile_title']
      }
    ]
  },
  {
    id: 'cultural_fit_assessment',
    name: 'Cultural Fit Assessment',
    description: 'Assess cultural fit and soft skills alignment',
    category: 'cultural_fit',
    examples: [
      {
        fields: [
          { 
            name: 'culturalFitScore', 
            type: 'number', 
            description: 'Cultural fit score on a scale of 1-10', 
            enumValues: [] 
          },
          { 
            name: 'communicationStyle', 
            type: 'enum', 
            description: 'Primary communication style observed', 
            enumValues: ['Direct', 'Diplomatic', 'Collaborative', 'Assertive'] 
          },
          { 
            name: 'teamOrientation', 
            type: 'boolean', 
            description: 'Prefers team work over individual work', 
            enumValues: [] 
          },
          { 
            name: 'leadershipPotential', 
            type: 'enum', 
            description: 'Leadership potential assessment', 
            enumValues: ['Individual Contributor', 'Team Lead', 'Manager', 'Executive'] 
          }
        ],
        modelName: 'AssessCulturalFit',
        prompt: 'Evaluate the candidate\'s cultural fit, communication style, and team orientation based on their profile. Consider their work experience, achievements, and any indicators of soft skills.',
        selectedMetadataFields: ['experience', 'education', 'interests', 'jobTitle']
      }
    ]
  },
  {
    id: 'salary_expectations',
    name: 'Salary Expectations',
    description: 'Extract salary expectations and compensation preferences',
    category: 'salary',
    examples: [
      {
        fields: [
          { 
            name: 'expectedSalary', 
            type: 'number', 
            description: 'Expected salary range in USD', 
            enumValues: [] 
          },
          { 
            name: 'salaryNegotiable', 
            type: 'boolean', 
            description: 'Whether salary is negotiable', 
            enumValues: [] 
          },
          { 
            name: 'benefitsPriority', 
            type: 'enum', 
            description: 'Most important benefit preference', 
            enumValues: ['Health Insurance', 'Remote Work', 'Stock Options', 'Professional Development', 'Flexible Hours'] 
          },
          { 
            name: 'compensationType', 
            type: 'enum', 
            description: 'Preferred compensation structure', 
            enumValues: ['Base Salary', 'Commission', 'Equity', 'Mixed'] 
          }
        ],
        modelName: 'SalaryExpectations',
        prompt: 'Analyze the candidate profile to determine their salary expectations and benefits preferences. Look for any mentions of compensation, benefits, or work preferences.',
        selectedMetadataFields: ['inferred_salary', 'jobTitle', 'experience', 'location_name']
      }
    ]
  },
  {
    id: 'experience_assessment',
    name: 'Experience Assessment',
    description: 'Evaluate work experience and career progression',
    category: 'experience',
    examples: [
      {
        fields: [
          { 
            name: 'totalExperience', 
            type: 'number', 
            description: 'Total years of professional experience', 
            enumValues: [] 
          },
          { 
            name: 'relevantExperience', 
            type: 'number', 
            description: 'Years of experience relevant to the target role', 
            enumValues: [] 
          },
          { 
            name: 'careerProgression', 
            type: 'enum', 
            description: 'Career progression pattern', 
            enumValues: ['Steady Growth', 'Rapid Advancement', 'Lateral Moves', 'Career Change'] 
          },
          { 
            name: 'industryExpertise', 
            type: 'text', 
            description: 'Primary industry expertise areas', 
            enumValues: [] 
          }
        ],
        modelName: 'ExperienceAssessment',
        prompt: 'Analyze the candidate\'s work experience to assess their career progression, relevant experience, and industry expertise. Focus on quantifying their experience and identifying patterns.',
        selectedMetadataFields: ['experience', 'experience_stats', 'industries', 'job_company_name']
      }
    ]
  },
  {
    id: 'education_evaluation',
    name: 'Education Evaluation',
    description: 'Assess educational background and qualifications',
    category: 'education',
    examples: [
      {
        fields: [
          { 
            name: 'highestDegree', 
            type: 'enum', 
            description: 'Highest educational degree obtained', 
            enumValues: ['High School', 'Associate', 'Bachelor', 'Master', 'PhD', 'Professional'] 
          },
          { 
            name: 'fieldOfStudy', 
            type: 'text', 
            description: 'Primary field of study', 
            enumValues: [] 
          },
          { 
            name: 'educationRelevance', 
            type: 'enum', 
            description: 'How relevant is the education to the target role', 
            enumValues: ['Highly Relevant', 'Somewhat Relevant', 'Not Relevant', 'Complementary'] 
          },
          { 
            name: 'certifications', 
            type: 'text', 
            description: 'Professional certifications and licenses', 
            enumValues: [] 
          }
        ],
        modelName: 'EducationEvaluation',
        prompt: 'Evaluate the candidate\'s educational background, including degrees, fields of study, and professional certifications. Assess the relevance to the target role.',
        selectedMetadataFields: ['education', 'ug_education_institute', 'ug_degree', 'skills']
      }
    ]
  },
  {
    id: 'custom_enrichment',
    name: 'Custom Enrichment',
    description: 'Create custom enrichment fields based on specific requirements',
    category: 'custom',
    examples: [
      {
        fields: [
          { 
            name: 'customField1', 
            type: 'text', 
            description: 'Custom field description based on requirements', 
            enumValues: [] 
          },
          { 
            name: 'customField2', 
            type: 'boolean', 
            description: 'Custom boolean field for specific criteria', 
            enumValues: [] 
          },
          { 
            name: 'customField3', 
            type: 'enum', 
            description: 'Custom classification field', 
            enumValues: ['Option A', 'Option B', 'Option C'] 
          }
        ],
        modelName: 'CustomEnrichment',
        prompt: 'Create custom enrichment fields based on the specific requirements provided. Adapt the fields and prompt according to the use case.',
        selectedMetadataFields: ['full_name', 'jobTitle', 'experience', 'skills']
      }
    ]
  }
];

/**
 * Get enrichment response format option by ID
 */
export const getEnrichmentResponseFormatOption = (id: string): EnrichmentResponseFormatOption | undefined => {
  return ENRICHMENT_RESPONSE_FORMAT_OPTIONS.find(option => option.id === id);
};

/**
 * Get all enrichment response format options
 */
export const getAllEnrichmentResponseFormatOptions = (): EnrichmentResponseFormatOption[] => {
  return ENRICHMENT_RESPONSE_FORMAT_OPTIONS;
};

/**
 * Get enrichment response format options by category
 */
export const getEnrichmentResponseFormatOptionsByCategory = (category: string): EnrichmentResponseFormatOption[] => {
  return ENRICHMENT_RESPONSE_FORMAT_OPTIONS.filter(option => option.category === category);
};
