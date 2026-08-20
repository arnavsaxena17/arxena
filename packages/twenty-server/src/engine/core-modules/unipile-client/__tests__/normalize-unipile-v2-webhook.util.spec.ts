import { normalizeUnipileWebhookPayload } from '../normalize-unipile-v2-webhook.util';

describe('normalizeUnipileWebhookPayload', () => {
  it('maps v2 relation.new User Relation payload onto v1 new_relation fields', () => {
    const normalized = normalizeUnipileWebhookPayload({
      type: 'relation.new',
      account_id: 'acc_1',
      account_provider: 'LINKEDIN',
      payload: {
        id: 'rel_1',
        object: 'UserRelation',
        user: {
          id: 'ACoAAAEkwwAB',
          object: 'User',
          type: 'individual',
          display_name: 'Satya Nadella',
          first_name: 'Satya',
          last_name: 'Nadella',
          public_identifier: 'satyanadella',
          profile_url: 'https://www.linkedin.com/in/satyanadella/',
          public_picture_url: 'https://media.licdn.com/photo.jpg',
        },
      },
    });

    expect(normalized).toMatchObject({
      event: 'new_relation',
      account_id: 'acc_1',
      account_type: 'LINKEDIN',
      user_full_name: 'Satya Nadella',
      user_provider_id: 'ACoAAAEkwwAB',
      user_public_identifier: 'satyanadella',
      user_profile_url: 'https://www.linkedin.com/in/satyanadella/',
      user_picture_url: 'https://media.licdn.com/photo.jpg',
    });
  });

  it('falls back to first/last name and builds a LinkedIn profile URL', () => {
    const normalized = normalizeUnipileWebhookPayload({
      type: 'relation.new',
      account_id: 'acc_2',
      payload: {
        user: {
          id: 'provider-2',
          first_name: 'Ada',
          last_name: 'Lovelace',
          public_identifier: 'adalovelace',
        },
      },
    });

    expect(normalized).toMatchObject({
      event: 'new_relation',
      user_full_name: 'Ada Lovelace',
      user_provider_id: 'provider-2',
      user_public_identifier: 'adalovelace',
      user_profile_url: 'https://www.linkedin.com/in/adalovelace',
    });
  });
});
