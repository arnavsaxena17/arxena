import { parseApolloContactHintsFromPerson } from 'src/engine/core-modules/candidate-search/services/apollo-people-search-transformer.service';
import {
    ORGCHART_DATA_SOURCE_SLUG_APOLLO,
    orgChartProviderContactHintRowKeys,
} from 'src/engine/core-modules/org-chart/utils/merge-orgchart-profile-source-slugs.util';

const apolloContactKeys = orgChartProviderContactHintRowKeys(
  ORGCHART_DATA_SOURCE_SLUG_APOLLO,
);

describe('parseApolloContactHintsFromPerson', () => {
  it('reads has_email, has_direct_phone, and organization.has_phone', () => {
    const raw: Record<string, unknown> = {
      has_email: true,
      has_direct_phone: 'Yes',
      organization: {
        name: 'Microsoft',
        has_phone: true,
      },
    };
    expect(parseApolloContactHintsFromPerson(raw)).toEqual({
      [apolloContactKeys.hasEmail]: true,
      [apolloContactKeys.hasDirectPhone]: true,
      [apolloContactKeys.hasOrgPhone]: true,
    });
  });

  it('returns undefined for missing org', () => {
    expect(
      parseApolloContactHintsFromPerson({ has_email: false }),
    ).toEqual({
      [apolloContactKeys.hasEmail]: false,
      [apolloContactKeys.hasDirectPhone]: undefined,
      [apolloContactKeys.hasOrgPhone]: undefined,
    });
  });
});
