import { useCallback, useState } from 'react';
import { MessagingChannel } from 'twenty-shared/arx';
import { isDefined } from 'twenty-shared/utils';

import {
  type OutreachCompanyRow,
  type OutreachStage,
  type OutreachPersonRow,
} from '@/outreach-home/types/outreach-home.types';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { outreachContextState } from '@/outreach-home/states/outreachContextState';

const parseEmployeeCount = (employees: string): number | undefined => {
  const parsed = Number.parseInt(employees.replace(/[^0-9]/g, ''), 10);

  return Number.isFinite(parsed) ? parsed : undefined;
};

const mapIcpFit = (icpFit: string): 'HIGH' | 'MEDIUM' | 'LOW' => {
  const normalized = icpFit.trim().toUpperCase();

  if (
    normalized === 'HIGH' ||
    normalized === 'MEDIUM' ||
    normalized === 'LOW'
  ) {
    return normalized;
  }

  return 'MEDIUM';
};

const mapCompanyStatusToOutreach = (status: string): string => {
  const normalized = status.trim().toLowerCase();

  if (normalized.includes('meeting')) {
    return 'MEETING_BOOKED';
  }

  if (normalized.includes('repl')) {
    return 'REPLIED';
  }

  if (normalized.includes('cover') || normalized.includes('reach')) {
    return 'COVERED';
  }

  return 'ADDED';
};

const mapPersonStageToCandidate = (
  stage: OutreachStage,
): {
  outreachSequenceStage: string;
  enrichStatus: string;
} => {
  switch (stage) {
    case 'needs_connection':
      return {
        outreachSequenceStage: 'NEEDS_CONNECTION',
        enrichStatus: 'NOT_STARTED',
      };
    case 'deferred':
      return {
        outreachSequenceStage: 'DEFERRED',
        enrichStatus: 'NOT_STARTED',
      };
    case 'stopped':
      return {
        outreachSequenceStage: 'STOPPED',
        enrichStatus: 'NOT_STARTED',
      };
    case 'connection_ignored':
      return {
        outreachSequenceStage: 'CONNECTION_IGNORED',
        enrichStatus: 'NOT_STARTED',
      };
    case 'inmail_sent':
      return {
        outreachSequenceStage: 'INMAIL_SENT',
        enrichStatus: 'NOT_STARTED',
      };
    case 'connection_sent':
      return {
        outreachSequenceStage: 'CONNECTION_SENT',
        enrichStatus: 'NOT_STARTED',
      };
    case 'profile_checked':
      return {
        outreachSequenceStage: 'PROFILE_CHECKED',
        enrichStatus: 'NOT_STARTED',
      };
    case 'warm_path':
      return {
        outreachSequenceStage: 'WARM_PATH',
        enrichStatus: 'NOT_STARTED',
      };
    case 'commented':
      return {
        outreachSequenceStage: 'COMMENTED',
        enrichStatus: 'NOT_STARTED',
      };
    case 'email_enriching':
      return {
        outreachSequenceStage: 'EMAIL_ENRICHING',
        enrichStatus: 'RUNNING',
      };
    case 'email_sent':
      return {
        outreachSequenceStage: 'EMAIL_SENT',
        enrichStatus: 'FOUND',
      };
    case 'replied':
      return {
        outreachSequenceStage: 'REPLIED',
        enrichStatus: 'FOUND',
      };
    case 'negotiating':
      return {
        outreachSequenceStage: 'NEGOTIATING',
        enrichStatus: 'FOUND',
      };
    case 'meeting_booked':
      return {
        outreachSequenceStage: 'MEETING_BOOKED',
        enrichStatus: 'FOUND',
      };
    case 'queued':
    default:
      return {
        outreachSequenceStage: 'QUEUED',
        enrichStatus: 'NOT_STARTED',
      };
  }
};

const normalizeDomain = (domain: string): string =>
  domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');

