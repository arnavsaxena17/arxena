export const PROCESSOR_METADATA = Symbol('message-queue:processor_metadata');
export const PROCESS_METADATA = Symbol('message-queue:process_metadata');
export const WORKER_METADATA = Symbol('bullmq:worker_metadata');
export const QUEUE_DRIVER = Symbol('message-queue:queue_driver');

export enum MessageQueue {
  taskAssignedQueue = 'task-assigned-queue',
  messagingQueue = 'messaging-queue',
  webhookQueue = 'webhook-queue',
  cronQueue = 'cron-queue',
  emailQueue = 'email-queue',
  calendarQueue = 'calendar-queue',
  contactCreationQueue = 'contact-creation-queue',
  billingQueue = 'billing-queue',
  workspaceQueue = 'workspace-queue',
  recordPositionBackfillQueue = 'record-position-backfill-queue',
  entityEventsToDbQueue = 'entity-events-to-db-queue',
  workflowQueue = 'workflow-queue',
  serverlessFunctionQueue = 'serverless-function-queue',
  deleteCascadeQueue = 'delete-cascade-queue',
  testQueue = 'test-queue',
  candidateQueue = 'candidate-queue',
  aiFilteringQueue = 'ai-filtering-queue',
  extSockWhatsappQueue = 'ext-sock-whatsapp-queue',
  googleContactsQueue = 'google-contacts-queue',
  candidateEngagementQueue = 'candidate-engagement-queue',
  engagedCandidateProcessingQueue = 'engaged-candidate-processing-queue',
  gmailDraftShortlistQueue = 'gmail-draft-shortlist-queue',
  resumeUploadQueue = 'resume-upload-queue',
  contactEnrichmentQueue = 'contact-enrichment-queue',
  metadataStructureQueue = 'metadata-structure-queue',
  autonomousRecruiterQueue = 'autonomous-recruiter-queue',
  theOrgQueue = 'theorg-queue',
  googleSearchPeopleResultsQueue = 'google-search-people-results-queue',
  /** Async Apify LinkedIn company profile scraper → org chart build */
  orgchartApifyQueue = 'orgchart-apify-queue',
}
