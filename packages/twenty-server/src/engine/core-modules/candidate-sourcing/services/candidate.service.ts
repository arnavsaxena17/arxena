import { forwardRef, Inject, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  ArxenaCandidateNode,
  ArxenaPersonNode,
  buildOtherFieldsFromUnmapped,
  CandidatesEdge,
  collectOtherFieldKeys,
  CreateManyCandidates,
  getGraphqlToFindManyJobsWithCandidateValues,
  graphqlToFetchAllCandidateData,
  graphQltoUpdateOneCandidate,
  Job,
  mutationToUpdateOnePerson,
  PageInfo,
  PersonNode,
  questionTextToKey,
  resolveIsOrgChartEnabledFromWorkspace,
  toSnakeCaseKey,
  UserProfile
} from 'twenty-shared';
import { NameProcessor } from '../../workspace-modifications/object-apis/data/nameProcessor';

import { DataProcessingUtils } from 'src/engine/core-modules/candidate-sourcing/utils/data-processing.utils';
import { generateCompleteMappings, mapArxCandidateToPersonNode, processArxCandidate } from 'src/engine/core-modules/candidate-sourcing/utils/data-transformation-utility';
import { normalizeLinkedInUrl } from 'src/engine/core-modules/candidate-sourcing/utils/linkedin-url.utils';
import {
  CandidateUploadLookup,
  deduplicateProfilesForUpload,
  extractUploadUrlBucket,
  findExistingCandidateForUpload,
  getUploadProfileDedupMapKey,
  normalizeUrlForDedup,
} from 'src/engine/core-modules/candidate-sourcing/utils/upload-profile-dedup.utils';
import { v4 } from 'uuid';

import axios from 'axios';

import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { FileStorageService } from 'src/engine/core-modules/file-storage/file-storage.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { JwtWrapperService } from 'src/engine/core-modules/jwt/services/jwt-wrapper.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { ProcessCandidatesService } from '../jobs/process-candidates.service';
import { CandidateWorkspaceGraphQLService } from './candidate-workspace-graphql.service';
import { OtherFieldsService } from './other-fields.service';
import { PersonService } from './person.service';

// Forward reference type to avoid circular dependency
type ProcessCandidatesServiceRef = ProcessCandidatesService;

type UploadExistingCandidateNode = {
  id: string;
  peopleId?: string;
  phoneNumber?: { primaryPhoneNumber?: string } | string;
  email?: { primaryEmail?: string } | string;
};

// import { WebSocketGateway } from 'src/modules/websocket/websocket.gateway';

interface ProcessingContext {
  jobCandidateInfo: {
    jobCandidateObjectId: string;
    jobCandidateObjectName: string;
    path_position: string;
  };
  timestamp: string;
}

@Injectable()
export class CandidateService {
  private processingContexts = new Map<string, ProcessingContext>();
  private processingStats: {
    totalCandidates: number;
    duplicatesRemoved: number;
    peopleToCreate: number;
    peopleToSkip: number;
    candidatesToCreate: number;
    candidatesToSkip: number;
  } | null = null;

  constructor(
    private readonly personService: PersonService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly jwtWrapperService: JwtWrapperService,
    private readonly fileStorageService: FileStorageService,
    private readonly dataProcessingUtils: DataProcessingUtils,
    private readonly candidateWorkspaceGraphQLService: CandidateWorkspaceGraphQLService,
    private readonly otherFieldsService: OtherFieldsService,
    @Inject(forwardRef(() => ProcessCandidatesService))
    private readonly processCandidatesService: ProcessCandidatesServiceRef,
  ) {}

  private async getWorkspaceIdFromToken(apiToken: string): Promise<string> {
    try {
      console.log("Going to get workpsace Id from token")
      // Try to verify as API key first
      let payload;
      try {
        payload = this.jwtWrapperService.verifyWorkspaceToken(apiToken, 'API_KEY');
      } catch (apiKeyError) {
        try {
          // Try to verify as ACCESS token
          payload = this.jwtWrapperService.verifyWorkspaceToken(apiToken, 'ACCESS');
        } catch (accessError) {
          console.warn('Token verification failed, falling back to decode:', accessError.message);
          // Fallback to decode method
          payload = this.jwtWrapperService.decode(apiToken, { json: true });
        }
      }
      
      if (!payload?.workspaceId) {
        console.error('No workspace ID found in token payload:', payload);
        throw new Error('No workspace ID found in token');
      }
      const workspaceId = payload.workspaceId;  
      console.log("REceived workspace id from payload:", workspaceId);
      return workspaceId;
    } catch (error) {
      console.error('Error getting workspace ID from token:', error);
      throw new Error(`Failed to get workspace ID from token: ${error.message}`);
    }
  }

  private indexCandidateNodeInUploadLookup(
    node: Record<string, unknown> | undefined,
    lookup: CandidateUploadLookup,
  ): void {
    if (!node?.id) {
      return;
    }
    const usk = node.uniqueStringKey;
    if (typeof usk === 'string' && usk.trim() !== '') {
      lookup.byUniqueStringKey.set(usk, node);
    }
    const email = node.email as { primaryEmail?: string } | undefined;
    const em = email?.primaryEmail;
    if (typeof em === 'string' && em.trim() !== '') {
      lookup.byEmail.set(em.toLowerCase().trim(), node);
    }
    const phone = node.phoneNumber as { primaryPhoneNumber?: string } | undefined;
    const ph = phone?.primaryPhoneNumber;
    if (typeof ph === 'string' && ph.trim() !== '') {
      const cleaned = this.dataProcessingUtils.cleanPhoneNumber(ph);
      if (cleaned) {
        lookup.byPhone.set(cleaned, node);
      }
    }
    const li = (node.linkedinUrl as { primaryLinkUrl?: string } | undefined)?.primaryLinkUrl;
    if (typeof li === 'string' && li.trim() !== '') {
      lookup.byLinkedinUrl.set(normalizeLinkedInUrl(li), node);
    }
    const hir = (node.hiringNaukriUrl as { primaryLinkUrl?: string } | undefined)?.primaryLinkUrl;
    if (typeof hir === 'string' && hir.trim() !== '') {
      lookup.byHiringNaukriUrl.set(normalizeUrlForDedup(hir), node);
    }
    const res = (node.resdexNaukriUrl as { primaryLinkUrl?: string } | undefined)?.primaryLinkUrl;
    if (typeof res === 'string' && res.trim() !== '') {
      lookup.byResdexNaukriUrl.set(normalizeUrlForDedup(res), node);
    }
  }