export const useAddOutreachRecordsToCrm = () => {
  const [isPersisting, setIsPersisting] = useState(false);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const outreachContext = useAtomStateValue(outreachContextState);
  const { createOneRecord: createCompany } = useCreateOneRecord({
    objectNameSingular: 'company',
  });
  const { createOneRecord: createPerson } = useCreateOneRecord({
    objectNameSingular: 'person',
  });
  const { createOneRecord: createCandidate } = useCreateOneRecord({
    objectNameSingular: 'candidate',
  });

  // Shared CRM companies — find by name for upsert (domain link label is not filterable reliably).
  const { records: existingCompanies } = useFindManyRecords<{
    id: string;
    name?: string;
    domainName?: { primaryLinkLabel?: string; primaryLinkUrl?: string } | null;
  }>({
    objectNameSingular: 'company',
    limit: 200,
    recordGqlFields: {
      id: true,
      name: true,
      domainName: true,
    },
  });

  const requireProjectId = (): string | null => {
    if (!isDefined(outreachContext.projectId)) {
      enqueueErrorSnackBar({
        message: 'Select or create a project before writing to CRM',
      });
      return null;
    }

    return outreachContext.projectId;
  };

  const findExistingCompanyId = useCallback(
    (company: Pick<OutreachCompanyRow, 'name' | 'domain'>): string | null => {
      const domain = normalizeDomain(company.domain);

      const match = existingCompanies.find((existing) => {
        const label = normalizeDomain(
          existing.domainName?.primaryLinkLabel ?? '',
        );
        const urlHost = normalizeDomain(
          existing.domainName?.primaryLinkUrl
            ?.replace(/^https?:\/\//, '')
            .split('/')[0] ?? '',
        );
        const nameMatch =
          (existing.name ?? '').trim().toLowerCase() ===
          company.name.trim().toLowerCase();

        return (
          (domain.length > 0 && (label === domain || urlHost === domain)) ||
          nameMatch
        );
      });

      return match?.id ?? null;
    },
    [existingCompanies],
  );

  // Upsert shared Company for an ephemeral target (no exclusive project tag).
  const ensureCrmCompany = useCallback(
    async (company: OutreachCompanyRow): Promise<string | null> => {
      const existingId = findExistingCompanyId(company);

      if (isDefined(existingId)) {
        return existingId;
      }

      const outreachFunnelStage = mapCompanyStatusToOutreach(company.status);

      const created = await createCompany({
        name: company.name,
        domainName: {
          primaryLinkUrl: `https://${company.domain}`,
          primaryLinkLabel: company.domain,
        },
        employees: parseEmployeeCount(company.employees),
        icpSegment: company.segment,
        icpFit: mapIcpFit(company.icpFit),
        outreachFunnelStage,
        peopleTargeted: 0,
        peopleReached: 0,
        coverageBucket: 'ZERO',
        attentionReason: 'NONE',
        coverageScore: 0,
        projectIds: outreachContext.projectId
          ? [outreachContext.projectId]
          : undefined,
      });

      return created?.id ?? null;
    },
    [createCompany, findExistingCompanyId, outreachContext.projectId],
  );

  const addPeopleToCrm = useCallback(
    async ({
      people,
      companiesByWorkingSetId,
    }: {
      people: OutreachPersonRow[];
      companiesByWorkingSetId?: Record<string, OutreachCompanyRow>;
    }) => {
      if (people.length === 0) {
        enqueueErrorSnackBar({
          message: 'Select at least one person to add to CRM',
        });
        return 0;
      }

      const projectId = requireProjectId();

      if (!isDefined(projectId)) {
        return 0;
      }

      setIsPersisting(true);

      try {
        let createdCount = 0;
        const companyIdCache = new Map<string, string>();

        for (const person of people) {
          const nameParts = person.name.trim().split(/\s+/);
          const firstName = nameParts[0] ?? '';
          const lastName = nameParts.slice(1).join(' ');
          const linkedinUrl = person.linkedinUrl.startsWith('http')
            ? person.linkedinUrl
            : `https://${person.linkedinUrl}`;
          const sequenceFields = mapPersonStageToCandidate(person.stage);

          let crmCompanyId: string | null = null;
          const ephemeralCompany = companiesByWorkingSetId?.[person.companyId];

          if (isDefined(ephemeralCompany)) {
            const cacheKey = ephemeralCompany.domain || ephemeralCompany.name;

            if (companyIdCache.has(cacheKey)) {
              crmCompanyId = companyIdCache.get(cacheKey) ?? null;
            } else {
              crmCompanyId = await ensureCrmCompany(ephemeralCompany);

              if (isDefined(crmCompanyId)) {
                companyIdCache.set(cacheKey, crmCompanyId);
              }
            }
          } else if (isNonEmptyCompanyName(person.companyName)) {
            const synthetic: OutreachCompanyRow = {
              id: person.companyId || person.companyName,
              name: person.companyName,
              domain: '',
              industry: '',
              employees: '',
              segment: '',
              icpFit: '',
              status: 'TARGET',
            };
            const cacheKey = synthetic.name;

            if (companyIdCache.has(cacheKey)) {
              crmCompanyId = companyIdCache.get(cacheKey) ?? null;
            } else {
              crmCompanyId = await ensureCrmCompany(synthetic);

              if (isDefined(crmCompanyId)) {
                companyIdCache.set(cacheKey, crmCompanyId);
              }
            }
          }

          const createdPerson = await createPerson({
            name: {
              firstName,
              lastName,
            },
            jobTitle: person.title,
            ...(isDefined(crmCompanyId) ? { companyId: crmCompanyId } : {}),
            ...(person.email ? { emails: { primaryEmail: person.email } } : {}),
            linkedinLink: {
              primaryLinkUrl: linkedinUrl,
              primaryLinkLabel: person.linkedinUrl.replace(/^https?:\/\//, ''),
            },
            doNotContact: person.doNotContact === true,
          });

          if (isDefined(createdPerson?.id)) {
            await createCandidate({
              name: person.name,
              jobTitle: person.title,
              jobCompanyName: person.companyName,
              ...(person.email
                ? { email: { primaryEmail: person.email } }
                : {}),
              linkedinUrl: {
                primaryLinkUrl: linkedinUrl,
                primaryLinkLabel: person.linkedinUrl.replace(
                  /^https?:\/\//,
                  '',
                ),
              },
              projectsId: projectId,
              peopleId: createdPerson.id,
              outreachSequenceStage: sequenceFields.outreachSequenceStage,
              enrichStatus: sequenceFields.enrichStatus,
              pendingChannel: person.pendingChannel ?? null,
              messagingChannel: MessagingChannel.LINKEDIN_CONNECT,
              campaign: projectId,
              source: 'outreach-home',
              candConversationStatus: 'ONLY_ADDED_NO_CONVERSATION',
            });
          }

          createdCount += 1;
        }

        enqueueSuccessSnackBar({
          message: `Added ${createdCount} ${createdCount === 1 ? 'person' : 'people'} to CRM`,
          options: {
            detailedMessage: `Candidates linked to Project ${projectId}; companies upserted when needed`,
          },
        });

        return createdCount;
      } catch (error) {
        enqueueErrorSnackBar({
          message:
            error instanceof Error
              ? error.message
              : 'Failed to add people to CRM',
        });
        return 0;
      } finally {
        setIsPersisting(false);
      }
    },
    [
      outreachContext.projectId,
      createCandidate,
      createPerson,
      enqueueErrorSnackBar,
      enqueueSuccessSnackBar,
      ensureCrmCompany,
    ],
  );

  return {
    isPersisting,
    addPeopleToCrm,
    ensureCrmCompany,
  };
};

const isNonEmptyCompanyName = (value: string | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;
