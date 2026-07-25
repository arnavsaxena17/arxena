#!/usr/bin/env node
/**
 * Rename CRM Job object → Project across source files.
 * Longest-match-first replacements with denylist token protection.
 *
 * Usage:
 *   node packages/twenty-utils/rename-crm-job-to-project.mjs [paths...]
 * Defaults to packages/twenty-{shared,front,server,mcp-server,website}
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../..',
);

const DEFAULT_PATHS = [
  'packages/twenty-shared',
  'packages/twenty-front',
  'packages/twenty-server',
  'packages/twenty-mcp-server',
  'packages/twenty-website',
].map((relativePath) => path.join(ROOT, relativePath));

const SKIP_DIR_PARTS = new Set([
  'node_modules',
  'dist',
  '.git',
  'coverage',
  'message-queue',
  'health-status',
  // Async/Bull enrichment queue jobIds — not the CRM object
  'contact-enrichment',
  'theorg',
  'linkedin-xray',
  '.next',
]);

const SKIP_FILE_SUFFIXES = ['.job.ts', '.job.js', '.map', '.lock'];

const SKIP_BASENAMES = new Set([
  'jobs.module.ts',
  'process-contact-enrichment.job.ts',
]);

// Protect these substrings before applying job→project renames
const PROTECTED_TOKENS = [
  'jobTitle',
  'jobLocation',
  'jobCode',
  'jobSpecificFields',
  'jobCompanyName',
  'search_linkedin_jobs',
  'search/jobs',
  'search-linkedin-jobs',
  'JOB_TITLE',
  'job-titles',
  'job-title',
  'Current Job Title',
  'Job Title',
  'Job Company Name',
  'Job specific fields',
  'expand_job_titles',
  'parse_job_description',
  'job_brief_understanding',
  'jobBrief',
  'jobDescription',
  'parsedJobDescription',
  'get_contact_enrichment_job',
  // LinkedIn jobs category / third-party
  "'jobs'",
  '"jobs"',
];

// Longest / most-specific first
const REPLACEMENTS = [
  // Helpers (longest first)
  [
    'getGraphqlToFindManyJobsWithCandidateValues',
    'getGraphqlToFindManyProjectsWithCandidateValues',
  ],
  [
    'graphqlToFindManyJobsWithCandidateValues',
    'graphqlToFindManyProjectsWithCandidateValues',
  ],
  [
    'getGraphqlToFindManyJobsWithCandidates',
    'getGraphqlToFindManyProjectsWithCandidates',
  ],
  [
    'graphqlToFindManyJobsWithCandidates',
    'graphqlToFindManyProjectsWithCandidates',
  ],
  [
    'getGraphqlToFindManyJobsWithPrompts',
    'getGraphqlToFindManyProjectsWithPrompts',
  ],
  [
    'graphqlToFindManyJobsWithPrompts',
    'graphqlToFindManyProjectsWithPrompts',
  ],
  ['getGraphqlToFindManyJobs', 'getGraphqlToFindManyProjects'],
  ['graphqlToFindManyJobs', 'graphqlToFindManyProjects'],
  ['graphqlToFetchAllJobData', 'graphqlToFetchAllProjectData'],
  ['graphqlToAddNewJob', 'graphqlToAddNewProject'],
  ['graphqlToUpdateJob', 'graphqlToUpdateProject'],

  // GraphQL operation / type names
  ['FindManyJobs', 'FindManyProjects'],
  ['CreateOneJob', 'CreateOneProject'],
  ['UpdateOneJob', 'UpdateOneProject'],
  ['DeleteOneJob', 'DeleteOneProject'],
  ['JobFilterInput', 'ProjectFilterInput'],
  ['JobOrderByInput', 'ProjectOrderByInput'],
  ['JobCreateInput', 'ProjectCreateInput'],
  ['JobUpdateInput', 'ProjectUpdateInput'],

  // GraphQL roots / mutations
  ['createJob', 'createProject'],
  ['updateJob', 'updateProject'],
  ['deleteJob', 'deleteProject'],

  // REST kebab
  [
    'create-job-in-arxena-and-sheets',
    'create-project-in-arxena-and-sheets',
  ],
  [
    'update-job-in-arxena-and-sheets',
    'update-project-in-arxena-and-sheets',
  ],
  ['get-candidates-by-job-id', 'get-candidates-by-project-id'],
  ['get-candidate-fields-by-job', 'get-candidate-fields-by-project'],
  ['get-job-by-id', 'get-project-by-id'],
  ['find-many-jobs', 'find-many-projects'],
  ['create-job-in-arxena', 'create-project-in-arxena'],
  ['update-job-in-arxena', 'update-project-in-arxena'],

  // MCP tool names
  ['list_active_jobs', 'list_active_projects'],
  ['list_candidates_for_job', 'list_candidates_for_project'],
  ['get_candidate_fields_for_job', 'get_candidate_fields_for_project'],
  ['get_candidates_by_job_id', 'get_candidates_by_project_id'],
  ['find_job_by_name', 'find_project_by_name'],
  ['get_job_by_id', 'get_project_by_id'],
  ['create_job', 'create_project'],

  // Controllers / service helpers
  ['createJobInArxena', 'createProjectInArxena'],
  ['updateJobInArxena', 'updateProjectInArxena'],
  ['sendCreateJobToArxena', 'sendCreateProjectToArxena'],
  ['sendUpdateJobToArxena', 'sendUpdateProjectToArxena'],
  ['sendJobToArxena', 'sendProjectToArxena'],
  ['validateAndExtractJobId', 'validateAndExtractProjectId'],
  ['createJobIdErrorResponse', 'createProjectIdErrorResponse'],
  ['fetchJobContext', 'fetchProjectContext'],
  ['RecruiterJobContext', 'RecruiterProjectContext'],

  // Relation FK
  ['jobsId', 'projectsId'],

  // Metadata seed
  ["nameSingular: 'job'", "nameSingular: 'project'"],
  ['nameSingular: "job"', 'nameSingular: "project"'],
  ['"nameSingular": "job"', '"nameSingular": "project"'],
  ['"namePlural": "jobs"', '"namePlural": "projects"'],
  ['"labelSingular": "Job"', '"labelSingular": "Project"'],
  ['"labelPlural": "Jobs"', '"labelPlural": "Projects"'],
  ['"fromObjectName": "job"', '"fromObjectName": "project"'],
  ['"toObjectName": "job"', '"toObjectName": "project"'],
  ['"objectName": "job"', '"objectName": "project"'],
  ["namePlural: 'jobs'", "namePlural: 'projects'"],
  ['namePlural: "jobs"', 'namePlural: "projects"'],
  ["objectName: 'job'", "objectName: 'project'"],
  ['objectName: "job"', 'objectName: "project"'],
  ["fromObjectName: 'job'", "fromObjectName: 'project'"],
  ['fromObjectName: "job"', 'fromObjectName: "project"'],
  ["toObjectName: 'job'", "toObjectName: 'project'"],
  ['toObjectName: "job"', 'toObjectName: "project"'],
  ["fromName: 'jobs'", "fromName: 'projects'"],
  ['fromName: "jobs"', 'fromName: "projects"'],
  ["toName: 'jobs'", "toName: 'projects'"],
  ['toName: "jobs"', 'toName: "projects"'],
  ["fromName: 'job'", "fromName: 'project'"],
  ['fromName: "job"', 'fromName: "project"'],
  ["toName: 'job'", "toName: 'project'"],
  ['toName: "job"', 'toName: "project"'],
  ["labelSingular: 'Job'", "labelSingular: 'Project'"],
  ['labelSingular: "Job"', 'labelSingular: "Project"'],
  ["labelPlural: 'Jobs'", "labelPlural: 'Projects'"],
  ['labelPlural: "Jobs"', 'labelPlural: "Projects"'],
  ["fromLabel: 'Job'", "fromLabel: 'Project'"],
  ['fromLabel: "Job"', 'fromLabel: "Project"'],
  ["fromLabel: 'Jobs'", "fromLabel: 'Projects'"],
  ['fromLabel: "Jobs"', 'fromLabel: "Projects"'],
  ["toLabel: 'Job'", "toLabel: 'Project'"],
  ['toLabel: "Job"', 'toLabel: "Project"'],
  ["toLabel: 'Jobs'", "toLabel: 'Projects'"],
  ['toLabel: "Jobs"', 'toLabel: "Projects"'],

  // App paths
  ["Jobs = 'jobs'", "Projects = 'projects'"],
  ["Job = 'job/:jobId'", "Project = 'project/:projectId'"],
  ["CustomLayoutJob = 'custom-layout-job'", "CustomLayoutProject = 'custom-layout-project'"],
  ['AppPath.Jobs', 'AppPath.Projects'],
  ['AppPath.Job', 'AppPath.Project'],
  ['AppPath.CustomLayoutJob', 'AppPath.CustomLayoutProject'],

  // Common type / component identifiers (word-boundary via regex later)
  ['JobDropdownProps', 'ProjectDropdownProps'],
  ['JobProcessModificationStage', 'ProjectProcessModificationStage'],
  ['JobProcessModificationsType', 'ProjectProcessModificationsType'],
  ['JobProcessModifications', 'ProjectProcessModifications'],
  ['JobProcessStage', 'ProjectProcessStage'],
  ['JobProcess', 'ProjectProcess'],
  ['MergeJobsModal', 'MergeProjectsModal'],
  ['JobStatisticsModal', 'ProjectStatisticsModal'],
  ['OrgChartResultsAddToJobPanel', 'OrgChartResultsAddToProjectPanel'],
  ['OrgChartResultsAddToJobModal', 'OrgChartResultsAddToProjectModal'],
  ['OrgChartAddToJobModal', 'OrgChartAddToProjectModal'],
  ['CandidateTableJobsPageMenuDropdown', 'CandidateTableProjectsPageMenuDropdown'],
  ['useOpenAddJobModal', 'useOpenAddProjectModal'],
  ['useJobDescriptionParser', 'useProjectDescriptionParser'],
  ['useJobOrgChartData', 'useProjectOrgChartData'],
  ['useJobStatusToggle', 'useProjectStatusToggle'],
  ['useJobStateReset', 'useProjectStateReset'],
  ['useJobRefetch', 'useProjectRefetch'],
  ['useJobPagination', 'useProjectPagination'],
  ['JobDetailsForm', 'ProjectDetailsForm'],
  ['JobFilters', 'ProjectFilters'],
  ['JobCard', 'ProjectCard'],
  ['JobPage', 'ProjectPage'],
  ['JobNode', 'ProjectNode'],
  ['JobEdge', 'ProjectEdge'],
  ['currentJobIdState', 'currentProjectIdState'],
  ['selectedJobId', 'selectedProjectId'],
  ['currentJobId', 'currentProjectId'],
  ['JobCreationService', 'ProjectCreationService'],
  ['jobCreationService', 'projectCreationService'],
  ['job-id.utils', 'project-id.utils'],
  ['job-candidate-utils', 'project-candidate-utils'],
  ['job-context.service', 'project-context.service'],
  ['job-tools', 'project-tools'],
  ['jobTools', 'projectTools'],

  // Generic jobId last among identifiers
  ['jobId', 'projectId'],
  ['JobId', 'ProjectId'],
];

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.graphql',
  '.gql',
  '.vue',
  '.py',
  '.html',
  '.css',
  '.scss',
]);

const shouldSkipPath = (filePath) => {
  const parts = filePath.split(path.sep);
  if (parts.some((part) => SKIP_DIR_PARTS.has(part))) {
    return true;
  }
  const basename = path.basename(filePath);
  if (SKIP_BASENAMES.has(basename)) {
    return true;
  }
  if (SKIP_FILE_SUFFIXES.some((suffix) => basename.endsWith(suffix))) {
    return true;
  }
  // Skip BullMQ-style queue job files that aren't CRM
  if (/\.cron\.job\.(ts|js)$/.test(basename)) {
    return true;
  }
  return false;
};

const collectFiles = (targetPath) => {
  const results = [];
  const walk = (currentPath) => {
    let stats;
    try {
      stats = fs.statSync(currentPath);
    } catch {
      return;
    }
    if (stats.isFile()) {
      if (shouldSkipPath(currentPath)) {
        return;
      }
      const extension = path.extname(currentPath);
      if (!TEXT_EXTENSIONS.has(extension) && !currentPath.endsWith('.inline.js')) {
        return;
      }
      results.push(currentPath);
      return;
    }
    if (!stats.isDirectory()) {
      return;
    }
    if (shouldSkipPath(currentPath)) {
      return;
    }
    for (const entry of fs.readdirSync(currentPath)) {
      walk(path.join(currentPath, entry));
    }
  };
  walk(targetPath);
  return results;
};

const applyRename = (content) => {
  const placeholders = [];
  let working = content;

  for (const [index, token] of PROTECTED_TOKENS.entries()) {
    const placeholder = `__CRM_RENAME_PROTECTED_${index}__`;
    if (working.includes(token)) {
      working = working.split(token).join(placeholder);
      placeholders.push({ placeholder, token });
    }
  }

  for (const [from, to] of REPLACEMENTS) {
    if (working.includes(from)) {
      working = working.split(from).join(to);
    }
  }

  // Interface / type Job (standalone word) — careful: only Job as type name patterns
  working = working.replace(/\binterface Job\b/g, 'interface Project');
  working = working.replace(/\btype Job\b/g, 'type Project');
  working = working.replace(/\bexport type Job\b/g, 'export type Project');
  working = working.replace(/\bexport interface Job\b/g, 'export interface Project');
  working = working.replace(/\binterface Jobs\b/g, 'interface Projects');
  working = working.replace(/\btype Jobs\b/g, 'type Projects');
  working = working.replace(/\bexport type Jobs\b/g, 'export type Projects');
  working = working.replace(/\bexport interface Jobs\b/g, 'export interface Projects');

  // GraphQL selection root `jobs(` / `  jobs(` already handled via createJob etc;
  // relation field access `.jobs` and ` jobs {`
  working = working.replace(/\.jobs\b/g, '.projects');
  working = working.replace(/\bjobs\s*\{/g, 'projects {');
  working = working.replace(/\bjobs\s*\(/g, 'projects(');

  // Restore protected tokens
  for (const { placeholder, token } of placeholders) {
    working = working.split(placeholder).join(token);
  }

  return working;
};

const renameFileIfNeeded = (filePath) => {
  const basename = path.basename(filePath);
  const dirname = path.dirname(filePath);
  const renamedBasename = applyRename(basename);
  if (renamedBasename === basename) {
    return filePath;
  }
  const targetPath = path.join(dirname, renamedBasename);
  if (fs.existsSync(targetPath)) {
    console.warn(`Skip rename (exists): ${filePath} -> ${targetPath}`);
    return filePath;
  }
  fs.renameSync(filePath, targetPath);
  console.log(`Renamed file: ${path.relative(ROOT, filePath)} -> ${renamedBasename}`);
  return targetPath;
};

const main = () => {
  const cliPaths = process.argv.slice(2);
  const targets =
    cliPaths.length > 0
      ? cliPaths.map((cliPath) => path.resolve(cliPath))
      : DEFAULT_PATHS;

  let changedFiles = 0;
  let scannedFiles = 0;

  for (const target of targets) {
    if (!fs.existsSync(target)) {
      console.warn(`Missing path: ${target}`);
      continue;
    }
    const files = collectFiles(target);
    for (const filePath of files) {
      scannedFiles += 1;
      let currentPath = filePath;
      const original = fs.readFileSync(currentPath, 'utf8');
      const updated = applyRename(original);
      if (updated !== original) {
        fs.writeFileSync(currentPath, updated);
        changedFiles += 1;
        console.log(`Updated: ${path.relative(ROOT, currentPath)}`);
      }
      currentPath = renameFileIfNeeded(currentPath);
    }
  }

  console.log(`\nScanned ${scannedFiles} files, updated ${changedFiles}.`);
};

main();
