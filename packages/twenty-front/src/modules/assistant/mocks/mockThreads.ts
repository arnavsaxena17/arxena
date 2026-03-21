import type { AssistantTableData } from '@/assistant/components/AssistantDetailsTable';
import type { AssistantThread } from '@/assistant/types/assistant.types';

const MOCK_CANDIDATES_TABLE: AssistantTableData = {
  tableType: 'candidates',
  // Base candidate data enriched with AI filter outputs so that
  // the assistant results panel + main candidate table can
  // demonstrate enrichment columns (relevance*, matchReasons, etc.).
  columns: [
    'name',
    'currentJobTitle',
    'currentCompany',
    'experience',
    'status',
    'engagementStatus',
    // AI filtering / enrichment outputs
    'relevanceScore',
    'relevanceLabel',
    'matchReasons',
    'mismatchReasons',
  ],
  rows: [
    {
      id: 'mock-cand-1',
      name: 'Priya Sharma',
      currentJobTitle: 'Senior React Developer',
      currentCompany: 'Fintech Solutions',
      experience: '6 years',
      status: 'SCREENING',
      engagementStatus: 'NOT_CONTACTED',
      jobsId: 'mock-job-1',
      relevanceScore: 0.92,
      relevanceLabel: 'highly_relevant',
      matchReasons: [
        '7+ years modern React experience',
        'Recent fintech product background',
      ],
      mismatchReasons: [],
    },
    {
      id: 'mock-cand-2',
      name: 'Rahul Verma',
      currentJobTitle: 'Frontend Lead',
      currentCompany: 'SaaS Corp',
      experience: '8 years',
      status: 'INTERESTED',
      engagementStatus: 'CONTACTED',
      jobsId: 'mock-job-1',
      relevanceScore: 0.78,
      relevanceLabel: 'somewhat_relevant',
      matchReasons: ['Team lead experience', 'Strong SaaS product exposure'],
      mismatchReasons: ['Less hands-on coding in current role'],
    },
    {
      id: 'mock-cand-3',
      name: 'Anita Patel',
      currentJobTitle: 'Software Engineer',
      currentCompany: 'Product Labs',
      experience: '5 years',
      status: 'CV_SENT',
      engagementStatus: 'CLIENT_REVIEW',
      jobsId: 'mock-job-1',
      relevanceScore: 0.64,
      relevanceLabel: 'somewhat_relevant',
      matchReasons: ['Solid React IC experience'],
      mismatchReasons: ['Limited fintech exposure'],
    },
  ],
};

const MOCK_CLIENT_SHORTLIST_TABLE: AssistantTableData = {
  tableType: 'data',
  columns: ['candidateName', 'role', 'stage', 'clientFeedback', 'priority'],
  rows: [
    {
      id: 'mock-cv-1',
      candidateName: 'Priya Sharma',
      role: 'Senior React Developer',
      stage: 'Sent to client',
      clientFeedback: 'Interview scheduled',
      priority: 'High',
    },
    {
      id: 'mock-cv-2',
      candidateName: 'Rahul Verma',
      role: 'Frontend Lead',
      stage: 'Sent to client',
      clientFeedback: 'Awaiting feedback',
      priority: 'Medium',
    },
  ],
};

