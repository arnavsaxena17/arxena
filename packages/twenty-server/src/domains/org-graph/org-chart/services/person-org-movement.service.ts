import { Injectable } from '@nestjs/common';

import { ContactOutPersonOrgMovementService } from './contactout-person-org-movement.service';
import { CoreSignalPersonOrgMovementService } from './coresignal-person-org-movement.service';
import { PdlPersonOrgMovementService } from './pdl-person-org-movement.service';
import {
  ContactOutCompanyRef,
  CoreSignalCompanyRef,
  CoreSignalEmployeeApi,
  OrgMovementWindowId,
  PdlCompanyRef,
  PersonOrgMovementCompanyRef,
  PersonOrgMovementResult,
  PersonOrgMovementSource,
} from './person-org-movement.types';

export type {
  ContactOutCompanyRef,
  CoreSignalCompanyRef,
  CoreSignalEmployeeApi,
  OrgMovementCounts,
  OrgMovementWindowId,
  PdlCompanyRef,
  PersonOrgMovementCompanyRef,
  PersonOrgMovementResult,
  PersonOrgMovementSource,
  PersonOrgMovementWindowResult
} from './person-org-movement.types';

export type PersonOrgMovementOptions = {
  referenceDate?: Date;
  windows?: OrgMovementWindowId[];
  maxNamesPerDirection?: number;
  /** PDL only: titlecase names in responses. */
  titlecase?: boolean;
  /** ContactOut only: cap profiles scanned (1 search credit per profile). */
  maxScanProfiles?: number;
  /** ContactOut only: delay between paginated search calls (60 req/min for People Search). */
  throttleMs?: number;
  /**
   * CoreSignal only: `multi_source` (default) vs `employee_base` search/preview/collect URLs.
   * Overrides `CORESIGNAL_EMPLOYEE_API` when set.
   */
  coresignalEmployeeApi?: CoreSignalEmployeeApi;
};

/**
 * Unified entry for org movement metrics from [People Data Labs](https://docs.peopledatalabs.com/docs/person-search-api),
 * [CoreSignal](https://docs.coresignal.com/employee-api/multi-source-employee-api/elasticsearch-dsl) (multi-source or base employee via `coresignalEmployeeApi` / `CORESIGNAL_EMPLOYEE_API`), or
 * [ContactOut People Search](https://api.contactout.com/#people-search-api) (with client-side classification — see ContactOut service).
 */
@Injectable()
export class PersonOrgMovementService {
  constructor(
    private readonly pdlPersonOrgMovementService: PdlPersonOrgMovementService,
    private readonly coreSignalPersonOrgMovementService: CoreSignalPersonOrgMovementService,
    private readonly contactOutPersonOrgMovementService: ContactOutPersonOrgMovementService,
  ) {}

  isConfigured(source: PersonOrgMovementSource): boolean {
    if (source === 'pdl') {
      return this.pdlPersonOrgMovementService.isConfigured();
    }

    if (source === 'coresignal') {
      return this.coreSignalPersonOrgMovementService.isConfigured();
    }

    return this.contactOutPersonOrgMovementService.isConfigured();
  }

  async getPersonOrgMovements(
    ref: PersonOrgMovementCompanyRef,
    options?: PersonOrgMovementOptions,
  ): Promise<PersonOrgMovementResult> {
    if (ref.source === 'pdl') {
      const company = this.toPdlCompanyRef(ref);

      return this.pdlPersonOrgMovementService.getOrgJoinLeaveMovement(
        company,
        options,
      );
    }

    if (ref.source === 'coresignal') {
      const company = this.toCoreSignalCompanyRef(ref);

      return this.coreSignalPersonOrgMovementService.getOrgJoinLeaveMovement(
        company,
        {
          referenceDate: options?.referenceDate,
          windows: options?.windows,
          maxNamesPerDirection: options?.maxNamesPerDirection,
          employeeApi: options?.coresignalEmployeeApi,
        },
      );
    }

    const company = this.toContactOutCompanyRef(ref);

    return this.contactOutPersonOrgMovementService.getOrgJoinLeaveMovement(
      company,
      {
        referenceDate: options?.referenceDate,
        windows: options?.windows,
        maxNamesPerDirection: options?.maxNamesPerDirection,
        maxScanProfiles: options?.maxScanProfiles,
        throttleMs: options?.throttleMs,
      },
    );
  }

  private toPdlCompanyRef(
    ref: Extract<PersonOrgMovementCompanyRef, { source: 'pdl' }>,
  ): PdlCompanyRef {
    if (typeof ref.jobCompanyId === 'string') {
      return { jobCompanyId: ref.jobCompanyId };
    }

    return { jobCompanyName: ref.jobCompanyName };
  }

  private toCoreSignalCompanyRef(
    ref: Extract<PersonOrgMovementCompanyRef, { source: 'coresignal' }>,
  ): CoreSignalCompanyRef {
    if (typeof ref.companyId === 'number') {
      return { companyId: ref.companyId };
    }

    return { companyNameExact: ref.companyNameExact };
  }

  private toContactOutCompanyRef(
    ref: Extract<PersonOrgMovementCompanyRef, { source: 'contactout' }>,
  ): ContactOutCompanyRef {
    if ('companyName' in ref && typeof ref.companyName === 'string') {
      return { companyName: ref.companyName };
    }

    return { domain: ref.domain };
  }
}
