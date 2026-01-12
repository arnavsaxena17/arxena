import axios from 'axios';

import console from 'console';
import { ParsedJobDescription } from '../src/engine/core-modules/candidate-search/types/candidate-search-request.type';
import { ChatMessageRequest } from '../src/engine/core-modules/candidate-search/types/search-plan.types';

const BASE_URL = process.env.SERVER_URL || 'http://localhost:3000';
const ENDPOINT = `${BASE_URL}/candidate-search/message`;
// const API_TOKEN = process.env.API_TOKEN || 'your-api-token-here';
const SEARCH_FILTER_ID = '42217337-454b-48c9-838d-768d5f36cc28';
const API_TOKEN='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxNzhkZTU3ZC0xYzM2LTQyZmMtYTEyYy1kY2U4ZTVlM2Y1MWMiLCJ3b3Jrc3BhY2VJZCI6IjA0Nzk2ZWFkLWM0NDktNGJhOC1hY2FlLWM4YzgzNTNkZTM5ZCIsIndvcmtzcGFjZU1lbWJlcklkIjoiODNlMjYxYjYtZjk3Yy00OWI5LWFjMWEtMjM5ZDM2MGNiOTljIiwidXNlcldvcmtzcGFjZUlkIjoiNjJlMGYwN2QtNjhjMi00ZTZmLWJmMTgtYjFiNTI5ZWU0MjE3IiwiaWF0IjoxNzYzNTI4Mzc4LCJleHAiOjE3NjM3MDgzNzh9.l6zA1n5pfdQeEpkMMdy8iZvGVSJs47mh7vL9CnSUqWA'

// Create a sample parsed job description based on the strategy rubrics example
const createSampleParsedJD = (): ParsedJobDescription => {
  return {
    jobTitle: 'Head of Corporate Strategy',
    company: 'Leading Power Infrastructure Company',
    location: 'Mumbai',
    industry: 'Power Infrastructure',
    requiredSkills: [
      'Corporate Strategy',
      'Market Analysis',
      'Capital Allocation',
      'Power Infrastructure',
      'Strategic Planning',
    ],
    preferredSkills: [
      'Investment Analysis',
      'M&A Strategy',
      'Regulatory Affairs',
      'Energy Sector',
    ],
    experienceLevel: 'executive',
    education: ['MBA from tier-1 institute preferred', 'Engineering degree'],
    keywords: [
      'corporate strategy',
      'power infrastructure',
      'capital allocation',
      'market analysis',
      'strategic planning',
    ],
    responsibilities: [
      'Lead strategic initiatives and capital allocation decisions',
      'Conduct market analysis and competitive intelligence',
      'Develop long-term strategic plans for power infrastructure',
      'Evaluate M&A opportunities and partnerships',
    ],
    qualifications: [
      '12-15 years of experience in strategy or power infrastructure',
      'MBA from tier-1 institute',
      'Strong analytical and strategic thinking skills',
      'Experience in capital allocation and market analysis',
    ],
    benefits: [
      'Competitive salary (50-60 LPA)',
      'Health insurance',
      'Performance bonuses',
    ],
    employmentType: 'full_time',
    remoteWork: false,
    salaryRange: {
      min: 5000000,
      max: 6000000,
      currency: 'INR',
    },
  };
};

// Create sample search results for enrichments/filters/sorts
const createSampleResults = () => {
  return [
    {
      id: 'candidate-001',
      name: 'John Doe',
      currentTitle: 'Director of Strategy',
      currentCompany: 'PowerGrid Corporation',
      currentLocation: 'Mumbai',
      totalExperienceYears: 13,
      education: ['MBA from IIM Ahmedabad', 'B.Tech in Electrical Engineering'],
      skills: ['Corporate Strategy', 'Market Analysis', 'Capital Allocation'],
      currentCompensation: '45 LPA',
    },
    {
      id: 'candidate-002',
      name: 'Jane Smith',
      currentTitle: 'VP Strategy',
      currentCompany: 'NTPC Limited',
      currentLocation: 'Delhi',
      totalExperienceYears: 15,
      education: ['MBA from IIM Bangalore', 'B.Tech in Mechanical Engineering'],
      skills: ['Strategic Planning', 'M&A', 'Investment Analysis'],
      currentCompensation: '55 LPA',
    },
    {
      id: 'candidate-003',
      name: 'Raj Kumar',
      currentTitle: 'Head of Corporate Development',
      currentCompany: 'Adani Power',
      currentLocation: 'Mumbai',
      totalExperienceYears: 12,
      education: ['MBA from ISB', 'B.Tech in Electrical Engineering'],
      skills: ['Corporate Strategy', 'Capital Allocation', 'Power Infrastructure'],
      currentCompensation: '50 LPA',
    },
  ];
};