export const MOCK_THREADS: AssistantThread[] = [
  {
    id: 'mock-thread-1',
    name: 'Senior React search – Bangalore',
    messages: [
      {
        role: 'assistant',
        content:
          'What would you like to search for? I can help you find candidates by role, location, experience, and more.',
      },
      {
        role: 'user',
        content: 'Senior React developers in Bangalore, 5+ years experience.',
      },
      {
        role: 'assistant',
        content:
          'To refine the search: do you want only product companies or are agencies okay too? Any specific industries (e.g. fintech, SaaS)?',
      },
      {
        role: 'user',
        content: 'Product only, fintech or SaaS preferred.',
      },
      {
        role: 'assistant',
        content:
          "I've run the search with your criteria. Here are the candidates that match. You can open the full table on the right or view them in a job.",
        tableDataList: [MOCK_CANDIDATES_TABLE],
      },
      {
        role: 'assistant',
        content:
          'Shall I prepare a shortlist for the client from these candidates and draft an intro message?',
      },
    ],
    lastTableData: MOCK_CANDIDATES_TABLE,
    jobId: 'mock-job-1',
    agentNotes: [
      {
        summary:
          'Client persona: prefers hands-on tech lead, product companies; fintech/SaaS experience a plus.',
        createdAt: new Date().toISOString(),
        id: 'note-1',
      },
      {
        summary:
          'Refined requirement: Senior React, Bangalore, 5+ years, product companies only.',
        createdAt: new Date().toISOString(),
        id: 'note-2',
      },
    ],
    agentEvents: [
      {
        status: 'started',
        threadId: 'mock-thread-1',
        runId: 'run-mock-1',
        summary: 'Heartbeat: checking Senior React – Bangalore pipeline',
        timestamp: Date.now() - 1000 * 60 * 30,
      },
      {
        status: 'completed',
        threadId: 'mock-thread-1',
        runId: 'run-mock-1',
        summary: 'Found 35 candidates, 8 highly relevant, 12 somewhat relevant.',
        timestamp: Date.now() - 1000 * 60 * 29,
      },
      {
        status: 'tool_call',
        threadId: 'mock-thread-1',
        runId: 'run-mock-2',
        toolName: 'generate_search_parameters',
        summary: 'Generating search parameters from JD + user query…',
        timestamp: Date.now() - 1000 * 60 * 5,
      },
      {
        status: 'completed',
        threadId: 'mock-thread-1',
        runId: 'run-mock-2',
        summary: 'Search parameters + LinkedIn queries ready for this job.',
        timestamp: Date.now() - 1000 * 60 * 4,
      },
    ],
  },
  {
    id: 'mock-thread-2',
    name: 'Client shortlist and feedback',
    messages: [
      {
        role: 'assistant',
        content:
          'I have created a shortlist of candidates to send to the client for the Senior React – Bangalore role. Here is the shortlist table.',
        tableDataList: [MOCK_CLIENT_SHORTLIST_TABLE],
      },
      {
        role: 'user',
        content:
          'Great. Please send Priya and Rahul to the client and ask for interview slots this week.',
      },
      {
        role: 'assistant',
        content:
          'Done. I have sent Priya and Rahul to the client with a tailored summary. I will notify you when the client responds.',
      },
      {
        role: 'assistant',
        content:
          'Update from client: Priya is shortlisted for interview, Rahul is on hold while they review other profiles.',
      },
    ],
    lastTableData: MOCK_CLIENT_SHORTLIST_TABLE,
    jobId: 'mock-job-1',
    agentNotes: [
      {
        summary:
          'Client prefers profiles with prior fintech experience and hands-on React work.',
        createdAt: new Date().toISOString(),
        id: 'client-note-1',
      },
    ],
    agentEvents: [
      {
        status: 'started',
        threadId: 'mock-thread-2',
        runId: 'run-mock-shortlist-1',
        summary: 'Preparing client-ready shortlist for Senior React – Bangalore.',
        timestamp: Date.now() - 1000 * 60 * 20,
      },
      {
        status: 'completed',
        threadId: 'mock-thread-2',
        runId: 'run-mock-shortlist-1',
        summary: 'Shortlist of 2 candidates sent to client with intro notes.',
        timestamp: Date.now() - 1000 * 60 * 19,
      },
    ],
  },
  {
    id: 'mock-thread-3',
    name: 'Open jobs overview',
    messages: [
      {
        role: 'assistant',
        content:
          'You have 3 open jobs. I can show details, candidate counts, or help with a new search.',
      },
      {
        role: 'user',
        content:
          'How many candidates have we sent to the client for the Senior React role?',
      },
      {
        role: 'assistant',
        content:
          'For the Senior React – Bangalore role: 12 candidates contacted, 5 sent to client, 2 interviews scheduled.',
      },
    ],
    lastTableData: null,
    jobId: null,
    agentNotes: [],
    agentEvents: [
      {
        status: 'started',
        threadId: 'mock-thread-3',
        runId: 'run-mock-overview-1',
        summary: 'Daily overview for all open jobs.',
        timestamp: Date.now() - 1000 * 60 * 90,
      },
      {
        status: 'completed',
        threadId: 'mock-thread-3',
        runId: 'run-mock-overview-1',
        summary: '3 open jobs, 12 active candidates, 4 interviews this week.',
        timestamp: Date.now() - 1000 * 60 * 89,
      },
    ],
  },
  {
    id: 'mock-thread-5',
    name: 'AI filters + enrichment demo',
    messages: [
      {
        role: 'assistant',
        content:
          'This is a mock conversation that walks through creating AI filters for a job, running enrichment, and streaming progress and results into the table on the right.',
      },
      {
        role: 'user',
        content:
          'For the Senior React – Bangalore role, create AI filters to score candidates and then run enrichment on the existing pipeline.',
      },
      {
        role: 'assistant',
        content:
          'Got it. I will design AI filters for technical skills, seniority, and location/relocation fit using the job description. Then I will run them on the current candidates for this job.',
      },
      {
        role: 'assistant',
        content:
          'Creating AI filters now:\n\n' +
          '```json\n' +
          JSON.stringify(
            {
              filters: [
                'Technical Skills Assessment – fields: primarySkillsMatch, secondarySkillsMatch, skillLevel',
                'Seniority Level Classification – fields: seniorityLevel, managementExperience, teamSizeManaged',
                'Location and Relocation Analysis – fields: currentLocation, relocationWillingness, remoteWorkPreference',
              ],
            },
            null,
            2,
          ) +
          '\n```',
      },
      {
        role: 'assistant',
        content:
          'I have queued the AI filters. You will see live progress in the enrichment panel as I fetch candidates, send them to the model, and write back enrichment fields (relevance score, match/mismatch reasons, etc.)',
      },
      {
        role: 'assistant',
        content:
          'Enrichment is complete. I have added relevance scores and match/mismatch reasons to each candidate. You can inspect the enriched snapshot below or open the full table on the right.',
        tableDataList: [MOCK_CANDIDATES_TABLE],
      },
      {
        role: 'assistant',
        content:
          'From the enriched table, Priya looks like the strongest match (highly relevant). Rahul is a good option if you want more team‑lead experience; Anita is a solid IC but with lighter fintech exposure.',
      },
    ],
    lastTableData: MOCK_CANDIDATES_TABLE,
    jobId: 'mock-job-1',
    agentNotes: [
      {
        summary:
          'Demo thread: shows how AI filters enrich candidates and how those fields appear in the results panel and main candidate table.',
        createdAt: new Date().toISOString(),
        id: 'ai-filter-demo-note-1',
      },
    ],
    agentEvents: [
      {
        status: 'started',
        threadId: 'mock-thread-5',
        runId: 'run-mock-filters-1',
        summary: 'Designing AI filters for Senior React – Bangalore.',
        timestamp: Date.now() - 1000 * 60 * 45,
      },
      {
        status: 'tool_call',
        threadId: 'mock-thread-5',
        runId: 'run-mock-filters-1',
        toolName: 'generate_search_parameters',
        summary: 'Generating search parameters and enrichment plan.',
        timestamp: Date.now() - 1000 * 60 * 44,
      },
      {
        status: 'completed',
        threadId: 'mock-thread-5',
        runId: 'run-mock-filters-1',
        summary: 'AI filters and enrichment completed for 3 mock candidates.',
        timestamp: Date.now() - 1000 * 60 * 43,
      },
    ],
  },
  {
    id: 'mock-thread-4',
    name: 'New thread',
    messages: [],
    lastTableData: null,
    jobId: null,
    agentEvents: [],
  },
  {
    id: 'mock-thread-jd-upload',
    name: 'Upload JD + search setup',
    messages: [
      {
        role: 'assistant',
        content:
          'You can drag and drop a job description file anywhere on this assistant chat (near the message box) to create a job, attach the JD, and start searching.',
      },
      {
        role: 'user',
        content:
          'I want to upload a JD for a Senior React Developer in Bangalore.',
      },
      {
        role: 'assistant',
        content:
          'Great. Drop the JD file here and I will create a job, parse the description, and set up an initial search plan for you.',
      },
      {
        role: 'assistant',
        content:
          'I have uploaded and parsed your job description. Here is a short summary of what I extracted:\n\n' +
          '```json\n' +
          JSON.stringify(
            {
              jobTitle: 'Senior React Developer',
              company: 'Mock Product Co',
              location: 'Bangalore (Hybrid)',
              experienceLevel: '5–8 years',
              keywords: [
                'React',
                'TypeScript',
                'Frontend architecture',
                'Design systems',
              ],
            },
            null,
            2,
          ) +
          '\n```',
      },
      {
        role: 'assistant',
        content:
          'I have also created a mock search snapshot linked to this JD. You can click the table preview to open the full candidate table on the right.',
        tableDataList: [
          {
            columns: [
              'name',
              'currentJobTitle',
              'currentCompany',
              'experience',
              'status',
              'jobsId',
            ],
            rows: [
              {
                id: 'mock-jd-cand-1',
                name: 'Amit Rao',
                currentJobTitle: 'Senior React Engineer',
                currentCompany: 'Mock Product Co',
                experience: '7 years',
                status: 'SCREENING',
                jobsId: 'mock-job-jd-upload',
              },
              {
                id: 'mock-jd-cand-2',
                name: 'Neha Gupta',
                currentJobTitle: 'Frontend Developer',
                currentCompany: 'SaaS Labs',
                experience: '6 years',
                status: 'CV_SENT',
                jobsId: 'mock-job-jd-upload',
              },
            ],
          },
        ],
      },
      {
        role: 'assistant',
        content:
          'The JD is now attached to this job. You can use the three‑dot menu in the assistant header to preview, replace, or remove the JD, and I will keep using it as context for future questions.',
      },
    ],
    lastTableData: null,
    jobId: 'mock-job-jd-upload',
    agentNotes: [
      {
        summary:
          'Demo thread: shows end‑to‑end JD upload, parsing, and a mock candidate snapshot linked to the new job.',
        createdAt: new Date().toISOString(),
        id: 'jd-upload-demo-note-1',
      },
    ],
    agentEvents: [
      {
        status: 'started',
        threadId: 'mock-thread-jd-upload',
        runId: 'run-mock-jd-1',
        summary: 'Processing uploaded JD and creating job.',
        timestamp: Date.now() - 1000 * 60 * 15,
      },
      {
        status: 'completed',
        threadId: 'mock-thread-jd-upload',
        runId: 'run-mock-jd-1',
        summary: 'JD parsed and initial search snapshot created.',
        timestamp: Date.now() - 1000 * 60 * 14,
      },
    ],
  },
];

export const USE_MOCK_ASSISTANT =false;
  // (typeof process !== 'undefined' &&
  //   typeof process.env !== 'undefined' &&
  //   process.env.REACT_APP_USE_MOCK_ASSISTANT === 'true') ||
  // (typeof window !== 'undefined' &&
  //   window.location.hostname === 'cool-panda.localhost');