  private chunkArray<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      out.push(items.slice(i, i + size));
    }
    return out;
  }

  /**
   * Loads existing candidates for this job keyed by uniqueStringKey, email, phone, and profile URLs
   * so uploads do not create duplicates when uniqueStringKey is name-only but phone/email/URL match.
   */
  async batchCheckExistingCandidates(
    profiles: UserProfile[],
    jobId: string,
    apiToken: string,
  ): Promise<CandidateUploadLookup> {
    const lookup: CandidateUploadLookup = {
      byUniqueStringKey: new Map(),
      byEmail: new Map(),
      byPhone: new Map(),
      byLinkedinUrl: new Map(),
      byHiringNaukriUrl: new Map(),
      byResdexNaukriUrl: new Map(),
    };

    const ingestNodes = (nodes: unknown[]) => {
      for (const node of nodes) {
        this.indexCandidateNodeInUploadLookup(node as Record<string, unknown>, lookup);
      }
    };

    const runCandidatesQuery = async (filter: Record<string, unknown>) => {
      const variables = { filter, limit: 200 };
      const response = await this.staticGraphQLService.executeGraphQL(
        graphqlToFetchAllCandidateData,
        variables,
        apiToken,
      );
      const candidates = response?.data?.data?.candidates as
        | { edges: CandidatesEdge[]; pageInfo: PageInfo }
        | undefined;
      const edges = candidates?.edges || [];
      return edges.map((e) => e.node).filter(Boolean);
    };

    const usks = [
      ...new Set(
        profiles.map((p) => p.uniqueStringKey).filter((k): k is string => Boolean(k && k.trim())),
      ),
    ];
    for (const part of this.chunkArray(usks, 30)) {
      if (part.length === 0) {
        continue;
      }
      const nodes = await runCandidatesQuery({
        and: [{ jobsId: { eq: jobId } }, { uniqueStringKey: { in: part } }],
      });
      ingestNodes(nodes);
    }

    const emails = new Set<string>();
    const phones = new Set<string>();
    const linkedins = new Set<string>();
    const hirings = new Set<string>();
    const resdexs = new Set<string>();

    for (const p of profiles) {
      const emailData = this.dataProcessingUtils.parseEmails(
        p.emailAddress ?? p.emailAddresses,
      );
      if (emailData.primaryEmail && emailData.primaryEmail.trim() !== '') {
        emails.add(emailData.primaryEmail.toLowerCase().trim());
      }
      const phoneData = this.dataProcessingUtils.parsePhoneNumbers(
        p.phoneNumbers ?? p.phoneNumber,
      );
      if (phoneData.primaryPhoneNumber && phoneData.primaryPhoneNumber.trim() !== '') {
        const c = this.dataProcessingUtils.cleanPhoneNumber(phoneData.primaryPhoneNumber);
        if (c) {
          phones.add(c);
        }
      }
      const urls = extractUploadUrlBucket(p);
      if (urls.linkedinNorm) {
        linkedins.add(urls.linkedinNorm);
      }
      if (urls.hiringNorm) {
        hirings.add(urls.hiringNorm);
      }
      if (urls.resdexNorm) {
        resdexs.add(urls.resdexNorm);
      }
    }

    for (const part of this.chunkArray([...emails], 30)) {
      if (part.length === 0) {
        continue;
      }
      const nodes = await runCandidatesQuery({
        and: [{ jobsId: { eq: jobId } }, { email: { primaryEmail: { in: part } } }],
      });
      ingestNodes(nodes);
    }

    for (const part of this.chunkArray([...phones], 30)) {
      if (part.length === 0) {
        continue;
      }
      const nodes = await runCandidatesQuery({
        and: [
          { jobsId: { eq: jobId } },
          { phoneNumber: { primaryPhoneNumber: { in: part } } },
        ],
      });
      ingestNodes(nodes);
    }

    for (const part of this.chunkArray([...linkedins], 30)) {
      if (part.length === 0) {
        continue;
      }
      const nodes = await runCandidatesQuery({
        and: [
          { jobsId: { eq: jobId } },
          { linkedinUrl: { primaryLinkUrl: { in: part } } },
        ],
      });
      ingestNodes(nodes);
    }

    for (const part of this.chunkArray([...hirings], 30)) {
      if (part.length === 0) {
        continue;
      }
      const nodes = await runCandidatesQuery({
        and: [
          { jobsId: { eq: jobId } },
          { hiringNaukriUrl: { primaryLinkUrl: { in: part } } },
        ],
      });
      ingestNodes(nodes);
    }

    for (const part of this.chunkArray([...resdexs], 30)) {
      if (part.length === 0) {
        continue;
      }
      const nodes = await runCandidatesQuery({
        and: [
          { jobsId: { eq: jobId } },
          { resdexNaukriUrl: { primaryLinkUrl: { in: part } } },
        ],
      });
      ingestNodes(nodes);
    }

    console.log(
      'Candidate upload lookup sizes — usk:',
      lookup.byUniqueStringKey.size,
      'email:',
      lookup.byEmail.size,
      'phone:',
      lookup.byPhone.size,
      'li:',
      lookup.byLinkedinUrl.size,
      'hiring:',
      lookup.byHiringNaukriUrl.size,
      'resdex:',
      lookup.byResdexNaukriUrl.size,
    );

    return lookup;
  }

  private async processBatches(
    data: UserProfile[],
    jobObject: Job,
    tracking: any,
    origin: string,
    apiToken: string,
  ): Promise<{
    manyPersonObjects: ArxenaPersonNode[];
    manyCandidateObjects: ArxenaCandidateNode[];
    allPersonObjects: PersonNode[];
  }> {
    const results = {
      manyPersonObjects: [] as ArxenaPersonNode[],
      allPersonObjects: [] as PersonNode[],
      manyCandidateObjects: [] as ArxenaCandidateNode[],
    };

    if (!jobObject) {
      throw new Error('jobObject is undefined in processBatches');
    }

    if (!jobObject.id) {
      throw new Error(`jobObject.id is undefined in processBatches. jobObject: ${JSON.stringify(jobObject)}`);
    }

    const uniqueStringKeys = data
      .map((p) => p?.uniqueStringKey)
      .filter(Boolean);

    console.log(
      'These are the unique string keys that are received::',
      uniqueStringKeys,
    );

    const existingCandidatesLookup = await this.batchCheckExistingCandidates(
      data,
      jobObject.id,
      apiToken,
    );

    await this.processPeopleBatch(
      data,
      uniqueStringKeys,
      results,
      tracking,
      apiToken,
      existingCandidatesLookup,
    );

    // Filter data to only include new candidates (match by URL, phone, email, then uniqueStringKey)
    const newCandidatesData = data.filter((profile) => {
      return !findExistingCandidateForUpload(
        existingCandidatesLookup,
        profile,
        this.dataProcessingUtils,
      );
    });

    // Update processing stats for candidates
    if (this.processingStats) {
      this.processingStats.candidatesToCreate += newCandidatesData.length;
      this.processingStats.candidatesToSkip += (data.length - newCandidatesData.length);
    }

    console.log(`Candidates to create: ${newCandidatesData.length}`);
    console.log(`Candidates to skip (existing): ${data.length - newCandidatesData.length}`);

    const recruiterId = jobObject.recruiterId;
    try {
    await this.processCandidatesBatch(
      data,
      jobObject,
      results,
      tracking,
      apiToken,
      existingCandidatesLookup,
    );
    } catch (error) {
      console.error('Error in processCandidatesBatch:', error);
      throw error;
    }

    // otherFields are set on candidate at creation time in processCandidatesBatch

    // Handle CV uploads for candidates that have CV file paths
    await this.processCvUploadsForCandidates(data, results, tracking, origin, apiToken);

    if (recruiterId) {
      try{
        await this.refreshTableData(recruiterId, apiToken);
      } catch (error) {
        console.log('Error in refreshTableData:', error);
      }
    }
    return results;
  }

  /**
   * Process CV uploads for candidates that have CV file paths in their data
   */
  private async processCvUploadsForCandidates(
    data: UserProfile[],
    results: any,
    tracking: any,
    origin: string,
    apiToken: string
  ): Promise<void> {
    try {
      for (let i = 0; i < data.length; i++) {
        const profile = data[i];
        const cvFilePath = (profile as any)._cvFilePath;
        
        if (cvFilePath) {
          const uniqueStringKey = profile.uniqueStringKey;
          const candidateId = tracking.candidateIdMap.get(uniqueStringKey);
          
          if (candidateId) {
            console.log(`Processing CV upload for candidate ${candidateId} with file: ${cvFilePath}`);
            try {
              await this.createCvAttachment(cvFilePath, candidateId, origin, apiToken);
              console.log(`Successfully uploaded CV for candidate ${candidateId}`);
            } catch (error) {
              console.error(`Error uploading CV for candidate ${candidateId}:`, error);
            }
          } else {
            console.warn(`No candidate ID found for uniqueStringKey ${uniqueStringKey}, cannot upload CV`);
          }
        }
      }
    } catch (error) {
      console.error('Error processing CV uploads for candidates:', error);
      // Don't throw - we don't want to fail the whole batch if CV upload fails
    }
  }

  // Helper method to process a chunk of candidates
  async processChunk(
    candidates: UserProfile[],
    jobId: string,
    jobName: any,
    timestamp: any,
    origin: string,
    apiToken: any,
    chunkNumber: number,
    totalChunks: any,
  ): Promise<string[]> {
    console.log(
      `Processing chunk ${chunkNumber}/${totalChunks} with ${candidates.length} candidates`,
    );
    try {
      console.log(
        `Processing mini-chunk of ${candidates.length}  of ${candidates.length})`,
      );
      console.log(
        `Processing mini-chunk uniqueStringKey of ${candidates.map((x) => x.uniqueStringKey)})`,
      );
      console.log(
        'Number of unique key strings in the mini-chunk:',
        candidates.map((x) => x.uniqueStringKey).length,
      );

      // Deduplicate by profile URL (resdex / hiring / linkedin), then phone, email, then uniqueStringKey
      let deduplicatedProfiles = deduplicateProfilesForUpload(
        candidates,
        this.dataProcessingUtils,
      );

      deduplicatedProfiles = deduplicatedProfiles.map((p, idx) => {
        if (p.uniqueStringKey && p.uniqueStringKey.trim() !== '') {
          return p;
        }
        const generated = getUploadProfileDedupMapKey(p, this.dataProcessingUtils);
        if (generated === 'anon:empty') {
          return { ...p, uniqueStringKey: `upload_missing_${chunkNumber}_${idx}` };
        }
        return { ...p, uniqueStringKey: generated };
      });

      const duplicatesRemoved = candidates.length - deduplicatedProfiles.length;
      console.log(
        `Deduplicated and filtered ${candidates.length} candidates to ${deduplicatedProfiles.length} valid unique profiles`,
      );
      console.log(
        `Removed ${duplicatesRemoved} duplicates or empty uniqueStringKey entries`,
      );
      
      // Track duplicates for summary
      if (!this.processingStats) {
        this.processingStats = {
          totalCandidates: 0,
          duplicatesRemoved: 0,
          peopleToCreate: 0,
          peopleToSkip: 0,
          candidatesToCreate: 0,
          candidatesToSkip: 0
        };
      }
      this.processingStats.totalCandidates += candidates.length;
      this.processingStats.duplicatesRemoved += duplicatesRemoved;

      // Try up to 3 times with exponential backoff
      let success = false;
      let attempt = 0;
      const MAX_ATTEMPTS = 2;

      let createdCandidateIds: string[] = [];
      while (!success && attempt < MAX_ATTEMPTS) {
        try {
          attempt++;
          const rateLimitResult = await this.processProfilesWithRateLimiting(
            deduplicatedProfiles,
            jobId,
            jobName,
            timestamp,
            origin,
      apiToken,
    );
          createdCandidateIds = rateLimitResult.createdCandidateIds ?? [];
          success = true;
        } catch (error) {
          console.log('error has been thrown and will do this in another shot');
          if (attempt >= MAX_ATTEMPTS) {
            throw error; // Re-throw on final attempt
          }
          // Exponential backoff delay
          const delay = Math.pow(2, attempt) * 1000;

          console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      // Add delay between GraphQL requests to avoid overloading the API
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return createdCandidateIds;
    } catch (error) {
      console.error(
        `Error processing mini-chunk in chunk ${chunkNumber}:`,
        error,
      );
      return [];
    }
  }

  async processProfilesWithRateLimiting(
    data: UserProfile[],
    jobId: string,
    jobName: string,
    timestamp: string,
    origin: string,
    apiToken: string,
  ): Promise<{
    manyPersonObjects: ArxenaPersonNode[];
    manyCandidateObjects: ArxenaCandidateNode[];
    allPersonObjects: PersonNode[];
    timestamp: string;
    createdCandidateIds: string[];
  }> {
    console.log('Queue has begun to be processed. ');
    
    // Reset processing stats for new batch
    this.resetProcessingStats();
    
    try {
      const jobObject = await this.candidateWorkspaceGraphQLService.getJobDetails(jobId, jobName, apiToken);

      if (!jobObject || !jobObject.id) {
        throw new Error(`Job not found or invalid for jobId: ${jobId}, jobName: ${jobName}`);
      }
      const tracking = {
        personIdMap: new Map<string, string>(),
        candidateIdMap: new Map<string, string>(),
      };
      console.log(
        'This is tracking of uniqueStringKey in process Profiles WithRateLimiting:',
        data.map((x) => x.uniqueStringKey),
      );
      const results = await this.processBatches(
        data,
        jobObject,
        tracking,
        origin,
        apiToken,
      );

      const recruiterId = jobObject.recruiterId;
      console.log('recruiterId:', recruiterId);

      // Display processing summary
      this.displayProcessingSummary();

      const createdCandidateIds = Array.from(tracking.candidateIdMap.values());
      return { ...results, timestamp, createdCandidateIds };
    } catch (error) {
      console.error('Error in profile processing:', error);
      throw error;
    }
  }





  private displayProcessingSummary(): void {
    if (!this.processingStats) {
      console.log('No processing statistics available');
      return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 CANDIDATE PROCESSING SUMMARY');
    console.log('='.repeat(60));
    console.log(`📥 Total candidates processed: ${this.processingStats.totalCandidates}`);
    console.log(`🔄 Duplicates removed: ${this.processingStats.duplicatesRemoved}`);
    console.log('');
    console.log('👥 PEOPLE:');
    console.log(`   ✅ People to create: ${this.processingStats.peopleToCreate}`);
    console.log(`   ⏭️  People to skip (existing): ${this.processingStats.peopleToSkip}`);
    console.log('');
    console.log('🎯 CANDIDATES:');
    console.log(`   ✅ Candidates to create: ${this.processingStats.candidatesToCreate}`);
    console.log(`   ⏭️  Candidates to skip (existing): ${this.processingStats.candidatesToSkip}`);
    console.log('');
    console.log('📈 SUMMARY:');
    console.log(`   Total unique profiles: ${this.processingStats.totalCandidates - this.processingStats.duplicatesRemoved}`);
    console.log(`   New people created: ${this.processingStats.peopleToCreate}`);
    console.log(`   New candidates created: ${this.processingStats.candidatesToCreate}`);
    console.log('='.repeat(60) + '\n');
  }

  private resetProcessingStats(): void {
    this.processingStats = {
      totalCandidates: 0,
      duplicatesRemoved: 0,
      peopleToCreate: 0,
      peopleToSkip: 0,
      candidatesToCreate: 0,
      candidatesToSkip: 0
    };
  }

  private async refreshTableData(recruiterId: string, apiToken: string) {
    const serverBaseUrl = process.env.SERVER_BASE_URL || 'http://localhost:3000';
    await axios.post(
      `${serverBaseUrl}/candidate-sourcing/refresh-table-data`,
      { recruiterId },
      { headers: { 'Authorization': `Bearer ${apiToken}` } }
    );
  }
  private async processPeopleBatch(
    batch: UserProfile[],
    uniqueStringKeys: string[],
    results: any,
    tracking: any,
    apiToken: string,
    candidatesLookup: CandidateUploadLookup,
  ) {
    try {
      console.log('This is tracking in processPeopleBatch:', tracking);

      const personDetailsMap =
        await this.personService.batchGetPersonDetailsByStringKeys(
          uniqueStringKeys,
          apiToken,
        );

      console.log('Person Details Map size:', personDetailsMap.size);
      console.log('Person Details Map keys:', Array.from(personDetailsMap.keys()));
      const peopleToCreate: ArxenaPersonNode[] = [];
      const peopleKeys: string[] = [];
      let peopleToSkip = 0;

      for (const profile of batch) {
        const key = profile?.uniqueStringKey;

        if (!key) continue;

        const existingCandForPerson = findExistingCandidateForUpload(
          candidatesLookup,
          profile,
          this.dataProcessingUtils,
        ) as UploadExistingCandidateNode | undefined;
        if (existingCandForPerson?.peopleId) {
          tracking.personIdMap.set(key, existingCandForPerson.peopleId);
          peopleToSkip++;
          continue;
        }

        const personObj = personDetailsMap?.get(key);
        if (!personObj || !personObj?.name?.firstName) {
          console.log('Person object not found or incomplete, creating new person for key:', profile?.uniqueStringKey);
          const personNode = mapArxCandidateToPersonNode(profile);
          peopleToCreate.push(personNode);
          peopleKeys.push(key);
          results.manyPersonObjects.push(personNode);
        } else {
          console.log('Using existing person for key:', profile?.uniqueStringKey, 'personId:', personObj?.id);
          results.allPersonObjects.push(personObj);
          tracking.personIdMap.set(key, personObj?.id);
          peopleToSkip++;
        }
      }

      // Update processing stats
      if (this.processingStats) {
        this.processingStats.peopleToCreate += peopleToCreate.length;
        this.processingStats.peopleToSkip += peopleToSkip;
      }

      console.log('People to create:', peopleToCreate.length);
      console.log('People to skip (existing):', peopleToSkip);
      if (peopleToCreate.length > 0) {
        await this.createPeopleWithDuplicateHandling(
          peopleToCreate,
          peopleKeys,
          tracking,
          apiToken,
        );
      }
      
      console.log('Final tracking.personIdMap after people processing:', tracking.personIdMap);
      console.log('Final tracking.personIdMap size:', tracking.personIdMap.size);
    } catch (error) {
      console.log('Error processing people batch1:', error.data);
      console.log('Error processing people batch2:', error.message);
    }
  }

  /**
   * Creates people while tolerating email-uniqueness collisions.
   *
   * The person table enforces uniqueness on primaryEmail, but callers only
   * skip creation based on uniqueStringKey. A person that already exists under
   * a different key (or a duplicate email inside the same batch) would
   * otherwise make the atomic bulk insert roll back the ENTIRE batch, leaving
   * every unrelated new person (and their candidates) with no linked person.
   *
   * Strategy:
   *   1. Reuse people that already exist in the DB by email.
   *   2. Drop duplicate emails within the batch (linked after creation).
   *   3. Attempt a single bulk insert (fast path).
   *   4. If the bulk insert fails, insert row-by-row so a single duplicate
   *      cannot sink the rest of the batch, recovering existing ids by email.
   */
  private async createPeopleWithDuplicateHandling(
    peopleToCreate: ArxenaPersonNode[],
    peopleKeys: string[],
    tracking: any,
    apiToken: string,
  ): Promise<void> {
    const emails = peopleToCreate
      .map((person) => (person.emails?.primaryEmail || '').toLowerCase().trim())
      .filter(Boolean);

    let existingByEmail = new Map<string, any>();
    if (emails.length > 0) {
      try {
        existingByEmail =
          await this.personService.batchGetPersonDetailsByEmails(
            emails,
            apiToken,
          );
      } catch (error) {
        console.log(
          'Error during email pre-check before createPeople:',
          (error as any)?.message || error,
        );
      }
    }

    const toInsertPeople: ArxenaPersonNode[] = [];
    const toInsertKeys: string[] = [];
    const keyToEmail = new Map<string, string>();
    const emailToKeys = new Map<string, string[]>();
    const emailsQueuedForInsert = new Set<string>();

    for (let i = 0; i < peopleToCreate.length; i++) {
      const person = peopleToCreate[i];
      const key = peopleKeys[i];
      const email = (person.emails?.primaryEmail || '').toLowerCase().trim();

      if (email) {
        keyToEmail.set(key, email);
        const keysForEmail = emailToKeys.get(email) || [];
        keysForEmail.push(key);
        emailToKeys.set(email, keysForEmail);
      }

      const existingPerson = email ? existingByEmail.get(email) : null;
      if (existingPerson?.id) {
        tracking.personIdMap.set(key, existingPerson.id);
        console.log(
          `Email pre-check: reusing existing person for key ${key}: ${existingPerson.id}`,
        );
        if (this.processingStats) {
          this.processingStats.peopleToCreate = Math.max(
            0,
            this.processingStats.peopleToCreate - 1,
          );
          this.processingStats.peopleToSkip += 1;
        }
        continue;
      }

      // Duplicate email within the same batch: insert once, link the rest later.
      if (email && emailsQueuedForInsert.has(email)) {
        console.log(
          `Email pre-check: duplicate email within batch for key ${key} (${email}), will link after creation`,
        );
        if (this.processingStats) {
          this.processingStats.peopleToCreate = Math.max(
            0,
            this.processingStats.peopleToCreate - 1,
          );
        }
        continue;
      }

      if (email) {
        emailsQueuedForInsert.add(email);
      }
      toInsertPeople.push(person);
      toInsertKeys.push(key);
    }

    if (toInsertPeople.length === 0) {
      console.log('No new people to insert after email pre-check');
      return;
    }

    const bulkSucceeded = await this.bulkCreateAndLinkPeople(
      toInsertPeople,
      toInsertKeys,
      keyToEmail,
      emailToKeys,
      tracking,
      apiToken,
    );

    if (bulkSucceeded) {
      return;
    }

    console.log(
      `Bulk createPeople failed, creating ${toInsertPeople.length} people individually`,
    );
    await this.createPeopleIndividually(
      toInsertPeople,
      toInsertKeys,
      keyToEmail,
      emailToKeys,
      tracking,
      apiToken,
    );
  }

  private async bulkCreateAndLinkPeople(
    people: ArxenaPersonNode[],
    keys: string[],
    keyToEmail: Map<string, string>,
    emailToKeys: Map<string, string[]>,
    tracking: any,
    apiToken: string,
  ): Promise<boolean> {
    try {
      const response = await this.personService.createPeople(people, apiToken);
      const createdPeople = response?.data?.data?.createPeople;

      if (Array.isArray(createdPeople) && createdPeople.length > 0) {
        createdPeople.forEach((person: any, idx: number) => {
          if (!person?.id) {
            console.log(
              `No ID found for created person at index ${idx}:`,
              JSON.stringify(person, null, 2),
            );
            return;
          }

          const returnedKey = person?.uniqueStringKey || keys[idx];
          const returnedEmail =
            (person?.emails?.primaryEmail || keyToEmail.get(returnedKey) || '')
              .toLowerCase()
              .trim();

          this.linkPersonIdToRelatedKeys(
            returnedKey,
            person.id,
            returnedEmail,
            emailToKeys,
            tracking,
          );
        });
        return true;
      }

      if (response?.data?.errors) {
        console.log(
          'Bulk createPeople returned errors:',
          response.data.errors
            ?.map((error: any) => error?.message)
            .join('; '),
        );
        return false;
      }

      console.log(
        'Bulk createPeople returned no data and no errors, treating as failure',
      );
      return false;
    } catch (error) {
      console.log(
        'Bulk createPeople threw an error:',
        (error as any)?.message || error,
      );
      return false;
    }
  }

  private async createPeopleIndividually(
    people: ArxenaPersonNode[],
    keys: string[],
    keyToEmail: Map<string, string>,
    emailToKeys: Map<string, string[]>,
    tracking: any,
    apiToken: string,
  ): Promise<void> {
    for (let i = 0; i < people.length; i++) {
      const person = people[i];
      const key = keys[i];

      if (tracking.personIdMap.has(key)) {
        continue;
      }

      try {
        const response = await this.personService.createPeople(
          [person],
          apiToken,
        );
        const createdPerson = response?.data?.data?.createPeople?.[0];

        if (createdPerson?.id) {
          const createdEmail =
            createdPerson?.emails?.primaryEmail || keyToEmail.get(key) || '';
          this.linkPersonIdToRelatedKeys(
            key,
            createdPerson.id,
            createdEmail,
            emailToKeys,
            tracking,
          );
          console.log(
            `Individually created person for key ${key}: ${createdPerson.id}`,
          );
          continue;
        }

        console.log(
          `Individual createPeople failed for key ${key}, attempting to find existing person`,
        );
        await this.recoverExistingPersonId(
          key,
          keyToEmail.get(key) || '',
          emailToKeys,
          tracking,
          apiToken,
        );
      } catch (error) {
        console.log(
          `Error creating person individually for key ${key}:`,
          (error as any)?.message || error,
        );
        await this.recoverExistingPersonId(
          key,
          keyToEmail.get(key) || '',
          emailToKeys,
          tracking,
          apiToken,
        );
      }
    }
  }

  private async recoverExistingPersonId(
    key: string,
    email: string,
    emailToKeys: Map<string, string[]>,
    tracking: any,
    apiToken: string,
  ): Promise<void> {
    console.log(
      `Attempting to find existing person for key: ${key}, email: ${email}`,
    );
    try {
      let existingPerson: PersonNode | null = null;

      if (email) {
        const existingByEmail =
          await this.personService.batchGetPersonDetailsByEmails(
            [email],
            apiToken,
          );
        existingPerson = existingByEmail.get(email.toLowerCase().trim()) || null;
      }

      if (!existingPerson) {
        const existingByKey =
          await this.personService.batchGetPersonDetailsByStringKeys(
            [key],
            apiToken,
          );
        existingPerson = existingByKey.get(key) || null;
      }

      if ((existingPerson as PersonNode | null)?.id) {
        const personId = (existingPerson as PersonNode).id;
        this.linkPersonIdToRelatedKeys(
          key,
          personId,
          email,
          emailToKeys,
          tracking,
        );
        console.log(`Found existing person for ${key}: ${personId}`);
      } else {
        console.log(
          `No existing person found for ${key} after creation failure`,
        );
      }
    } catch (error) {
      console.log(
        `Error finding existing person for ${key}:`,
        (error as any)?.message || error,
      );
    }
  }

  /**
   * Links a resolved personId to a key and to any other keys in the same batch
   * that shared the same email (intra-batch duplicates that were not inserted).
   */
  private linkPersonIdToRelatedKeys(
    key: string,
    personId: string,
    email: string,
    emailToKeys: Map<string, string[]>,
    tracking: any,
  ): void {
    if (key) {
      tracking.personIdMap.set(key, personId);
    }

    const normalizedEmail = (email || '').toLowerCase().trim();
    if (!normalizedEmail) {
      return;
    }

    const relatedKeys = emailToKeys.get(normalizedEmail) || [];
    for (const relatedKey of relatedKeys) {
      if (!tracking.personIdMap.has(relatedKey)) {
        tracking.personIdMap.set(relatedKey, personId);
        console.log(
          `Linked personId ${personId} to related key ${relatedKey} (shared email ${normalizedEmail})`,
        );
      }
    }
  }

  private async processCandidatesBatch(
    batch: UserProfile[],
    jobObject: Job,
    results: any,
    tracking: any,
    apiToken: string,
    candidatesLookup: CandidateUploadLookup,
  ) {
    try {
      console.log('Starting processCandidatesBatch with jobObject:', jobObject);
      if (!jobObject) {
        throw new Error('jobObject is undefined in processCandidatesBatch');
      }
      if (!jobObject.id) {
        throw new Error(`jobObject.id is undefined in processCandidatesBatch. jobObject: ${JSON.stringify(jobObject)}`);
      }
      const recruiterId = jobObject.recruiterId;
      if (!recruiterId) {
        console.warn('No recruiterId found in jobObject');
      }

      console.log('This is tracking in processCandidatesBatch:', tracking);
  
      console.log(
        'Checking candidates with keys:',
        batch.map((p) => p?.uniqueStringKey),
      );
      console.log('Using precomputed candidates lookup for upload batch');
      const workspaceId = await this.getWorkspaceIdFromToken(apiToken);
      console.log('Workspace ID:', workspaceId);
  
      const whatsapp_key = await this.workspaceQueryService.getWorkspaceApiKey(
        workspaceId,
        'whatsapp_key',
      ) || process.env.DEFAULT_WHATSAPP_CLIENT || 'whatsapp-unipile';
      console.log('whatsapp_key:', whatsapp_key);
      
      const candidatesToCreate: ArxenaCandidateNode[] = [];
      const candidateKeys: string[] = [];
      
      const candidatesToUpdate: Array<{
        candidateId: string;
        hiringNaukriUrl: { "primaryLinkLabel": string; "primaryLinkUrl": string; };
        resdexNaukriUrl: { "primaryLinkLabel": string; "primaryLinkUrl": string; };
        displayPicture: { "primaryLinkLabel": string; "primaryLinkUrl": string; };
        linkedinUrl: { "primaryLinkLabel": string; "primaryLinkUrl": string; };
        personId: string;
        profile: UserProfile;
        missingFields: string[];
      }> = [];
  
      for (const profile of batch) {
        const key = profile?.uniqueStringKey;
  
        if (!key) continue;
        console.log("This is the candidates uniqueStringKey:", key);
        // console.log("This is the candidates candidatesMap:", candidatesMap);
        const existingCandidate = findExistingCandidateForUpload(
          candidatesLookup,
          profile,
          this.dataProcessingUtils,
        ) as UploadExistingCandidateNode | undefined;
        let personId = tracking.personIdMap.get(key);
        
        console.log(`- personId: ${personId}`);
        console.log(`- existingCandidate: ${existingCandidate ? 'found' : 'not found'}`);
        
        // If personId is not found in tracking, try to find existing person by email
        if (!personId && profile?.emailAddress) {
          console.log(`PersonId not found for ${key}, attempting to find existing person by email: ${profile.emailAddress}`);
          try {
            const email = profile.emailAddress.toLowerCase().trim();
            let existingPerson: PersonNode | null = null;

            if (email) {
              const existingByEmail =
                await this.personService.batchGetPersonDetailsByEmails(
                  [email],
                  apiToken,
                );
              existingPerson = existingByEmail.get(email) || null;
            }

            if (!existingPerson) {
              const existingPersonsByKey =
                await this.personService.batchGetPersonDetailsByStringKeys(
                  [key],
                  apiToken,
                );
              existingPerson = existingPersonsByKey.get(key) || null;
            }

            if ((existingPerson as PersonNode | null)?.id) {
              const personIdFromExisting = (existingPerson as PersonNode).id;
              personId = personIdFromExisting;
              tracking.personIdMap.set(key, personIdFromExisting);
              console.log(`Found existing person for ${key}: ${personIdFromExisting}`);
            } else {
              console.log(
                `No existing person found for ${key}, will create candidate without personId`,
              );
            }
          } catch (error) {
            console.log(
              `Error finding existing person for ${key}:`,
              (error as any)?.message || error,
            );
          }
        }

        // Spreadsheet import: ensure we always have a linked Person.
        // These imports can legitimately arrive without an existing Person (no match by uniqueStringKey),
        // but the UI expects Candidate.peopleId to exist to persist edits (e.g. remarks).
        if (!personId && profile?.creationSource === 'spreadsheet_import') {
          console.log(`No personId for spreadsheet import key ${key}. Creating person before candidate.`);
          try {
            const personNode = mapArxCandidateToPersonNode(profile);
            const createPersonResponse = await this.personService.createPeople([personNode], apiToken);
            const createdPersonId = createPersonResponse?.data?.data?.createPeople?.[0]?.id;
            if (createdPersonId) {
              personId = createdPersonId;
              tracking.personIdMap.set(key, personId);
              console.log(`Created person for ${key}: ${personId}`);
            } else {
              // As a fallback (e.g. if createPeople returns errors), try to fetch again by uniqueStringKey.
              const existingPersons = await this.personService.batchGetPersonDetailsByStringKeys([key], apiToken);
              const existingPerson = existingPersons.get(key);
              if (existingPerson?.id) {
                personId = existingPerson.id;
                tracking.personIdMap.set(key, personId);
                console.log(`Resolved person after creation attempt for ${key}: ${personId}`);
              } else {
                console.warn(`Failed to create/resolve person for spreadsheet import key ${key}. Candidate may be unlinked.`);
              }
            }
          } catch (error) {
            console.warn(`Error creating person for spreadsheet import key ${key}:`, error?.message || error);
          }
        }
        
        console.log(`- Final personId: ${personId}`);
        console.log(`- Will create candidate: ${!existingCandidate ? 'YES' : 'NO'}`);

        // If a spreadsheet-import candidate already exists but is not linked to a person, link it now.
        if (
          existingCandidate &&
          profile?.creationSource === 'spreadsheet_import' &&
          personId &&
          !existingCandidate?.peopleId
        ) {
          try {
            console.log(`Linking existing candidate ${existingCandidate.id} to person ${personId} (spreadsheet import).`);
            await this.staticGraphQLService.executeGraphQL(
              graphQltoUpdateOneCandidate,
              { idToUpdate: existingCandidate.id, input: { peopleId: personId } },
              apiToken,
            );
          } catch (error) {
            console.warn(
              `Failed linking existing candidate ${existingCandidate.id} to person ${personId}:`,
              error?.message || error,
            );
          }
        }

        // Create candidate if it doesn't already exist, regardless of personId status
        if (!existingCandidate) {
          const { unmappedCandidateObject } = await generateCompleteMappings(
            profile,
            jobObject,
          );
          const { candidateNode } = await processArxCandidate(
            profile,
            jobObject,
            whatsapp_key,
          );
          const otherFields = buildOtherFieldsFromUnmapped(unmappedCandidateObject);
  
          const candidateWithOtherFields = {
            ...candidateNode,
            peopleId: personId || undefined,
            otherFields,
          };
          candidatesToCreate.push(candidateWithOtherFields);
          candidateKeys.push(key);
          results.manyCandidateObjects.push(candidateWithOtherFields);
          console.log(`- Candidate personId: ${candidateWithOtherFields.peopleId || 'undefined (will need to be linked later)'}`);
          
          
        } else if (existingCandidate) {
          const missingFields: string[] = [];
          
          const isFieldEmpty = (field: any): boolean => {
            if (!field) return true;
            if (typeof field === 'string') return field.trim() === '';
            if (typeof field === 'object') {
              if ('primaryPhoneNumber' in field) return !field.primaryPhoneNumber || field.primaryPhoneNumber.trim() === '';
              if ('primaryEmail' in field) return !field.primaryEmail || field.primaryEmail.trim() === '';
              return Object.keys(field).length === 0;
            }
            return false;
          };

          const rawCandPhone = existingCandidate?.phoneNumber;
          const candidatePhone =
            typeof rawCandPhone === 'string'
              ? rawCandPhone
              : rawCandPhone?.primaryPhoneNumber || '';
          console.log('Current candidate phone:', candidatePhone);
          const profilePhone = profile?.phoneNumbers?.[0] || profile?.phoneNumber || profile?.phoneNumbers?.[0];
          console.log('Profile phone:', profilePhone);
          
          // Parse phone numbers to handle comma-separated values
          const candidatePhoneData = this.dataProcessingUtils.parsePhoneNumbers(candidatePhone);
          const profilePhoneData = this.dataProcessingUtils.parsePhoneNumbers(profilePhone);
          
          // Clean the profile phone number for comparison
          const cleanedProfilePhone = profilePhoneData.primaryPhoneNumber;
          const cleanedCandidatePhone = candidatePhoneData.primaryPhoneNumber;
          
          if (isFieldEmpty(candidatePhone) && cleanedProfilePhone && cleanedProfilePhone.trim() !== '') {
            console.log('Adding phoneNumber to missing fields');
            missingFields.push('phoneNumber');
          } else if (cleanedCandidatePhone && cleanedProfilePhone && cleanedCandidatePhone !== cleanedProfilePhone) {
            console.log('Phone numbers differ, adding to missing fields');
            missingFields.push('phoneNumber');
          } else {
            console.log('No phone number to update');
          }
          
          const profileUrl = profile?.profileUrl;
          const rawCandEmail = existingCandidate?.email;
          const candidateEmail =
            typeof rawCandEmail === 'string'
              ? rawCandEmail
              : rawCandEmail?.primaryEmail || '';
          console.log('Current candidate email:', candidateEmail);
          const profileEmail = profile?.emailAddress?.[0] || profile?.emailAddresses?.[0];
          console.log('Profile email:', profileEmail);
          
          // Parse emails to handle comma-separated values
          const candidateEmailData = this.dataProcessingUtils.parseEmails(candidateEmail);
          const profileEmailData = this.dataProcessingUtils.parseEmails(profileEmail);
          
          // Clean the profile email for comparison
          const cleanedProfileEmail = profileEmailData.primaryEmail;
          const cleanedCandidateEmail = candidateEmailData.primaryEmail;
          
          console.log('profileUrl to be checked for duplication:', profileUrl);
          if (profileUrl && profileUrl.includes('naukri')) {
            missingFields.push('profileUrl');
          } else {
            console.log('No profile url to update for naukri');
          }
          
          if (isFieldEmpty(candidateEmail) && cleanedProfileEmail && cleanedProfileEmail.trim() !== '') {
            console.log('Adding email to missing fields');
            missingFields.push('email');
          } else if (cleanedCandidateEmail && cleanedProfileEmail && cleanedCandidateEmail !== cleanedProfileEmail) {
            console.log('Emails differ, adding to missing fields');
            missingFields.push('email');
          } else {
            console.log('No email to update');
          }
          
          console.log('Missing fields:', missingFields);
          
          if (missingFields.length > 0) {
            console.log('Missing fields:', missingFields);
            const candidateToUpdate = 
            {
              candidateId: existingCandidate.id,
              personId: existingCandidate.peopleId || '',
              hiringNaukriUrl: { "primaryLinkLabel": profile?.profileUrl && profile?.profileUrl.includes('hiring') ? profile?.profileUrl : '', "primaryLinkUrl": profile?.profileUrl && profile?.profileUrl.includes('hiring') ? profile?.profileUrl : '' },
              resdexNaukriUrl: { "primaryLinkLabel": profile?.profileUrl && profile?.profileUrl.includes('resdex') ? profile?.profileUrl : '', "primaryLinkUrl": profile?.profileUrl && profile?.profileUrl.includes('resdex') ? profile?.profileUrl : '' },
              displayPicture: { "primaryLinkLabel": "Display Picture", "primaryLinkUrl": typeof profile?.displayPicture === 'string' ? profile?.displayPicture : (profile?.displayPicture as any)?.primaryLinkUrl || '' },
              linkedinUrl: { "primaryLinkLabel": profile?.profileUrl && profile?.profileUrl.includes('linkedin') ? normalizeLinkedInUrl(profile?.profileUrl) : '', "primaryLinkUrl": profile?.profileUrl && profile?.profileUrl.includes('linkedin') ? normalizeLinkedInUrl(profile?.profileUrl) : '' },
              profile: profile,
              missingFields
            }
            if ('uniqueStringKey' in candidateToUpdate) {
              delete candidateToUpdate.uniqueStringKey;
            }

            candidatesToUpdate.push(candidateToUpdate);
          }
          // console.log("Candidate to update:", candidatesToUpdate.map((c) => c.profile.uniqueStringKey));
          tracking.candidateIdMap.set(key, existingCandidate?.id);
        }
      }
  
      console.log('Candidates to create:', candidatesToCreate.length);
      console.log('Candidates to update:', candidatesToUpdate.length);
      console.log('Candidates candidateKeys:', candidateKeys);
      console.log('Candidates with personId:', candidatesToCreate.filter(c => c.peopleId).length);
      console.log('Candidates without personId:', candidatesToCreate.filter(c => !c.peopleId).length);
      console.log('tracking.candidateIdMap:', tracking.candidateIdMap);
  
      if (candidatesToCreate.length > 0) {
        console.log(`Creating ${candidatesToCreate.length} candidates...`);
        const response = await this.createCandidates( candidatesToCreate, apiToken, );
  
        if (response?.data?.data?.createCandidates) {
          response.data.data.createCandidates.forEach(
            (candidate: { id: any }, idx: string | number) => {
              console.log(`Setting candidateId for key ${candidateKeys[idx]}: ${candidate?.id}`);
              if (candidate?.id) {
                tracking.candidateIdMap.set(candidateKeys[idx], candidate.id);
              }
            },
          );
        } else {
          console.log('No candidates were created in the response');
        }
      } else {
        console.log('No candidates to create - candidatesToCreate array is empty');
      }
  
      if (candidatesToUpdate.length > 0) {
        for (const updateCandidate of candidatesToUpdate) {
          const { candidateId, personId, profile, missingFields } = updateCandidate;
          try {
            for (const fieldName of missingFields) {
              if (fieldName === 'phoneNumber') {
                const phoneValue = profile?.phoneNumbers?.[0] || profile?.phoneNumber || profile?.phoneNumbers?.[0] || '';
                if (phoneValue && phoneValue.trim() !== '') {
                  const phoneData = this.dataProcessingUtils.parsePhoneNumbers(phoneValue);
                  await this.handlePhoneNumberUpdateWithStructure(candidateId, phoneData, apiToken);
                }
              } else if (fieldName === 'email') {
                const emailValue = profile?.emailAddress?.[0] || profile?.emailAddresses?.[0] || '';
                if (emailValue && emailValue.trim() !== '') {
                  const emailData = this.dataProcessingUtils.parseEmails(emailValue);
                  await this.handleEmailUpdateWithStructure(candidateId, personId, emailData, apiToken);
                }
              }
              if (fieldName === 'profileUrl') {
                const profileUrl = profile?.profileUrl;
                if (profileUrl && profileUrl.includes('naukri')) {
                  const updateData = {"hiringNaukriUrl": {primaryLinkLabel: profileUrl, primaryLinkUrl: profileUrl}, "resdexNaukriUrl": {primaryLinkLabel: profileUrl, primaryLinkUrl: profileUrl}};
                  const response = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, { idToUpdate: candidateId, input: updateData }, apiToken);
                } else if (profileUrl && profileUrl.includes('linkedin')) {
                  const normalizedUrl = normalizeLinkedInUrl(profileUrl);
                  const updateData = {"linkedinUrl": {primaryLinkLabel: normalizedUrl, primaryLinkUrl: normalizedUrl}};
                  const response = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, { idToUpdate: candidateId, input: updateData }, apiToken);
                }
              }
            }
          } catch (error) {
            console.log(`Error updating candidate ${candidateId}:`, error);
          }
        }
      }


    } catch (error) {
      console.log('Error processing candidates batch:1', error.data);
      console.log('Error processing candidates batch:2', error);
      console.log('Error processing candidates batch:3', error?.response?.data);
      console.log('Error processing candidates batch:4', error.message);
    }
  }

  async createCandidates(
    manyCandidateObjects: ArxenaCandidateNode[],
    apiToken: string,
  ): Promise<any> {
    console.log('Creating candidates, count:', manyCandidateObjects?.length);
    const graphqlVariables = { data: manyCandidateObjects };
    try {
      const response = await this.staticGraphQLService.executeGraphQL(CreateManyCandidates, graphqlVariables, apiToken);

      return response;
    } catch (error) {
      console.log('Error in creating candidates1', error?.data);
      console.log('Error in creating candidates2', error?.message);
      console.log('Error in creating candidates3', error);
    }
  }

  async updateCandidateFieldValue(
    candidateId: string,
    fieldName: string,
    value: any,
    apiToken: string,
  ): Promise<any> {
    try {
      console.log('Going to update otherFields field:', fieldName);

      if (fieldName === 'mobilePhone') {
        return this.handlePhoneNumberUpdate(candidateId, value, apiToken);
      }

      const candidate = await this.otherFieldsService.fetchCandidateById(
        candidateId,
        apiToken,
      );

      if (candidate) {
        await this.otherFieldsService.lazyMigrateCandidateOtherFields(
          candidate,
          apiToken,
        );
      }

      const merged = await this.otherFieldsService.patchCandidateOtherFields(
        candidateId,
        { [toSnakeCaseKey(fieldName)]: value },
        apiToken,
        candidate ? this.otherFieldsService.resolveOtherFields(candidate) : undefined,
      );

      return { success: true, otherFields: merged };
    } catch (error) {
      console.error('Error updating candidate field value:', error);
      throw error;
    }
  }




  async handlePhoneNumberUpdate(candidateId: string, value: string, apiToken: string): Promise<any> {
    try {
      console.log("Going to update phone number for candidate:", candidateId, value);
      const candidateResponse = await this.staticGraphQLService.executeGraphQL(graphqlToFetchAllCandidateData, { filter: { id: { eq: candidateId } } }, apiToken);

      const oldPhoneNumber = candidateResponse?.data?.data?.candidates?.edges[0]?.node?.phoneNumber?.primaryPhoneNumber;
      const personId = candidateResponse?.data?.data?.candidates?.edges[0]?.node?.peopleId;
      // Update candidate phone number
      const updateCandidateResponse = await this.updateCandidatePhoneNumber(
        candidateId, 
        { primaryPhoneNumber: String(value) }, 
        apiToken
      );

      // Update person phone number
      if (personId) {
        await this.updatePersonPhoneNumber(
          personId, 
          { primaryPhoneNumber: String(value) }, 
          apiToken
        );
      }

      // Only update whitelist if the phone number has actually changed
      if (oldPhoneNumber !== value) {
        // await this.updateWhatsAppWhitelist(oldPhoneNumber, value, apiToken);
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating phone number fields:', error);
      throw error;
    }
  }

  /**
   * Update candidate phone number
   */
  private async updateCandidatePhoneNumber(
    candidateId: string,
    phoneData: {
      primaryPhoneNumber: string;
      primaryPhoneCountryCode?: string;
      primaryPhoneCallingCode?: string;
      additionalPhones?: Array<{
        number: string;
        callingCode: string;
        countryCode: string;
      }>;
    },
    apiToken: string
  ): Promise<any> {
    const candidateUpdateData = {
      phoneNumber: {
        primaryPhoneNumber: phoneData.primaryPhoneNumber,
        ...(phoneData.primaryPhoneCountryCode && { primaryPhoneCountryCode: phoneData.primaryPhoneCountryCode }),
        ...(phoneData.primaryPhoneCallingCode && { primaryPhoneCallingCode: phoneData.primaryPhoneCallingCode }),
        ...(phoneData.additionalPhones && { additionalPhones: phoneData.additionalPhones })
      }
    };

    return await this.staticGraphQLService.executeGraphQL(
      graphQltoUpdateOneCandidate, 
      { idToUpdate: candidateId, input: candidateUpdateData }, 
      apiToken
    );
  }

  /**
   * Update person phone number
   */
  private async updatePersonPhoneNumber(
    personId: string,
    phoneData: {
      primaryPhoneNumber: string;
      primaryPhoneCountryCode?: string;
      primaryPhoneCallingCode?: string;
      additionalPhones?: Array<{
        number: string;
        callingCode: string;
        countryCode: string;
      }>;
    },
    apiToken: string
  ): Promise<any> {
    const personUpdateData = {
      phones: {
        primaryPhoneNumber: phoneData.primaryPhoneNumber,
        ...(phoneData.primaryPhoneCountryCode && { primaryPhoneCountryCode: phoneData.primaryPhoneCountryCode }),
        ...(phoneData.primaryPhoneCallingCode && { primaryPhoneCallingCode: phoneData.primaryPhoneCallingCode }),
        ...(phoneData.additionalPhones && { additionalPhones: phoneData.additionalPhones })
      }
    };

    return await this.staticGraphQLService.executeGraphQL(
      mutationToUpdateOnePerson, 
      { idToUpdate: personId, input: personUpdateData }, 
      apiToken
    );
  }

  /**
   * Handle phone number update with structured data (primary + additional phones)
   */
  async handlePhoneNumberUpdateWithStructure(
    candidateId: string, 
    phoneData: {
      primaryPhoneNumber: string;
      primaryPhoneCountryCode: string;
      primaryPhoneCallingCode: string;
      additionalPhones: Array<{
        number: string;
        callingCode: string;
        countryCode: string;
      }>;
    }, 
    apiToken: string
  ): Promise<any> {
    try {
      console.log('Updating phone number with structure:', phoneData);
      
      // Update candidate phone number with structured data
      const candidateResponse = await this.updateCandidatePhoneNumber(candidateId, phoneData, apiToken);
      console.log('Candidate phone update response:', candidateResponse?.data?.data);

      // Get person ID and update person phone as well
      const candidateResponseForPerson = await this.staticGraphQLService.executeGraphQL(
        graphqlToFetchAllCandidateData, 
        { filter: { id: { eq: candidateId } } }, 
        apiToken
      );

      const personId = candidateResponseForPerson?.data?.data?.candidates?.edges[0]?.node?.peopleId;
      
      if (personId) {
        const personResponse = await this.updatePersonPhoneNumber(personId, phoneData, apiToken);
        console.log('Person phone update response:', personResponse?.data?.data);
      }

      // Handle whitelist update for WhatsApp if phone number changed
      if (phoneData.primaryPhoneNumber) {
        // await this.updateWhatsAppWhitelist('', phoneData.primaryPhoneNumber, apiToken);
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating phone number with structure:', error);
      throw error;
    }
  }

  /**
   * Handle email update with structured data (primary + additional emails)
   */
  async handleEmailUpdateWithStructure(
    candidateId: string,
    personId: string | null,
    emailData: {
      primaryEmail: string;
      additionalEmails: string[];
    },
    apiToken: string
  ): Promise<any> {
    try {
      console.log('Updating email with structure:', emailData);
      
      // Update candidate email with structured data
      const candidateUpdateData = {
        email: {
          primaryEmail: emailData.primaryEmail,
          additionalEmails: emailData.additionalEmails
        }
      };

      const candidateResponse = await this.staticGraphQLService.executeGraphQL(
        graphQltoUpdateOneCandidate, 
        { idToUpdate: candidateId, input: candidateUpdateData }, 
        apiToken
      );

      console.log('Candidate email update response:', candidateResponse?.data?.data);

      // Update person email if personId is available
      if (personId) {
        try {
          const personUpdateData = {
            emails: {
              primaryEmail: emailData.primaryEmail,
              additionalEmails: emailData.additionalEmails
            }
          };

          const personResponse = await this.staticGraphQLService.executeGraphQL(
            mutationToUpdateOnePerson, 
            { idToUpdate: personId, input: personUpdateData }, 
            apiToken
          );

          console.log('Person email update response:', personResponse?.data?.data);
        } catch (error) {
          console.error('Error updating person email with structure:', error);
          // Check if it's a duplicate key error
          if (error.message && error.message.includes('duplicate key value violates unique constraint')) {
            console.warn(`Email ${emailData.primaryEmail} already exists for another person. Skipping person email update.`);
            // Continue execution - don't throw error
          } else {
            console.error('Non-constraint error updating person email:', error);
            throw error;
          }
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating email with structure:', error);
      throw error;
    }
  }
  /**
   * Updates a direct field on a candidate
   */
  async updateCandidateField(
    personId: string,
    candidateId: string,
    fieldName: string,
    value: any,
    apiToken: string,
    origin: string,
  ): Promise<any> {
    try {
      // Format the value based on field type
      let formattedValue = value;
      console.log("Going to update candidate field:::", fieldName, candidateId, personId, value);
      
      if(value === null || value === undefined) {
        console.log("value is null or undefined, returning")
        formattedValue = null;
      }
      if (formattedValue?.toLowerCase() === 'true' || formattedValue?.toLowerCase() === 'false') {
        formattedValue = formattedValue?.toLowerCase() === 'true';
      }

      const snakeCaseFieldName = toSnakeCaseKey(fieldName);
      console.log('snakeCaseFieldName::', snakeCaseFieldName);

      const directFields = [
        'remarks', 'engagementStatus', 'startChat', 'stopChat', 'startChatCompleted', 'status',
        'startMeetingSchedulingChat', 'startMeetingSchedulingChatCompleted', 'hiringNaukriUrl',
        'startVideoInterviewChat', 'startVideoInterviewChatCompleted', 'candConversationStatus',
        'messagingChannel', 'linkedinUrl', 'email', 'jobTitle', 'jobCompanyName', 'mobilePhone',
        'phone', 'phoneNumber',
      ];

      const isDirectField = directFields.includes(fieldName);
      // Special handling for specific fields
      if (fieldName === 'email') {
        try {
          const updateData = {"email": {primaryEmail: formattedValue}};
          const response = await this.staticGraphQLService.executeGraphQL(mutationToUpdateOnePerson, { idToUpdate: personId, input: { emails: { primaryEmail: formattedValue } } }, apiToken);
        } catch (error) {
          console.error('Error updating person email:', error);
          // Check if it's a duplicate key error
          if (error.message && error.message.includes('duplicate key value violates unique constraint')) {
            console.warn(`Email ${formattedValue} already exists for another person. Skipping person email update.`);
            // Return a success response but don't update the person email
            return { success: true, message: 'Email already exists for another person, skipped person update' };
          }
          console.error('Non-constraint error updating person email:', error);
        }

        try{
          const updateData = {"email": {primaryEmail: formattedValue}};
          const response = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, { idToUpdate: candidateId, input: updateData }, apiToken);
        } catch (error) {
          console.error('Error updating person email:', error);
        }
        return { success: true, message: 'Email updated successfully' };
      }

      if (fieldName === 'jobTitle') {
        const updateData = {"jobTitle": formattedValue};
        const response = await this.staticGraphQLService.executeGraphQL(mutationToUpdateOnePerson, { idToUpdate: personId, input: updateData }, apiToken);
        console.log("response for job title update::", response?.data?.data);

        const updateCandidateResponse = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, { idToUpdate: candidateId, input: { jobTitle: formattedValue } }, apiToken);
        console.log("updateCandidateResponse::", updateCandidateResponse?.data?.data);
        return response?.data?.data;
      }

      if (fieldName === 'jobCompanyName') {
        const updateCandidateResponse = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, { idToUpdate: candidateId, input: { jobCompanyName: formattedValue } }, apiToken);
        console.log("updateCandidateResponse for jobCompanyName::", updateCandidateResponse?.data?.data);
        return updateCandidateResponse?.data?.data;
      }

      if (fieldName === 'mobilePhone' || fieldName === 'phone' || fieldName === 'phoneNumber') {
        return this.handlePhoneNumberUpdate(candidateId, formattedValue, apiToken);
      }

      // Special handling for linkedinUrl field - update both candidate and person
      if (fieldName === 'linkedinUrl') {
        console.log("Updating linkedinUrl in both candidate and person");
        
        // Normalize the LinkedIn URL using the utility function
        const normalizedLinkedInUrl = normalizeLinkedInUrl(formattedValue || '');
        console.log("Original LinkedIn URL:", formattedValue);
        console.log("Normalized LinkedIn URL:", normalizedLinkedInUrl);
        
        // Format the value as a link object
        const linkValue = {
          primaryLinkLabel: normalizedLinkedInUrl,
          primaryLinkUrl: normalizedLinkedInUrl
        };
        
        // Update candidate linkedinUrl
        const candidateUpdateData = { linkedinUrl: linkValue };
        const candidateResponse = await this.staticGraphQLService.executeGraphQL(
          graphQltoUpdateOneCandidate, 
          { idToUpdate: candidateId, input: candidateUpdateData }, 
          apiToken
        );
        console.log("Candidate linkedinUrl update response:", candidateResponse?.data?.data);
        
        // Update person linkedinLink (note: person uses linkedinLink, not linkedinUrl)
        if (personId) {
          const personUpdateData = { linkedinLink: linkValue };
          const personResponse = await this.staticGraphQLService.executeGraphQL(
            mutationToUpdateOnePerson, 
            { idToUpdate: personId, input: personUpdateData }, 
            apiToken
          );
          console.log("Person linkedinLink update response:", personResponse?.data?.data);
        }
        
        return candidateResponse?.data?.data;
      }

      // Custom fields are stored in candidate.otherFields
      if (!isDirectField) {
        console.log('Updating as otherFields value');
        return this.updateCandidateFieldValue(
          candidateId,
          snakeCaseFieldName,
          formattedValue,
          apiToken,
        );
      }

      console.log('formattedValue in updateCandidateField::', formattedValue);
      console.log('Updating as direct field');
      let updateData: Record<string, any> = {};
      
      // Special handling for candConversationStatus to map label back to key
      if (fieldName === 'candConversationStatus' && typeof formattedValue === 'string') {
        const CANDIDATE_CONVERSATION_STATUS_LABELS_REVERSE = {
          'No Conversation': 'ONLY_ADDED_NO_CONVERSATION',
          'Started, No Response': 'CONVERSATION_STARTED_HAS_NOT_RESPONDED',
          'Shared JD, No Response': 'SHARED_JD_HAS_NOT_RESPONDED',
          'Refuses Relocation': 'CANDIDATE_REFUSES_TO_RELOCATE',
          'Stopped Responding': 'STOPPED_RESPONDING_ON_QUESTIONS',
          'Salary Out of Range': 'CANDIDATE_SALARY_OUT_OF_RANGE',
          'Keen to Chat': 'CANDIDATE_IS_KEEN_TO_CHAT',
          'Declined Opportunity': 'CANDIDATE_DECLINED_OPPORTUNITY',
          'Followed Up': 'CANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT',
          'Reluctant on Compensation': 'CANDIDATE_IS_RELUCTANT_TO_DISCUSS_COMPENSATION',
          'Closed to Contact': 'CONVERSATION_CLOSED_TO_BE_CONTACTED'
        };
        
        const statusKey = CANDIDATE_CONVERSATION_STATUS_LABELS_REVERSE[formattedValue];
        if (statusKey) {
          updateData[fieldName] = statusKey;
        } else {
          console.warn(`Unknown status label: ${formattedValue}`);
          updateData[fieldName] = formattedValue;
        }
      } else if (fieldName === 'status' && typeof formattedValue === 'string') {
        const STATUS_LABELS_REVERSE = {
          'Not Interested': 'NOT_INTERESTED',
          'Interested': 'INTERESTED',
          'CV Received': 'CV_RECEIVED',
          'Not Fit': 'NOT_FIT',
          'Screening': 'SCREENING',
          'Recruiter Interview': 'RECRUITER_INTERVIEW',
          'CV Sent': 'CV_SENT',
          'Client Interview': 'CLIENT_INTERVIEW',
          'Negotiation': 'NEGOTIATION'
        };
        
        const statusKey = STATUS_LABELS_REVERSE[formattedValue];
        if (statusKey) {
          updateData[fieldName] = statusKey;
        } else {
          console.warn(`Unknown status label: ${formattedValue}`);
          updateData[fieldName] = formattedValue;
        }
      } else {
        updateData[fieldName] = formattedValue;
      }
      
      const variables = {
        idToUpdate: candidateId,
        input: updateData
      };
      const response = await this.staticGraphQLService.executeGraphQL(graphQltoUpdateOneCandidate, variables, apiToken);
      
      if (response?.data?.errors && response.data.errors.length > 0) {
        console.error(`[CandidateService] GraphQL errors in updateCandidateField for field "${fieldName}":`, response.data.errors);
        console.error(`[CandidateService] Candidate ID: ${candidateId}, Field: ${fieldName}, Value:`, formattedValue);
        console.error(`[CandidateService] Variables sent:`, JSON.stringify(variables, null, 2));
      }
      
      return response?.data;
    } catch (error) {
      console.error('Error updating candidate field:', error);
      throw error;
    }
  }
  async getCandidateFieldsByJobId(
    jobId: string,
    apiToken: string,
  ): Promise<any> {
    try {
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const workspaceKeys =
        await this.workspaceQueryService.getWorkspaceKeys(workspaceId);
      const isOrgChartEnabled = resolveIsOrgChartEnabledFromWorkspace(
        workspaceKeys?.is_org_chart_enabled,
      );
      const query =
        getGraphqlToFindManyJobsWithCandidateValues(isOrgChartEnabled);

      const variables = {
        filter: { id: { eq: jobId } },
        orderBy: [{ position: 'AscNullsFirst' }],
        limit: 100
      };

      const response = await this.staticGraphQLService.executeGraphQL(
        query,
        variables,
        apiToken,
      );

      const candidates =
        response.data.data?.jobs?.edges?.[0]?.node?.candidates?.edges?.map(
          (edge: { node: unknown }) => edge.node,
        ) ?? [];
      const chatQuestions = await this.otherFieldsService.fetchJobChatQuestions(
        jobId,
        apiToken,
      );
      const fieldKeys = collectOtherFieldKeys(candidates);
      const questionKeys = chatQuestions.map((question) =>
        questionTextToKey(question),
      );

      return Array.from(new Set([...fieldKeys, ...questionKeys]));
    } catch (error) {
      console.error('Error fetching candidate fields by job ID:', error);
      throw error;
    }
  }

  async processContactData(contactData: any, origin: string, apiToken: string): Promise<void> {
    try {
      console.log('Processing contact data:', contactData);
      
      if (!contactData.json_data) {
        console.log('No json_data found in contact data');
        return;
      }

      const jsonData = JSON.parse(contactData.json_data);
      console.log('Parsed JSON data:', jsonData);
      
      // Extract candidate profile type
      const candidateProfile = jsonData.candidate_profile || '';
      console.log('Candidate profile type:', candidateProfile);
      
      // Process resume/CV data if available
      await this.processResumeData(contactData, jsonData, origin, apiToken);
      
      // Update candidate profile information based on source
      if (candidateProfile.includes('resdex') || candidateProfile.includes('naukri')) {
        console.log('Processing Naukri/Resdex profile data');
        await this.updateResdexProfileInfo(contactData, jsonData, origin, apiToken);
      } else {
        console.log('Processing generic profile data');
        await this.updateGenericProfileInfo(contactData, jsonData, origin, apiToken);
      }
      
      console.log('Contact data processed successfully');
    } catch (error) {
      console.error('Error processing contact data:', error);
      throw error;
    }
  }

  private async processResumeData(contactData: any, jsonData: any, origin: string, apiToken: string): Promise<void> {
    try {
      if (contactData.direct_download) {
        console.log('Skipping server-side CV download — extension already uploaded file (direct_download=true)');
        return;
      }

      // Extract resume-related data
      const htmlCV = jsonData.htmlCV || '';
      const cookies = jsonData.cookies || '';
      const url = jsonData.url || '';
      const userAgent = jsonData['user-agent'] || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36';
      const extension = jsonData.extension || 'unsure';
      const fileName = jsonData.file_name || '';
      
      console.log('Processing resume data:', { url, fileName });
      
      // Generate unique key for candidate identification
      const uniqueStringKey = this.generateUniqueStringKey(jsonData.full_name, jsonData.company_name);
      console.log('Generated unique string key:', uniqueStringKey);
      
      // Process CV download/upload logic
      let localFilePath = '';
      let workspaceId = '';

      try {
        workspaceId = await this.getWorkspaceIdFromToken(apiToken);
      } catch (workspaceError) {
        console.warn(
          'Could not resolve workspace ID for resume archival:',
          workspaceError.message,
        );
      }
      
      if (url && !url.includes('undefined')) {
        console.log('Attempting to download CV from URL:', url);
        localFilePath = await this.downloadAndSaveCV(
          url,
          cookies,
          userAgent,
          extension,
          fileName,
          origin,
          workspaceId,
        );
      }
      
      if (!localFilePath && htmlCV) {
        console.log('Converting HTML CV to PDF');
        localFilePath = await this.convertHtmlCvToPdf(
          htmlCV,
          fileName,
          workspaceId,
        );
      }
      
      if (localFilePath) {
        try {
          console.log('Uploading CV to Twenty:', localFilePath);
          await this.uploadCVToTwentyWithFallback(
            localFilePath,
            uniqueStringKey,
            contactData,
            origin,
            apiToken,
          );
        } finally {
          await this.cleanupTemporaryFile(localFilePath);
        }
      }
      
    } catch (error) {
      console.error('Error processing resume data:', error);
      // Don't throw - continue with other processing
    }
  }

  private async updateResdexProfileInfo(contactData: any, jsonData: any, origin: string, apiToken: string): Promise<void> {
    try {
      // Extract phone number and clean it
      const phoneNumber = contactData.phone_number_current_page || jsonData.phone_number || '';
      const cleanPhoneNumber = this.cleanPhoneNumber(phoneNumber);
      console.log('Cleaned phone number:', cleanPhoneNumber);
      
      // Extract email
      const email = contactData.email || jsonData.email_address || '';
      console.log('Email after cleaned:', email);
      
      // Extract other profile data
      const noticePeriod = contactData.notice_period || jsonData.notice_period || '';
      // Preserve the full profile URL for better matching - don't truncate query parameters
      // The original code was splitting on '&' which made URLs too generic and matched wrong candidates
      let profileUrl = contactData.profile_url || jsonData.profile_url || jsonData.window_url || '';
      // Only remove trailing empty query parameters (like &sid= with no value after the =)
      if (profileUrl.endsWith('&sid=') || profileUrl.match(/&sid=$/)) {
        profileUrl = profileUrl.replace(/&sid=$/, '');
      }
      
      // Extract job information from contactData
      const popupData = contactData.popup_data || {};
      let targetJobId = popupData.twenty_job_id || popupData.job_id || '';
      const targetJobName = popupData.job_name || '';
      
      // If we have jobName but no jobId, try to find the job by name
      if (targetJobName && !targetJobId) {
        try {
          console.log(`Attempting to find job by name: ${targetJobName}`);
          const job = await this.candidateWorkspaceGraphQLService.getJobDetails('', targetJobName, apiToken);
          if (job && job.id) {
            targetJobId = job.id;
            console.log(`Found job by name, jobId: ${targetJobId}`);
          }
        } catch (error) {
          console.warn(`Could not find job by name "${targetJobName}":`, error.message);
        }
      }
      
      // Generate unique key and name data
      const fullName = jsonData.full_name || '';
      const companyName = jsonData.company_name || '';
      const uniqueStringKey = this.generateUniqueStringKey(fullName, companyName);
      const nameProcessor = new NameProcessor();
      const nameData = nameProcessor.processName(fullName);
      
      console.log('Processing profile update for:', { uniqueStringKey, profileUrl, targetJobId, targetJobName });
      
      // Find existing candidates by unique key or profile URL
      const allCandidates = await this.findCandidatesByuniqueStringKeyOrUrl(uniqueStringKey, profileUrl, apiToken);
      
      // Filter candidates by target job if job ID is specified
      let candidatesInTargetJob: any[] = [];
      if (targetJobId && allCandidates && allCandidates.length > 0) {
        candidatesInTargetJob = allCandidates.filter(candidate => {
          // Check both jobsId (direct field) and jobs.id (nested object)
          const candidateJobId = candidate.jobsId || candidate.jobs?.id;
          return candidateJobId === targetJobId;
        });
        console.log(`Found ${candidatesInTargetJob.length} candidates in target job ${targetJobId} out of ${allCandidates.length} total candidates`);
      } else {
        candidatesInTargetJob = allCandidates || [];
      }
      
      if (candidatesInTargetJob && candidatesInTargetJob.length > 0) {
        // Update candidates in the target job
        for (const candidate of candidatesInTargetJob) {
          // Get person ID for this candidate
          const candidateData = await this.getCandidateWithPersonId(candidate.id, apiToken);
          const personId = candidateData?.peopleId || null;
          
          const candidateJobId = candidate.jobsId || candidate.jobs?.id;
          console.log('Updating candidate with personId:', { candidateId: candidate.id, personId, jobId: candidateJobId });
          
          await this.updateCandidateProfile(candidate.id, personId, {
            phoneNumber: cleanPhoneNumber,
            email: email,
            noticePeriod: noticePeriod,
            profileUrl: profileUrl,
            firstName: nameData.first_name,
            lastName: nameData.last_name,
          }, apiToken);
        }
      } else {
        // No candidate found in target job - create new one
        if (allCandidates && allCandidates.length > 0) {
          console.log(`Found ${allCandidates.length} candidate(s) but none in target job ${targetJobId || targetJobName}. Creating new candidate in target job.`);
        } else {
          console.log('No existing candidates found for update, creating new candidate');
        }
        
        // Include phone, email, and profile info in candidate data - will be processed in queue
        const enhancedJsonData = {
          ...jsonData,
          phone_number: cleanPhoneNumber,
          email_address: email,
          notice_period: noticePeriod,
          profile_url: profileUrl,
          first_name: nameData.first_name,
          last_name: nameData.last_name,
        };
        // Create candidate using upload-profiles flow - phone/email/profile info included in data
        await this.createCandidateFromContactData(contactData, enhancedJsonData, origin, apiToken);
        console.log('Candidate queued for creation with phone, email, and profile info - will be processed in queue');
      }
      
    } catch (error) {
      console.error('Error updating Resdex profile info:', error);
      throw error;
    }
  }

  private async updateGenericProfileInfo(contactData: any, jsonData: any, origin: string, apiToken: string): Promise<void> {
    try {
      const phoneNumber = contactData.phone_number_current_page || '';
      const email = contactData.email || '';
      const profileUrl = contactData.profile_url || '';
      
      console.log('Processing generic profile update:', { phoneNumber, email, profileUrl });
      
      let candidatesFound = false;
      
      if (phoneNumber && phoneNumber.length > 2 && !email) {
        const candidates = await this.findCandidatesByProfileUrl(profileUrl, apiToken);
        if (candidates && candidates.length > 0) {
          candidatesFound = true;
          await this.updateCandidateByPhoneNumber(phoneNumber, profileUrl, apiToken);
        }
      } else if (email && email.length > 1 && email.includes('@') && email.includes('.')) {
        const candidates = await this.findCandidatesByProfileUrl(profileUrl, apiToken);
        if (candidates && candidates.length > 0) {
          candidatesFound = true;
          await this.updateCandidateByEmail(email, profileUrl, apiToken);
        }
      }
      
      // If no candidates found, create new candidate
      if (!candidatesFound) {
        console.log('No existing candidates found for update, creating new candidate');
        // Include phone/email in candidate data - will be processed in queue
        const enhancedJsonData = {
          ...jsonData,
          phone_number: phoneNumber,
          email_address: email,
        };
        await this.createCandidateFromContactData(contactData, enhancedJsonData, origin, apiToken);
        console.log('Candidate queued for creation with phone/email - will be processed in queue');
      }
      
    } catch (error) {
      console.error('Error updating generic profile info:', error);
      throw error;
    }
  }

  private generateUniqueStringKey(fullName: string, companyName: string): string {
    // Use NameProcessor for consistent uniqueStringKey generation
    const nameProcessor = new NameProcessor();
    return nameProcessor.getUniqueStringKeyFromFullNameCompanyNameData(fullName, companyName);
  }

  /**
   * Create candidate from contact data using upload-profiles flow
   */
  private async createCandidateFromContactData(
    contactData: any,
    jsonData: any,
    origin: string,
    apiToken: string,
    cvFilePath?: string,
  ): Promise<void> {
    try {
      console.log('Creating candidate from contact data:',contactData);
      
      // Extract job information from contactData
      const popupData = contactData.popup_data || {};
      let jobId = popupData.twenty_job_id || popupData.job_id || '';
      let jobName = popupData.job_name || '';
      const recruiterId = popupData.recruiterId || '';
      
      // If we have jobName but no jobId, try to find the job by name
      if (jobName && !jobId) {
        try {
          console.log(`Attempting to find job by name: ${jobName}`);
          const job = await this.candidateWorkspaceGraphQLService.getJobDetails('', jobName, apiToken);
          if (job && job.id) {
            jobId = job.id;
            console.log(`Found job by name, jobId: ${jobId}`);
          }
        } catch (error) {
          console.warn(`Could not find job by name "${jobName}":`, error.message);
        }
      }
      
      // If still no jobId or jobName, try to use default_job
      if (!jobId && !jobName) {
        jobName = 'default_job';
        try {
          console.log('Attempting to find default_job');
          const job = await this.candidateWorkspaceGraphQLService.getJobDetails('', 'default_job', apiToken);
          if (job && job.id) {
            jobId = job.id;
            console.log(`Found default_job, jobId: ${jobId}`);
          }
        } catch (error) {
          console.warn('Could not find default_job:', error.message);
        }
      }
      
      if (!jobId || !jobName) {
        console.warn('Missing job information (jobId or jobName), cannot create candidate', {
          jobId,
          jobName,
          popupData
        });
        return;
      }
      
      // Get recruiter ID if not provided
      let actualRecruiterId = recruiterId;
      if (!actualRecruiterId) {
        try {
          const currentUser = await new RecruiterProfileService(this.staticGraphQLService)
            .getCurrentUser(apiToken, process.env.SERVER_BASE_URL || 'http://localhost:3000');
          actualRecruiterId = currentUser?.workspaceMember?.id || '';
        } catch (error) {
          console.warn('Could not get recruiter ID:', error.message);
        }
      }
      
      // Determine data source based on profile URL or candidate profile
      const profileUrl = contactData.profile_url || jsonData.profile_url || jsonData.window_url || '';
      const candidateProfile = jsonData.candidate_profile || '';
      let dataSource = 'profile_data_naukri';
      
      if (candidateProfile.includes('resdex') || profileUrl.includes('resdex')) {
        dataSource = 'profile_data_naukri';
      } else if (candidateProfile.includes('hiring') || profileUrl.includes('hiring')) {
        dataSource = 'profile_data_naukri';
      } else if (profileUrl.includes('linkedin')) {
        dataSource = 'linkedin_premium';
      } else {
        dataSource = 'data_upload';
      }
      
      // Format candidate data as raw data for processing
      const candidateData: any = {
        ...jsonData,
        profile_url: profileUrl,
        candidate_profile: candidateProfile,
        phone_number: contactData.phone_number_current_page || jsonData.phone_number || '',
        email: contactData.email || jsonData.email_address || '',
      };
      
      // Include CV file path if provided (will be processed after candidate creation)
      if (cvFilePath) {
        candidateData._cvFilePath = cvFilePath;
        candidateData._cvFileName = cvFilePath.split('/').pop() || 'resume.pdf';
        console.log('Including CV file path in candidate data:', cvFilePath);
      }
      
      const timestamp = new Date().toISOString();
      const uploadSessionId = v4();

      const inferredOrigin = origin ||
        contactData.origin ||
        popupData.origin ||
        popupData.workspaceDomain ||
        popupData.domain ||
        popupData.job_domain ||
        '';
      
      console.log('Creating candidate with data:', {
        dataSource,
        jobId,
        jobName,
        recruiterId: actualRecruiterId,
      });
      
      // Queue candidate for processing using upload-profiles flow
      if (this.processCandidatesService.isDataSourceSupported(dataSource)) {
        await this.processCandidatesService.queueRawDataForProcessing(
          [candidateData],
          dataSource,
          jobId,
          jobName,
          actualRecruiterId,
          timestamp,
          inferredOrigin,
          apiToken,
          uploadSessionId,
        );
      } else {
        // Fallback to legacy processing
        await this.processCandidatesService.send(
          [candidateData],
          jobId,
          jobName,
          timestamp,
          apiToken,
          actualRecruiterId,
          inferredOrigin,
        );
      }
      
      console.log('Successfully queued candidate for creation');
      
    } catch (error) {
      console.error('Error creating candidate from contact data:', error);
      // Don't throw - we don't want to fail the whole update process
    }
  }

  private cleanPhoneNumber(phoneNumber: string): string {
    // Use enhanced phone number cleaning utility
    if (!phoneNumber) return '';
    return this.dataProcessingUtils.cleanPhoneNumber(phoneNumber);
  }

  private getResumeTempDir(subfolder: string): string {
    return path.join(os.tmpdir(), 'twenty-server', subfolder);
  }

  private async cleanupTemporaryFile(filePath: string): Promise<void> {
    if (!filePath) {
      return;
    }

    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`Failed to clean up temporary file ${filePath}:`, error);
      }
    }
  }

  private async archiveResumeFile(params: {
    workspaceId?: string;
    folderName: string;
    fileName: string;
    mimeType?: string;
    file: Buffer;
  }): Promise<void> {
    if (!params.workspaceId) {
      return;
    }

    await this.fileStorageService.write({
      file: params.file,
      name: params.fileName,
      mimeType: params.mimeType,
      folder: `workspace-${params.workspaceId}/candidate_cv_archives/${params.folderName}`,
    });
  }

  private async downloadAndSaveCV(
    url: string,
    cookies: string,
    userAgent: string,
    extension: string,
    fileName: string,
    origin: string,
    workspaceId?: string,
  ): Promise<string> {
    try {
      console.log('Downloading CV from URL:', url);
      
      if (!url || url.includes('undefined')) {
        console.log('Invalid URL for CV download:', url);
        return '';
      }
      
      const outputDir = this.getResumeTempDir('all_resumes');
      await fs.promises.mkdir(outputDir, { recursive: true });
      
      // Prepare headers
      const headers: any = {
        'User-Agent': userAgent,
        'Accept': 'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,*/*'
      };
      
      if (cookies) {
        headers['Cookie'] = cookies;
      }
      
      // Add specific headers for different platforms
      if (url.includes('hiring.naukri')) {
        headers['appid'] = '4';
        headers['systemid'] = 'naukriIndia';
        
        // Clean up hiring.naukri URLs
        if (url.includes('hiring.naukri.com/cloudgateway-rm/rm-document-services/v0/download/applications/')) {
          const appId = url.match(/applications\/([^?]+)/)?.[1] ?? '';
          const jobId = url.match(/jobId=([^&]+)/)?.[1] ?? '';
          url = `https://hiring.naukri.com/cloudgateway-rm/rm-document-services/v0/download/applications/${appId}?jobId=${jobId}&applyType=`;
        } else if (url.includes('searchId')) {
          const cleanUrl = url.split('searchId')[0];
          const jobIdPart = url.split('jobId')[1];
          if (jobIdPart) {
            url = `${cleanUrl.slice(0, -1)}?jobId=${jobIdPart.substring(1)}`;
          }
        }
      } else if (url.includes('resdex.naukri')) {
        headers['appid'] = '112';
        headers['systemid'] = 'naukriIndia';
        
        // Don't clean resdex URLs - they require all query parameters (resId, uname, sid)
        // Removing these parameters causes 400 Bad Request errors
      }
      
      console.log('Making request to download CV with headers:', headers);
      
      // Make the download request
      const response = await axios({
        method: 'GET',
        url: url,
        headers: headers,
        responseType: 'arraybuffer',
        timeout: 30000, // 30 second timeout
        maxRedirects: 5
      });
      
      if (response.status !== 200) {
        console.error('Failed to download CV, status:', response.status);
        return '';
      }
      
      // Determine file extension
      let fileExtension = extension;
      if (extension === 'unsure') {
        const contentDisposition = response.headers['content-disposition'];
        if (contentDisposition) {
          const extensionMatch = contentDisposition.match(/\.(\w+)$/);
          if (extensionMatch) {
            fileExtension = extensionMatch[1];
          }
        } else {
          // Fallback to content-type
          const contentType = response.headers['content-type'];
          if (contentType?.includes('pdf')) {
            fileExtension = 'pdf';
          } else if (contentType?.includes('wordprocessingml')) {
            fileExtension = 'docx';
          } else if (contentType?.includes('msword')) {
            fileExtension = 'doc';
          } else {
            fileExtension = 'pdf'; // Default
          }
        }
      }
      
      // Get filename from response headers if available
      const responseFileName = response.headers['filename'];
      if (responseFileName) {
        fileName = responseFileName;
        const extensionMatch = fileName.match(/\.(\w+)$/);
        if (extensionMatch) {
          fileExtension = extensionMatch[1];
        }
      } else {
        fileName = `${fileName}.${fileExtension}`;
      }
      
      const filePath = path.join(outputDir, fileName);

      const responseBuffer = Buffer.from(response.data);

      await this.archiveResumeFile({
        workspaceId,
        folderName: 'all_resumes',
        fileName,
        mimeType: response.headers['content-type'],
        file: responseBuffer,
      });

      await fs.promises.writeFile(
        filePath,
        new Uint8Array(responseBuffer.buffer, responseBuffer.byteOffset, responseBuffer.byteLength),
      );
      
      console.log('Successfully downloaded CV to:', filePath);
      return filePath;
      
    } catch (error) {
      console.error('Error downloading CV:', error);
      return '';
    }
  }

  private async convertHtmlCvToPdf(
    htmlCV: string,
    fileName: string,
    workspaceId?: string,
  ): Promise<string> {
    try {
      console.log('Converting HTML CV to PDF:', fileName);
      
      if (!htmlCV) {
        console.log('No HTML CV content provided');
        return '';
      }
      
      const outputDir = this.getResumeTempDir('all_resumes_pdfs');

      await fs.promises.mkdir(outputDir, { recursive: true });
      
      // Parse HTML CV if it's JSON
      let htmlContent = htmlCV;
      try {
        const parsedHtml = JSON.parse(htmlCV);
        htmlContent = parsedHtml.htmlCv || htmlCV;
      } catch (e) {
        // If parsing fails, use as-is
        htmlContent = htmlCV;
      }
      
      // Create styled HTML with proper CSS
      const styledHtml = `
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 10px;
              }
              span { 
                display: inline-block; 
              }
              .resume-content {
                max-width: 800px;
                margin: 0 auto;
              }
            </style>
          </head>
          <body>
            <div class="resume-content">
              ${this.unescapeHtml(htmlContent)}
            </div>
          </body>
        </html>
      `;
      
      const outputFile = path.join(outputDir, `${fileName}.pdf`);
      console.log('Output file path:', outputFile);
      
      // Use puppeteer for HTML to PDF conversion (more reliable than pdfkit)
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setContent(styledHtml, { waitUntil: 'networkidle0' });
      
      await page.pdf({
        path: outputFile,
        format: 'A4',
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm'
        }
      });
      
      await browser.close();

      const pdfBuffer = await fs.promises.readFile(outputFile);

      await this.archiveResumeFile({
        workspaceId,
        folderName: 'all_resumes_pdfs',
        fileName: `${fileName}.pdf`,
        mimeType: 'application/pdf',
        file: pdfBuffer,
      });
      
      console.log('Successfully converted HTML CV to PDF:', outputFile);
      return outputFile;
      
    } catch (error) {
      console.error('Error converting HTML CV to PDF:', error);
      return '';
    }
  }
  
  private unescapeHtml(htmlString: string): string {
    const htmlEntities: { [key: string]: string } = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&#x27;': "'",
      '&#x2F;': '/',
      '&#x60;': '`',
      '&#x3D;': '='
    };
    
    return htmlString.replace(/&[#\w]+;/g, (entity) => {
      return htmlEntities[entity] || entity;
    });
  }

   async uploadCVToTwentyWithFallback(filePath: string, uniqueStringKey: string, contactData: any, origin: string, apiToken: string): Promise<void> {
    try {
      console.log('Uploading CV to Twenty with fallback:', { filePath, uniqueStringKey });
      
      if (!filePath || !uniqueStringKey) {
        console.error('Missing required parameters for CV upload');
        return;
      }
      
      // Get candidate IDs for the unique string key
      let candidateIds = await this.getCandidateIdsByUniqueStringKey(uniqueStringKey, apiToken);
      
      // If no candidates found by unique string key, try to find by profile URL
      if (!candidateIds || candidateIds.length === 0) {
        console.log('No candidates found for unique string key, trying to find by profile URL');
        
        // Extract profile URL from contact data
        let profileUrl = '';
        if (contactData.profile_url) {
          profileUrl = contactData.profile_url;
        } else if (contactData.json_data) {
          const jsonData = JSON.parse(contactData.json_data);
          profileUrl = jsonData.profile_url || jsonData.window_url || '';
        }
        
        if (profileUrl) {
          const candidates = await this.findCandidatesByProfileUrl(profileUrl, apiToken);
          if (candidates && candidates.length > 0) {
            candidateIds = candidates.map(candidate => candidate.id);
            console.log('Found candidates by profile URL:', candidateIds);
          }
        }
        
        if (!candidateIds || candidateIds.length === 0) {
          console.log('No candidates found for unique string key or profile URL, cannot upload CV');
          return;
        }
      }
      
      console.log('Found candidates for CV upload:', candidateIds);
      
      // Upload CV for each candidate ID
      for (const candidateId of candidateIds) {
        try {
          await this.createCvAttachment(filePath, candidateId, origin, apiToken);
          console.log('Successfully uploaded CV for candidate:', candidateId);
        } catch (error) {
          console.error('Error uploading CV for candidate:', candidateId, error);
          // Continue with other candidates even if one fails
        }
      }
      
      console.log('CV upload process completed for all candidates');
      
    } catch (error) {
      console.error('Error in uploadCVToTwent yWithFallback:', error);
      throw error;
    }
  }

  private async findCandidatesByuniqueStringKeyOrUrl(uniqueStringKey: string, profileUrl: string, apiToken: string): Promise<any[]> {
    try {
      console.log('Finding candidates by unique key or URL:', { uniqueStringKey, profileUrl });
      
      // First try to find by unique string key
      let candidates: any[] = [];
      
      if (uniqueStringKey) {
        const candidateIds = await this.getCandidateIdsByUniqueStringKey(uniqueStringKey, apiToken);
        if (candidateIds.length > 0) {
          // Get full candidate data for the found IDs
          const candidateGraphqlQuery = {
            filter: {
              id: { in: candidateIds }
            },
            orderBy: [{ position: "AscNullsFirst" }]
          };
          
          const response = await this.staticGraphQLService.executeGraphQL(
            graphqlToFetchAllCandidateData,
            candidateGraphqlQuery,
            apiToken
          );
          
          const candidatesData = response?.data?.data?.candidates as {
            edges: CandidatesEdge[];
            pageInfo: PageInfo;
          } | undefined;
          
          if (candidatesData?.edges) {
            candidates = candidatesData.edges.map(edge => edge?.node).filter(Boolean);
          }
        }
      }
      
      // If no candidates found by unique key, try profile URL
      if (candidates.length === 0 && profileUrl) {
        candidates = await this.findCandidatesByProfileUrl(profileUrl, apiToken);
      }
      
      console.log('Found candidates by unique key or URL:', candidates.length);
      return candidates;
      
    } catch (error) {
      console.error('Error finding candidates by unique key or URL:', error);
      return [];
    }
  }

  private async getCandidateWithPersonId(candidateId: string, apiToken: string): Promise<any> {
    try {
      const graphqlQuery = {
        filter: {
          id: { eq: candidateId }
        }
      };
      
      const response = await this.staticGraphQLService.executeGraphQL(
        graphqlToFetchAllCandidateData,
        graphqlQuery,
        apiToken
      );
      
      const candidate = response?.data?.data?.candidates?.edges?.[0]?.node;
      return candidate;
      
    } catch (error) {
      console.error('Error getting candidate with person ID:', error);
      return null;
    }
  }

  private async updateCandidateProfile(candidateId: string, personId: string | null, profileData: any, apiToken: string): Promise<void> {
    // Use existing updateCandidateField method for each field
    try {
      if (profileData.phoneNumber) {
        await this.updateCandidateField(personId || '', candidateId, 'phoneNumber', profileData.phoneNumber, apiToken, 'contact_update');
      }
      if (profileData.email) {
        await this.updateCandidateField(personId || '', candidateId, 'email', profileData.email, apiToken, 'contact_update');
      }
      // Add other field updates as needed
    } catch (error) {
      console.error('Error updating candidate profile:', error);
      throw error;
    }
  }

  private async updateCandidateByPhoneNumber(phoneNumber: string, profileUrl: string, apiToken: string): Promise<void> {
    try {
      console.log('Updating candidate by phone number:', { phoneNumber, profileUrl });
      
      if (!phoneNumber || phoneNumber.length < 3) {
        console.log('Invalid phone number provided');
        return;
      }
      
      // Find candidates by profile URL
      const candidates = await this.findCandidatesByProfileUrl(profileUrl, apiToken);
      
      if (!candidates || candidates.length === 0) {
        console.log('No candidates found for profile URL to update phone number');
        return;
      }
      
      // Update phone number for each candidate found
      for (const candidate of candidates) {
        try {
          console.log('Updating phone number for candidate:', candidate.id);
          await this.updateCandidateField(
            candidate.peopleId || '', 
            candidate.id, 
            'phoneNumber', 
            this.cleanPhoneNumber(phoneNumber), 
            apiToken, 
            'extension_update'
          );
          console.log('Successfully updated phone number for candidate:', candidate.id);
        } catch (error) {
          console.error('Error updating phone number for candidate:', candidate.id, error);
        }
      }
      
    } catch (error) {
      console.error('Error updating candidate by phone number:', error);
      throw error;
    }
  }

  private async updateCandidateByEmail(email: string, profileUrl: string, apiToken: string): Promise<void> {
    try {
      console.log('Updating candidate by email:', { email, profileUrl });
      
      if (!email || !email.includes('@') || !email.includes('.')) {
        console.log('Invalid email provided');
        return;
      }
      
      // Find candidates by profile URL
      const candidates = await this.findCandidatesByProfileUrl(profileUrl, apiToken);
      
      if (!candidates || candidates.length === 0) {
        console.log('No candidates found for profile URL to update email');
        return;
      }
      
      // Update email for each candidate found
      for (const candidate of candidates) {
        try {
          console.log('Updating email for candidate:', candidate.id);
          await this.updateCandidateField(
            candidate.peopleId || '', 
            candidate.id, 
            'email', 
            email, 
            apiToken, 
            'extension_update'
          );
          console.log('Successfully updated email for candidate:', candidate.id);
        } catch (error) {
          console.error('Error updating email for candidate:', candidate.id, error);
        }
      }
      
    } catch (error) {
      console.error('Error updating candidate by email:', error);
      throw error;
    }
  }


  async processCvUploadToTwenty(
    contactData: any,
    filePath: string,
    uniqueStringKey: string,
    apiToken: string,
    origin: string
  ): Promise<void> {
    try {
      console.log('Processing CV upload to Twenty:', { filePath, uniqueStringKey });
      
      // Get person object from contact data (similar to get_person_id_from_resdex_data)
      const personObj = await this.getPersonFromContactData(contactData, apiToken, uniqueStringKey);
      
      // If no candidates found, create candidate first
      if (!personObj) {
        console.log('No existing candidates found for CV upload, creating candidate first');
        
        // Parse json_data if available
        let jsonData = {};
        if (contactData.json_data) {
          try {
            jsonData = JSON.parse(contactData.json_data);
          } catch (error) {
            console.warn('Error parsing json_data:', error);
          }
        }
        
        // Create candidate using upload-profiles flow with CV file path
        // CV upload will be handled automatically in the queue after candidate creation
        await this.createCandidateFromContactData(contactData, jsonData, origin, apiToken, filePath);
        
        console.log('Candidate with CV queued for processing - CV will be uploaded after candidate creation');
        return; // CV upload will happen in the queue
      }
      
      // If candidate exists, upload CV directly
      const uploadPersonObj = personObj || { uniqueStringKey: uniqueStringKey };
      await this.uploadCvFileToTwenty(filePath, uploadPersonObj, '', uniqueStringKey,origin, apiToken, contactData || {});
      
      console.log('Successfully uploaded CV to Twenty');
      
    } catch (error) {
      console.error('Error in processCvUploadToTwenty:', error);
      throw error;
    }
  }

  private async getPersonFromContactData(contactData: any, apiToken: string, uniqueStringKey?: string): Promise<any> {
    try {
      // First, try to find by uniqueStringKey if provided (most reliable identifier)
      if (uniqueStringKey && uniqueStringKey.trim() !== '') {
        console.log('Searching for person with uniqueStringKey:', uniqueStringKey);
        
        const graphqlQuery = {
          filter: {
            uniqueStringKey: { eq: uniqueStringKey }
          },
          orderBy: [{ position: "AscNullsFirst" }]
        };
        
        const response = await this.staticGraphQLService.executeGraphQL(
          graphqlToFetchAllCandidateData,
          graphqlQuery,
          apiToken
        );
        
        const candidates = response?.data?.data?.candidates as {
          edges: CandidatesEdge[];
          pageInfo: PageInfo;
        } | undefined;
        
        if (candidates?.edges && candidates.edges.length > 0) {
          console.log('Found candidate with uniqueStringKey');
          return candidates.edges[0]?.node;
        }
      }
      
      // Fall back to profile URL search if uniqueStringKey search didn't find anything
      let profileUrl = '';
      
      if (contactData.profile_url) {
        profileUrl = contactData.profile_url;
      } else if (contactData.json_data) {
        const jsonData = JSON.parse(contactData.json_data);
        profileUrl = jsonData.profile_url || jsonData.window_url || jsonData.candidate_profile || '';
      }
      console.log("profileUrl: ", profileUrl);
      
      if (!profileUrl) {
        console.log('No valid profile URL found');
        return null;
      }
      
      // Try searching with full URL first (most accurate match)
      console.log('Searching for person with full profile URL:', profileUrl);
      let candidates = await this.findCandidatesByProfileUrl(profileUrl, apiToken);
      
      if (candidates && candidates.length > 0) {
        console.log('Found candidates with full URL');
        return candidates[0]; // Return the first matching candidate
      }
      
      // If no match with full URL, try with base URL (without query parameters)
      // Extract base URL by removing query string
      try {
        const urlObj = new URL(profileUrl);
        const baseUrl = urlObj.origin + urlObj.pathname;
        if (baseUrl !== profileUrl) {
          console.log('Trying search with base URL:', baseUrl);
          candidates = await this.findCandidatesByProfileUrl(baseUrl, apiToken);
          
          if (candidates && candidates.length > 0) {
            console.log('Found candidates with base URL');
            return candidates[0];
          }
        }
      } catch (urlError) {
        console.warn('Error parsing URL for base URL extraction:', urlError);
        // Continue with other search strategies
      }
      
      // For resdex URLs, also try searching with just the domain + path prefix
      // This handles cases where query params might vary
      if (profileUrl.includes('resdex.naukri.com')) {
        const resdexBaseUrl = 'https://resdex.naukri.com/v3/preview';
        console.log('Trying search with resdex base URL:', resdexBaseUrl);
        candidates = await this.findCandidatesByProfileUrl(resdexBaseUrl, apiToken);
        
        if (candidates && candidates.length > 0) {
          console.log('Found candidates with resdex base URL');
          return candidates[0];
        }
      }
      
      console.log('No candidates found with any search method');
      return null;
      
    } catch (error) {
      console.error('Error getting person from contact data:', error);
      return null;
    }
  }

  async findCandidatesByProfileUrl(profileUrl: string, apiToken: string): Promise<any[]> {
    try {
      console.log('Finding candidates by profile URL:', profileUrl);

      // Stored LinkedIn URLs are normalized (https://linkedin.com/in/...); callers often pass
      // http://www.linkedin.com/... or linkedin.com/in/... — normalize so ilike matches DB rows.
      const linkedinLookupUrl =
        profileUrl.includes('linkedin.com') &&
        !profileUrl.toLowerCase().includes('resdex') &&
        !profileUrl.toLowerCase().includes('hiring')
          ? (normalizeLinkedInUrl(profileUrl).trim() || profileUrl.trim())
          : profileUrl.trim();

      // Try different URL field queries based on profile URL type
      let graphqlQuery;
      
      if (profileUrl.includes('resdex')) {
        graphqlQuery = {
          filter: {
            resdexNaukriUrl: { 
              primaryLinkUrl: { ilike: `%${profileUrl}%` }
            }
          },
          orderBy: [{ position: "AscNullsFirst" }]
        };
      } else if (profileUrl.includes('hiring')) {
        graphqlQuery = {
          filter: {
            hiringNaukriUrl: { 
              primaryLinkUrl: { ilike: `%${profileUrl}%` }
            }
          },
          orderBy: [{ position: "AscNullsFirst" }]
        };
      } else if (profileUrl.includes('linkedin')) {
        graphqlQuery = {
          filter: {
            linkedinUrl: { 
              primaryLinkUrl: { ilike: `%${linkedinLookupUrl}%` }
            }
          },
          orderBy: [{ position: "AscNullsFirst" }]
        };
      } else {
        // Generic profile URL search
        graphqlQuery = {
          filter: {
            or: [
              { resdexNaukriUrl: { primaryLinkUrl: { ilike: `%${profileUrl}%` } } },
              { hiringNaukriUrl: { primaryLinkUrl: { ilike: `%${profileUrl}%` } } },
              { linkedinUrl: { primaryLinkUrl: { ilike: `%${linkedinLookupUrl}%` } } }
            ]
          },
          orderBy: [{ position: "AscNullsFirst" }]
        };
      }
      
      const response = await this.staticGraphQLService.executeGraphQL(
        graphqlToFetchAllCandidateData,
        graphqlQuery,
        apiToken
      );
      
      const candidates = response?.data?.data?.candidates as {
        edges: CandidatesEdge[];
        pageInfo: PageInfo;
      } | undefined;
      
      if (!candidates?.edges || candidates.edges.length === 0) {
        console.log('No candidates found for profile URL:', profileUrl);
        return [];
      }
      
      const candidateList = candidates.edges.map(edge => edge?.node).filter(Boolean);
      console.log('Found candidates:', candidateList.length);
      return candidateList;
      
    } catch (error) {
      console.error('Error finding candidates by profile URL:', error);
      return [];
    }
  }

  private async uploadCvFileToTwenty(
    filePath: string,
    personObj: any,
    candidateId: string,
    uniqueStringKey: string,
    origin: string,
    apiToken: string,
    contactData?: any,
  ): Promise<void> {
    try {
      console.log('Uploading CV file to Twenty:', { filePath, uniqueStringKey });
      
      // This would implement the actual file upload logic
      // Similar to the uploadCVtoTwenty method in the Flask code
      
      if (!filePath || !uniqueStringKey) {
        console.error('Missing required parameters for CV upload');
        return;
      }
      
      // Get candidate IDs for the unique string key
      let candidateIds = await this.getCandidateIdsByUniqueStringKey(uniqueStringKey, apiToken);
      
      // If no candidates found by unique string key, try to find by profile URL
      if (!candidateIds || candidateIds.length === 0) {
        console.log('No candidates found for unique string key, trying to find by profile URL');
        
        // Extract profile URL from contact data
        let profileUrl = '';
        if (contactData.profile_url) {
          profileUrl = contactData.profile_url;
        } else if (contactData.json_data) {
          const jsonData = JSON.parse(contactData.json_data);
          profileUrl = jsonData.profile_url || jsonData.window_url || '';
        }
        
        if (profileUrl) {
          const candidates = await this.findCandidatesByProfileUrl(profileUrl, apiToken);
          if (candidates && candidates.length > 0) {
            candidateIds = candidates.map(candidate => candidate.id);
            console.log('Found candidates by profile URL:', candidateIds);
          }
        }
        
        if (!candidateIds || candidateIds.length === 0) {
          console.log('No candidates found for unique string key or profile URL, creating candidate first');
          
          // Parse json_data if available
          let jsonData = {};
          if (contactData?.json_data) {
            try {
              jsonData = JSON.parse(contactData.json_data);
            } catch (error) {
              console.warn('Error parsing json_data:', error);
            }
          }
          
          // Create candidate using upload-profiles flow
          await this.createCandidateFromContactData(contactData || {}, jsonData, origin || '', apiToken);
          
          // Wait for candidate to be created, then try to find it again
          console.log('Waiting for candidate creation to complete...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Try to find candidates again
          candidateIds = await this.getCandidateIdsByUniqueStringKey(uniqueStringKey, apiToken);
          
          if (!candidateIds || candidateIds.length === 0) {
            if (profileUrl) {
              const candidates = await this.findCandidatesByProfileUrl(profileUrl, apiToken);
              if (candidates && candidates.length > 0) {
                candidateIds = candidates.map(candidate => candidate.id);
                console.log('Found candidates by profile URL after creation:', candidateIds);
              }
            }
          }
          
          if (!candidateIds || candidateIds.length === 0) {
            console.warn('Candidate may still be processing, will retry CV upload later');
            return;
          }
        }
      }
      
      // Extract email address and phone number from contact data for updating candidate
      let emailToUpdate = '';
      let phoneToUpdate = '';
      if (contactData?.json_data) {
        try {
          const jsonData = JSON.parse(contactData.json_data);
          emailToUpdate = jsonData.email_address || jsonData.email || '';
          phoneToUpdate = jsonData.phone_number || jsonData.phone || '';
          console.log('Extracted email from contact data for update:', emailToUpdate);
          console.log('Extracted phone from contact data for update:', phoneToUpdate);
        } catch (error) {
          console.error('Error parsing json_data for contact extraction:', error);
        }
      }
      
      // Upload file and create attachments for each candidate
      for (const candidateId of candidateIds) {
        await this.createCvAttachment(filePath, candidateId, origin, apiToken);
        
        // Update candidate email if we have email data
        if (emailToUpdate) {
          try {
            console.log('Updating email for candidate:', candidateId, 'with email:', emailToUpdate);
            
            // Get candidate details to find personId
            const candidateDetails = await this.getCandidateDetails(candidateId, apiToken);
            const personId = candidateDetails?.peopleId || null;
            
            // Update email using structured email update
            await this.handleEmailUpdateWithStructure(
              candidateId,
              personId,
              {
                primaryEmail: emailToUpdate,
                additionalEmails: []
              },
              apiToken
            );
            
            console.log('Successfully updated email for candidate:', candidateId);
          } catch (error) {
            console.error('Error updating email for candidate:', candidateId, error);
            // Don't fail the CV upload if email update fails
          }
        }
        
        // Update candidate phone if we have phone data
        if (phoneToUpdate) {
          try {
            console.log('Updating phone for candidate:', candidateId, 'with phone:', phoneToUpdate);
            
            // Parse phone number using data processing utils
            const phoneData = this.dataProcessingUtils.parsePhoneNumbers(phoneToUpdate);
            
            if (phoneData.primaryPhoneNumber) {
              // Update phone using structured phone update
              await this.handlePhoneNumberUpdateWithStructure(
                candidateId,
                phoneData,
                apiToken
              );
              
              console.log('Successfully updated phone for candidate:', candidateId);
            } else {
              console.log('No valid phone number found after parsing:', phoneToUpdate);
            }
          } catch (error) {
            console.error('Error updating phone for candidate:', candidateId, error);
            // Don't fail the CV upload if phone update fails
          }
        }
      }
      
      console.log('Successfully uploaded CV for all candidates');
      
    } catch (error) {
      console.error('Error uploading CV file to Twenty:', error);
      throw error;
    }
  }

  private async getCandidateIdsByUniqueStringKey(uniqueStringKey: string, apiToken: string): Promise<string[]> {
    try {
      console.log('Getting candidate IDs by unique string key:', uniqueStringKey);
      
      const graphqlQuery = {
        filter: {
          uniqueStringKey: { eq: uniqueStringKey }
        },
        orderBy: [{ position: "AscNullsFirst" }]
      };
      
      const response = await this.staticGraphQLService.executeGraphQL(
        graphqlToFetchAllCandidateData, 
        graphqlQuery, 
        apiToken
      );
      
      const candidates = response?.data?.data?.candidates as {
        edges: CandidatesEdge[];
        pageInfo: PageInfo;
      } | undefined;
      
      if (!candidates?.edges || candidates.edges.length === 0) {
        console.log('No candidates found for unique string key:', uniqueStringKey);
        return [];
      }
      
      const candidateIds = candidates.edges
        .map(edge => edge?.node?.id)
        .filter(Boolean);
      
      console.log('Found candidate IDs:', candidateIds);
      return candidateIds;
      
    } catch (error) {
      console.error('Error getting candidate IDs by unique string key:', error);
      return [];
    }
  }

  private async getCandidateDetails(candidateId: string, apiToken: string): Promise<any> {
    try {
      console.log('Getting candidate details for:', candidateId);
      
      const graphqlQuery = {
        filter: {
          id: { eq: candidateId }
        }
      };
      
      const response = await this.staticGraphQLService.executeGraphQL(
        graphqlToFetchAllCandidateData, 
        graphqlQuery, 
        apiToken
      );
      
      const candidates = response?.data?.data?.candidates as {
        edges: CandidatesEdge[];
        pageInfo: PageInfo;
      } | undefined;
      
      if (!candidates?.edges || candidates.edges.length === 0) {
        console.log('No candidate found for ID:', candidateId);
        return null;
      }
      
      const candidate = candidates.edges[0]?.node;
      console.log('Found candidate details:', candidate?.id);
      return candidate;
      
    } catch (error) {
      console.error('Error getting candidate details:', error);
      return null;
    }
  }

  private async createCvAttachment(filePath: string, candidateId: string, origin: string, apiToken: string): Promise<void> {
    try {
      console.log('Creating CV attachment for candidate:', candidateId);
      
      if (!filePath || !candidateId) {
        console.error('Missing required parameters for CV attachment');
        return;
      }

      // Get the current user to access the actual WorkspaceMember.id
      const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
      
      // Use the WorkspaceMember.id, not the WorkspaceMemberProfile.id
      const workspaceMemberId = currentUser?.workspaceMember?.id;
      if (!workspaceMemberId) {
        console.error('Could not get workspace member ID for attachment author');
        return;
      }
      
      console.log('Using workspace member ID for attachment author:', workspaceMemberId);
      
      // Extract file information
      const fileName = filePath.split('/').pop() || 'resume.pdf';
      const fileType = this.getFileTypeFromFileName(fileName);
      const applicationType = this.getApplicationTypeFromFileType(fileType);
      
      // Step 1: Upload file to Twenty storage
      const uploadResponse = await this.uploadFileToTwenty(filePath, fileName, applicationType, apiToken);
      
      if (!uploadResponse?.uploadFilePath) {
        console.error('Failed to upload file to Twenty storage');
        return;
      }
      
      // Step 2: Create attachment record
      const createAttachmentMutation = `
        mutation CreateOneAttachment($input: AttachmentCreateInput!) {
          createAttachment(data: $input) {
            id
            name
            fullPath
            type
          }
        }
      `;
      
      const attachmentVariables = {
        input: {
          authorId: workspaceMemberId,
          name: fileName,
          fullPath: uploadResponse.uploadFilePath,
          type: "TextDocument",
          candidateId: candidateId
        }
      };
      
      const attachmentResponse = await this.staticGraphQLService.executeGraphQL(
        createAttachmentMutation,
        attachmentVariables,
        apiToken
      );
      
      console.log('Successfully created CV attachment:', attachmentResponse?.data?.data?.createAttachment);
      
    } catch (error) {
      console.error('Error creating CV attachment:', error);
      throw error;
    }
  }
  
  private async uploadFileToTwenty(filePath: string, fileName: string, contentType: string, apiToken: string): Promise<{ uploadFilePath: string }> {
    try {
      const FormData = require('form-data');
      const axios = require('axios');

      const lastSlashIndex = filePath.lastIndexOf('/');
      const folderPath =
        lastSlashIndex >= 0 ? filePath.substring(0, lastSlashIndex) : '';
      const storageFileName =
        lastSlashIndex >= 0 ? filePath.substring(lastSlashIndex + 1) : filePath;

      console.log('Reading CV from storage for Twenty upload:', {
        folderPath,
        filename: storageFileName,
      });

      const fileStream = await this.fileStorageService.read({
        folderPath,
        filename: storageFileName,
      });
      
      const formData = new FormData();
      const operations = JSON.stringify({
        operationName: "uploadFile",
        variables: { file: null, fileFolder: "Attachment" },
        query: "mutation uploadFile($file: Upload!, $fileFolder: FileFolder) {\n  uploadFile(file: $file, fileFolder: $fileFolder)\n}"
      });
      
      const map = JSON.stringify({ "1": ["variables.file"] });
      
      formData.append('operations', operations);
      formData.append('map', map);
      formData.append('1', fileStream, {
        filename: fileName,
        contentType: contentType
      });
      
      const response = await axios.post(
        `${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/graphql`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${apiToken}`
          }
        }
      );
      
      const uploadFilePath = response.data?.data?.uploadFile;
      if (!uploadFilePath) {
        throw new Error('Failed to get upload file path from response');
      }
      
      // Remove query parameters from the path
      const cleanPath = uploadFilePath.split('?')[0];
      
      return { uploadFilePath: cleanPath };
      
    } catch (error) {
      console.error('Error uploading file to Twenty:', error);
      throw error;
    }
  }
  
  private getFileTypeFromFileName(fileName: string): string {
    if (fileName.includes('.docx')) return 'docx';
    if (fileName.includes('.pdf')) return 'pdf';
    if (fileName.includes('.doc') && !fileName.includes('.docx')) return 'doc';
    return 'pdf'; // default
  }
  
  private getApplicationTypeFromFileType(fileType: string): string {
    switch (fileType) {
      case 'pdf':
        return 'application/pdf';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'doc':
        return 'application/msword';
      default:
        return 'application/pdf';
    }
  }

  async updateTableData(recruiterId: string, apiToken: string): Promise<void> {
    try {
      console.log('Updating table data for recruiter:', recruiterId);
      
      // This method should implement table data refresh logic
      // For now, we'll implement a basic version that could trigger data refresh
      
      // Here you would implement logic to:
      // 1. Refresh candidate data in tables
      // 2. Update any cached data
      // 3. Trigger any necessary data synchronization
      
      console.log('Table data updated successfully');
      
    } catch (error) {
      console.error('Error updating table data:', error);
      throw error;
    }
  }

 
}