// Create sample data distribution for filter generation
const createSampleDataDistribution = () => {
  return {
    totalExperienceYears: {
      min: 10,
      max: 18,
      avg: 13.3,
      count: 3,
    },
    currentCompensation: {
      min: 4500000,
      max: 5500000,
      avg: 5000000,
      count: 3,
    },
  };
};

// Send a message to the endpoint
const sendMessage = async (
  message: string,
  parsedJD: ParsedJobDescription,
  stepNumber: number,
  stepName: string,
  additionalData: Partial<ChatMessageRequest> = {},
): Promise<any> => {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📨 Step ${stepNumber}: ${stepName}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`💬 Message: "${message}"`);
    console.log(`📤 Sending request...\n`);
    const payload: ChatMessageRequest = {
      searchFilterId: SEARCH_FILTER_ID,
      message,
      parsedJD,
      searchType: 'classic',
      searchCategory: 'people',
      ...additionalData,
    };

    const startTime = Date.now();
    const response = await axios.post(ENDPOINT, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_TOKEN}`,
      },
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`✅ Request successful!`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📊 Status: ${response.status} ${response.statusText}\n`);

    if (response.data.success) {
      console.log(`✅ Success: ${response.data.chatMessage || 'Operation completed'}`);
      if (response.data.type) {
        console.log(`📋 Type: ${response.data.type}`);
      }
    } else {
      console.log(`❌ Error: ${response.data.error || 'Unknown error'}`);
    }

    console.log(`\n📋 Response Summary:`);
    console.log(JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error(`❌ Request failed for step ${stepNumber} (${stepName})!`);

    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        console.error('❌ Connection refused. Is the server running?');
        console.error(`   Make sure the server is running on ${BASE_URL}`);
      }

      console.error(`Status: ${error.response?.status || 'N/A'}`);
      console.error(`Status Text: ${error.response?.statusText || 'N/A'}`);
      console.error(`Error Code: ${error.code || 'N/A'}`);
      console.error(`Error Message: ${error.message}`);

      if (error.response?.data) {
        console.error('\n📋 Error Response Data:');
        console.error(JSON.stringify(error.response.data, null, 2));
      }
    } else {
      console.error('Error:', error);
    }
    throw error;
  }
};

/**
 * Simulate a complete recruiter workflow that demonstrates:
 * 1. Posting initial requirements and generating search parameters
 * 2. Tweaking requirements and modifying search parameters
 * 3. Generating enrichments (similar to strategy rubrics evaluation)
 * 4. Generating filters to narrow down candidates
 * 5. Generating sorting strategies to prioritize candidates
 * 6. Complete plan generation (all components at once)
 * 7. Refining and iterating on generated components
 * 
 * This workflow mirrors how search models create rubrics and enrichments
 * by using structured prompts and AI classification to route messages
 * to appropriate generation services.
 */
const runRecruiterWorkflow = async () => {
  try {
    console.log('🚀 Starting Recruiter Workflow Simulation...');
    console.log(`📍 Endpoint: ${ENDPOINT}`);
    console.log(`🔑 Search Filter ID: ${SEARCH_FILTER_ID}`);
    console.log(`📦 Preparing workflow steps...\n`);

    const parsedJD = createSampleParsedJD();
    const sampleResults = createSampleResults();
    const dataDistribution = createSampleDataDistribution();

    const results: any[] = [];

    // Step 1: Initial requirement posting - Generate search parameters
    // This simulates a recruiter posting their initial job requirements
    // The system will classify this as 'search_parameters' and generate
    // LinkedIn search criteria based on the parsed JD
    const step1Result = await sendMessage(
      'I need to find a Head of Corporate Strategy with 12-15 years of experience in power infrastructure, based in Mumbai, with MBA from tier-1 institute, and experience in capital allocation and market analysis. Generate search parameters for LinkedIn.',
      parsedJD,
      1,
      'Initial Requirements - Generate Search Parameters',
    );
    results.push({ step: 1, result: step1Result });
    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 Workflow Summary');
    console.log(`${'='.repeat(80)}\n`);

    const successCount = results.filter((r) => r.result?.success).length;
    const totalCount = results.length;

    console.log(`✅ Successful steps: ${successCount}/${totalCount}`);
    console.log(`\n📋 Step Results:`);

    results.forEach((r, index) => {
      const status = r.result?.success ? '✅' : '❌';
      const type = r.result?.type || 'N/A';
      console.log(`  ${status} Step ${r.step}: ${type}`);
    });

    return results;
  } catch (error) {
    console.error('\n💥 Workflow failed!');
    throw error;
  }
};

// Run the script
if (require.main === module) {
  runRecruiterWorkflow()
    .then(() => {
      console.log('\n✨ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed!');
      process.exit(1);
    });
}

export { createSampleDataDistribution, createSampleParsedJD, createSampleResults, runRecruiterWorkflow, sendMessage };

