/* eslint-disable @nx/workspace-max-consts-per-file */
/* eslint-disable @typescript-eslint/naming-convention -- mock org chart builder locals */
import { OrgChartData } from 'twenty-shared';

/**
 * Static Salesforce-inspired leadership tree for the sign-in backdrop (no API calls).
 * Illustrative only; names and titles are fictional.
 */

type MockCandidate = {
  full_name: string;
  job_title: string;
  /** Stable varied photo per person (Picsum seed); requires network to load. */
  image: string;
};

type MockOrgNodeDraft = {
  key: number;
  parent?: number;
  headline: string;
  candidates: MockCandidate[];
  std_grade_category: string;
  std_grade: string;
  std_function: string;
  std_function_root: string;
  std_grade_vectorized: number;
  std_function_vectorized: number;
  std_function_category: string;
  std_function_counts: number;
  stringkey: string;
  std_function_parent: string;
  isAssistant?: boolean;
  std_function_to_add?: string[];
  std_function_root_to_add?: string[];
};

type MockOrgNode = MockOrgNodeDraft & { len_candidates: number };

const FIRST_NAMES = [
  'Alex',
  'Blake',
  'Casey',
  'Dana',
  'Ellis',
  'Finley',
  'Gray',
  'Harper',
  'Indigo',
  'Jordan',
  'Kai',
  'Logan',
  'Morgan',
  'Noah',
  'Oakley',
  'Parker',
  'Quinn',
  'Riley',
  'Sage',
  'Taylor',
];

const LAST_NAMES = [
  'Nguyen',
  'Rivera',
  'Patel',
  'Kim',
  'Chen',
  'Okonkwo',
  'Martinez',
  'Singh',
  'Okafor',
  'Lindstrom',
  'Hassan',
  'Nakamura',
  'Silva',
  'Bauer',
  'Dubois',
  'Kowalski',
  'Yamamoto',
  'Costa',
  'Fischer',
  'Andersson',
];

const makeNames = (count: number, startIndex: number): string[] =>
  Array.from({ length: count }, (_, i) => {
    const idx = startIndex + i;
    return `${FIRST_NAMES[idx % FIRST_NAMES.length]} ${LAST_NAMES[(idx * 7) % LAST_NAMES.length]}`;
  });

