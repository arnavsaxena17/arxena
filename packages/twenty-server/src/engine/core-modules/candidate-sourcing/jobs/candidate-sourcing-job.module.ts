import { Module } from '@nestjs/common';
// import { ProcessCandidatesJob } from './process-candidates.job';
import { CandidateService } from '../services/candidate.service';
import { JobService } from '../services/job.service';
import { PersonService } from '../services/person.service';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';

@Module({
  providers: [
    // ProcessCandidatesJob,
    CandidateService,
    JobService,
    PersonService,
    WorkspaceQueryService,
    // {
    //   provide: ProcessCandidatesJob.name,
    //   useClass: ProcessCandidatesJob,
    // },
  ],
  exports: [CandidateService],
})
export class CandidateSourcingJobModule {}