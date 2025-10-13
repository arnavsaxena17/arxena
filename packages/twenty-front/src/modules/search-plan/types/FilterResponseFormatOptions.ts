import { FilterResponseFormatOption } from './FilterSchemas';

/**
 * Filter response format options for both Handsontable and Candidate Search Results Table
 * Each option includes examples of filter structures for different filtering scenarios
 */
export const FILTER_RESPONSE_FORMAT_OPTIONS: FilterResponseFormatOption[] = [
  {
    id: 'handsontable_basic',
    name: 'Handsontable Basic Filters',
    description: 'Basic text and numeric filters for Handsontable data grid',
    category: 'handsontable',
    examples: {
      handsontable: [
        {
          column: 'name',
          type: 'text',
          condition: 'contains',
          value: 'John'
        },
        {
          column: 'jobTitle',
          type: 'text',
          condition: 'begins_with',
          value: 'Senior'
        },
        {
          column: 'candConversationStatus',
          type: 'dropdown',
          condition: 'by_value',
          value: 'CONTACTED',
          options: ['CONTACTED', 'REPLIED', 'INTERESTED', 'NOT_INTERESTED']
        },
        {
          column: 'expectedSalary',
          type: 'numeric',
          condition: 'between',
          value: 80000,
          value2: 120000
        }
      ]
    }
  },
  {
    id: 'handsontable_advanced',
    name: 'Handsontable Advanced Filters',
    description: 'Advanced filters with multiple conditions and complex logic',
    category: 'handsontable',
    examples: {
      handsontable: [
        {
          column: 'locationName',
          type: 'text',
          condition: 'contains',
          value: 'San Francisco'
        },
        {
          column: 'totalExperience',
          type: 'numeric',
          condition: 'gte',
          value: 5
        },
        {
          column: 'culturalFitScore',
          type: 'numeric',
          condition: 'between',
          value: 7,
          value2: 10
        },
        {
          column: 'status',
          type: 'dropdown',
          condition: 'by_value',
          value: 'ACTIVE',
          options: ['ACTIVE', 'INACTIVE', 'PENDING']
        },
        {
          column: 'email',
          type: 'text',
          condition: 'not_empty',
          value: null
        }
      ]
    }
  },
  {
    id: 'candidate_search_basic',
    name: 'Candidate Search Basic Filters',
    description: 'Basic filters for LinkedIn candidate search results',
    category: 'candidate_search',
    examples: {
      candidateSearch: [
        {
          field: 'name',
          type: 'text_search',
          label: 'Name',
          value: 'Software Engineer',
          placeholder: 'Search by name...'
        },
        {
          field: 'location',
          type: 'location',
          label: 'Location',
          value: 'San Francisco Bay Area',
          options: ['San Francisco Bay Area', 'New York', 'Seattle', 'Austin']
        },
        {
          field: 'industry',
          type: 'dropdown_selection',
          label: 'Industry',
          value: 'Technology',
          options: ['Technology', 'Finance', 'Healthcare', 'Education']
        },
        {
          field: 'network_distance',
          type: 'multi_select',
          label: 'Network Distance',
          values: [1, 2],
          options: ['1st', '2nd', '3rd', 'Group']
        }
      ]
    }
  },
  {
    id: 'candidate_search_advanced',
    name: 'Candidate Search Advanced Filters',
    description: 'Advanced filters for detailed candidate screening',
    category: 'candidate_search',
    examples: {
      candidateSearch: [
        {
          field: 'experience',
          type: 'experience_range',
          label: 'Experience Range',
          min: 3,
          max: 10
        },
        {
          field: 'company',
          type: 'company',
          label: 'Current Company',
          value: 'Google',
          options: ['Google', 'Microsoft', 'Apple', 'Amazon', 'Meta']
        },
        {
          field: 'seniority',
          type: 'seniority',
          label: 'Seniority Level',
          values: ['senior', 'manager'],
          options: ['entry', 'mid', 'senior', 'manager', 'director', 'executive']
        },
        {
          field: 'can_send_inmail',
          type: 'boolean',
          label: 'InMail Available',
          value: true
        },
        {
          field: 'followers_count',
          type: 'numeric_range',
          label: 'Followers Count',
          min: 500,
          max: 5000
        }
      ]
    }
  },
  {
    id: 'unified_filtering',
    name: 'Unified Filtering System',
    description: 'Combined filters for both Handsontable and Candidate Search Results',
    category: 'unified',
    examples: {
      unified: {
        handsontable: [
          {
            column: 'name',
            type: 'text',
            condition: 'contains',
            value: 'Engineer'
          },
          {
            column: 'locationName',
            type: 'text',
            condition: 'contains',
            value: 'Remote'
          },
          {
            column: 'expectedSalary',
            type: 'numeric',
            condition: 'gte',
            value: 100000
          }
        ],
        candidateSearch: [
          {
            field: 'headline',
            type: 'text_search',
            label: 'Job Title',
            value: 'Senior Software Engineer',
            placeholder: 'Search by job title...'
          },
          {
            field: 'location',
            type: 'location',
            label: 'Location',
            value: 'Remote',
            options: ['Remote', 'Hybrid', 'On-site']
          },
          {
            field: 'industry',
            type: 'dropdown_selection',
            label: 'Industry',
            value: 'Technology',
            options: ['Technology', 'Finance', 'Healthcare']
          }
        ]
      }
    }
  },
  {
    id: 'enrichment_filters',
    name: 'Enrichment-Based Filters',
    description: 'Filters based on AI-generated enrichment data',
    category: 'handsontable',
    examples: {
      handsontable: [
        {
          column: 'primarySkills',
          type: 'text',
          condition: 'contains',
          value: 'React'
        },
        {
          column: 'culturalFitScore',
          type: 'numeric',
          condition: 'gte',
          value: 8
        },
        {
          column: 'communicationStyle',
          type: 'dropdown',
          condition: 'by_value',
          value: 'Collaborative',
          options: ['Direct', 'Diplomatic', 'Collaborative', 'Assertive']
        },
        {
          column: 'salaryNegotiable',
          type: 'checkbox',
          condition: 'eq',
          value: true
        },
        {
          column: 'highestDegree',
          type: 'dropdown',
          condition: 'by_value',
          value: 'Bachelor',
          options: ['High School', 'Associate', 'Bachelor', 'Master', 'PhD']
        }
      ]
    }
  },
  {
    id: 'conversation_filters',
    name: 'Conversation Status Filters',
    description: 'Filters based on candidate conversation and engagement status',
    category: 'handsontable',
    examples: {
      handsontable: [
        {
          column: 'candConversationStatus',
          type: 'dropdown',
          condition: 'by_value',
          value: 'CONTACTED',
          options: ['NOT_CONTACTED', 'CONTACTED', 'REPLIED', 'INTERESTED', 'NOT_INTERESTED', 'HIRED']
        },
        {
          column: 'lastMessage',
          type: 'date',
          condition: 'gte',
          value: '2024-01-01'
        },
        {
          column: 'status',
          type: 'dropdown',
          condition: 'by_value',
          value: 'ACTIVE',
          options: ['ACTIVE', 'INACTIVE', 'PENDING', 'ARCHIVED']
        },
        {
          column: 'remarks',
          type: 'text',
          condition: 'not_empty',
          value: null
        }
      ]
    }
  },
  {
    id: 'job_specific_filters',
    name: 'Job-Specific Filters',
    description: 'Filters tailored for specific job requirements and criteria',
    category: 'unified',
    examples: {
      unified: {
        handsontable: [
          {
            column: 'jobTitle',
            type: 'text',
            condition: 'contains',
            value: 'Developer'
          },
          {
            column: 'jobCompanyName',
            type: 'text',
            condition: 'contains',
            value: 'Tech'
          },
          {
            column: 'totalExperience',
            type: 'numeric',
            condition: 'between',
            value: 3,
            value2: 7
          }
        ],
        candidateSearch: [
          {
            field: 'headline',
            type: 'text_search',
            label: 'Role',
            value: 'Full Stack Developer',
            placeholder: 'Search by role...'
          },
          {
            field: 'company',
            type: 'company',
            label: 'Target Companies',
            values: ['Google', 'Microsoft', 'Apple'],
            options: ['Google', 'Microsoft', 'Apple', 'Amazon', 'Meta', 'Netflix']
          },
          {
            field: 'experience',
            type: 'experience_range',
            label: 'Required Experience',
            min: 2,
            max: 8
          },
          {
            field: 'network_distance',
            type: 'multi_select',
            label: 'Network Access',
            values: [1, 2],
            options: ['1st', '2nd', '3rd']
          }
        ]
      }
    }
  }
];

/**
 * Get filter response format option by ID
 */
export const getFilterResponseFormatOption = (id: string): FilterResponseFormatOption | undefined => {
  return FILTER_RESPONSE_FORMAT_OPTIONS.find(option => option.id === id);
};

/**
 * Get all filter response format options
 */
export const getAllFilterResponseFormatOptions = (): FilterResponseFormatOption[] => {
  return FILTER_RESPONSE_FORMAT_OPTIONS;
};

/**
 * Get filter response format options by category
 */
export const getFilterResponseFormatOptionsByCategory = (category: string): FilterResponseFormatOption[] => {
  return FILTER_RESPONSE_FORMAT_OPTIONS.filter(option => option.category === category);
};
