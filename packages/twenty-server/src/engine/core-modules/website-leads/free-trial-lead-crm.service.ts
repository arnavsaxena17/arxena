import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { DatabaseEventAction } from 'src/engine/api/graphql/graphql-query-runner/enums/database-event-action';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { FieldActorSource } from 'src/engine/metadata-modules/field-metadata/composite-types/actor.composite-type';
import { ObjectMetadataEntity } from 'src/engine/metadata-modules/object-metadata/object-metadata.entity';
import { TwentyORMGlobalManager } from 'src/engine/twenty-orm/twenty-orm-global.manager';
import { WorkspaceEventEmitter } from 'src/engine/workspace-event-emitter/workspace-event-emitter';
import { CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';
import { OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';
import { PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';
import { v4 } from 'uuid';

import { FreeTrialLeadDto } from './dto/free-trial-lead.dto';

export type FreeTrialLeadCrmRecords = {
  companyId: string;
  personId: string;
  opportunityId: string;
};

@Injectable()
export class FreeTrialLeadCrmService {
  private readonly logger = new Logger(FreeTrialLeadCrmService.name);

  constructor(
    private readonly twentyORMGlobalManager: TwentyORMGlobalManager,
    private readonly environmentService: EnvironmentService,
    private readonly workspaceEventEmitter: WorkspaceEventEmitter,
    @InjectRepository(ObjectMetadataEntity, 'metadata')
    private readonly objectMetadataRepository: Repository<ObjectMetadataEntity>,
  ) {}

  private getWorkspaceId(): string | null {
    return this.environmentService.get('FREE_TRIAL_LEAD_WORKSPACE_ID') ?? null;
  }

  private parseLeadName(name: string): {
    firstName: string;
    lastName: string;
  } {
    const trimmedName = name.trim();
    const nameParts = trimmedName.split(/\s+/);

    if (nameParts.length === 1) {
      return { firstName: nameParts[0], lastName: '' };
    }

    return {
      firstName: nameParts[0],
      lastName: nameParts.slice(1).join(' '),
    };
  }

  private buildCompanyDomain(company: string, email: string): string {
    const emailDomain = email.split('@')[1]?.trim().toLowerCase();

    if (emailDomain) {
      return emailDomain;
    }

    return `${company.trim().toLowerCase().replace(/\s+/g, '')}.com`;
  }

  async createRecordsFromLead(
    lead: FreeTrialLeadDto,
  ): Promise<FreeTrialLeadCrmRecords | null> {
    const workspaceId = this.getWorkspaceId();

    if (!workspaceId) {
      this.logger.warn(
        'FREE_TRIAL_LEAD_WORKSPACE_ID is not configured; skipping CRM record creation',
      );

      return null;
    }

    const normalizedEmail = lead.email.trim().toLowerCase();
    const { firstName, lastName } = this.parseLeadName(lead.name);
    const companyName = lead.company.trim();
    const companyDomain = this.buildCompanyDomain(companyName, normalizedEmail);

    const companyRepository =
      await this.twentyORMGlobalManager.getRepositoryForWorkspace(
        workspaceId,
        CompanyWorkspaceEntity,
      );
    const personRepository =
      await this.twentyORMGlobalManager.getRepositoryForWorkspace(
        workspaceId,
        PersonWorkspaceEntity,
      );
    const opportunityRepository =
      await this.twentyORMGlobalManager.getRepositoryForWorkspace(
        workspaceId,
        OpportunityWorkspaceEntity,
      );

    let company = await companyRepository.findOne({
      where: { name: companyName },
    });

    if (!company) {
      company = await companyRepository.findOne({
        where: {
          domainName: {
            primaryLinkLabel: companyDomain,
          },
        },
      });
    }

    if (!company) {
      company = await companyRepository.save({
        id: v4(),
        name: companyName,
        domainName: {
          primaryLinkUrl: `https://${companyDomain}`,
          primaryLinkLabel: companyDomain,
        },
        createdBy: {
          source: FieldActorSource.SYSTEM,
          name: 'Website Free Trial',
        },
      });
    }

    let person = await personRepository.findOne({
      where: {
        emails: {
          primaryEmail: normalizedEmail,
        },
      },
    });

    if (!person) {
      const lastPersonPosition =
        (await personRepository.maximum('position')) ?? 0;

      person = await personRepository.save({
        id: v4(),
        name: {
          firstName,
          lastName,
        },
        emails: {
          primaryEmail: normalizedEmail,
          additionalEmails: null,
        },
        companyId: company.id,
        position: lastPersonPosition + 1,
        createdBy: {
          source: FieldActorSource.SYSTEM,
          name: 'Website Free Trial',
        },
      });
    }

    const opportunityName = `Free Trial — ${firstName} ${lastName} @ ${companyName}`;

    const existingOpportunity = await opportunityRepository.findOne({
      where: {
        name: opportunityName,
        pointOfContactId: person.id,
      },
    });

    if (existingOpportunity) {
      this.logger.log(
        `Reusing existing opportunity ${existingOpportunity.id} for ${normalizedEmail}`,
      );

      return {
        companyId: company.id,
        personId: person.id,
        opportunityId: existingOpportunity.id,
      };
    }

    const lastOpportunityPosition =
      (await opportunityRepository.maximum('position')) ?? 0;

    const opportunity = await opportunityRepository.save({
      id: v4(),
      name: opportunityName,
      stage: 'NEW',
      position: lastOpportunityPosition + 1,
      companyId: company.id,
      pointOfContactId: person.id,
      createdBy: {
        source: FieldActorSource.SYSTEM,
        name: 'Website Free Trial',
      },
    });

    const opportunityObjectMetadata =
      await this.objectMetadataRepository.findOne({
        where: {
          nameSingular: 'opportunity',
          workspaceId,
        },
      });

    if (opportunityObjectMetadata) {
      this.workspaceEventEmitter.emitDatabaseBatchEvent({
        objectMetadataNameSingular: 'opportunity',
        action: DatabaseEventAction.CREATED,
        events: [
          {
            recordId: opportunity.id,
            objectMetadata: opportunityObjectMetadata,
            properties: {
              after: opportunity,
            },
          },
        ],
        workspaceId,
      });
    }

    this.logger.log(
      `Created free trial CRM records for ${normalizedEmail}: company=${company.id}, person=${person.id}, opportunity=${opportunity.id}`,
    );

    return {
      companyId: company.id,
      personId: person.id,
      opportunityId: opportunity.id,
    };
  }
}
