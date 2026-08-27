import {
  normalizeLinkedinProfileUrl,
  resolveAcceptedRelationIdentity,
  UNIPILE_NEW_RELATION_PAYLOAD_KEYS,
} from '../unipile-new-relation.util';
import { type UnipileNewRelationWebhook } from '../../types/unipile-webhook.types';

describe('unipile-new-relation.util', () => {
  const officialPayload: UnipileNewRelationWebhook = {
    event: 'new_relation',
    account_id: 'SDF4tGaPSPSzNe1D1xsOs',
    account_type: 'LINKEDIN',
    webhook_name: '',
    user_full_name: 'Satya Nadella',
    user_provider_id: 'ACoAAAEkwwAB9KEc2TrQgOLEQ-vzRyZeCDyc6DQ',
    user_public_identifier: 'satyanadella',
    user_profile_url: 'https://www.linkedin.com/in/satyanadella/',
    user_picture_url: 'https://media.licdn.com/example.jpg',
  };

  it('documents the official Unipile new_relation keys', () => {
    expect(UNIPILE_NEW_RELATION_PAYLOAD_KEYS).toEqual([
      'event',
      'account_id',
      'account_type',
      'webhook_name',
      'user_full_name',
      'user_provider_id',
      'user_public_identifier',
      'user_profile_url',
      'user_picture_url',
    ]);
  });

  it('resolves identity from the official Unipile payload', () => {
    expect(resolveAcceptedRelationIdentity(officialPayload)).toEqual({
      name: 'Satya Nadella',
      providerId: 'ACoAAAEkwwAB9KEc2TrQgOLEQ-vzRyZeCDyc6DQ',
      profileUrl: 'https://linkedin.com/in/satyanadella/',
      publicIdentifier: 'satyanadella',
    });
  });

  it('builds a profile URL from public identifier when user_profile_url is missing', () => {
    const identity = resolveAcceptedRelationIdentity({
      ...officialPayload,
      user_profile_url: undefined,
    });

    expect(identity?.profileUrl).toBe('https://linkedin.com/in/satyanadella');
  });

  it('returns null when neither profile URL nor public identifier is present', () => {
    expect(
      resolveAcceptedRelationIdentity({
        event: 'new_relation',
        account_id: 'acct-1',
        account_type: 'LINKEDIN',
      }),
    ).toBeNull();
  });

  it('normalizes a slug into a LinkedIn URL', () => {
    expect(normalizeLinkedinProfileUrl('satyanadella')).toBe(
      'https://linkedin.com/in/satyanadella',
    );
  });
});
