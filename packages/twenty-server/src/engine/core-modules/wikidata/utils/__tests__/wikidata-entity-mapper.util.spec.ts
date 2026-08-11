import {
  mapWikidataEntityToCompanyProfile,
  scoreWikidataCompanyCandidate,
} from 'src/engine/core-modules/wikidata/utils/wikidata-entity-mapper.util';
import { type WikidataEntity } from 'src/engine/core-modules/wikidata/types/wikidata-company.types';

const buildEntity = ({
  id,
  label,
  description,
  website,
  instanceOf,
  parentOrganization,
}: {
  id: string;
  label: string;
  description?: string;
  website?: string;
  instanceOf?: string[];
  parentOrganization?: string[];
}): WikidataEntity => ({
  id,
  labels: { en: { language: 'en', value: label } },
  descriptions: description
    ? { en: { language: 'en', value: description } }
    : undefined,
  claims: {
    ...(website
      ? {
          P856: [
            {
              mainsnak: {
                datavalue: { type: 'string', value: website },
              },
            },
          ],
        }
      : {}),
    ...(instanceOf
      ? {
          P31: instanceOf.map((entityId) => ({
            mainsnak: {
              datavalue: {
                type: 'wikibase-entityid',
                value: { id: entityId },
              },
            },
          })),
        }
      : {}),
    ...(parentOrganization
      ? {
          P749: parentOrganization.map((entityId) => ({
            mainsnak: {
              datavalue: {
                type: 'wikibase-entityid',
                value: { id: entityId },
              },
            },
          })),
        }
      : {}),
  },
  sitelinks: {
    enwiki: { site: 'enwiki', title: label },
  },
});

describe('wikidata-entity-mapper.util', () => {
  it('prefers parent public companies over subsidiaries sharing a website', () => {
    const parent = buildEntity({
      id: 'Q667505',
      label: 'Clariant',
      description: 'specialty chemicals company',
      website: 'http://www.clariant.com',
      instanceOf: ['Q4830453', 'Q891723'],
    });

    const subsidiary = buildEntity({
      id: 'Q140907657',
      label: 'Clariant (Japan)',
      description: 'company in Tokyo, Japan',
      website: 'https://www.clariant.com',
      instanceOf: ['Q4830453'],
      parentOrganization: ['Q667505'],
    });

    const parentScore = scoreWikidataCompanyCandidate({
      entity: parent,
      queryDomain: 'clariant.com',
    }).score;

    const subsidiaryScore = scoreWikidataCompanyCandidate({
      entity: subsidiary,
      queryDomain: 'clariant.com',
    }).score;

    expect(parentScore).toBeGreaterThan(subsidiaryScore);
  });

  it('prefers Dow Inc. holding company over Dow Chemical operating subsidiary', () => {
    const dowInc = buildEntity({
      id: 'Q62739842',
      label: 'Dow Inc.',
      description: 'American chemical company',
      website: 'https://www.dow.com',
      instanceOf: ['Q6881511', 'Q891723'],
    });

    const dowChemical = buildEntity({
      id: 'Q855639',
      label: 'Dow Chemical Company',
      description: 'American chemical company',
      website: 'http://www.dow.com',
      instanceOf: ['Q4830453', 'Q6881511', 'Q891723'],
      parentOrganization: ['Q62739842'],
    });

    expect(
      scoreWikidataCompanyCandidate({
        entity: dowInc,
        queryDomain: 'dow.com',
      }).score,
    ).toBeGreaterThan(
      scoreWikidataCompanyCandidate({
        entity: dowChemical,
        queryDomain: 'dow.com',
      }).score,
    );
  });

  it('maps entity claims into a company profile', () => {
    const entity = buildEntity({
      id: 'Q62739842',
      label: 'Dow Inc.',
      description: 'American chemical company',
      website: 'https://www.dow.com',
      instanceOf: ['Q891723', 'Q6881511'],
    });

    entity.claims = {
      ...entity.claims,
      P571: [
        {
          mainsnak: {
            datavalue: {
              type: 'time',
              value: { time: '+2019-04-01T00:00:00Z' },
            },
          },
        },
      ],
      P1128: [
        {
          mainsnak: {
            datavalue: {
              type: 'quantity',
              value: { amount: '+35700' },
            },
          },
        },
      ],
      P452: [
        {
          mainsnak: {
            datavalue: {
              type: 'wikibase-entityid',
              value: { id: 'Q207652' },
            },
          },
        },
      ],
      P414: [
        {
          mainsnak: {
            datavalue: {
              type: 'wikibase-entityid',
              value: { id: 'Q13677' },
            },
          },
          qualifiers: {
            P249: [
              {
                datavalue: { type: 'string', value: 'DOW' },
              },
            ],
          },
        },
      ],
    };

    const labelById = new Map<string, string>([
      ['Q207652', 'chemical industry'],
      ['Q13677', 'New York Stock Exchange'],
      ['Q891723', 'publicly traded company'],
      ['Q6881511', 'enterprise'],
    ]);

    const profile = mapWikidataEntityToCompanyProfile({
      entity,
      queryDomain: 'dow.com',
      labelById,
    });

    expect(profile.wikidataId).toBe('Q62739842');
    expect(profile.companyName).toBe('Dow Inc.');
    expect(profile.companyDomain).toBe('dow.com');
    expect(profile.foundedYear).toBe(2019);
    expect(profile.employeeCount).toBe(35700);
    expect(profile.industry).toBe('chemical industry');
    expect(profile.stockListing).toEqual({
      exchange: 'New York Stock Exchange',
      tickerSymbol: 'DOW',
    });
    expect(profile.dataSources).toEqual({
      wikidata: 'Q62739842',
      wikipedia: 'Dow Inc.',
    });
  });
});
