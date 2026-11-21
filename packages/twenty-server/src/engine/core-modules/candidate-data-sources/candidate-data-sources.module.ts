import { Module } from '@nestjs/common';

import { CandidateAvatarModule } from 'src/engine/core-modules/candidate-avatar/candidate-avatar.module';
import { ApifyLinkedInCompanyProfileTransformerService } from 'src/engine/core-modules/candidate-data-sources/services/data-sources/apify-linkedin-company-profile-transformer.service';
import { ApnaDatabaseTransformerService } from 'src/engine/core-modules/candidate-data-sources/services/data-sources/apna-database-transformer.service';
import { BaseDataSourceTransformerService } from 'src/engine/core-modules/candidate-data-sources/services/data-sources/base-data-source-transformer.service';
import { HiringNaukriTransformerService } from 'src/engine/core-modules/candidate-data-sources/services/data-sources/hiring-naukri-transformer.service';
import { LinkedinPremiumJobsTransformerService } from 'src/engine/core-modules/candidate-data-sources/services/data-sources/linkedin-premium-jobs-transformer.service';
import { LinkedinPremiumTransformerService } from 'src/engine/core-modules/candidate-data-sources/services/data-sources/linkedin-premium-transformer.service';
import { LinkedinRecruiterJobsTransformerService } from 'src/engine/core-modules/candidate-data-sources/services/data-sources/linkedin-recruiter-jobs-transformer.service';
import { LinkedInRecruiterPeopleTransformerService } from 'src/engine/core-modules/candidate-data-sources/services/data-sources/linkedin-recruiter-people-transformer.service';
import { LinkedinSalesNavigatorTransformerService } from 'src/engine/core-modules/candidate-data-sources/services/data-sources/linkedin-sales-navigator-transformer.service';
import { LinkedInSearchTransformerService } from 'src/engine/core-modules/candidate-data-sources/services/data-sources/linkedin-search-transformer.service';
import { LinkedinXrayTransformerService } from 'src/engine/core-modules/candidate-data-sources/services/data-sources/linkedin-xray-transformer.service';
import { NaukriProfileDataTransformerService } from 'src/engine/core-modules/candidate-data-sources/services/data-sources/naukri-profile-data-transformer.service';
import { ParsedCVTransformerService } from 'src/engine/core-modules/candidate-data-sources/services/data-sources/parsed-cv-transformer.service';
import { ResdexNaukriTransformerService } from 'src/engine/core-modules/candidate-data-sources/services/data-sources/resdex-naukri-transformer.service';
import { RmsNaukriTransformerService } from 'src/engine/core-modules/candidate-data-sources/services/data-sources/rms-naukri-transformer.service';
import { SpreadsheetImportTwentyTransformerService } from 'src/engine/core-modules/candidate-data-sources/services/data-sources/spreadsheet-import-twenty-transformer.service';
import { UploadedProfilesTransformerService } from 'src/engine/core-modules/candidate-data-sources/services/data-sources/uploaded-profiles-transformer.service';
import { DataSourceTransformerFactoryService } from 'src/engine/core-modules/candidate-data-sources/services/data-source-transformer-factory.service';
import { DataProcessingUtils } from 'src/engine/core-modules/candidate-data-sources/utils/data-processing.utils';

const TRANSFORMERS = [
  ResdexNaukriTransformerService,
  HiringNaukriTransformerService,
  LinkedinPremiumTransformerService,
  SpreadsheetImportTwentyTransformerService,
  RmsNaukriTransformerService,
  ApnaDatabaseTransformerService,
  NaukriProfileDataTransformerService,
  UploadedProfilesTransformerService,
  LinkedinRecruiterJobsTransformerService,
  LinkedInRecruiterPeopleTransformerService,
  LinkedinPremiumJobsTransformerService,
  LinkedinSalesNavigatorTransformerService,
  LinkedInSearchTransformerService,
  LinkedinXrayTransformerService,
  ParsedCVTransformerService,
];

// Spreadsheet/CSV source normalisation has no dependency on the rest of
// candidate sourcing, so it is its own leaf module instead of being copied
// provider-by-provider into every module that imports a spreadsheet.
@Module({
  imports: [CandidateAvatarModule],
  providers: [
    DataProcessingUtils,
    BaseDataSourceTransformerService,
    ApifyLinkedInCompanyProfileTransformerService,
    ...TRANSFORMERS,
    DataSourceTransformerFactoryService,
  ],
  exports: [
    DataProcessingUtils,
    BaseDataSourceTransformerService,
    ApifyLinkedInCompanyProfileTransformerService,
    ...TRANSFORMERS,
    DataSourceTransformerFactoryService,
  ],
})
export class CandidateDataSourcesModule {}
