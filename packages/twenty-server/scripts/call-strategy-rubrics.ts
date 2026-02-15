import axios from 'axios';

import { EvaluateShortlistDto } from '../src/engine/core-modules/search-models/dto/evaluate-shortlist.dto';

const BASE_URL = process.env.SERVER_URL || 'http://localhost:3000';
const ENDPOINT = `${BASE_URL}/search-models/strategy-rubrics`;

const createSamplePayload = (): EvaluateShortlistDto => {
  return {
    naturalLanguageQuery:
      'Find a Head of Corporate Strategy with 12-15 years of experience in power infrastructure, based in Mumbai, with MBA from tier-1 institute, and experience in capital allocation and market analysis.',
    candidate: {
      candidateId: 'sample-candidate-001',
      name: 'John Doe',
      currentTitle: 'Director of Strategy',
      currentCompany: 'PowerGrid Corporation',
      currentLocation: 'Mumbai',
      preferredLocation: 'Mumbai, Delhi',
      totalExperienceYears: 13,
      currentCompensation: '45 LPA',
      expectedCompensation: '55 LPA',
      education: ['MBA from IIM Ahmedabad', 'B.Tech in Electrical Engineering'],
      skills: [
        'Corporate Strategy',
        'Market Analysis',
        'Capital Allocation',
        'Power Infrastructure',
        'Strategic Planning',
      ],
      certifications: ['PMP', 'Six Sigma Black Belt'],
      languages: ['English', 'Hindi'],
      achievements: [
        'Led strategic initiatives worth $500M',
        'Successfully executed 3 major infrastructure projects',
      ],
      notes: 'Strong background in power sector with proven track record in strategic planning.',
      structuredFields: {
        jsUserName: 'john.doe',
        jobTitle: 'Director of Strategy',
        keySkills: 'Corporate Strategy, Market Analysis, Capital Allocation',
        focusedSkills: 'Strategic Planning, Power Infrastructure, Market Analysis',
        interestedSkills: 'Corporate Strategy, Capital Allocation',
        education: {
          ug: {
            institute: 'IIT Delhi',
            course: 'B.Tech',
            specialization: 'Electrical Engineering',
            year: 2010,
          },
          pg: {
            institute: 'IIM Ahmedabad',
            course: 'MBA',
            specialization: 'Strategy',
            year: 2012,
          },
          ppg: null,
        },
        employment: {
          current: {
            designation: 'Director of Strategy',
            organization: 'PowerGrid Corporation',
            startDate: '2018-01-01',
            endDate: undefined,
          },
          previous: {
            designation: 'Senior Manager - Strategy',
            organization: 'NTPC Limited',
            startDate: '2012-06-01',
            endDate: '2017-12-31',
          },
        },
        ctcInfo: {
          lacs: '45',
          thousands: '00',
          currency: 'INR',
        },
        experience: {
          years: 13,
          months: 6,
        },
        currentLocation: 'Mumbai',
        preferredLocations: 'Mumbai, Delhi',
        salaryDisclosed: true,
        immediateAvailabilty: false,
        avgResponseTime: '24 hours',
        noticePeriod: 60,
        modifyDateLabel: '2024-01-15',
        activeDateLabel: '2024-01-10',
      },
    },
    expectations: {
      jobTitle: 'Head of Corporate Strategy',
      company: 'Leading Power Infrastructure Company',
      location: 'Mumbai',
      salary: '50-60 LPA',
      experience: '12-15 years',
      education: 'MBA from tier-1 institute preferred',
      skills: 'Corporate Strategy, Market Analysis, Capital Allocation, Power Infrastructure',
      certifications: 'PMP or equivalent preferred',
      languages: 'English, Hindi',
      shortlistingCriteria:
        'Must have 12+ years experience, MBA from tier-1 institute, experience in power infrastructure, and strong strategic planning background.',
    },
  };
};

const runStrategyRubricsRequest = async () => {
  try {
    console.log('🚀 Starting strategy-rubrics request...');
    console.log(`📍 Endpoint: ${ENDPOINT}`);
    console.log('📦 Preparing sample payload...\n');

    const payload = createSamplePayload();
    console.log('Payload:', JSON.stringify(payload, null, 2));
    console.log('📤 Sending request...\n');
    const startTime = Date.now();

    const response = await axios.post(ENDPOINT, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('✅ Request successful!');
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📊 Status: ${response.status} ${response.statusText}\n`);
    console.log('📋 Response Data:');

    console.log(JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error('❌ Request failed!');
    
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

// Run the script
if (require.main === module) {
  runStrategyRubricsRequest()
    .then(() => {
      console.log('\n✨ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed!');
      process.exit(1);
    });
}

export { createSamplePayload, runStrategyRubricsRequest };

