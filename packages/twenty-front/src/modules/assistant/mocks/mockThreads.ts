import type { AssistantTableData } from '@/assistant/components/AssistantDetailsTable';
import type { AssistantThread } from '@/assistant/types/assistant.types';

const MOCK_CANDIDATES_TABLE: AssistantTableData = {
  columns: ['name', 'currentJobTitle', 'currentCompany', 'experience'],
  rows: [
    {
      id: 'mock-cand-1',
      name: 'Priya Sharma',
      currentJobTitle: 'Senior React Developer',
      currentCompany: 'Fintech Solutions',
      experience: '6 years',
    },
    {
      id: 'mock-cand-2',
      name: 'Rahul Verma',
      currentJobTitle: 'Frontend Lead',
      currentCompany: 'SaaS Corp',
      experience: '8 years',
    },
    {
      id: 'mock-cand-3',
      name: 'Anita Patel',
      currentJobTitle: 'Software Engineer',
      currentCompany: 'Product Labs',
      experience: '5 years',
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
      },
    ],
    lastTableData: MOCK_CANDIDATES_TABLE,
    jobId: null,
    agentNotes: [
      {
        summary: 'Client persona: prefers hands-on tech lead, product companies; fintech/SaaS experience a plus.',
        createdAt: new Date().toISOString(),
        id: 'note-1',
      },
      {
        summary: 'Refined requirement: Senior React, Bangalore, 5+ years, product companies only.',
        createdAt: new Date().toISOString(),
        id: 'note-2',
      },
    ],
  },
  {
    id: 'mock-thread-2',
    name: 'Open jobs overview',
    messages: [
      {
        role: 'assistant',
        content: 'You have 3 open jobs. I can show details, candidate counts, or help with a new search.',
      },
      {
        role: 'user',
        content: 'How many candidates have we sent to the client for the Senior React role?',
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
  },
  {
    id: 'mock-thread-3',
    name: 'New thread',
    messages: [],
    lastTableData: null,
    jobId: null,
  },
];

export const USE_MOCK_ASSISTANT =
  typeof process !== 'undefined' &&
  typeof process.env !== 'undefined' &&
  process.env.REACT_APP_USE_MOCK_ASSISTANT === 'true';