const buildMockOrgChartNodes = (): MockOrgNode[] => {
  let nameOffset = 0;
  let profileImageSeed = 0;
  const takeNames = (count: number) => {
    const names = makeNames(count, nameOffset);
    nameOffset += count;
    return names;
  };

  const assignTitles = (names: string[], titles: string[]): MockCandidate[] =>
    names.map((full_name, i) => ({
      full_name,
      job_title: titles[i % titles.length] ?? titles[0] ?? '',
      image: `https://picsum.photos/seed/${profileImageSeed++}/64/64`,
    }));

  const nodes: MockOrgNode[] = [];

  const push = (node: MockOrgNodeDraft) => {
    nodes.push({
      ...node,
      len_candidates: node.candidates.length,
    });
  };

  push({
    key: 1000000,
    headline: 'CORPORATE LEADERSHIP',
    std_grade_category: 'ceo',
    std_grade: 'ceo',
    std_function: 'ceo',
    std_function_root: 'ceo',
    std_grade_vectorized: 0,
    std_function_vectorized: 0,
    std_function_category: 'ceo',
    std_function_counts: 0,
    stringkey: 'ceoceo',
    std_function_parent: 'root',
    candidates: assignTitles(takeNames(1), [
      'Chair and Chief Executive Officer',
    ]),
  });

  push({
    key: 1100000,
    parent: 1000000,
    headline: 'SALES LEADERSHIP',
    std_grade_category: 'senior',
    std_grade: 'leadership',
    std_function: 'sales',
    std_function_root: 'sales',
    std_grade_vectorized: 108.79,
    std_function_vectorized: 667,
    std_function_category: 'sales',
    std_function_counts: 85097,
    stringkey: 'seniorsales',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(2), [
      'Chief Revenue Officer',
      'EVP, Global Sales',
      'VP, Enterprise Sales',
    ]),
  });

  push({
    key: 1110000,
    parent: 1100000,
    headline: 'SALES TEAM',
    std_grade_category: 'entry',
    std_grade: 'entry',
    std_function: 'sales',
    std_function_root: 'sales',
    std_grade_vectorized: 105.9949,
    std_function_vectorized: 667,
    std_function_category: 'sales',
    std_function_counts: 85097,
    stringkey: 'entrysales',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(5), [
      'Business Development Representative',
      'Account Development Representative',
      'Sales Development Representative',
      'Inside Sales Representative',
    ]),
  });

  push({
    key: 1120000,
    parent: 1100000,
    headline: 'ACCOUNTS LEADERSHIP',
    std_grade_category: 'senior',
    std_grade: 'leadership',
    std_function: 'accounts',
    std_function_root: 'sales',
    std_grade_vectorized: 108.79,
    std_function_vectorized: 710,
    std_function_category: 'sales',
    std_function_counts: 29184,
    stringkey: 'senioraccounts',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(1), [
      'Director, Strategic Account Sales',
      'Director, Commercial Accounts',
    ]),
  });

  push({
    key: 1121000,
    parent: 1120000,
    headline: 'ACCOUNTS MANAGERS',
    std_grade_category: 'mid',
    std_grade: 'mid',
    std_function: 'accounts',
    std_function_root: 'sales',
    std_grade_vectorized: 107.459,
    std_function_vectorized: 710,
    std_function_category: 'sales',
    std_function_counts: 29184,
    stringkey: 'midaccounts',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(3), [
      'Technical Account Manager',
      'Senior Technical Account Manager',
      'Account Manager',
    ]),
  });

  push({
    key: 1121100,
    parent: 1121000,
    headline: 'ACCOUNTS TEAM',
    std_grade_category: 'entry',
    std_grade: 'entry',
    std_function: 'accounts',
    std_function_root: 'sales',
    std_grade_vectorized: 105.9949,
    std_function_vectorized: 710,
    std_function_category: 'sales',
    std_function_counts: 29184,
    stringkey: 'entryaccounts',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(4), [
      'Commercial Account Executive',
      'Account Executive',
      'Strategic Account Executive',
    ]),
  });

  push({
    key: 1121200,
    parent: 1121000,
    headline: 'SALES MARKETING TEAM',
    std_grade_category: 'entry',
    std_grade: 'entry',
    std_function: 'sales marketing',
    std_function_root: 'sales',
    std_grade_vectorized: 105.9949,
    std_function_vectorized: 643,
    std_function_category: 'sales',
    std_function_counts: 5701,
    stringkey: 'entrysales marketing',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(2), [
      'Sales and Marketing Operations Analyst',
      'Marketing Operations Specialist',
    ]),
  });

  push({
    key: 1121300,
    parent: 1121000,
    headline: 'SALES ENTERPRISE TEAM',
    std_grade_category: 'entry',
    std_grade: 'entry',
    std_function: 'sales enterprise',
    std_function_root: 'sales',
    std_grade_vectorized: 105.9949,
    std_function_vectorized: 649,
    std_function_category: 'sales',
    std_function_counts: 553,
    stringkey: 'entrysales enterprise',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(3), [
      'Enterprise Account Executive',
      'Senior Enterprise Account Executive',
    ]),
  });

  push({
    key: 1121400,
    parent: 1121000,
    headline: 'SALES SOLUTIONS TEAM',
    std_grade_category: 'entry',
    std_grade: 'entry',
    std_function: 'sales solutions',
    std_function_root: 'sales',
    std_grade_vectorized: 105.9949,
    std_function_vectorized: 632,
    std_function_category: 'sales',
    std_function_counts: 238,
    stringkey: 'entrysales solutions',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(2), [
      'Sales Solutions Engineer',
      'Solutions Consultant',
    ]),
  });

  push({
    key: 1130000,
    parent: 1100000,
    headline: 'CUSTOMER SUCCESS LEADERSHIP',
    std_grade_category: 'senior',
    std_grade: 'leadership',
    std_function: 'customer success',
    std_function_root: 'sales',
    std_grade_vectorized: 108.79,
    std_function_vectorized: 617,
    std_function_category: 'sales',
    std_function_counts: 4000,
    stringkey: 'seniorcustomer success',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(1), [
      'Associate Director, Customer Success',
      'Director, Customer Success',
    ]),
  });

  push({
    key: 1131000,
    parent: 1130000,
    headline: 'CUSTOMER SUCCESS MANAGERS',
    std_grade_category: 'mid',
    std_grade: 'mid',
    std_function: 'customer success',
    std_function_root: 'sales',
    std_grade_vectorized: 107.459,
    std_function_vectorized: 617,
    std_function_category: 'sales',
    std_function_counts: 4000,
    stringkey: 'midcustomer success',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(3), [
      'Customer Success Manager',
      'Senior Customer Success Manager',
    ]),
  });

  push({
    key: 1131100,
    parent: 1131000,
    headline: 'CUSTOMER SUCCESS TEAM',
    std_grade_category: 'entry',
    std_grade: 'entry',
    std_function: 'customer success',
    std_function_root: 'sales',
    std_grade_vectorized: 105.9949,
    std_function_vectorized: 617,
    std_function_category: 'sales',
    std_function_counts: 4000,
    stringkey: 'entrycustomer success',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(4), [
      'Partner Success Manager',
      'Customer Success Associate',
      'Customer Evangelist',
    ]),
  });

  push({
    key: 1200000,
    parent: 1000000,
    headline: 'ENGINEERING LEADERSHIP',
    std_grade_category: 'senior',
    std_grade: 'leadership',
    std_function: 'engineering',
    std_function_root: 'engineering',
    std_grade_vectorized: 108.79,
    std_function_vectorized: 310,
    std_function_category: 'engineering',
    std_function_counts: 42513,
    stringkey: 'seniorengineering',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(1), [
      'Vice President of Engineering',
      'VP, Platform Engineering',
    ]),
  });

  push({
    key: 1210000,
    parent: 1200000,
    headline: 'ENGINEERING MANAGERS',
    std_grade_category: 'mid',
    std_grade: 'mid',
    std_function: 'engineering',
    std_function_root: 'engineering',
    std_grade_vectorized: 107.459,
    std_function_vectorized: 310,
    std_function_category: 'engineering',
    std_function_counts: 42513,
    stringkey: 'midengineering',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(4), [
      'Engineering Manager',
      'Senior Engineering Manager',
      'Lead Engineer',
    ]),
  });

  push({
    key: 1211000,
    parent: 1210000,
    headline: 'ENGINEERING TEAM',
    std_grade_category: 'entry',
    std_grade: 'entry',
    std_function: 'engineering',
    std_function_root: 'engineering',
    std_grade_vectorized: 105.9949,
    std_function_vectorized: 310,
    std_function_category: 'engineering',
    std_function_counts: 42513,
    stringkey: 'entryengineering',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(4), [
      'Software Engineer',
      'Senior Software Engineer',
      'Staff Software Engineer',
    ]),
  });

  push({
    key: 1212000,
    parent: 1210000,
    headline: 'SYSTEMS TEAM',
    std_grade_category: 'entry',
    std_grade: 'entry',
    std_function: 'systems',
    std_function_root: 'engineering',
    std_grade_vectorized: 105.9949,
    std_function_vectorized: 234,
    std_function_category: 'engineering',
    std_function_counts: 5475,
    stringkey: 'entrysystems',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(2), [
      'IT Systems Administrator',
      'Systems Engineer',
    ]),
  });

  push({
    key: 1213000,
    parent: 1210000,
    headline: 'CONTROL TEAM',
    std_grade_category: 'entry',
    std_grade: 'entry',
    std_function: 'control',
    std_function_root: 'engineering',
    std_grade_vectorized: 105.9949,
    std_function_vectorized: 326,
    std_function_category: 'engineering',
    std_function_counts: 2736,
    stringkey: 'entrycontrol',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(1), [
      'Controller',
      'Assistant Controller',
    ]),
  });

  push({
    key: 1220000,
    parent: 1200000,
    headline: 'QUALITY MANAGERS',
    std_grade_category: 'mid',
    std_grade: 'mid',
    std_function: 'quality',
    std_function_root: 'engineering',
    std_grade_vectorized: 107.459,
    std_function_vectorized: 287,
    std_function_category: 'engineering',
    std_function_counts: 11220,
    stringkey: 'midquality',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(1), [
      'QA Manager',
      'Quality Engineering Manager',
    ]),
  });

  push({
    key: 1221000,
    parent: 1220000,
    headline: 'QUALITY TEAM',
    std_grade_category: 'entry',
    std_grade: 'entry',
    std_function: 'quality',
    std_function_root: 'engineering',
    std_grade_vectorized: 105.9949,
    std_function_vectorized: 287,
    std_function_category: 'engineering',
    std_function_counts: 11220,
    stringkey: 'entryquality',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(3), [
      'Quality Assurance Engineer',
      'QA Automation Engineer',
    ]),
  });

  push({
    key: 1230000,
    parent: 1200000,
    headline: 'PROGRAM MANAGERS',
    std_grade_category: 'mid',
    std_grade: 'mid',
    std_function: 'program',
    std_function_root: 'engineering',
    std_grade_vectorized: 107.459,
    std_function_vectorized: 288,
    std_function_category: 'engineering',
    std_function_counts: 6009,
    stringkey: 'midprogram',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(2), [
      'Senior Technical Program Manager',
      'Technical Program Manager',
    ]),
  });

  push({
    key: 1240000,
    parent: 1200000,
    headline: 'SECURITY LEADERSHIP',
    std_grade_category: 'senior',
    std_grade: 'leadership',
    std_function: 'security',
    std_function_root: 'engineering',
    std_grade_vectorized: 108.79,
    std_function_vectorized: 239,
    std_function_category: 'engineering',
    std_function_counts: 5708,
    stringkey: 'seniorsecurity',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(1), [
      'VP, Security and Integrations',
      'Chief Information Security Officer',
    ]),
  });

  push({
    key: 1250000,
    parent: 1200000,
    headline: 'ARCHITECT MANAGERS',
    std_grade_category: 'mid',
    std_grade: 'mid',
    std_function: 'architect',
    std_function_root: 'engineering',
    std_grade_vectorized: 107.459,
    std_function_vectorized: 340,
    std_function_category: 'engineering',
    std_function_counts: 4936,
    stringkey: 'midarchitect',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(2), [
      'Solutions Architecture Manager',
      'Principal Architect',
    ]),
  });

  push({
    key: 1251000,
    parent: 1250000,
    headline: 'ARCHITECT TEAM',
    std_grade_category: 'entry',
    std_grade: 'entry',
    std_function: 'architect',
    std_function_root: 'engineering',
    std_grade_vectorized: 105.9949,
    std_function_vectorized: 340,
    std_function_category: 'engineering',
    std_function_counts: 4936,
    stringkey: 'entryarchitect',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(4), [
      'Solutions Architect',
      'Senior Solutions Architect',
    ]),
  });

  push({
    key: 1300000,
    parent: 1000000,
    headline: 'SOLUTIONS LEADERSHIP',
    std_grade_category: 'senior',
    std_grade: 'leadership',
    std_function: 'solutions',
    std_function_root: 'technology',
    std_grade_vectorized: 108.79,
    std_function_vectorized: 399,
    std_function_category: 'technology',
    std_function_counts: 3151,
    stringkey: 'seniorsolutions',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(1), [
      'Vice President, Solution Engineering',
    ]),
  });

  push({
    key: 1310000,
    parent: 1300000,
    headline: 'SOFTWARE TEAM',
    std_grade_category: 'entry',
    std_grade: 'entry',
    std_function: 'software',
    std_function_root: 'technology',
    std_grade_vectorized: 105.9949,
    std_function_vectorized: 423,
    std_function_category: 'technology',
    std_function_counts: 23428,
    stringkey: 'entrysoftware',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(3), [
      'Software Developer',
      'Software Engineer',
      'Cloud Engineer',
    ]),
  });

  push({
    key: 1320000,
    parent: 1300000,
    headline: 'INFORMATION TECHNOLOGY TEAM',
    std_grade_category: 'entry',
    std_grade: 'entry',
    std_function: 'information technology',
    std_function_root: 'technology',
    std_grade_vectorized: 105.9949,
    std_function_vectorized: 429,
    std_function_category: 'technology',
    std_function_counts: 10314,
    stringkey: 'entryinformation technology',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(2), [
      'IT Administrator',
      'IT Support Specialist',
    ]),
  });

  push({
    key: 1330000,
    parent: 1300000,
    headline: 'DATA TEAM',
    std_grade_category: 'entry',
    std_grade: 'entry',
    std_function: 'data',
    std_function_root: 'technology',
    std_grade_vectorized: 105.9949,
    std_function_vectorized: 372,
    std_function_category: 'technology',
    std_function_counts: 7221,
    stringkey: 'entrydata',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(2), [
      'Data Engineer',
      'Analytics Engineer',
    ]),
  });

  push({
    key: 1340000,
    parent: 1300000,
    headline: 'CONTENT TEAM',
    std_grade_category: 'entry',
    std_grade: 'entry',
    std_function: 'content',
    std_function_root: 'technology',
    std_grade_vectorized: 105.9949,
    std_function_vectorized: 373,
    std_function_category: 'technology',
    std_function_counts: 1620,
    stringkey: 'entrycontent',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(1), [
      'Content Strategist',
      'Technical Writer',
    ]),
  });

  push({
    key: 1350000,
    parent: 1300000,
    headline: 'SOLUTIONS TEAM',
    std_grade_category: 'entry',
    std_grade: 'entry',
    std_function: 'solutions',
    std_function_root: 'technology',
    std_grade_vectorized: 105.9949,
    std_function_vectorized: 399,
    std_function_category: 'technology',
    std_function_counts: 3151,
    stringkey: 'entrysolutions',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(2), [
      'Solutions Engineer',
      'Solution Consultant',
    ]),
  });

  push({
    key: 1400000,
    parent: 1000000,
    headline: 'PRODUCT LEADERSHIP',
    std_grade_category: 'senior',
    std_grade: 'leadership',
    std_function: 'product',
    std_function_root: 'product',
    std_grade_vectorized: 108.79,
    std_function_vectorized: 61,
    std_function_category: 'product',
    std_function_counts: 8528,
    stringkey: 'seniorproduct',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(1), ['Vice President of Product']),
  });

  push({
    key: 1410000,
    parent: 1400000,
    headline: 'PRODUCT TEAM',
    std_grade_category: 'entry',
    std_grade: 'entry',
    std_function: 'product',
    std_function_root: 'product',
    std_grade_vectorized: 105.9949,
    std_function_vectorized: 61,
    std_function_category: 'product',
    std_function_counts: 8528,
    stringkey: 'entryproduct',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(3), [
      'Product Manager',
      'Senior Product Manager',
      'Group Product Manager',
    ]),
  });

  push({
    key: 1420000,
    parent: 1400000,
    headline: 'PRODUCT DEVELOPMENT LEADERSHIP',
    std_grade_category: 'senior',
    std_grade: 'leadership',
    std_function: 'product development',
    std_function_root: 'product',
    std_grade_vectorized: 108.79,
    std_function_vectorized: 52,
    std_function_category: 'product',
    std_function_counts: 2222,
    stringkey: 'seniorproduct development',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(1), ['Director of Product Development']),
  });

  push({
    key: 1430000,
    parent: 1400000,
    headline: 'MARKETING PRODUCT LEADERSHIP',
    std_grade_category: 'senior',
    std_grade: 'leadership',
    std_function: 'marketing product',
    std_function_root: 'product',
    std_grade_vectorized: 108.79,
    std_function_vectorized: 46,
    std_function_category: 'product',
    std_function_counts: 1065,
    stringkey: 'seniormarketing product',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(1), [
      'Vice President, Product Marketing',
    ]),
  });

  push({
    key: 1500000,
    parent: 1000000,
    headline: 'OPERATIONS LEADERSHIP',
    std_grade_category: 'senior',
    std_grade: 'leadership',
    std_function: 'operations',
    std_function_root: 'operations',
    std_grade_vectorized: 108.79,
    std_function_vectorized: 167,
    std_function_category: 'operations',
    std_function_counts: 27084,
    stringkey: 'senioroperations',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(1), [
      'Chief Operating Officer',
      'SVP, Operations',
    ]),
  });

  push({
    key: 1510000,
    parent: 1500000,
    headline: 'OPERATIONS TEAM',
    std_grade_category: 'entry',
    std_grade: 'entry',
    std_function: 'operations',
    std_function_root: 'operations',
    std_grade_vectorized: 105.9949,
    std_function_vectorized: 167,
    std_function_category: 'operations',
    std_function_counts: 27084,
    stringkey: 'entryoperations',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(3), [
      'Operations Analyst',
      'Operations Assistant',
      'Business Operations Specialist',
    ]),
  });

  push({
    key: 1600000,
    parent: 1000000,
    headline: 'PROJECTS MANAGERS',
    std_grade_category: 'mid',
    std_grade: 'mid',
    std_function: 'projects',
    std_function_root: 'projects',
    std_grade_vectorized: 107.459,
    std_function_vectorized: 18,
    std_function_category: 'projects',
    std_function_counts: 37558,
    stringkey: 'midprojects',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(2), [
      'Technical Project Manager',
      'Senior Technical Project Manager',
    ]),
  });

  push({
    key: 1700000,
    parent: 1000000,
    headline: 'FINANCE LEADERSHIP',
    std_grade_category: 'senior',
    std_grade: 'leadership',
    std_function: 'finance',
    std_function_root: 'finance',
    std_grade_vectorized: 108.79,
    std_function_vectorized: 798,
    std_function_category: 'finance',
    std_function_counts: 26664,
    stringkey: 'seniorfinance',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(1), ['Chief Financial Officer']),
  });

  push({
    key: 1800000,
    parent: 1000000,
    headline: 'HUMAN RESOURCES LEADERSHIP',
    std_grade_category: 'senior',
    std_grade: 'leadership',
    std_function: 'human resources',
    std_function_root: 'human resources',
    std_grade_vectorized: 108.79,
    std_function_vectorized: 487,
    std_function_category: 'human resources',
    std_function_counts: 22266,
    stringkey: 'seniorhuman resources',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(1), [
      'Chief People Officer',
      'Director, People Operations',
    ]),
  });

  push({
    key: 1810000,
    parent: 1800000,
    headline: 'TRAINING DEVELOPMENT MANAGERS',
    std_grade_category: 'mid',
    std_grade: 'mid',
    std_function: 'training development',
    std_function_root: 'human resources',
    std_grade_vectorized: 107.459,
    std_function_vectorized: 466,
    std_function_category: 'human resources',
    std_function_counts: 8434,
    stringkey: 'midtraining development',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(2), [
      'Enablement and Training Manager',
      'Learning and Development Manager',
    ]),
  });

  push({
    key: 1900000,
    parent: 1000000,
    headline: 'PLANNING STRATEGIC LEADERSHIP',
    std_grade_category: 'senior',
    std_grade: 'leadership',
    std_function: 'planning strategic',
    std_function_root: 'corporate',
    std_grade_vectorized: 108.79,
    std_function_vectorized: 927,
    std_function_category: 'corporate',
    std_function_counts: 6331,
    stringkey: 'seniorplanning strategic',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(1), [
      'VP, Strategic Alliances',
      'Director, Corporate Strategy',
    ]),
  });

  push({
    key: 2000000,
    parent: 1000000,
    headline: 'CREATIVE LEADERSHIP',
    std_grade_category: 'senior',
    std_grade: 'leadership',
    std_function: 'creative',
    std_function_root: 'design',
    std_grade_vectorized: 108.79,
    std_function_vectorized: 229,
    std_function_category: 'design',
    std_function_counts: 4100,
    stringkey: 'seniorcreative',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(1), ['Creative Director']),
  });

  push({
    key: 2010000,
    parent: 2000000,
    headline: 'USER EXPERIENCE MANAGERS',
    std_grade_category: 'mid',
    std_grade: 'mid',
    std_function: 'user experience',
    std_function_root: 'design',
    std_grade_vectorized: 107.459,
    std_function_vectorized: 200,
    std_function_category: 'design',
    std_function_counts: 1025,
    stringkey: 'miduser experience',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(1), ['UX Lead', 'Design Manager']),
  });

  push({
    key: 2011000,
    parent: 2010000,
    headline: 'USER EXPERIENCE TEAM',
    std_grade_category: 'entry',
    std_grade: 'entry',
    std_function: 'user experience',
    std_function_root: 'design',
    std_grade_vectorized: 105.9949,
    std_function_vectorized: 200,
    std_function_category: 'design',
    std_function_counts: 1025,
    stringkey: 'entryuser experience',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(2), [
      'Senior UX Designer',
      'Product Designer',
    ]),
  });

  push({
    key: 2012000,
    parent: 2010000,
    headline: 'WRITER EDITOR TEAM',
    std_grade_category: 'entry',
    std_grade: 'entry',
    std_function: 'writer editor',
    std_function_root: 'design',
    std_grade_vectorized: 105.9949,
    std_function_vectorized: 212,
    std_function_category: 'design',
    std_function_counts: 2283,
    stringkey: 'entrywriter editor',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(2), [
      'Content Marketing Writer',
      'Technical Writer',
    ]),
  });

  push({
    key: 2100000,
    parent: 1000000,
    headline: 'DELIVERY LEADERSHIP',
    std_grade_category: 'senior',
    std_grade: 'leadership',
    std_function: 'delivery',
    std_function_root: 'supply chain',
    std_grade_vectorized: 108.79,
    std_function_vectorized: 84,
    std_function_category: 'supply chain',
    std_function_counts: 1530,
    stringkey: 'seniordelivery',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(1), [
      'Senior Director, Professional Services Delivery',
    ]),
  });

  push({
    key: 2200000,
    parent: 1000000,
    headline: 'SERVICE DELIVERY LEADERSHIP',
    std_grade_category: 'senior',
    std_grade: 'leadership',
    std_function: 'service delivery',
    std_function_root: 'support service',
    std_grade_vectorized: 108.79,
    std_function_vectorized: 958,
    std_function_category: 'support service',
    std_function_counts: 843,
    stringkey: 'seniorservice delivery',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(1), ['Service Delivery Director']),
  });

  push({
    key: 2210000,
    parent: 2200000,
    headline: 'SERVICE ENGINEERING MANAGERS',
    std_grade_category: 'mid',
    std_grade: 'mid',
    std_function: 'service engineering',
    std_function_root: 'support service',
    std_grade_vectorized: 107.459,
    std_function_vectorized: 994,
    std_function_category: 'support service',
    std_function_counts: 419,
    stringkey: 'midservice engineering',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(1), ['Manager, Support Engineering']),
  });

  push({
    key: 2211000,
    parent: 2210000,
    headline: 'SUPPORT SERVICE TEAM',
    std_grade_category: 'entry',
    std_grade: 'entry',
    std_function: 'support service',
    std_function_root: 'support service',
    std_grade_vectorized: 105.9949,
    std_function_vectorized: 996,
    std_function_category: 'support service',
    std_function_counts: 34027,
    stringkey: 'entrysupport service',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(3), [
      'Support Engineer',
      'Salesforce Support Engineer',
    ]),
  });

  push({
    key: 2300000,
    parent: 1000000,
    headline: 'MIDDLE MANAGEMENT',
    std_grade_category: 'mid',
    std_grade: 'mid',
    std_function: '0',
    std_function_root: '0',
    std_grade_vectorized: 107.459,
    std_function_vectorized: 0,
    std_function_category: '0',
    std_function_counts: 0,
    stringkey: 'mid0',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(2), [
      'Configuration Lead',
      'Senior Manager, Configuration',
    ]),
  });

  push({
    key: 2310000,
    parent: 2300000,
    headline: 'ENTRY',
    std_grade_category: 'entry',
    std_grade: 'entry',
    std_function: '0',
    std_function_root: '0',
    std_grade_vectorized: 105.9949,
    std_function_vectorized: 0,
    std_function_category: '0',
    std_function_counts: 0,
    stringkey: 'entry0',
    std_function_parent: '0',
    candidates: assignTitles(takeNames(2), [
      'Associate',
      'Document Generation Associate',
    ]),
  });

  nodes.push({
    key: 2400000,
    parent: 1000000,
    headline: '+4 MORE FUNCTIONS',
    std_grade_category: 'ceoassist',
    std_grade: 'ceoassist',
    std_function: 'ceoassist',
    std_function_root: 'ceoassist',
    std_grade_vectorized: 0,
    std_function_vectorized: 0,
    std_function_category: 'ceoassist',
    std_function_counts: 0,
    stringkey: 'ceoassist',
    std_function_parent: '0',
    isAssistant: true,
    std_function_root_to_add: ['marketing', 'secretarial', 'legal', 'ceo'],
    candidates: [],
    len_candidates: 0,
  });

  nodes.push({
    key: 1260000,
    parent: 1200000,
    headline: '+5 MORE FUNCTIONS',
    std_grade_category: 'engineeringassist',
    std_grade: 'engineeringassist',
    std_function: 'engineeringassist',
    std_function_root: 'engineeringassist',
    std_grade_vectorized: 0,
    std_function_vectorized: 0,
    std_function_category: 'engineeringassist',
    std_function_counts: 0,
    stringkey: 'engineeringassist',
    std_function_parent: '0',
    isAssistant: true,
    std_function_to_add: [
      'technician',
      'infrastructure',
      'network',
      'maintenance',
      'application',
    ],
    candidates: [],
    len_candidates: 0,
  });

  return nodes;
};

const SIGN_IN_BACKGROUND_MOCK_ORG_CHART_JSON = JSON.stringify(
  buildMockOrgChartNodes(),
);

export const SIGN_IN_BACKGROUND_MOCK_SALESFORCE_ORG_CHART: OrgChartData = {
  company_id: 'signin-mock-salesforce',
  orgchart: SIGN_IN_BACKGROUND_MOCK_ORG_CHART_JSON,
  country: 'United States',
  type: 'fullcompany',
};
